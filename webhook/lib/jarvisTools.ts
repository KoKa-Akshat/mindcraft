/**
 * lib/jarvisTools.ts
 *
 * JARVIS tool definitions and executors for the Anthropic tool-use API.
 *
 * Exports:
 *   TOOLS      — Anthropic Tool[] passed to client.messages.create()
 *   makeExecutors() — returns a map of tool name → async executor function
 *
 * Tools:
 *   explain_concept      — generates 4 cinematic help cards for a math concept
 *   get_student_profile  — fetches ML mastery / strength profile
 *   get_recommendations  — fetches personalised next-concept suggestions
 *   get_session_history  — reads recent tutoring sessions from Firestore
 *   navigate             — tells the frontend to route to a page
 */

import Anthropic from '@anthropic-ai/sdk'
import { db }    from './firebase'

const client = new Anthropic()
const MODEL  = 'claude-sonnet-4-20250514'

// ── Constants ──────────────────────────────────────────────────────────────────

const CARD_STYLES: Record<string, string> = {
  geometric:  'Emphasize shapes, motion, and spatial relationships. Ground every idea in what it looks like.',
  algebraic:  'Emphasize structure, patterns, and symbolic manipulation. Show how symbols encode the idea.',
  intuitive:  'Emphasize story, motion, and "why it makes sense." Make the student feel the math before seeing it.',
}

const CARD_SHAPE = `{
  "helpCards": [
    {
      "title": "2-3 word concept title",
      "tagline": "A poetic, philosophical one-liner about this concept",
      "visual": "Describe a minimal diagram in one sentence",
      "core_insight": "2-3 elegant sentences. Intelligent, calm, slightly poetic.",
      "equation": "The key mathematical relationship, clean, no prose",
      "applications": ["Real-world use 1", "Real-world use 2"],
      "step": 1
    }
  ]
}`

const CARD_SYSTEM = `You are JARVIS, the AI tutor inside MindCraft. Your homework help cards are cinematic —
they feel like a premium mathematics magazine, not a textbook.

Generate exactly 4 cards in this sequence:
  Card 1 — "The Big Picture": what concept family this belongs to, why it matters
  Card 2 — "The Foundation": the one building block the student must grasp first
  Card 3 — "The Method": the strategic approach — no solving, just the map
  Card 4 — "The Solution": walk through the actual answer as an elegant narrative

DESIGN RULES:
• Title: 2-3 words, powerful and minimal
• Tagline: almost philosophical, could open a chapter in a math book
• Visual: describe what a minimal diagram would show
• Core insight: 2-3 sentences, intelligent and calm
• Equation: the single key relationship, no surrounding prose
• Applications: 2 real-world uses that are genuinely interesting

Return ONLY valid JSON matching the given shape. No markdown fences.`

// ── Card generation (internal) ────────────────────────────────────────────────

async function generateCards(problem: string, style: string): Promise<string> {
  const styleGuide = CARD_STYLES[style] ?? CARD_STYLES.intuitive
  const message = await client.messages.create({
    model:       MODEL,
    max_tokens:  2048,
    temperature: 0.5,
    system:      CARD_SYSTEM,
    messages: [{
      role:    'user',
      content: `STYLE: ${styleGuide}\n\nStudent's question: ${problem}\n\nReturn JSON matching this shape:\n${CARD_SHAPE}`,
    }],
  })

  const raw   = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON returned from card generation')
  return match[0]
}

// ── Anthropic tool definitions ─────────────────────────────────────────────────

export const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name:        'explain_concept',
    description:
      'Generate cinematic educational cards for a math problem or concept. ' +
      'Call this whenever the student asks for help with any math question, wants a concept explained, or needs homework help.',
    input_schema: {
      type: 'object',
      properties: {
        problem: {
          type:        'string',
          description: 'The exact math problem or concept the student wants help with',
        },
        cardStyle: {
          type:        'string',
          enum:        ['geometric', 'algebraic', 'intuitive'],
          description: 'Learning style override for card tone',
        },
      },
      required: ['problem'],
    },
  },
  {
    name:        'get_student_profile',
    description:
      "Fetch the student's ML learning profile: concept mastery scores, top strengths, and top knowledge gaps. " +
      'Call when asked about progress, strengths, weaknesses, or how the student is doing.',
    input_schema: {
      type:       'object',
      properties: {
        sid: { type: 'string', description: 'Student Firebase UID (omit to use current student)' },
      },
    },
  },
  {
    name:        'get_recommendations',
    description:
      'Get personalised concept recommendations ranked by the ML engine. ' +
      'Call when the student asks what to study next, which topics to focus on, or for a study plan.',
    input_schema: {
      type:       'object',
      properties: {
        mode: {
          type:        'string',
          enum:        ['curriculum', 'exam', 'explore'],
          description: 'curriculum = next in sequence, exam = gap-filling, explore = curiosity',
        },
      },
    },
  },
  {
    name:        'get_session_history',
    description:
      "Retrieve the student's recent tutoring sessions from the database. " +
      'Call when asked about past sessions, what was covered, or when the last class was.',
    input_schema: {
      type:       'object',
      properties: {
        limit: { type: 'number', description: 'Number of sessions to return (default 3)' },
      },
    },
  },
  {
    name:        'navigate',
    description:
      'Navigate the student to a specific page in the MindCraft app. ' +
      'Call when the student says "go to", "take me to", "open", or mentions a page by name.',
    input_schema: {
      type: 'object',
      properties: {
        page: {
          type:        'string',
          enum:        ['dashboard', 'knowledge-graph', 'practice', 'book', 'study-timer'],
          description: 'The destination page',
        },
        concept: {
          type:        'string',
          description: 'For knowledge-graph: the concept to explore (e.g. "quadratic equations")',
        },
      },
      required: ['page'],
    },
  },
]

// ── Executor factory ───────────────────────────────────────────────────────────

export interface ExecutorOptions {
  studentId: string
  mlBase:    string
  style:     string
}

export function makeExecutors(opts: ExecutorOptions): Record<string, (input: any) => Promise<string>> {
  const { studentId, mlBase, style } = opts

  return {
    explain_concept: async ({ problem, cardStyle }: { problem: string; cardStyle?: string }) => {
      try {
        return await generateCards(problem, cardStyle ?? style)
      } catch (e) {
        return JSON.stringify({ error: String(e) })
      }
    },

    get_student_profile: async ({ sid }: { sid?: string }) => {
      try {
        const targetId = sid ?? studentId
        if (!targetId) return 'No student ID available.'
        const res = await fetch(`${mlBase}/student-profile/${targetId}`)
        if (!res.ok) return 'No profile data available yet — the student may not have completed any sessions.'
        return JSON.stringify(await res.json())
      } catch {
        return 'Unable to fetch student profile right now.'
      }
    },

    get_recommendations: async ({ mode }: { mode?: string }) => {
      try {
        if (!studentId) return 'No student ID available.'
        const res = await fetch(`${mlBase}/recommend`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ student_id: studentId, target_concepts: [], mode }),
        })
        if (!res.ok) return 'No recommendations available yet.'
        const data = await res.json()
        return JSON.stringify((data.recommendations ?? []).slice(0, 5))
      } catch {
        return 'Unable to fetch recommendations right now.'
      }
    },

    get_session_history: async ({ limit }: { limit?: number }) => {
      try {
        if (!studentId) return 'No student ID available.'
        const snap = await db
          .collection('sessions')
          .where('studentId', '==', studentId)
          .orderBy('date', 'desc')
          .limit(limit ?? 3)
          .get()
        if (snap.empty) return 'No sessions on record yet.'
        const sessions = snap.docs.map(d => {
          const data = d.data()
          return { date: data.date, subject: data.subject, topics: data.topics, duration: data.duration }
        })
        return JSON.stringify(sessions)
      } catch {
        return 'Unable to fetch session history right now.'
      }
    },

    navigate: ({ page, concept }: { page: string; concept?: string }) => {
      return Promise.resolve(JSON.stringify({ page, concept }))
    },
  }
}
