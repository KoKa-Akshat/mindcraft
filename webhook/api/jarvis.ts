/**
 * api/jarvis.ts
 *
 * Two modes:
 *   1. Regular chat  → { reply: string }
 *   2. Homework help → { reply: string, helpCards: CinematicCard[] }
 *
 * Homework mode returns 4 cinematic editorial cards:
 * dark background, gold/cream, elegant — math as a cinematic experience.
 * Adapts to student's learning style: geometric | algebraic | intuitive.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { setCors } from '../lib/cors'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

const HOMEWORK_RE = /help\s*me|explain|how\s+do\s+I|how\s+to|can\s+you\s+show|I\s+don'?t\s+understand|solve|simplify|find\s+the|prove|derive|what\s+is\s+a|why\s+does|step[\s-]by[\s-]step|walk\s+me\s+through/i
const EQUATION_RE = /[=+\-*/^√∫∑][0-9x]|[0-9x][=+\-*/^√∫∑]|\b(?:equation|formula|function|derivative|integral|factor|simplify|expand|evaluate)\b/i

function isHomeworkQuestion(msg: string): boolean {
  return HOMEWORK_RE.test(msg) || EQUATION_RE.test(msg)
}

function extractStyle(context: string): 'geometric' | 'algebraic' | 'intuitive' {
  if (/geometric/i.test(context)) return 'geometric'
  if (/algebraic/i.test(context)) return 'algebraic'
  return 'intuitive'
}

const CARD_SHAPE = `{
  "reply": "One calm, intelligent sentence introducing the cards",
  "helpCards": [
    {
      "title": "2-3 word concept title",
      "tagline": "A poetic, philosophical one-liner about this concept",
      "visual": "Describe a minimal glowing diagram in one sentence (what it would look like, what it shows)",
      "core_insight": "2-3 elegant sentences. Intelligent, calm, slightly poetic. Use 'think of it as' or motion/story.",
      "equation": "The key mathematical relationship, clean, no prose",
      "applications": ["Real-world use 1", "Real-world use 2"],
      "step": 1
    }
  ]
}`

const STYLE_RULES: Record<string, string> = {
  geometric:  'Emphasize shapes, motion, and spatial relationships. Ground every idea in what it looks like.',
  algebraic:  'Emphasize structure, patterns, and symbolic manipulation. Show how symbols encode the idea.',
  intuitive:  'Emphasize story, motion, and "why it makes sense." Make the student feel the math before seeing it.',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { message, context } = req.body as { message: string; context: string }
  if (!message) return res.status(400).json({ error: 'No message' })

  try {
    if (isHomeworkQuestion(message)) {
      const style = extractStyle(context)
      const styleRule = STYLE_RULES[style]

      const prompt = `You are JARVIS, the AI tutor inside MindCraft. Your homework help cards are cinematic —
they feel like a premium mathematics magazine, not a textbook.

STYLE ADAPTATION: ${styleRule}

Generate exactly 4 cards in this sequence:
  Card 1 — "The Big Picture": what concept family this belongs to, why it matters in mathematics
  Card 2 — "The Foundation": the one building block the student must grasp first
  Card 3 — "The Method": the strategic approach — no solving, just the map
  Card 4 — "The Solution": walk through the actual answer as an elegant narrative

DESIGN RULES (follow precisely):
• Title: 2-3 words, powerful and minimal
• Tagline: almost philosophical, could open a chapter in a math book
• Visual: describe what a minimal glowing diagram would show — a curve, intersection, triangle, graph
• Core insight: 2-3 sentences, intelligent and calm. No "you should" or "we need to". Write as mathematical truth.
• Equation: the single key relationship — clean, no surrounding prose
• Applications: 2 real-world uses that are interesting, not textbook-generic

Student context: ${context}
Student's question: ${message}

Return ONLY valid JSON (no markdown fences, no extra text) matching this exact shape:
${CARD_SHAPE}`

      const result = await model.generateContent(prompt)
      const raw = result.response.text().trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.helpCards?.length) {
            parsed.helpCards = parsed.helpCards.map((c: any, i: number) => ({ ...c, step: i + 1, style }))
            return res.json(parsed)
          }
        } catch { /* fall through */ }
      }
    }

    // Regular chat mode
    const prompt = `You are JARVIS, an AI assistant built into MindCraft — an intelligent tutoring platform.
Your personality: precise, calm, slightly formal, and genuinely helpful. Like J.A.R.V.I.S. from Iron Man.
Rules:
- Keep every response to 1-3 sentences maximum. Be concise.
- Address the user by name when you know it.
- Never say "I'm an AI" — you are JARVIS.
- If asked to navigate somewhere, say "Navigating to [page] now."
- Speak about the platform features as if you know them intimately.
- If they ask for homework help, say "Type your full problem and I'll break it down into cinematic help cards for you."

User context: ${context}
User says: ${message}`

    const result = await model.generateContent(prompt)
    return res.json({ reply: result.response.text().trim() })
  } catch {
    return res.json({ reply: fallback(message, context), fallback: true })
  }
}

function fallback(msg: string, ctx: string): string {
  const m = msg.toLowerCase()
  if (m.includes('session') || m.includes('class'))
    return ctx.includes('Last session')
      ? 'Your last session details are displayed on your dashboard.'
      : 'No sessions on record yet. Book your first session to get started.'
  if (m.includes('practice') || m.includes('problem'))
    return 'Your practice problems are ready in the Practice Ready panel.'
  if (m.includes('book') || m.includes('schedule'))
    return 'I can take you to the booking page — just say "book a session".'
  if (m.includes('hello') || m.includes('hi') || m.includes('hey'))
    return 'Good to see you. All systems are operational. How may I assist you?'
  return 'Ask me about your sessions, practice, or any math problem and I will assist.'
}
