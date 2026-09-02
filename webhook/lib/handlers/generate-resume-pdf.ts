/**
 * POST /api/generate-resume-pdf
 *
 * Renders a ready-to-send PDF for the Resume Helper on Desk OS (2026-08-31):
 * either the student's resume (deterministic layout from the ResumeDraft the
 * resume-agent conversation already builds, no LLM, no platform spend) or a
 * per-role cover letter (short LLM-written body via the platform Gemini key
 * as of 2026-09-02, was Anthropic until that key was found out of credits
 * in production, same discovery as discover-internships.ts's fix; runs
 * behind the same auth+budget discipline as
 * generate-lesson-outline.ts/discover-internships.ts: verifyToken ->
 * checkPlatformBudget -> checkAndRecordAttempt -> real call, with an
 * honest template fallback that is labeled as such via the
 * x-mc-letter-source response header, never passed off as generated).
 *
 * PDF library choice: pdf-lib. Pure JS, no native modules, no font files, no
 * headless browser, about 1MB installed. api/tts.ts already sits near
 * Vercel's 250MB uncompressed function-size limit, so anything
 * Chromium-shaped (puppeteer, playwright-pdf) was off the table, and pdfkit
 * drags in fontkit plus AFM data. pdf-lib's StandardFonts cover a resume
 * fine.
 *
 * Never writes to Firestore. The client decides what to do with the bytes
 * (download) and owns any resumeReady/coverLetterReady bookkeeping on
 * users/{uid}/jobOS/state, matching the "board never changes silently"
 * discipline in JobOSStore.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
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

/** pdf-lib's WinAnsi standard fonts cannot encode every glyph students paste
 *  in (smart quotes survive, but emoji or CJK would throw). Replace anything
 *  outside Latin-1 with a plain space instead of failing the whole PDF. */
function enc(s: string): string {
  return s.replace(/[^ -~\u00a0-ÿ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = enc(text).split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(probe, size) <= maxWidth) {
      line = probe
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 54
const INK = rgb(0.1, 0.11, 0.12)
const SOFT = rgb(0.38, 0.4, 0.42)
const RULE = rgb(0.82, 0.84, 0.85)

class Sheet {
  doc: PDFDocument
  page: PDFPage
  y: number
  regular: PDFFont
  bold: PDFFont

  constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont) {
    this.doc = doc
    this.regular = regular
    this.bold = bold
    this.page = doc.addPage([PAGE_W, PAGE_H])
    this.y = PAGE_H - MARGIN
  }

  need(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_W, PAGE_H])
      this.y = PAGE_H - MARGIN
    }
  }

  text(s: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gapAfter?: number; indent?: number } = {}) {
    const size = opts.size ?? 10
    const font = opts.bold ? this.bold : this.regular
    const indent = opts.indent ?? 0
    const lines = wrap(s, font, size, PAGE_W - MARGIN * 2 - indent)
    for (const line of lines) {
      this.need(size + 4)
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y - size,
        size,
        font,
        color: opts.color ?? INK,
      })
      this.y -= size + 3
    }
    this.y -= opts.gapAfter ?? 0
  }

  heading(label: string) {
    this.need(30)
    this.y -= 10
    this.page.drawText(enc(label).toUpperCase(), {
      x: MARGIN,
      y: this.y - 9,
      size: 9,
      font: this.bold,
      color: SOFT,
    })
    this.y -= 14
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.7,
      color: RULE,
    })
    this.y -= 8
  }
}

async function newSheet(): Promise<Sheet> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  return new Sheet(doc, regular, bold)
}

export async function buildResumePdf(draftIn: DraftBody | undefined, linksIn: string[] = []): Promise<Uint8Array> {
  const d = clean(draftIn)
  const links = linksIn.map((l) => clip(l, 200)).filter(Boolean).slice(0, 6)
  const sheet = await newSheet()

  sheet.text(d.name || 'Your name', { size: 20, bold: true, gapAfter: 2 })
  if (d.headline) sheet.text(d.headline, { size: 11, color: SOFT, gapAfter: 2 })
  const contact = [d.email, d.location, d.school, d.linkedinUrl].filter(Boolean).join('  ·  ')
  if (contact) sheet.text(contact, { size: 9, color: SOFT })

  if (d.roles.length) {
    sheet.heading('Experience')
    for (const role of d.roles) {
      const head = [role.title, role.org].filter(Boolean).join(', ')
      if (!head) continue
      sheet.text(role.when ? `${head}  ·  ${role.when}` : head, { size: 10.5, bold: true })
      for (const bullet of role.bullets || []) sheet.text(`-  ${bullet}`, { size: 10, indent: 10 })
      sheet.y -= 5
    }
  }
  if (d.education.length || d.school) {
    sheet.heading('Education')
    const rows = d.education.length ? d.education : [d.school]
    for (const row of rows) sheet.text(row, { size: 10 })
  }
  if (d.projects.length) {
    sheet.heading('Projects')
    for (const p of d.projects) sheet.text(`-  ${p}`, { size: 10, indent: 10 })
  }
  if (d.skills.length) {
    sheet.heading('Skills')
    sheet.text(d.skills.join('  ·  '), { size: 10 })
  }
  if (links.length) {
    sheet.heading('Links')
    for (const l of links) sheet.text(l, { size: 9.5 })
  }
  return sheet.doc.save()
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
  // whatever paragraphs come back, see buildCoverLetterPdf below), but the
  // model does not reliably comply, confirmed empirically while wiring up
  // this Gemini switch: a real test call came back with its own "Dear
  // JPMorgan Hiring Team," opener and "Sincerely, Test Student" closer.
  // Left uncaught, that becomes a real paragraph via the split below and
  // doubles up with the wrapper's own greeting/sign-off in the final PDF.
  // Strip both defensively rather than trust prompt adherence.
  const cleaned = String(raw || '')
    .replace(/[\u2014\u2013]/g, ', ')
    .replace(/\r/g, '')
    .trim()
    .replace(/^(Dear[^\n]*,|Hello,|Hi[^\n]*,)\s*\n+/i, '')
    .replace(/\n+\s*(Sincerely|Best regards|Best|Regards|Warm regards|Thank you)[,.]?\s*\n+[\s\S]{0,80}$/i, '')
    .trim()
  const paragraphs = cleaned.split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean).slice(0, 4)
  if (paragraphs.length >= 2) return { paragraphs, source: 'llm' }
  return { paragraphs: templateLetterBody(d, role), source: 'template' }
}

export async function buildCoverLetterPdf(
  draftIn: DraftBody | undefined,
  role: TargetRole,
  paragraphs: string[],
): Promise<Uint8Array> {
  const d = clean(draftIn)
  const sheet = await newSheet()

  sheet.text(d.name || 'Your name', { size: 16, bold: true, gapAfter: 1 })
  const contact = [d.email, d.location].filter(Boolean).join('  ·  ')
  if (contact) sheet.text(contact, { size: 9, color: SOFT })
  sheet.y -= 14
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  sheet.text(today, { size: 10, color: SOFT, gapAfter: 10 })
  const target = [clip(role.role, 160), clip(role.company, 120)].filter(Boolean).join('  ·  ')
  if (target) sheet.text(`Re: ${target}`, { size: 10.5, bold: true, gapAfter: 10 })
  sheet.text(role.company ? `Dear ${clip(role.company, 120)} team,` : 'Hello,', { size: 10.5, gapAfter: 8 })
  for (const p of paragraphs) sheet.text(p, { size: 10.5, gapAfter: 8 })
  sheet.y -= 4
  sheet.text('Sincerely,', { size: 10.5, gapAfter: 2 })
  sheet.text(d.name || 'A MindCraft student', { size: 10.5, bold: true })
  return sheet.doc.save()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body = (req.body || {}) as PdfBody
  const kind = body.kind === 'coverLetter' ? 'coverLetter' : body.kind === 'resume' ? 'resume' : ''
  if (!kind) return res.status(400).json({ error: 'kind must be resume or coverLetter' })

  try {
    if (kind === 'resume') {
      // Deterministic layout, no model call, no platform spend: auth only.
      const bytes = await buildResumePdf(body.draft, Array.isArray(body.links) ? body.links.map(String) : [])
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"')
      return res.status(200).send(Buffer.from(bytes))
    }

    const role = body.role || {}
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

    const d = clean(body.draft)
    const key = typeof body.studentGeminiKey === 'string' ? body.studentGeminiKey.trim() : ''
    const { paragraphs, source } = await letterBody(d, role, key, body.byok)
    const bytes = await buildCoverLetterPdf(body.draft, role, paragraphs)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="cover-letter.pdf"')
    res.setHeader('x-mc-letter-source', source)
    return res.status(200).send(Buffer.from(bytes))
  } catch (err) {
    console.error('[generate-resume-pdf] error:', err)
    return res.status(502).json({ error: 'PDF generation failed' })
  }
}
