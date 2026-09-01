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
import { setCors } from '../cors'
import { callAnthropic, callGroq, parseModelJson, sanitizeText } from '../llmChat'
import corpus from '../../data/dans-archive-chunks.json'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
// NOT llama-3.3-70b-versatile: Groq shut that model down 2026-08-16 (see
// english-practice.ts's own discovery of this), this is the live,
// confirmed replacement.
const GROQ_MODEL = 'openai/gpt-oss-120b'
const WAIT_MS = 5000
const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'how', 'why',
  'are', 'was', 'can', 'you', 'your', 'about', 'into', 'book', 'page', 'open',
  'show', 'tell', 'please', 'jesse',
  // The native client's own fixed wrapper phrase - "Give me a short table
  // of contents for X" - was itself supplying the dominant match (2026-08-18,
  // confirmed live: "California bar exams" opened an unrelated Computer
  // Science page). "table"/"contents" happen to be a near-universal URL
  // fragment across this whole corpus (".../book-table-of-contents/"),
  // so those two words alone cleared even a real title-match requirement
  // regardless of what topic came after "for" - every topic, real or
  // nonsense, was landing on the same three navigation pages. Stripping
  // the wrapper's own vocabulary here means only the actual topic words
  // can ever drive a match, no matter how a future caller phrases the ask.
  'give', 'short', 'table', 'contents',
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

// A hit riding on a single coincidental body-text mention of a generic
// word, with no title/slug relevance at all, reads as a confident match
// ("I opened X") when it's really noise. The real 2026-08-18 false
// positive ("California bar exams" -> an unrelated Computer Science page)
// turned out to be the client's own fixed wrapper phrase ("give me a
// short table of contents for...") supplying the dominant match via
// "table"/"contents" - now stripped in STOP above, at the actual source
// of the pollution. With that fixed, a body-only signal is real enough to
// keep (verified against "derivatives": two real Calculus pages discuss
// it in the body without the word ever appearing in their own page
// title - a hard title-only gate excluded both, a real regression tested
// and reverted) - MIN_RELEVANT_SCORE stays as the corroboration
// requirement for a bare body hit specifically.
const MIN_RELEVANT_SCORE = 3

// No stemming anywhere in this matcher - a plain trailing-s strip is
// enough to catch the common case (confirmed live: "derivatives" missed
// two real Calculus pages that only ever say "derivative" singular in
// their own body text) without pulling in a real stemmer for one suffix.
function singular(t: string): string | null {
  return t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : null
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Word-boundary match, not raw substring (confirmed live, 2026-08-18:
// adding the singular-strip above without this first reintroduced the
// exact bug it was meant to fix - "exams" -> "exam" then substring-matched
// inside "example", which is all over an educational corpus, so
// "California bar exams" started confidently matching again). `\b` on
// both sides means "exam" matches the word "exam" but not the "exam"
// inside "example" or "examine".
function wordMatch(haystack: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`).test(haystack)
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
      const alt = singular(t)
      if (wordMatch(title, t) || (alt && wordMatch(title, alt))) score += 4
      if (wordMatch(body, t) || (alt && wordMatch(body, alt))) score += 1
      if (wordMatch(c.bookSlug.replace(/-/g, ' '), t)) score += 2
    }
    if (score >= MIN_RELEVANT_SCORE) scored.push({ ...c, score })
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
- If STUDENT_WEAKNESS is present, you may gently tie your answer to it when
  it genuinely fits (e.g. "that page also leans on X, which you've been
  finding tricky lately"). Never force it into an unrelated answer, never
  state a score or diagnose the student, at most one soft clause.

Return ONLY JSON:
{"reply":"...","hitUrls":["https://..."]}`

interface ParsedArchiveReply {
  reply?: string
  hitUrls?: string[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as {
    message?: string
    studentWeakness?: { conceptId?: string; label?: string }
  }
  const message = clip(body.message, 400).trim()
  if (!message) return res.status(400).json({ error: 'No message' })

  const weaknessLabel = clip(body.studentWeakness?.label, 80).trim()
  const studentWeakness = weaknessLabel
    ? { conceptId: clip(body.studentWeakness?.conceptId, 80).trim(), label: weaknessLabel }
    : null

  const hits = retrieve(message, 3)
  const user = JSON.stringify({
    message,
    studentWeakness,
    hits: hits.map((h) => ({
      bookTitle: h.bookTitle,
      pageTitle: h.pageTitle,
      pageUrl: h.pageUrl,
      quote: h.quote,
    })),
  })

  const raw =
    (await callAnthropic(user, { model: ANTHROPIC_MODEL, maxTokens: 500, system: SYSTEM })) ||
    (await callGroq(user, { model: GROQ_MODEL, maxTokens: 500, temperature: 0.2, system: SYSTEM }))
  const parsed = raw ? parseModelJson<ParsedArchiveReply>(raw) : null
  const reply = sanitizeText(parsed?.reply || heuristicReply(message, hits)) || heuristicReply(message, hits)

  return res.status(200).json({
    reply,
    waitMs: WAIT_MS,
    hits: hits.map(({ score: _s, ...h }) => h),
    fallback: !parsed,
  })
}
