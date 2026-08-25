/**
 * POST /api/discover-internships
 *
 * Real discovery loop for MindCraft's Resume/JobOS feature (2026-08-22) —
 * closes the one gap that made this feature's "Apply today" board pure
 * scaffolding: there was no real search behind it, only an LLM-suggested
 * (company, role, why, query) tuple stub fed by resume-chat conversation
 * (JobOSStore.ingestFromJesse). This runs 2-3 REAL Google Custom Search
 * queries (the one real live-web-search capability in this repo, shared
 * with researchAgent.ts via lib/googleSearch.ts — no Anthropic web-search
 * tool exists here) and extracts genuinely evidenced candidates via Claude,
 * never inventing a posting that isn't backed by a real search result.
 *
 * Same auth+budget discipline as generate-lesson-outline.ts/generate-sim.ts:
 * verifyToken -> checkPlatformBudget -> checkAndRecordAttempt -> real call
 * -> recordActualSpend. NEVER writes to Firestore or JobOSStore itself —
 * returns candidates only. The client decides what reaches the board
 * (tap "Add to board"), matching this feature's existing "the board never
 * changes silently" discipline (JobOSStore.markApplied always requires a
 * real confirm; addRole is always an explicit client call).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { db } from '../firebase'
import { checkAndRecordAttempt, checkPlatformBudget, recordActualSpend } from '../generationBudget'
import { googleSearch, type SearchResult } from '../googleSearch'
import { studentGeminiComplete } from '../studentGemini'

const client = new Anthropic()
const MODEL = 'claude-haiku-4-5-20251001'

// Same published-rate cost accounting generate-lesson-outline.ts uses —
// real usage-based cost, not a flat per-call guess.
const INPUT_USD_PER_MTOK = 1.0
const OUTPUT_USD_PER_MTOK = 5.0

export interface InternshipCandidate {
  company: string
  role: string
  location: string
  why: string
  deadline: string | null
  roleUrl: string
  verificationStatus: 'link_verified' | 'unverified'
}

function buildQueries(grade: number | undefined, program: string | undefined, interests: string[], location: string | undefined): string[] {
  // High-school-appropriate phrasing, deliberately NOT "college internship"
  // — this codebase's existing Macalester seed data assumes a college
  // audience, but CLAUDE.md documents MindCraft's real students as high
  // schoolers, so discovery queries are scoped to what's actually
  // realistic and open to them (pre-college summer programs, teen research
  // programs, local junior placements), not a college-internship board.
  const topic = interests.length > 0 ? interests.slice(0, 3).join(' ') : (program ? `${program} prep` : 'STEM')
  const loc = location?.trim() || ''
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

function safeExtractionPrompt(searchBundle: { query: string; results: SearchResult[] }[]): string {
  const blocks = searchBundle
    .map(
      ({ query, results }) =>
        `QUERY: "${query}"\n` +
        results.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nSNIPPET: ${r.snippet}`).join('\n\n'),
    )
    .join('\n\n---\n\n')

  return `You are extracting REAL internship / summer-program candidates for a high-school student from real Google search results below. Every field you output must be directly evidenced by a specific search result — never invent a company, program, deadline, or URL that isn't in the text below.

${blocks}

Rules:
- Only include a candidate if a search result names a specific, real program or opportunity (not a generic "browse jobs" homepage).
- If a result's own URL is a direct posting/program page, use it as roleUrl and set verificationStatus to "link_verified". If you're inferring from a snippet that only implies a program exists but the URL is a generic homepage or aggregator, still include the candidate with your best URL, but set verificationStatus to "unverified" — never upgrade a guess to "link_verified".
- "why" must be one sentence describing why this fits a high schooler, grounded in the snippet text.
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
      .map((c) => ({
        company: String(c.company).slice(0, 120),
        role: String(c.role).slice(0, 160),
        location: typeof c.location === 'string' ? c.location.slice(0, 100) : '',
        why: typeof c.why === 'string' ? c.why.slice(0, 300) : '',
        deadline: typeof c.deadline === 'string' && c.deadline.trim() ? c.deadline.slice(0, 40) : null,
        roleUrl: typeof c.roleUrl === 'string' ? c.roleUrl.slice(0, 500) : '',
        verificationStatus: c.verificationStatus === 'link_verified' ? 'link_verified' : 'unverified',
      }))
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

  const body = (req.body || {}) as { grade?: number; program?: string; interests?: string[]; location?: string; studentGeminiKey?: string }
  const interests = Array.isArray(body.interests) ? body.interests.map(String).slice(0, 5) : []
  const { grade, program, location } = await resolveProfile(uid, body)
  const studentGeminiKey = typeof body.studentGeminiKey === 'string' ? body.studentGeminiKey.trim() : ''

  // BYOK does NOT bypass these checks here (unlike generate-lesson-outline.ts) -
  // this endpoint's real cost isn't only the LLM extraction call, it's 2-3
  // real Google Custom Search queries first (see file header), which a
  // student's Gemini key cannot pay for and which recordActualSpend below
  // has never tracked in costUsd anyway (a real, pre-existing gap, not
  // introduced or fixed here). Letting a student key skip the attempt cap
  // would mean unlimited free-to-them Search API usage against MindCraft's
  // own quota/billing - a real exposure the other BYOK'd handlers don't
  // share, so the cap stays active regardless of whether a key is present.
  const platformBudget = await checkPlatformBudget()
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
    const queries = buildQueries(grade, program, interests, location)
    const searchBundle = await Promise.all(
      queries.map(async (query) => ({ query, results: await googleSearch(query, 5).catch(() => []) })),
    )
    const totalResults = searchBundle.reduce((n, b) => n + b.results.length, 0)
    if (totalResults === 0) {
      return res.status(200).json({ status: 'ok', candidates: [], reason: 'No live search results this run' })
    }

    let text: string
    if (studentGeminiKey) {
      // Search cost still lands on the platform (see the checks above,
      // unconditionally run) - only the extraction call itself moves to
      // the student's key, so nothing to record here.
      text = await studentGeminiComplete(studentGeminiKey, safeExtractionPrompt(searchBundle), 1800)
    } else {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1800,
        messages: [{ role: 'user', content: safeExtractionPrompt(searchBundle) }],
      })
      const costUsd =
        (message.usage.input_tokens / 1_000_000) * INPUT_USD_PER_MTOK +
        (message.usage.output_tokens / 1_000_000) * OUTPUT_USD_PER_MTOK
      recordActualSpend(costUsd).catch((e) => {
        console.error('discover-internships: failed to record platform spend', e)
      })
      const textBlock = message.content.find((b) => b.type === 'text')
      text = textBlock && 'text' in textBlock ? textBlock.text : ''
    }
    const candidates = parseCandidates(text)
    return res.status(200).json({ status: 'ok', candidates })
  } catch (err) {
    console.error('[discover-internships] error:', err)
    return res.status(502).json({ status: 'error', reason: String(err) })
  }
}
