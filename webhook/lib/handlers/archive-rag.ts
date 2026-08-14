/**
 * POST /api/archive-rag
 *
 * Jesse on Dan McCreary's open textbooks. Retrieval is lexical over a
 * chapter-excerpt index (mkdocs search dumps). Answers must cite a real
 * page URL. We never rehost the books.
 *
 * Routed through app-actions. Client also runs the same index locally
 * so the proto still works if this function has not redeployed yet.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../cors'
import corpus from '../../data/dans-archive-chunks.json'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const WAIT_MS = 5000
const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'how', 'why',
  'are', 'was', 'can', 'you', 'your', 'about', 'into', 'book', 'page', 'open',
  'show', 'tell', 'please', 'jesse',
])

type Chunk = {
  bookSlug: string
  bookTitle: string
  pageTitle: string
  location: string
  pageUrl: string
  quote: string
}

type Hit = Chunk & { score: number }

const CHUNKS = (corpus as { chunks: Chunk[] }).chunks || []

function clip(s: unknown, n: number): string {
  return String(s || '').replace(/\u0000/g, '').slice(0, n)
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
}

export function retrieve(query: string, limit = 3): Hit[] {
  const q = tokens(query)
  if (!q.length) return []
  const scored: Hit[] = []
  for (const c of CHUNKS) {
    const title = `${c.bookTitle} ${c.pageTitle} ${c.location}`.toLowerCase()
    const body = `${c.quote}`.toLowerCase()
    let score = 0
    for (const t of q) {
      if (title.includes(t)) score += 4
      if (body.includes(t)) score += 1
      if (c.bookSlug.replace(/-/g, ' ').includes(t)) score += 2
    }
    if (score > 0) scored.push({ ...c, score })
  }
  scored.sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  const out: Hit[] = []
  for (const h of scored) {
    if (seen.has(h.pageUrl)) continue
    seen.add(h.pageUrl)
    out.push(h)
    if (out.length >= limit) break
  }
  return out
}

function heuristicReply(query: string, hits: Hit[]): string {
  if (!hits.length) {
    return 'I do not have that page in the shelf yet. Try calculus, MicroPython, or the five-dollar DSP book.'
  }
  const top = hits[0]
  return `I opened ${top.bookTitle} at ${top.pageTitle}. ${top.quote.slice(0, 180)}`
}

function sanitizeReply(text: string): string {
  return text
    .replace(/—/g, '-')
    .replace(/[!]{1,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 420)
}

const SYSTEM = `You are Jesse, the archive agent on The Desk by MindCraft.
You help a student find an exact page in Dan McCreary's open intelligent textbooks.
Friendly, certain, short. Like a calm older sibling on a call. Not peppy.

Rules:
- Reply in 1-3 spoken sentences. No emoji. No exclamation marks. No em dashes.
- Use ONLY the provided HITS. Never invent a page, quote, or URL.
- Always name the book and the page title.
- If the hits are weak, say so and still offer the closest page.
- Credit Dan. These are his books. We link out. We do not rehost.
- Student data stays on their device. This call does not store the question.

Return ONLY JSON:
{"reply":"...","hitUrls":["https://..."]}`

function parseModelJson(raw: string): { reply?: string; hitUrls?: string[] } | null {
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
      max_tokens: 500,
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
        temperature: 0.2,
        max_tokens: 500,
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

  const body = (req.body || {}) as { message?: string }
  const message = clip(body.message, 400).trim()
  if (!message) return res.status(400).json({ error: 'No message' })

  const hits = retrieve(message, 3)
  const user = JSON.stringify({
    message,
    hits: hits.map((h) => ({
      bookTitle: h.bookTitle,
      pageTitle: h.pageTitle,
      pageUrl: h.pageUrl,
      quote: h.quote,
    })),
  })

  const raw = (await callAnthropic(user)) || (await callGroq(user))
  const parsed = raw ? parseModelJson(raw) : null
  const reply = sanitizeReply(parsed?.reply || heuristicReply(message, hits)) || heuristicReply(message, hits)

  return res.status(200).json({
    reply,
    waitMs: WAIT_MS,
    hits: hits.map(({ score: _s, ...h }) => h),
    fallback: !parsed,
  })
}
