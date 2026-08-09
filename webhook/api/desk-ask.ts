/**
 * api/desk-ask.ts
 *
 * Desk Operator agent — per-student Ask MindCraft mount for Field Desk / Dash.
 * Anthropic tool loop (same pattern as jarvis.ts), separate conversation memory.
 *
 * Request:  { message, studentId, deskContext }
 * Response: { reply, actions[], toolsUsed[], fallback? }
 *
 * v0 tools: read_desk_context, propose_action, note_for_intel
 * Growth ladder (later): binder receipts, Gmail draft, Job OS, ask_tutor
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../lib/cors'
import { loadHistory, saveExchange } from '../lib/conversationStore'
import { verifyToken } from '../lib/verifyToken'

const client = new Anthropic()
const MODEL = 'claude-sonnet-4-20250514'
const MAX_ITERATIONS = 4

type DeskActionType =
  | 'open_gmail'
  | 'open_apply'
  | 'open_connect'
  | 'refresh_calendar'
  | 'prepend_intel'

interface DeskAction {
  type: DeskActionType
  payload?: string
}

interface DeskContext {
  intelLines?: string[]
  binderItems?: { title?: string; course?: string }[]
  calendarEvents?: { day?: string; title?: string }[]
  connected?: string[]
  openSurface?: 'desk' | 'gmail' | 'applyToday'
}

interface DeskAskBody {
  message?: string
  studentId?: string
  deskContext?: DeskContext
}

function deskConversationId(studentId: string): string {
  return `desk:${studentId}`
}

function buildSystemPrompt(): string {
  return `You are the MindCraft Desk Operator. Students ask you from Ask MindCraft on Field Desk / Dash.

Personality: calm, practical, short. Help them run their desk (calendar, mail, connect, apply, binder, intel).
Never use em dashes. Never say you are an AI.
Keep replies to 1-3 short sentences.
When you use desk facts, say where they came from (from your calendar, from intel, from binder).

Tools:
- read_desk_context: inspect the student's current desk snapshot before answering about week, binder, or intel.
- propose_action: open Gmail, Apply today, Connect, or refresh calendar. Use when the student asks to open or check those surfaces.
- note_for_intel: file one short useful line into intel.

Rules:
- Do not invent emails, binder files, or calendar events that are not in desk context.
- Never send mail or mark job applications done.
- If the week is empty, say so clearly and suggest Connect Gmail + Calendar.
- Prefer actions over long instructions when the student wants to open something.`
}

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'read_desk_context',
    description: 'Read the student desk snapshot (intel, binder titles, calendar week, connected tools).',
    input_schema: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          enum: ['all', 'calendar', 'intel', 'binder', 'connected'],
          description: 'Which slice to return',
        },
      },
    },
  },
  {
    name: 'propose_action',
    description: 'Ask the client to open a desk surface or refresh calendar.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['open_gmail', 'open_apply', 'open_connect', 'refresh_calendar'],
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'note_for_intel',
    description: 'File one short line into the student intel card.',
    input_schema: {
      type: 'object',
      properties: {
        line: { type: 'string', description: 'Short intel line, under 120 chars' },
      },
      required: ['line'],
    },
  },
]

function sliceContext(ctx: DeskContext, focus = 'all') {
  const intel = (ctx.intelLines || []).slice(0, 12)
  const binder = (ctx.binderItems || []).slice(0, 20).map((b) => ({
    title: String(b.title || '').slice(0, 120),
    course: String(b.course || '').slice(0, 80),
  }))
  const calendar = (ctx.calendarEvents || []).slice(0, 10).map((e) => ({
    day: String(e.day || '').slice(0, 16),
    title: String(e.title || '').slice(0, 160),
  }))
  const connected = (ctx.connected || []).slice(0, 12).map(String)

  if (focus === 'calendar') return { calendar }
  if (focus === 'intel') return { intel }
  if (focus === 'binder') return { binder }
  if (focus === 'connected') return { connected, openSurface: ctx.openSurface || 'desk' }
  return { intel, binder, calendar, connected, openSurface: ctx.openSurface || 'desk' }
}

function keywordFallback(message: string, ctx: DeskContext): { reply: string; actions: DeskAction[] } {
  const s = message.toLowerCase()
  const actions: DeskAction[] = []
  const cal = (ctx.calendarEvents || []).slice(0, 4)
  const intel = (ctx.intelLines || []).slice(0, 3)

  if (/mail|gmail|inbox|email/.test(s)) {
    actions.push({ type: 'open_gmail' })
    return { reply: 'Opening your Gmail box.', actions }
  }
  if (/apply|job|resume|linkedin/.test(s)) {
    actions.push({ type: 'open_apply' })
    return { reply: 'Opening Apply today.', actions }
  }
  if (/connect|moodle|link/.test(s)) {
    actions.push({ type: 'open_connect' })
    return { reply: 'Opening Connect.', actions }
  }
  if (/cal|week|schedule|due/.test(s)) {
    actions.push({ type: 'refresh_calendar' })
    if (cal.length) {
      const bits = cal.map((e) => `${e.day} · ${e.title}`).join('; ')
      return { reply: `From your calendar: ${bits}.`, actions }
    }
    return {
      reply: 'No events this week yet. Connect Gmail + Calendar to load your real week.',
      actions,
    }
  }
  if (intel.length && /intel|note|memo|what did/.test(s)) {
    return { reply: `From intel: ${intel.join(' · ')}.`, actions }
  }
  return {
    reply: 'I heard you. Try ask about your week, open mail, or Apply today.',
    actions,
  }
}

async function runDeskLoop(
  messages: { role: 'user' | 'assistant'; content: any }[],
  ctx: DeskContext,
): Promise<{ reply: string; toolsUsed: string[]; actions: DeskAction[] }> {
  let msgs = [...messages]
  const used: string[] = []
  const actions: DeskAction[] = []

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages: msgs,
    })

    if (response.stop_reason === 'end_turn') {
      const reply = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.Messages.TextBlock).text)
        .join('')
        .trim()
      return { reply: reply || 'Done.', toolsUsed: used, actions }
    }

    if (response.stop_reason === 'tool_use') {
      msgs.push({ role: 'assistant', content: response.content })
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        used.push(block.name)
        const input = (block.input || {}) as Record<string, unknown>
        let result = ''

        if (block.name === 'read_desk_context') {
          result = JSON.stringify(sliceContext(ctx, String(input.focus || 'all')))
        } else if (block.name === 'propose_action') {
          const type = String(input.type || '') as DeskActionType
          const allowed: DeskActionType[] = [
            'open_gmail',
            'open_apply',
            'open_connect',
            'refresh_calendar',
          ]
          if (allowed.includes(type)) {
            actions.push({ type })
            result = JSON.stringify({ ok: true, type })
          } else {
            result = JSON.stringify({ ok: false, error: 'unknown action' })
          }
        } else if (block.name === 'note_for_intel') {
          const line = String(input.line || '')
            .replace(/—/g, '-')
            .trim()
            .slice(0, 120)
          if (line) {
            actions.push({ type: 'prepend_intel', payload: line })
            result = JSON.stringify({ ok: true, line })
          } else {
            result = JSON.stringify({ ok: false, error: 'empty line' })
          }
        } else {
          result = `Tool "${block.name}" not available.`
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        })
      }

      msgs.push({ role: 'user', content: toolResults })
      continue
    }

    break
  }

  return {
    reply: 'I hit my step limit. Try a shorter ask.',
    toolsUsed: used,
    actions,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Unauthorized' })

  const body = (req.body || {}) as DeskAskBody
  const message = String(body.message || '').trim()
  const studentId = String(body.studentId || '').trim()
  const deskContext: DeskContext = body.deskContext || {}

  if (!message) return res.status(400).json({ error: 'No message' })
  if (!studentId || uid !== studentId) return res.status(403).json({ error: 'Forbidden' })

  const history = await loadHistory(deskConversationId(studentId))
  const contextNote = `Desk snapshot JSON:\n${JSON.stringify(sliceContext(deskContext))}`
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history,
    { role: 'user', content: `${message}\n\n${contextNote}` },
  ]

  try {
    const { reply, toolsUsed, actions } = await runDeskLoop(messages, deskContext)
    const cleanReply = reply.replace(/—/g, '-')
    saveExchange(deskConversationId(studentId), message, cleanReply).catch(() => {})
    return res.json({ reply: cleanReply, actions, toolsUsed })
  } catch (err) {
    console.error('[desk-ask] error:', err)
    const fb = keywordFallback(message, deskContext)
    saveExchange(deskConversationId(studentId), message, fb.reply).catch(() => {})
    return res.json({
      reply: fb.reply,
      actions: fb.actions,
      toolsUsed: [],
      fallback: true,
    })
  }
}
