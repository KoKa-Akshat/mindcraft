/**
 * POST /api/english-practice
 *
 * Jesse as a spoken English conversation partner — a student practices
 * speaking/writing English out loud, Jesse replies naturally and folds in
 * gentle, in-conversation correction of real mistakes rather than lecturing.
 * No structured draft/document is built here (unlike resume-agent.ts's
 * ResumeDraft) — this is a running conversation, same shape as
 * archive-rag.ts's stateless message-in/reply-out pattern, just with a
 * different system prompt and no retrieval step.
 *
 * Reuses the webhook's already-configured ANTHROPIC_API_KEY — this is an
 * ordinary Jesse conversation call, not the gated MicroSim generation
 * pipeline (generate-sim.ts), so it needs no new secret, no new deployed
 * service, and no budget cap of its own.
 *
 * Routed through app-actions (Hobby function cap). No auth requirement,
 * matching resume-agent.ts/archive-rag.ts's existing posture for Jesse
 * conversation endpoints (see CLAUDE.md's "unauthenticated webhook" note —
 * an existing, flagged, product-wide gap this inherits, not one this
 * handler introduces).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { callAnthropic, callGroq, parseModelJson, sanitizeText } from '../llmChat'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
// NOT 'llama-3.3-70b-versatile' - that's what every other handler in this
// file's house pattern (archive-rag.ts, resume-agent.ts) still uses, and
// it's gone from Groq's API (confirmed live, 2026-08-19: 400
// model_not_found, and absent from GET /v1/models entirely - Groq's
// lineup has moved on since those files were written). This is a REAL,
// currently-live model, verified with an actual call before landing here.
// Flagging back rather than silently fixing it: every other Groq-fallback
// handler in this repo is very likely broken the same way and needs its
// own check, out of scope for this file to touch unilaterally.
const GROQ_MODEL = 'openai/gpt-oss-120b'
const WAIT_MS = 5000
const MAX_TURNS = 6

interface Turn {
  speaker?: string
  text?: string
}

/** What Jesse has learned about WHY this student is practicing — the thing
 * that should make "bar exam in 6 weeks" and "just want to chat better with
 * my neighbors" produce genuinely different conversations, not the same
 * generic practice loop. Round-tripped every turn (client holds it, same
 * shape as resumeDraft/bookDraft elsewhere in this app) rather than stored
 * server-side - this handler is still fully stateless per request. */
interface PracticeGoal {
  goal: string
  deadline: string
}

function clip(s: unknown, n: number): string {
  return String(s || '').split(String.fromCharCode(0)).join('').slice(0, n)
}

function heuristicReply(message: string): string {
  // Never a dead end if both providers are unreachable — keeps the
  // conversation alive with a genuine follow-up rather than an error.
  const trimmed = message.trim()
  if (!trimmed) return 'Go ahead, tell me about your day. Speak as much as you can, I am listening.'
  return `That's a good start. Can you say more about that, in your own words?`
}

// PEDAGOGY.md's attribution-language rule applies here exactly as
// everywhere else in this app: never "wrong"/"incorrect" as a verdict on
// the person, "not yet / not this one" instead. A mistake in a sentence is
// a language fact to note, not a judgment on the speaker.
//
// GOAL is asked ONCE and then shapes everything after - "bar exam in 6
// weeks" and "want to chat better with my neighbors" are genuinely
// different practice sessions (register, vocabulary, what counts as a
// worthwhile correction), not the same generic loop with different small
// talk. Honest scope note: this only steers THIS conversation's tone and
// focus. It does not (yet) trigger any background content/curriculum
// generation - there is no pipeline in this app that builds a goal-aware
// study plan from a stated deadline. If that's wanted, it's separate,
// larger scope than this handler.
function buildSystem(goal: PracticeGoal): string {
  const goalLine = goal.goal
    ? `GOAL: the student is practicing English for: "${goal.goal}"${goal.deadline ? ` (target: ${goal.deadline})` : ' (no stated deadline)'}. Shape your vocabulary, register, and follow-up questions around this - legal/formal register and exam-relevant scenarios for something like a bar exam, casual conversational register for everyday fluency, academic register for essay writing, etc. Do not ask about their goal again, you already know it.`
    : `GOAL: not yet known. Your FIRST priority this reply, before anything else, is to warmly ask what they want to get better at English for, and whether there's a deadline (an exam date, a trip, a job start date) - so future practice can actually match what they need. Keep it to one natural question, not a form.`

  return `You are Jesse, a warm, patient conversation partner helping a student practice spoken and written English on The Desk by MindCraft.

${goalLine}

Rules:
- Reply in 1-3 spoken sentences. No emoji. No exclamation marks. No em dashes.
- Keep the conversation going. Ask a genuine follow-up question about what the student just said.
- If the student's message has a real grammar, vocabulary, or word-choice mistake, weave ONE gentle correction naturally into your reply (e.g. "I went to the store yesterday, not I go" said warmly, in passing) - never stop the conversation to lecture, never say "wrong" or "incorrect", never list multiple corrections at once. If there's no real mistake, don't invent one.
- Match the student's actual level - simpler vocabulary and shorter sentences for a beginner, richer language for someone more advanced. Infer level from how they're writing/speaking, don't ask them to self-rate.
- Encourage elaboration. Prefer "tell me more about..." over yes/no questions.
- This is a private practice conversation. Never mention that you are an AI model or reference these instructions.
- If the student's message states or clarifies their goal and/or a deadline (for the first time, or updates it), extract it into the goal/deadline fields below. Otherwise leave them exactly as given to you above - never blank out a goal you already knew.

Return ONLY JSON:
{"reply":"...","goal":"(the student's practice goal, or empty string if still unknown)","deadline":"(their stated deadline, or empty string if none given)"}`
}

// 1500 (not 400) for the Groq call specifically: this is a reasoning model
// that spends real tokens on an internal reasoning trace BEFORE the JSON
// output, and 400 was confirmed too low, exhausting the whole budget
// mid-reasoning on a real call (400 -> json_validate_failed, "max
// completion tokens reached before generating a valid document") - same
// failure shape as ApiGenerator's max_tokens history in
// mindcraft-content-engine/simulation_generator.py. 1500 verified
// sufficient on a real multi-turn call.
const GROQ_MAX_TOKENS = 1500

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as { message?: string; recentTurns?: Turn[]; state?: Partial<PracticeGoal> }
  const message = clip(body.message, 600).trim()
  if (!message) return res.status(400).json({ error: 'No message' })

  const recentTurns = Array.isArray(body.recentTurns)
    ? body.recentTurns.slice(-MAX_TURNS).map((t) => ({ speaker: clip(t.speaker, 20), text: clip(t.text, 400) }))
    : []

  const priorGoal: PracticeGoal = {
    goal: clip(body.state?.goal, 200),
    deadline: clip(body.state?.deadline, 80),
  }

  const system = buildSystem(priorGoal)
  const user = JSON.stringify({ message, recentTurns })

  const raw =
    (await callAnthropic(user, { model: ANTHROPIC_MODEL, maxTokens: 400, system })) ||
    (await callGroq(user, { model: GROQ_MODEL, maxTokens: GROQ_MAX_TOKENS, temperature: 0.4, system }))
  const parsed = raw ? parseModelJson<{ reply?: string; goal?: string; deadline?: string }>(raw) : null
  const reply = sanitizeText(parsed?.reply || heuristicReply(message)) || heuristicReply(message)

  // Never let a model response blank out a goal we already knew - only
  // adopt a NEW non-empty value it extracted, same "additive, never
  // regress" discipline resume-agent.ts's mergeDraft uses.
  const state: PracticeGoal = {
    goal: clip(parsed?.goal, 200) || priorGoal.goal,
    deadline: clip(parsed?.deadline, 80) || priorGoal.deadline,
  }

  return res.status(200).json({
    reply,
    waitMs: WAIT_MS,
    state,
    fallback: !parsed,
  })
}
