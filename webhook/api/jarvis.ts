/**
 * api/jarvis.ts
 *
 * JARVIS AI assistant — Anthropic native tool-use agent loop.
 *
 * The agent runs up to MAX_ITERATIONS turns of tool calling until Claude
 * decides it has enough information to give a final answer. No LangGraph
 * required — Anthropic's API handles the ReAct pattern natively.
 *
 * Tools: explain_concept, get_student_profile, get_recommendations,
 *        get_session_history, navigate
 *
 * Conversation history is persisted per-student in Firestore so the agent
 * has memory across cold starts and browser refreshes.
 *
 * Request body:  { message: string, context?: string, studentId?: string }
 * Response body: { reply, helpCards?, navigationTarget?, toolsUsed[], fallback? }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../lib/cors'
import { loadHistory, saveExchange } from '../lib/conversationStore'
import { TOOLS, makeExecutors } from '../lib/jarvisTools'

const client  = new Anthropic()
const MODEL   = 'claude-sonnet-4-20250514'
const ML_BASE = process.env.ML_URL ?? 'http://localhost:8000'

const MAX_ITERATIONS = 6

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseStyle(context: string): string {
  if (/geometric/i.test(context)) return 'geometric'
  if (/algebraic/i.test(context)) return 'algebraic'
  return 'intuitive'
}

function parseUserName(context: string): string {
  return context.match(/User:\s*([^.]+)/)?.[1]?.trim() ?? 'Student'
}

function buildSystemPrompt(userName: string, style: string): string {
  return `You are JARVIS, the AI assistant built into MindCraft — an intelligent math tutoring platform.

Personality: precise, calm, slightly formal, genuinely helpful. Like J.A.R.V.I.S. from Iron Man.
Address the student as ${userName}.
The student's dominant learning style is ${style}.

Rules:
- Keep conversational replies to 1-3 sentences. Be concise and direct.
- Never say "I'm an AI" — you are JARVIS.
- Never explain math yourself without calling explain_concept first.

When to use each tool:
- explain_concept: ANY math question, concept explanation, or homework help request.
- get_student_profile: questions about progress, strengths, weaknesses, or "how am I doing".
- get_recommendations: questions about what to study next, which topics to focus on, or study plans.
- get_session_history: questions about past sessions, what was covered, or when the last class was.
- navigate: any request to go somewhere — "take me to X", "open X", "show me X", or page names:
    practice → practice
    knowledge graph / my graph → knowledge-graph
    book / schedule / new session → book
    study timer / focus mode → study-timer
    dashboard / home → dashboard

After explain_concept: write one calm sentence saying the cards are ready. Do not re-explain the math.
After navigate: confirm the navigation in one short sentence.
After get_student_profile or get_recommendations: synthesise a clear 2-3 sentence insight from the data.`
}

// ── Agent loop ─────────────────────────────────────────────────────────────────

interface LoopResult {
  reply:           string
  toolsUsed:       string[]
  helpCards?:      object[]
  navigationTarget?: string
}

async function runAgentLoop(
  messages:     { role: 'user' | 'assistant'; content: any }[],
  systemPrompt: string,
  executors:    Record<string, (input: any) => Promise<string>>,
): Promise<LoopResult> {
  let msgs    = [...messages]
  const used: string[]            = []
  let helpCards: object[] | undefined
  let navigationTarget: string   | undefined

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: 1024,
      system:     systemPrompt,
      tools:      TOOLS,
      messages:   msgs,
    })

    if (response.stop_reason === 'end_turn') {
      const reply = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.Messages.TextBlock).text)
        .join('')
      return { reply, toolsUsed: used, helpCards, navigationTarget }
    }

    if (response.stop_reason === 'tool_use') {
      msgs.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        used.push(block.name)
        const executor = executors[block.name]
        const result   = executor
          ? await executor(block.input)
          : `Tool "${block.name}" not available.`

        // Extract structured outputs
        if (block.name === 'explain_concept') {
          try {
            const parsed = JSON.parse(result)
            if (Array.isArray(parsed.helpCards)) helpCards = parsed.helpCards
          } catch { /* malformed — skip */ }
        }
        if (block.name === 'navigate') {
          try {
            const { page, concept } = JSON.parse(result)
            navigationTarget = concept
              ? `${page}/${encodeURIComponent(concept)}`
              : page
          } catch { /* skip */ }
        }

        toolResults.push({
          type:        'tool_result',
          tool_use_id: block.id,
          content:     result,
        })
      }

      msgs.push({ role: 'user', content: toolResults })
      continue
    }

    // Unexpected stop reason — break out
    break
  }

  // Max iterations reached
  return { reply: 'I reached my reasoning limit. Please rephrase and try again.', toolsUsed: used, helpCards, navigationTarget }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  const { message, context = '', studentId } = req.body as {
    message:    string
    context?:   string
    studentId?: string
  }
  if (!message?.trim()) return res.status(400).json({ error: 'No message' })

  const userName = parseUserName(context)
  const style    = parseStyle(context)
  const executors = makeExecutors({ studentId: studentId ?? '', mlBase: ML_BASE, style })

  // Load persistent conversation history from Firestore
  const history = studentId ? await loadHistory(studentId) : []

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history,
    { role: 'user', content: message.trim() },
  ]

  try {
    const { reply, toolsUsed, helpCards, navigationTarget } = await runAgentLoop(
      messages,
      buildSystemPrompt(userName, style),
      executors,
    )

    if (studentId) {
      saveExchange(studentId, message.trim(), reply).catch(() => {})
    }

    return res.json({ reply, helpCards, navigationTarget, toolsUsed })

  } catch (err) {
    console.error('[JARVIS] Agent error:', err)
    return res.json({
      reply:     'My reasoning engine encountered an issue. Please try again in a moment.',
      toolsUsed: [],
      fallback:  true,
    })
  }
}
