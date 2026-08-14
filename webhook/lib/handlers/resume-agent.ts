/**
 * POST /api/resume-agent
 *
 * Jesse: extract a private resume draft from LinkedIn paste/PDF, Drive
 * folder text, and uploaded resume, then speak a short guided reply.
 * Client waits ≥5s before playing voice. Does not invent employers.
 *
 * Routed through app-actions (Hobby function cap). Optional Firebase auth.
 * No Firestore write unless a verified uid is present (not in v1).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../cors'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const WAIT_MS = 5000
const MAX_SOURCE = 24000

export interface ResumeRole {
  title: string
  org: string
  when: string
  bullets: string[]
}

export interface ResumeDraft {
  name: string
  headline: string
  school: string
  email: string
  location: string
  skills: string[]
  roles: ResumeRole[]
  education: string[]
  projects: string[]
  files: string[]
  linkedinUrl: string
  drive: boolean
}

export interface SuggestedRole {
  company: string
  role: string
  why: string
  query: string
}

interface ResumeAgentBody {
  message?: string
  draft?: Partial<ResumeDraft>
  sources?: {
    linkedinUrl?: string
    linkedinText?: string
    driveFiles?: { name?: string; text?: string }[]
    resumeText?: string
    resumeFileName?: string
  }
}

const EMPTY_DRAFT: ResumeDraft = {
  name: '',
  headline: '',
  school: '',
  email: '',
  location: '',
  skills: [],
  roles: [],
  education: [],
  projects: [],
  files: [],
  linkedinUrl: '',
  drive: false,
}

function clip(s: unknown, n: number): string {
  return String(s || '').replace(/\u0000/g, '').slice(0, n)
}

function uniq(list: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    const t = String(raw || '').trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

function mergeDraft(base: ResumeDraft, next: Partial<ResumeDraft> | null | undefined): ResumeDraft {
  const b = { ...EMPTY_DRAFT, ...base }
  const n = next || {}
  const roles = Array.isArray(n.roles) && n.roles.length ? n.roles : b.roles
  return {
    name: clip(n.name, 80) || b.name,
    headline: clip(n.headline, 180) || b.headline,
    school: clip(n.school, 120) || b.school,
    email: clip(n.email, 120) || b.email,
    location: clip(n.location, 80) || b.location,
    skills: uniq([...(b.skills || []), ...((n.skills as string[]) || [])]).slice(0, 24),
    roles: (roles || []).slice(0, 12).map((r) => ({
      title: clip(r.title, 80),
      org: clip(r.org, 80),
      when: clip(r.when, 60),
      bullets: (r.bullets || []).map((x) => clip(x, 180)).filter(Boolean).slice(0, 5),
    })),
    education: uniq([...(b.education || []), ...((n.education as string[]) || [])]).slice(0, 8),
    projects: uniq([...(b.projects || []), ...((n.projects as string[]) || [])]).slice(0, 8),
    files: uniq([...(b.files || []), ...((n.files as string[]) || [])]).slice(0, 12),
    linkedinUrl: clip(n.linkedinUrl, 200) || b.linkedinUrl,
    drive: Boolean(n.drive || b.drive),
  }
}

function draftReady(d: ResumeDraft): boolean {
  return Boolean(d.name) && (d.roles.length > 0 || d.skills.length >= 2)
}

function sanitizeReply(text: string): string {
  return text
    .replace(/—/g, '-')
    .replace(/[!]{1,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 420)
}

function heuristicExtract(message: string, sources: ResumeAgentBody['sources'], prior: ResumeDraft): ResumeDraft {
  const blob = [
    message,
    sources?.linkedinUrl,
    sources?.linkedinText,
    sources?.resumeText,
    sources?.resumeFileName,
    ...(sources?.driveFiles || []).map((f) => `${f.name}\n${f.text}`),
  ]
    .filter(Boolean)
    .join('\n')

  const email = blob.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || prior.email
  const li = (sources?.linkedinUrl || blob.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+/i)?.[0] || prior.linkedinUrl).replace(/\/$/, '')

  const skillHits = ['Python', 'R', 'Excel', 'SQL', 'Stata', 'Java', 'JavaScript', 'TypeScript', 'Tutoring', 'Writing', 'Research', 'Tableau', 'PowerPoint', 'Spanish', 'French']
    .filter((s) => new RegExp(`\\b${s}\\b`, 'i').test(blob))

  const nameLine = blob.split('\n').map((l) => l.trim()).find((l) => /^[A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(l)) || ''
  const school =
    blob.match(/Macalester College|University of [A-Z][a-z]+|College of [A-Z][a-zA-Z ]+/i)?.[0] || prior.school

  const files = uniq([
    ...prior.files,
    sources?.resumeFileName || '',
    ...((sources?.driveFiles || []).map((f) => String(f.name || ''))),
  ])

  return mergeDraft(prior, {
    name: prior.name || nameLine,
    email,
    school,
    linkedinUrl: li,
    skills: skillHits,
    files,
    drive: prior.drive || Boolean(sources?.driveFiles?.length),
    headline: prior.headline,
  })
}

function heuristicReply(draft: ResumeDraft, message: string): { reply: string; suggestedRoles: SuggestedRole[] } {
  const t = message.toLowerCase()
  if (/apply|job|let's go|lets go|ready/.test(t) && draftReady(draft)) {
    return {
      reply: `The draft is on your desk. We can look for ${draft.skills.slice(0, 2).join(' and ') || 'intern'} roles next.`,
      suggestedRoles: suggestFromDraft(draft),
    }
  }
  if (draft.roles.length) {
    return {
      reply: `Pulled ${draft.roles[0].org || 'your roles'} into a private draft. Tell me what to add or cut.`,
      suggestedRoles: suggestFromDraft(draft),
    }
  }
  if (draft.skills.length) {
    return {
      reply: `Added ${draft.skills.slice(0, 3).join(', ')}. Name a role if you want it on the page.`,
      suggestedRoles: [],
    }
  }
  return {
    reply: 'I heard you. Paste LinkedIn, open The Desk Drive folder, or upload a PDF and I will place what is useful.',
    suggestedRoles: [],
  }
}

function suggestFromDraft(d: ResumeDraft): SuggestedRole[] {
  const skills = d.skills.slice(0, 3).join(' ')
  const school = d.school || 'college'
  const out: SuggestedRole[] = []
  if (/R\b|Excel|SQL|Stata|Python|research/i.test(skills + JSON.stringify(d.roles))) {
    out.push({
      company: 'Research / data internships',
      role: 'Research assistant or data intern',
      why: 'Matches methods and tools already on the draft.',
      query: `${school} research assistant intern ${skills}`.trim(),
    })
  }
  if (/tutor|teaching|writing/i.test(skills + JSON.stringify(d.roles))) {
    out.push({
      company: 'Education / tutoring',
      role: 'Tutor or academic support',
      why: 'You already teach or write on the page.',
      query: `tutor intern ${school}`.trim(),
    })
  }
  out.push({
    company: 'Handshake / LinkedIn jobs',
    role: 'Internship matching your headline',
    why: 'Search from the draft, then log Applied on the board.',
    query: `${d.headline || 'internship'} ${school}`.trim(),
  })
  return out.slice(0, 3)
}

const SYSTEM = `You are Jesse, the resume agent on The Desk by MindCraft.
You help a student build a resume that sounds like them. Friendly, certain, short. Like a calm older sibling on a call. Not peppy. Not a recruiter bot.

Rules:
- Reply in 1-3 spoken sentences. No emoji. No exclamation marks. No em dashes.
- Never invent employers, dates, GPAs, or skills that are not in SOURCES or the student's words.
- Extract only useful resume facts: name, headline, school, email, location, skills, roles (title, org, when, 1-3 bullets), education, projects.
- LinkedIn OpenID does not include Experience. Experience comes from pasted About/Experience, a LinkedIn PDF, Drive files, or the call.
- Drive is folder-scoped: only files from The Desk folder. Say that when Drive is used.
- The draft is private on their desk. Data stays in accounts they already own.
- If the draft has a name plus at least one role or two skills, set readyToApply true and suggest up to 3 role DIRECTIONS (search queries), not fake job postings with fake URLs.
- If they ask to apply, set action open_apply.
- If sources are thin, ask for one next step: LinkedIn paste, Drive folder, or PDF.

Return ONLY JSON:
{"reply":"...","draft":{"name":"","headline":"","school":"","email":"","location":"","skills":[],"roles":[{"title":"","org":"","when":"","bullets":[]}],"education":[],"projects":[],"files":[],"linkedinUrl":"","drive":false},"readyToApply":false,"suggestedRoles":[{"company":"","role":"","why":"","query":""}],"action":""}`

function parseModelJson(raw: string): {
  reply?: string
  draft?: Partial<ResumeDraft>
  readyToApply?: boolean
  suggestedRoles?: SuggestedRole[]
  action?: string
} | null {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1))
  } catch {
    return null
  }
}

async function callAnthropic(user: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1400,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    })
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.Messages.TextBlock).text)
      .join('')
      .trim()
  } catch {
    return null
  }
}

async function callGroq(user: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 1400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as ResumeAgentBody
  const message = clip(body.message, 2000).trim()
  if (!message) return res.status(400).json({ error: 'No message' })

  const sources = body.sources || {}
  const prior = mergeDraft(EMPTY_DRAFT, body.draft)
  const linkedinText = clip(sources.linkedinText, MAX_SOURCE)
  const resumeText = clip(sources.resumeText, MAX_SOURCE)
  const driveFiles = (sources.driveFiles || []).slice(0, 6).map((f) => ({
    name: clip(f.name, 120),
    text: clip(f.text, 8000),
  }))

  const user = JSON.stringify({
    message,
    priorDraft: prior,
    sources: {
      linkedinUrl: clip(sources.linkedinUrl, 200),
      linkedinText,
      resumeFileName: clip(sources.resumeFileName, 120),
      resumeText,
      driveFiles,
    },
  })

  const raw = (await callAnthropic(user)) || (await callGroq(user))
  const parsed = raw ? parseModelJson(raw) : null
  const fallback = !parsed

  const extracted = heuristicExtract(message, { ...sources, linkedinText, resumeText, driveFiles }, prior)
  const draft = mergeDraft(extracted, parsed?.draft)
  if (sources.resumeFileName) draft.files = uniq([...draft.files, sources.resumeFileName])
  if (driveFiles.length) draft.drive = true
  if (sources.linkedinUrl) draft.linkedinUrl = clip(sources.linkedinUrl, 200)

  const heuristic = heuristicReply(draft, message)
  const reply = sanitizeReply(parsed?.reply || heuristic.reply) || heuristic.reply
  const suggestedRoles = (parsed?.suggestedRoles || []).length
    ? parsed!.suggestedRoles!.slice(0, 3)
    : heuristic.suggestedRoles
  const readyToApply = Boolean(parsed?.readyToApply) || draftReady(draft)
  const action = parsed?.action === 'open_apply' || /apply|let's apply|lets apply/i.test(message)
    ? 'open_apply'
    : ''

  return res.status(200).json({
    reply,
    waitMs: WAIT_MS,
    draft,
    readyToApply,
    suggestedRoles,
    actions: action ? [{ type: action }] : [],
    fallback,
  })
}
