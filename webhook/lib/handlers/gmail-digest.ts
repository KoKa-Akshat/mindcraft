/**
 * POST /api/gmail-digest
 *
 * Turns a student's already-fetched inbox (GmailClient.fetchInbox on the
 * iOS side - real Gmail via their own OAuth, this endpoint never touches
 * Gmail itself) into a short AI digest: what actually needs a reply or has
 * a deadline, versus what's just FYI. No auth here and no Firestore write,
 * matching resume-agent.ts/archive-rag.ts/book-agent.ts - this endpoint is
 * stateless, given a batch of message previews in and a digest out.
 * Persisting the digest (so students have their own history of these, not
 * just an ephemeral in-memory read) is a native-side Firestore write,
 * already-authenticated as the signed-in student - same pattern as
 * BookWorkflowView's publish bridge.
 *
 * Routed through app-actions (Hobby function cap).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../cors'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

export interface DigestMessageIn {
  from?: string
  subject?: string
  snippet?: string
  dateLabel?: string
}

export interface DigestItem {
  from: string
  subject: string
  why: string
}

export interface GmailDigest {
  headline: string
  actionItems: DigestItem[]
  fyi: DigestItem[]
}

const EMPTY_DIGEST: GmailDigest = { headline: '', actionItems: [], fyi: [] }

interface GmailDigestBody {
  messages?: DigestMessageIn[]
}

function clip(s: unknown, n: number): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n)
}

function sanitizeText(text: string, n: number): string {
  return text
    .replace(/—/g, '-')
    .replace(/[!]{1,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n)
}

function normalizeMessages(raw: unknown): DigestMessageIn[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 20).map((m) => ({
    from: clip((m as DigestMessageIn)?.from, 120),
    subject: clip((m as DigestMessageIn)?.subject, 200),
    snippet: clip((m as DigestMessageIn)?.snippet, 400),
    dateLabel: clip((m as DigestMessageIn)?.dateLabel, 40),
  }))
}

function normalizeDigest(parsed: unknown): GmailDigest | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Partial<GmailDigest>
  const toItems = (arr: unknown): DigestItem[] =>
    Array.isArray(arr)
      ? arr.slice(0, 10).map((it) => ({
          from: clip((it as DigestItem)?.from, 120),
          subject: clip((it as DigestItem)?.subject, 200),
          why: sanitizeText(String((it as DigestItem)?.why ?? ''), 220),
        }))
      : []
  return {
    headline: sanitizeText(String(p.headline ?? ''), 200),
    actionItems: toItems(p.actionItems),
    fyi: toItems(p.fyi),
  }
}

const SYSTEM = `You read a student's already-fetched inbox previews (from/subject/snippet/date - real emails, already authorized by the student's own Google account) and write a short digest so they can triage without opening every message.

Split into two lists:
- actionItems: emails that need a reply, have a deadline, or need the student to do something. "why" is one short plain-language reason (e.g. "Due Friday", "Teacher is asking a direct question").
- fyi: everything else worth knowing but not urgent (announcements, confirmations, newsletters).

Rules:
- Never invent facts beyond what's in the subject/snippet given. If a snippet is too thin to judge, put it in fyi rather than guessing it's urgent.
- headline is one short plain sentence summarizing the batch (e.g. "2 emails need a reply, rest is routine").
- No emoji. No exclamation marks. No em dashes.

Return ONLY JSON:
{"headline":"...","actionItems":[{"from":"","subject":"","why":""}],"fyi":[{"from":"","subject":"","why":""}]}`

function parseModelJson(raw: string): unknown {
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
      max_tokens: 1200,
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
        max_tokens: 1200,
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

/** No LLM reachable - honest fallback, not a fake summary: everything goes to fyi. */
function heuristicDigest(messages: DigestMessageIn[]): GmailDigest {
  return {
    headline: messages.length
      ? `${messages.length} recent email${messages.length === 1 ? '' : 's'} - summary unavailable right now`
      : 'Inbox is empty',
    actionItems: [],
    fyi: messages.map((m) => ({ from: m.from ?? '', subject: m.subject ?? '', why: '' })),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as GmailDigestBody
  const messages = normalizeMessages(body.messages)
  if (!messages.length) return res.status(400).json({ error: 'No messages' })

  const user = JSON.stringify({ messages })
  const raw = (await callAnthropic(user)) || (await callGroq(user))
  const parsed = raw ? normalizeDigest(parseModelJson(raw)) : null
  const fallback = !parsed
  const digest = parsed ?? heuristicDigest(messages)

  return res.status(200).json({ ...(digest ?? EMPTY_DIGEST), fallback })
}
