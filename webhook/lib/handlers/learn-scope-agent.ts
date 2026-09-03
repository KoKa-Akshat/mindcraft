/**
 * POST /api/learn-scope-agent
 *
 * Jesse, before /learn's own real search runs: a short back-and-forth
 * ("what are you preparing for, or what do you want to learn") to turn a
 * vague ask into real search terms, then hand off. Never invents lesson
 * content itself — the model's only job is refining a search query; the
 * actual concept/chapter always comes from the real semantic search
 * (concept-resolve) once this returns ready:true, same discipline this
 * project uses everywhere else (Practice Probe's real-bank-only rule,
 * discover-internships' honesty filter): the LLM proposes, the real data
 * decides.
 *
 * Routed through app-actions (Hobby function cap, see that file's header).
 * No auth required (mirrors resume-agent.ts): this fires from /learn's
 * blank entry screen, before a student has necessarily signed in.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { callAnthropic, callByok, callGemini, callGroq, parseModelJson, sanitizeText, type ByokChatOptions } from '../llmChat'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
const GROQ_MODEL = 'openai/gpt-oss-120b'
const MAX_TOKENS = 400
const MAX_TURNS = 12 // history entries kept, not full transcript forever

interface HistoryTurn {
  role?: string
  text?: string
}

interface LearnScopeBody {
  message?: string
  history?: HistoryTurn[]
  byok?: {
    provider?: string
    apiKey?: string
    model?: string
    baseUrl?: string
  }
}

function clip(s: unknown, n: number): string {
  return String(s || '').replace(/\u0000/g, '').slice(0, n)
}

const SYSTEM = `You are Jesse, helping a student on MindCraft figure out what they want to learn, before handing off to a real search of MindCraft's own lesson library.

Ask ONE short, warm, specific question at a time. Learn what they are preparing for (a class, a test, a project, plain curiosity) and enough detail to search well: a real topic, not just a broad subject like "math" or "history".

After 1 to 3 exchanges, once you have a specific enough topic, stop asking: set ready true and searchQuery to the best real search terms for it (2 to 6 words, the way a student would actually type it, not a full sentence).

You never invent or describe lesson content yourself. Your only job is turning the conversation into a good search query; the real lesson always comes from the library once search runs.

Reply in 1-2 short sentences. No emoji. No exclamation marks. No em dashes.

Return ONLY JSON: {"reply":"...","ready":false,"searchQuery":""}`

interface ParsedScopeReply {
  reply?: string
  ready?: boolean
  searchQuery?: string
}

function formatHistory(history: HistoryTurn[]): string {
  return history
    .map((t) => `${t.role === 'jesse' ? 'Jesse' : 'Student'}: ${clip(t.text, 400)}`)
    .join('\n')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as LearnScopeBody
  const message = clip(body.message, 500).trim()
  if (!message) return res.status(400).json({ error: 'No message' })

  const history = (Array.isArray(body.history) ? body.history : []).slice(-MAX_TURNS)
  const transcript = formatHistory(history)
  const user = transcript
    ? `Conversation so far:\n${transcript}\n\nStudent's latest message: ${message}`
    : `Student's first message: ${message}`

  const byok = body.byok
  const byokProvider = byok?.provider
  const validByok: ByokChatOptions | null =
    byok?.apiKey && (byokProvider === 'openai' || byokProvider === 'groq' || byokProvider === 'gemini' || byokProvider === 'openrouter' || byokProvider === 'anthropic' || byokProvider === 'custom')
      ? {
          provider: byokProvider,
          apiKey: clip(byok.apiKey, 200),
          model: byok.model ? clip(byok.model, 80) : undefined,
          baseUrl: byok.baseUrl ? clip(byok.baseUrl, 300) : undefined,
          maxTokens: MAX_TOKENS,
          temperature: 0.3,
          system: SYSTEM,
        }
      : null

  const raw =
    (await callAnthropic(user, { model: ANTHROPIC_MODEL, maxTokens: MAX_TOKENS, system: SYSTEM })) ||
    (await callGemini(user, { maxTokens: MAX_TOKENS, temperature: 0.3, system: SYSTEM })) ||
    (await callGroq(user, { model: GROQ_MODEL, maxTokens: MAX_TOKENS, temperature: 0.3, system: SYSTEM })) ||
    (validByok ? await callByok(user, validByok) : null)
  const parsed = raw ? parseModelJson<ParsedScopeReply>(raw) : null
  const fallback = !parsed

  // Every real model path failed. Never trap the student in a dead
  // conversation: ask once (first message only), then just hand their own
  // words straight to the real search rather than stalling forever.
  if (!parsed) {
    if (!history.length) {
      return res.status(200).json({
        reply: 'What are you preparing for, or what do you want to learn?',
        ready: false,
        fallback: true,
      })
    }
    return res.status(200).json({
      reply: "Let's search for that.",
      ready: true,
      searchQuery: message,
      fallback: true,
    })
  }

  const reply = sanitizeText(parsed.reply || '') || 'Tell me a bit more.'
  const ready = Boolean(parsed.ready)
  const searchQuery = ready ? clip(parsed.searchQuery, 160).trim() || message : undefined

  // A real cap, not just the prompt's "1 to 3 exchanges" asking nicely: a
  // live test conversation reached a 4th question before the model called
  // itself ready, still a reasonable answer but not the guarantee "never
  // trap the student" needs. After 3 student messages (history already has
  // 3 user turns, so this is the 4th), force a handoff on this turn
  // regardless of what the model wants, same honesty rule as the fallback
  // path above: the student's own words become the query rather than one
  // more question.
  const userTurns = history.filter((t) => t.role !== 'jesse').length + 1
  if (!ready && userTurns >= 4) {
    return res.status(200).json({
      reply: sanitizeText(`Let's search for ${message}.`),
      ready: true,
      searchQuery: message,
      fallback,
    })
  }

  return res.status(200).json({
    reply,
    ready,
    searchQuery,
    fallback,
  })
}
