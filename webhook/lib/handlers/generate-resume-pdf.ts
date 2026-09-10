/**
 * POST /api/generate-resume-pdf
 *
 * Renders a ready-to-send Word document (.docx, 2026-09-02, was PDF until
 * the founder asked for editable files) for the Resume Helper on Desk OS:
 * either the student's resume (deterministic layout from the ResumeDraft
 * the resume-agent conversation already builds, no LLM, no platform
 * spend) or a per-role cover letter (short LLM-written body via the
 * platform Gemini key, was Anthropic until that key was found out of
 * credits in production; runs behind the same auth+budget discipline as
 * generate-lesson-outline.ts/discover-internships.ts: verifyToken ->
 * checkPlatformBudget -> checkAndRecordAttempt -> real call, with an
 * honest template fallback labeled as such via the x-mc-letter-source
 * response header, never passed off as generated).
 *
 * Route path kept as /api/generate-resume-pdf on purpose despite no
 * longer generating a PDF: this route is multiplexed through
 * api/app-actions.ts and mapped in vercel.json, and the client
 * (resumeHelper.js) fetches this exact URL, so renaming the route would
 * need three coordinated changes for a purely cosmetic gain. What
 * actually changed is the file format returned, not the endpoint.
 *
 * Library choice: docx (pure JS, no native modules, no font files, no
 * headless browser), same constraint pdf-lib was originally chosen
 * under (api/tts.ts already sits near Vercel's 250MB uncompressed
 * function-size limit). Real side benefit over the old PDF approach,
 * not just format-matching: Word's own text runs are full Unicode, so
 * the old enc()/wrap() functions that manually stripped anything
 * outside Latin-1 (pdf-lib's StandardFonts could not encode emoji or
 * CJK) are gone entirely, nothing to strip anymore.
 *
 * Never writes to Firestore. The client decides what to do with the
 * bytes (download) and owns any resumeReady/coverLetterReady
 * bookkeeping on users/{uid}/jobOS/state, matching the "board never
 * changes silently" discipline in JobOSStore.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BorderStyle, Document, Packer, Paragraph, TextRun } from 'docx'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { checkAndRecordAttempt, checkPlatformBudget } from '../generationBudget'
import { callGemini, callByok, type ByokChatOptions } from '../llmChat'
import { studentGeminiComplete } from '../studentGemini'

interface DraftRole {
  title?: string
  org?: string
  when?: string
  bullets?: string[]
}

interface DraftBody {
  name?: string
  headline?: string
  school?: string
  email?: string
  location?: string
  skills?: string[]
  roles?: DraftRole[]
  education?: string[]
  projects?: string[]
  linkedinUrl?: string
}

interface TargetRole {
  company?: string
  role?: string
  location?: string
  why?: string
  roleUrl?: string
}

interface PdfBody {
  kind?: string
  draft?: DraftBody
  role?: TargetRole
  links?: string[]
  studentGeminiKey?: string
  // Tried only after studentGeminiKey and the platform Anthropic call both
  // give up, same 2026-09-01 addition as resume-agent.ts, see callByok's
  // own comment in llmChat.ts.
  byok?: {
    provider?: string
    apiKey?: string
    model?: string
    baseUrl?: string
  }
}

function toByokOptions(byok: PdfBody['byok'], system: string): ByokChatOptions | null {
  const provider = byok?.provider
  if (!byok?.apiKey || !(provider === 'openai' || provider === 'groq' || provider === 'gemini' || provider === 'openrouter' || provider === 'anthropic' || provider === 'custom')) return null
  return {
    provider,
    apiKey: clip(byok.apiKey, 200),
    model: byok.model ? clip(byok.model, 80) : undefined,
    baseUrl: byok.baseUrl ? clip(byok.baseUrl, 300) : undefined,
    maxTokens: 600,
    temperature: 0.5,
    system,
  }
}

function clip(s: unknown, n: number): string {
  return String(s ?? '').replace(/\u0000/g, '').trim().slice(0, n)
}

function clean(draft: DraftBody | undefined): Required<DraftBody> {
  const d = draft || {}
  return {
    name: clip(d.name, 80),
    headline: clip(d.headline, 180),
    school: clip(d.school, 120),
    email: clip(d.email, 120),
    location: clip(d.location, 80),
    skills: (Array.isArray(d.skills) ? d.skills : []).map((s) => clip(s, 60)).filter(Boolean).slice(0, 24),
    roles: (Array.isArray(d.roles) ? d.roles : []).slice(0, 12).map((r) => ({
      title: clip(r?.title, 80),
      org: clip(r?.org, 80),
      when: clip(r?.when, 60),
      bullets: (Array.isArray(r?.bullets) ? r.bullets : []).map((b) => clip(b, 200)).filter(Boolean).slice(0, 5),
    })),
    education: (Array.isArray(d.education) ? d.education : []).map((e) => clip(e, 160)).filter(Boolean).slice(0, 8),
    projects: (Array.isArray(d.projects) ? d.projects : []).map((p) => clip(p, 200)).filter(Boolean).slice(0, 8),
    linkedinUrl: clip(d.linkedinUrl, 200),
  }
}

const INK = '1a1c1f'
const SOFT = '61696d'
const RULE = 'd1d6d9'

/** Section heading styled like the old PDF's (small caps label, soft
 *  gray, a thin rule underneath via a paragraph border), one Paragraph. */
function heading(label: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 18, color: SOFT })],
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
  })
}

function body(text: string, opts: { bold?: boolean; size?: number; color?: string; indent?: number; spacingAfter?: number } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 20, color: opts.color ?? INK })],
    indent: opts.indent ? { left: opts.indent } : undefined,
    spacing: { after: opts.spacingAfter ?? 60 },
  })
}

export async function buildResumeDocx(draftIn: DraftBody | undefined, linksIn: string[] = []): Promise<Buffer> {
  const d = clean(draftIn)
  const links = linksIn.map((l) => clip(l, 200)).filter(Boolean).slice(0, 6)
  const children: Paragraph[] = []

  children.push(new Paragraph({
    children: [new TextRun({ text: d.name || 'Your name', bold: true, size: 40 })],
    spacing: { after: 40 },
  }))
  if (d.headline) children.push(body(d.headline, { size: 22, color: SOFT, spacingAfter: 40 }))
  const contact = [d.email, d.location, d.school, d.linkedinUrl].filter(Boolean).join('  |  ')
  if (contact) children.push(body(contact, { size: 18, color: SOFT, spacingAfter: 200 }))

  if (d.roles.length) {
    children.push(heading('Experience'))
    for (const role of d.roles) {
      const head = [role.title, role.org].filter(Boolean).join(', ')
      if (!head) continue
      children.push(body(role.when ? `${head}  |  ${role.when}` : head, { bold: true, size: 21, spacingAfter: 40 }))
      for (const bullet of role.bullets || []) children.push(body(`-  ${bullet}`, { indent: 200, spacingAfter: 40 }))
      children.push(new Paragraph({ children: [], spacing: { after: 80 } }))
    }
  }
  if (d.education.length || d.school) {
    children.push(heading('Education'))
    const rows = d.education.length ? d.education : [d.school]
    for (const row of rows) children.push(body(row))
  }
  if (d.projects.length) {
    children.push(heading('Projects'))
    for (const p of d.projects) children.push(body(`-  ${p}`, { indent: 200 }))
  }
  if (d.skills.length) {
    children.push(heading('Skills'))
    children.push(body(d.skills.join('  |  ')))
  }
  if (links.length) {
    children.push(heading('Links'))
    for (const l of links) children.push(body(l, { size: 19 }))
  }

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}

/** Deterministic body used when no LLM reply is available. Plain, honest,
 *  and clearly labeled by the caller (x-mc-letter-source: template). */
function templateLetterBody(d: Required<DraftBody>, role: TargetRole): string[] {
  const target = [role.role, role.company].filter(Boolean).join(' at ') || 'this opportunity'
  const p1 = `I am writing to apply for ${target}. I am a student${d.school ? ` at ${d.school}` : ''}${d.location ? ` based in ${d.location}` : ''}, and this opportunity fits what I am building toward.`
  const skillLine = d.skills.slice(0, 4).join(', ')
  const roleLine = d.roles[0] ? `My most recent experience is ${[d.roles[0].title, d.roles[0].org].filter(Boolean).join(' with ')}.` : ''
  const p2 = [
    skillLine ? `I bring real practice with ${skillLine}.` : '',
    roleLine,
    role.why ? `This role stood out because ${role.why.replace(/\.$/, '')}.` : '',
  ].filter(Boolean).join(' ')
  const p3 = 'My resume is attached. I would be glad to talk about how I can contribute, and I appreciate your consideration.'
  return [p1, p2, p3].filter(Boolean)
}

const LETTER_SYSTEM = `You write short cover letters for a HIGH SCHOOL student applying to programs and junior roles.
Rules:
- Exactly 3 short paragraphs, plain text, separated by blank lines. No greeting line, no sign-off, no placeholders like [Company].
- Use ONLY facts given in the JSON (skills, roles, school, projects). Never invent employers, dates, GPAs, or achievements.
- Sound like a real student: direct, warm, specific. Not corporate. No emoji, no exclamation marks, no em dashes.
- 120 to 180 words total.`

async function letterBody(
  d: Required<DraftBody>,
  role: TargetRole,
  studentGeminiKey: string,
  byok: PdfBody['byok'],
): Promise<{ paragraphs: string[]; source: 'llm' | 'template' }> {
  const user = JSON.stringify({
    student: { name: d.name, school: d.school, location: d.location, skills: d.skills, roles: d.roles, projects: d.projects, headline: d.headline },
    applyingTo: { company: clip(role.company, 120), role: clip(role.role, 160), location: clip(role.location, 100), why: clip(role.why, 300) },
  })
  let raw: string | null = null
  try {
    if (studentGeminiKey) {
      raw = await studentGeminiComplete(studentGeminiKey, `${LETTER_SYSTEM}\n\n${user}`, 600)
    } else {
      // Platform fallback switched from callAnthropic to callGemini
      // (2026-09-02): the platform ANTHROPIC_API_KEY was found out of
      // credits in production (same discovery as discover-internships.ts's
      // fix, confirmed via Vercel logs), so this call was failing on every
      // real cover letter request, silently falling through to the
      // template body every time instead of a real generated letter.
      raw = await callGemini(user, { system: LETTER_SYSTEM, maxTokens: 600 })
      // Tried last, and only costs the platform budget nothing either way,
      // since it is the student's own key.
      if (!raw) {
        const byokOptions = toByokOptions(byok, LETTER_SYSTEM)
        if (byokOptions) raw = await callByok(user, byokOptions)
      }
    }
  } catch {
    raw = null
  }
  // The system prompt asks for no greeting line and no sign-off (this file
  // already adds its own "Dear X team," and "Sincerely, Name" around
  // whatever paragraphs come back, see buildCoverLetterDocx below), but
  // the model does not reliably comply, confirmed empirically while
  // wiring up the Gemini switch: a real test call came back with its own
  // "Dear JPMorgan Hiring Team," opener and "Sincerely, Test Student"
  // closer. Left uncaught, that becomes a real paragraph via the split
  // below and doubles up with the wrapper's own greeting/sign-off in the
  // final document. Strip both defensively rather than trust prompt
  // adherence.
  const cleaned = String(raw || '')
    .replace(/[—–]/g, ', ')
    .replace(/\r/g, '')
    .trim()
    .replace(/^(Dear[^\n]*,|Hello,|Hi[^\n]*,)\s*\n+/i, '')
    .replace(/\n+\s*(Sincerely|Best regards|Best|Regards|Warm regards|Thank you)[,.]?\s*\n+[\s\S]{0,80}$/i, '')
    .trim()
  const paragraphs = cleaned.split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean).slice(0, 4)
  if (paragraphs.length >= 2) return { paragraphs, source: 'llm' }
  return { paragraphs: templateLetterBody(d, role), source: 'template' }
}

export async function buildCoverLetterDocx(
  draftIn: DraftBody | undefined,
  role: TargetRole,
  paragraphs: string[],
): Promise<Buffer> {
  const d = clean(draftIn)
  const children: Paragraph[] = []

  children.push(new Paragraph({ children: [new TextRun({ text: d.name || 'Your name', bold: true, size: 32 })], spacing: { after: 20 } }))
  const contact = [d.email, d.location].filter(Boolean).join('  |  ')
  if (contact) children.push(body(contact, { size: 18, color: SOFT, spacingAfter: 280 }))
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  children.push(body(today, { size: 20, color: SOFT, spacingAfter: 200 }))
  const target = [clip(role.role, 160), clip(role.company, 120)].filter(Boolean).join('  |  ')
  if (target) children.push(body(`Re: ${target}`, { bold: true, size: 21, spacingAfter: 200 }))
  children.push(body(role.company ? `Dear ${clip(role.company, 120)} team,` : 'Hello,', { size: 21, spacingAfter: 160 }))
  for (const p of paragraphs) children.push(body(p, { size: 21, spacingAfter: 160 }))
  children.push(body('Sincerely,', { size: 21, spacingAfter: 40 }))
  children.push(body(d.name || 'A MindCraft student', { bold: true, size: 21 }))

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body_ = (req.body || {}) as PdfBody
  const kind = body_.kind === 'coverLetter' ? 'coverLetter' : body_.kind === 'resume' ? 'resume' : ''
  if (!kind) return res.status(400).json({ error: 'kind must be resume or coverLetter' })

  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  try {
    if (kind === 'resume') {
      // Deterministic layout, no model call, no platform spend: auth only.
      const bytes = await buildResumeDocx(body_.draft, Array.isArray(body_.links) ? body_.links.map(String) : [])
      res.setHeader('Content-Type', DOCX_MIME)
      res.setHeader('Content-Disposition', 'attachment; filename="resume.docx"')
      return res.status(200).send(bytes)
    }

    const role = body_.role || {}
    if (!clip(role.company, 120) && !clip(role.role, 160)) {
      return res.status(400).json({ error: 'coverLetter needs a role with company or role' })
    }

    // Cover letters call a model, so the full budget discipline applies,
    // exactly like discover-internships.ts. A student Gemini key moves the
    // model cost to the student but does not skip the caps (same
    // conservative stance as discover-internships, one shared discipline).
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

    const d = clean(body_.draft)
    const key = typeof body_.studentGeminiKey === 'string' ? body_.studentGeminiKey.trim() : ''
    const { paragraphs, source } = await letterBody(d, role, key, body_.byok)
    const bytes = await buildCoverLetterDocx(body_.draft, role, paragraphs)
    res.setHeader('Content-Type', DOCX_MIME)
    res.setHeader('Content-Disposition', 'attachment; filename="cover-letter.docx"')
    res.setHeader('x-mc-letter-source', source)
    return res.status(200).send(bytes)
  } catch (err) {
    console.error('[generate-resume-pdf] error:', err)
    return res.status(502).json({ error: 'Document generation failed' })
  }
}
