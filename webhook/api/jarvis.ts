/**
 * api/jarvis.ts
 *
 * JARVIS AI assistant powered by a LangGraph ReAct agent.
 *
 * The agent orchestrates five tools:
 *   explain_concept      — cinematic 4-card math breakdown
 *   get_student_profile  — ML mastery / strength profile
 *   get_recommendations  — personalised next-concept suggestions
 *   get_session_history  — recent tutoring sessions from Firestore
 *   navigate             — client-side routing instruction
 *
 * Conversation history is persisted per-student in Firestore so the agent
 * has memory across cold starts and browser refreshes.
 *
 * Request body:  { message: string, context?: string, studentId?: string }
 * Response body: { reply, helpCards?, navigationTarget?, toolsUsed[], fallback? }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createReactAgent }       from '@langchain/langgraph/prebuilt'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage }           from '@langchain/core/messages'
import { setCors }                from '../lib/cors'
import { loadHistory, saveExchange } from '../lib/conversationStore'
import { makeTools }              from '../lib/jarvisTools'

const ML_BASE = process.env.ML_URL ?? 'http://localhost:8000'

function parseStyle(context: string): 'geometric' | 'algebraic' | 'intuitive' {
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
- get_student_profile: questions about progress, strengths, weaknesses, mastery, or "how am I doing".
- get_recommendations: questions about what to study next, which topics to focus on, or study plans.
- get_session_history: questions about past sessions, what was covered, or when the last class was.
- navigate: any request to go somewhere — "take me to X", "open X", "show me X", or page names:
    practice → practice
    knowledge graph / my graph / study [concept] → knowledge-graph
    book / schedule / new session → book
    study timer / pomodoro / focus mode / study techniques → study-timer
    dashboard / home → dashboard

After calling explain_concept: write one calm sentence saying the cards are ready. Do not re-explain the math.
After calling navigate: confirm the navigation in one short sentence.
After get_student_profile or get_recommendations: synthesise a clear 2-3 sentence insight from the data.`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  const { message, context = '', studentId } = req.body as {
    message: string
    context?: string
    studentId?: string
  }
  if (!message?.trim()) return res.status(400).json({ error: 'No message' })

  const userName = parseUserName(context)
  const style    = parseStyle(context)

  const llm = new ChatGoogleGenerativeAI({
    model:       'gemini-1.5-flash',
    apiKey:      process.env.GEMINI_API_KEY!,
    temperature: 0.7,
  })

  const tools = makeTools({ studentId: studentId ?? '', mlBase: ML_BASE, style })

  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: buildSystemPrompt(userName, style),
  })

  // Load persistent conversation history from Firestore
  const history = studentId ? await loadHistory(studentId) : []

  try {
    const result = await agent.invoke({
      messages: [...history, new HumanMessage(message.trim())],
    })

    // ── Extract structured data from tool results ─────────────────────────
    const toolsUsed: string[]      = []
    let   helpCards: any[] | undefined
    let   navigationTarget: string | undefined

    for (const msg of result.messages) {
      if (msg._getType() !== 'tool') continue
      const tm = msg as any  // ToolMessage: { name, content }
      if (tm.name) toolsUsed.push(tm.name)

      if (tm.name === 'explain_concept') {
        try {
          const parsed = JSON.parse(tm.content as string)
          if (Array.isArray(parsed.helpCards)) helpCards = parsed.helpCards
        } catch { /* malformed card JSON — skip */ }
      }

      if (tm.name === 'navigate') {
        try {
          const { page, concept } = JSON.parse(tm.content as string)
          navigationTarget = concept
            ? `${page}/${encodeURIComponent(concept)}`
            : page
        } catch { /* skip */ }
      }
    }

    // Final AIMessage content (string or content-block array)
    const lastMsg = result.messages[result.messages.length - 1]
    const reply =
      typeof lastMsg.content === 'string'
        ? lastMsg.content
        : Array.isArray(lastMsg.content)
          ? (lastMsg.content as any[]).map((c: any) => c.text ?? '').join('')
          : 'I encountered an issue. Please try again.'

    // Persist exchange in the background — don't block the response
    if (studentId) {
      saveExchange(studentId, message.trim(), reply).catch(() => {})
    }

    return res.json({ reply, helpCards, navigationTarget, toolsUsed })

  } catch (err) {
    console.error('[JARVIS] Agent error:', err)
    return res.json({
      reply:    'My reasoning engine encountered an issue. Please try again in a moment.',
      toolsUsed: [],
      fallback:  true,
    })
  }
}
