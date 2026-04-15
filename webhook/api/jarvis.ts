/**
 * api/jarvis.ts
 *
 * JARVIS — MindCraft's AI assistant.
 * Receives a message + user context string, returns a short AI reply.
 * Uses Claude Haiku with a JARVIS persona.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../lib/cors'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { message, context } = req.body as { message: string; context: string }
  if (!message) return res.status(400).json({ error: 'No message' })

  try {
    const system = `You are JARVIS, an AI assistant built into MindCraft — an intelligent tutoring platform.
Your personality: precise, calm, slightly formal, and genuinely helpful. Like J.A.R.V.I.S. from Iron Man.
Rules:
- Keep every response to 1-3 sentences maximum. Be concise.
- Address the user by name when you know it.
- Never say "I'm an AI" — you are JARVIS.
- If asked to navigate somewhere, say "Navigating to [page] now."
- Speak about the platform features as if you know them intimately.

User's current context:
${context}`

    const resp = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 180,
      system,
      messages:   [{ role: 'user', content: message }],
    })

    const reply = resp.content[0].type === 'text' ? resp.content[0].text : ''
    return res.json({ reply })
  } catch (err: any) {
    // Fallback: keyword-based responses if API fails
    return res.json({ reply: fallback(message, context), fallback: true })
  }
}

function fallback(msg: string, ctx: string): string {
  const m = msg.toLowerCase()
  if (m.includes('session') || m.includes('class'))
    return ctx.includes('Last session')
      ? 'Your last session details are displayed on your dashboard. I recommend reviewing the summary before your next session.'
      : 'You have no sessions on record yet. I suggest booking your first session to get started.'
  if (m.includes('practice') || m.includes('problem'))
    return 'Your practice problems are ready in the Practice Ready panel. Consistent daily practice accelerates learning significantly.'
  if (m.includes('message') || m.includes('tutor'))
    return 'Your tutor messages are visible in the Messages panel. I can navigate you there if needed.'
  if (m.includes('book') || m.includes('schedule'))
    return 'I can take you to the booking page. Simply click Book Session in the header.'
  if (m.includes('study') || m.includes('technique') || m.includes('timer') || m.includes('pomodoro'))
    return 'The Study Techniques page offers five research-backed methods including Pomodoro, 52/17, Ultradian cycles, Deep Work, and Flowtime.'
  if (m.includes('hello') || m.includes('hi') || m.includes('hey'))
    return 'Good to see you. All systems are operational. How may I assist you today?'
  return 'I am monitoring all your dashboard metrics. Ask me about your sessions, practice, or study techniques and I will assist.'
}
