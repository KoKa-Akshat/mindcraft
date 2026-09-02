/**
 * POST /api/discover-internships
 *
 * Real discovery loop for MindCraft's Resume/JobOS feature (2026-08-22) —
 * closes the one gap that made this feature's "Apply today" board pure
 * scaffolding: there was no real search behind it, only an LLM-suggested
 * (company, role, why, query) tuple stub fed by resume-chat conversation
 * (JobOSStore.ingestFromJesse). This runs 2-3 REAL web searches via
 * lib/googleSearch.ts (Serper as of 2026-09-02, shared with
 * researchAgent.ts — the one real live-web-search capability in this
 * repo) and extracts genuinely evidenced candidates via the platform
 * Gemini key (callGemini, also switched 2026-09-02 after the platform
 * Anthropic key was found out of credits in production), never inventing
 * a posting that isn't backed by a real search result.
 *
 * Auth+budget discipline (search cost) same as
 * generate-lesson-outline.ts/generate-sim.ts: verifyToken ->
 * checkPlatformBudget -> checkAndRecordAttempt -> real call. No per-call
 * cost tracking on the extraction step itself, callGemini/
 * studentGeminiComplete's usage is cheap enough this file does not meter
 * it the way the old Anthropic call was metered. NEVER writes to
 * Firestore or JobOSStore itself — returns candidates only. The client
 * decides what reaches the board (tap "Add to board"), matching this
 * feature's existing "the board never changes silently" discipline
 * (JobOSStore.markApplied always requires a real confirm; addRole is
 * always an explicit client call).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { db } from '../firebase'
import { checkAndRecordAttempt, checkPlatformBudget } from '../generationBudget'
import { googleSearch, type SearchResult } from '../googleSearch'
import { studentGeminiComplete } from '../studentGemini'
import { callGemini } from '../llmChat'
import { matchAlumniCompanies, isAlumniCompany } from '../alumniCompanies'

export interface InternshipCandidate {
  company: string
  role: string
  location: string
  why: string
  deadline: string | null
  roleUrl: string
  verificationStatus: 'link_verified' | 'unverified'
  // Real signal, not decorative (2026-09-02): true only when the extracted
  // company name matches a real Macalester alumni employer (see
  // lib/alumniCompanies.ts), so the client can show "an alum works here"
  // instead of leaving that connection invisible after the alumni-weighted
  // query already found it.
  alumniConnection: boolean
}

// Age-aware phrasing (2026-09-02): this used to unconditionally assume
// every student is a high schooler, phrasing every query as "teen research
// internship" / "pre-college program", regardless of who was actually
// asking. resume-agent.ts's own suggestFromDraft() fallback was fixed for
// this exact bug on 2026-09-01 (see its own doc comment, which names this
// function as the original source of the assumption) but this function,
// the one that actually runs the real search, was never updated to match.
// Same 19+ threshold, same "stay conservative, do not sniff experience out
// of free text" reasoning as that fix.
function buildQueries(age: number | undefined, grade: number | undefined, program: string | undefined, interests: string[], location: string | undefined): string[] {
  const topic = interests.length > 0 ? interests.slice(0, 3).join(' ') : (program ? `${program} prep` : 'STEM')
  const loc = location?.trim() || ''
  const isCollege = typeof age === 'number' && age >= 19
  if (isCollege) {
    // Alumni-weighted queries (2026-09-02): real Macalester alumni employer
    // data (see lib/alumniCompanies.ts for what this is and is not), matched
    // against the student's own topic. Put first when there is a real match,
    // since a company an alumnus actually works at is a stronger, more
    // specific lead than a generic "college student apply" query, generic
    // queries still run as the remaining slots (also a real safety net when
    // nothing matches, matchAlumniCompanies returns empty, not a guess).
    const alumniMatches = matchAlumniCompanies(topic, 2)
    const queries = [
      ...alumniMatches.map((company) => `${topic} internship ${company} apply`),
      `${topic} internship college student apply`,
      `entry level ${topic} job new grad ${loc}`.trim(),
      `${topic} internship ${loc}`.trim(),
    ]
    return queries.slice(0, 3)
  }
  const gradeHint = grade ? `high school grade ${grade}` : 'high school student'
  const queries = [
    `${topic} summer program for ${gradeHint} 2027 apply`,
    `${topic} teen research internship high schoolers ${loc}`.trim(),
    `pre-college ${topic} program high school students apply now`,
  ]
  return queries.slice(0, 3)
}

async function resolveProfile(uid: string, body: { grade?: number; program?: string; location?: string }) {
  // Same two-source precedent as generate-lesson-outline.ts: a
  // request-supplied value (what the student just said) wins; falls back
  // to the durable users/{uid} profile; fails open rather than blocking.
  let grade = typeof body.grade === 'number' && Number.isInteger(body.grade) && body.grade >= 1 && body.grade <= 12 ? body.grade : undefined
  let program = typeof body.program === 'string' && body.program.trim() ? body.program.trim() : undefined
  let location = typeof body.location === 'string' && body.location.trim() ? body.location.trim() : undefined
  if (grade === undefined || program === undefined) {
    try {
      const snap = await db.collection('users').doc(uid).get()
      const data = snap.data()
      if (grade === undefined && typeof data?.grade === 'number') grade = data.grade
      if (program === undefined && typeof data?.program === 'string') program = data.program
    } catch (e) {
      console.error('discover-internships: failed to read student profile', e)
    }
  }
  return { grade, program, location }
}

function safeExtractionPrompt(searchBundle: { query: string; results: SearchResult[] }[], isCollege: boolean): string {
  const blocks = searchBundle
    .map(
      ({ query, results }) =>
        `QUERY: "${query}"\n` +
        results.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nSNIPPET: ${r.snippet}`).join('\n\n'),
    )
    .join('\n\n---\n\n')

  const audience = isCollege ? 'a college student' : 'a high-school student'
  return `You are extracting REAL internship / job candidates for ${audience} from real Google search results below. Every field you output must be directly evidenced by a specific search result — never invent a company, program, deadline, or URL that isn't in the text below.

${blocks}

Rules:
- Only include a candidate if a search result names a specific, real program or opportunity (not a generic "browse jobs" homepage).
- If a result's own URL is a direct posting/program page, use it as roleUrl and set verificationStatus to "link_verified". If you're inferring from a snippet that only implies a program exists but the URL is a generic homepage or aggregator, still include the candidate with your best URL, but set verificationStatus to "unverified" — never upgrade a guess to "link_verified".
- "why" must be one sentence describing why this fits ${audience}, grounded in the snippet text.
- Return 0-6 candidates. Zero is a completely valid and expected answer if nothing in the results is a real, specific opportunity.

Return ONLY a JSON array, no prose, no markdown fences:
[{"company":"","role":"","location":"","why":"","deadline":null,"roleUrl":"","verificationStatus":"link_verified"}]`
}

function parseCandidates(text: string): InternshipCandidate[] {
  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((c) => c && typeof c.company === 'string' && typeof c.role === 'string' && c.company.trim() && c.role.trim())
      .slice(0, 6)
      .map((c) => {
        const company = String(c.company).slice(0, 120)
        return {
          company,
          role: String(c.role).slice(0, 160),
          location: typeof c.location === 'string' ? c.location.slice(0, 100) : '',
          why: typeof c.why === 'string' ? c.why.slice(0, 300) : '',
          deadline: typeof c.deadline === 'string' && c.deadline.trim() ? c.deadline.slice(0, 40) : null,
          roleUrl: typeof c.roleUrl === 'string' ? c.roleUrl.slice(0, 500) : '',
          verificationStatus: c.verificationStatus === 'link_verified' ? 'link_verified' : 'unverified',
          alumniConnection: isAlumniCompany(company),
        }
      })
  } catch {
    return []
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body = (req.body || {}) as { grade?: number; program?: string; interests?: string[]; location?: string; studentGeminiKey?: string; age?: string | number }
  const interests = Array.isArray(body.interests) ? body.interests.map(String).slice(0, 5) : []
  const { grade, program, location } = await resolveProfile(uid, body)
  const studentGeminiKey = typeof body.studentGeminiKey === 'string' ? body.studentGeminiKey.trim() : ''
  const parsedAge = typeof body.age === 'number' ? body.age : parseInt(String(body.age ?? ''), 10)
  const age = Number.isFinite(parsedAge) ? parsedAge : undefined

  // BYOK does NOT bypass these checks here (unlike generate-lesson-outline.ts) -
  // this endpoint's real cost isn't only the LLM extraction call, it's 2-3
  // real search queries first (see file header), which a student's Gemini
  // key cannot pay for. Letting a student key skip the attempt cap
  // would mean unlimited free-to-them Search API usage against MindCraft's
  // own quota/billing - a real exposure the other BYOK'd handlers don't
  // share, so the cap stays active regardless of whether a key is present.
  const platformBudget = await checkPlatformBudget(uid)
  if (!platformBudget.allowed) {
    return res.status(429).json({
      status: 'rate_limited',
      reason: `This closed test's monthly generation budget is used up ($${platformBudget.spentThisMonthUsd.toFixed(2)}/$${platformBudget.capUsd}). It resets next month.`,
    })
  }
  const studentBudget = await checkAndRecordAttempt(uid)
  if (!studentBudget.allowed) {
    return res.status(429).json({
      status: 'rate_limited',
      reason: `Daily generation limit reached (${studentBudget.attemptsToday}/${studentBudget.cap}).`,
    })
  }

  try {
    const isCollege = typeof age === 'number' && age >= 19
    const queries = buildQueries(age, grade, program, interests, location)
    const searchBundle = await Promise.all(
      queries.map(async (query) => ({ query, results: await googleSearch(query, 5).catch(() => []) })),
    )
    const totalResults = searchBundle.reduce((n, b) => n + b.results.length, 0)
    if (totalResults === 0) {
      return res.status(200).json({ status: 'ok', candidates: [], reason: 'No live search results this run' })
    }

    // Platform extraction now goes through Gemini, not Anthropic (2026-09-02):
    // the platform ANTHROPIC_API_KEY was found out of credits in production
    // (confirmed via Vercel logs: "Your credit balance is too low to access
    // the Anthropic API"), so this endpoint was failing on every single
    // real search, silently to the student ("Search did not come back").
    // callGemini never throws, returns null on any failure (including no
    // key configured), same contract studentGeminiComplete already has, so
    // a Gemini-side failure here reads as zero candidates, an honest
    // answer this file already treats as valid, not a 502.
    const text = studentGeminiKey
      ? await studentGeminiComplete(studentGeminiKey, safeExtractionPrompt(searchBundle, isCollege), 1800)
      : (await callGemini(safeExtractionPrompt(searchBundle, isCollege), { system: '', maxTokens: 1800 })) ?? ''
    const candidates = parseCandidates(text)
    return res.status(200).json({ status: 'ok', candidates })
  } catch (err) {
    console.error('[discover-internships] error:', err)
    return res.status(502).json({ status: 'error', reason: String(err) })
  }
}
