/**
 * lib/jarvisTools.ts
 *
 * Five tools available to the JARVIS LangGraph agent:
 *   explain_concept    — generates 4 cinematic help cards for a math problem
 *   get_student_profile — fetches ML mastery/strength profile from Cloud Run
 *   get_recommendations — fetches personalised concept recommendations
 *   get_session_history — reads recent tutoring sessions from Firestore
 *   navigate            — tells the frontend to route to a page
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { db } from './firebase'

// ── Card generation (called inside explain_concept tool) ──────────────────────

const STYLE_RULES: Record<string, string> = {
  geometric:  'Emphasize shapes, motion, and spatial relationships. Ground every idea in what it looks like.',
  algebraic:  'Emphasize structure, patterns, and symbolic manipulation. Show how symbols encode the idea.',
  intuitive:  'Emphasize story, motion, and "why it makes sense." Make the student feel the math before seeing it.',
}

const CARD_SHAPE = `{
  "helpCards": [
    {
      "title": "2-3 word concept title",
      "tagline": "A poetic, philosophical one-liner about this concept",
      "visual": "Describe a minimal glowing diagram in one sentence (what it would look like, what it shows)",
      "core_insight": "2-3 elegant sentences. Intelligent, calm, slightly poetic.",
      "equation": "The key mathematical relationship, clean, no prose",
      "applications": ["Real-world use 1", "Real-world use 2"],
      "step": 1
    }
  ]
}`

async function generateCards(
  problem: string,
  style: 'geometric' | 'algebraic' | 'intuitive',
): Promise<object> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `You are JARVIS, the AI tutor inside MindCraft. Your homework help cards are cinematic —
they feel like a premium mathematics magazine, not a textbook.

STYLE ADAPTATION: ${STYLE_RULES[style]}

Generate exactly 4 cards in this sequence:
  Card 1 — "The Big Picture": what concept family this belongs to, why it matters in mathematics
  Card 2 — "The Foundation": the one building block the student must grasp first
  Card 3 — "The Method": the strategic approach — no solving, just the map
  Card 4 — "The Solution": walk through the actual answer as an elegant narrative

DESIGN RULES (follow precisely):
• Title: 2-3 words, powerful and minimal
• Tagline: almost philosophical, could open a chapter in a math book
• Visual: describe what a minimal glowing diagram would show — a curve, intersection, triangle, graph
• Core insight: 2-3 sentences, intelligent and calm. No "you should" or "we need to".
• Equation: the single key relationship — clean, no surrounding prose
• Applications: 2 real-world uses that are interesting, not textbook-generic

Student's question: ${problem}

Return ONLY valid JSON (no markdown fences, no extra text) matching this exact shape:
${CARD_SHAPE}`

  const result  = await model.generateContent(prompt)
  const raw     = result.response.text().trim()
  const match   = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON returned from card generation')
  return JSON.parse(match[0])
}

// ── Tool factory ──────────────────────────────────────────────────────────────

export interface ToolOptions {
  studentId: string
  mlBase: string
  style: 'geometric' | 'algebraic' | 'intuitive'
}

export function makeTools({ studentId, mlBase, style }: ToolOptions) {

  // 1. explain_concept — cinematic 4-card breakdown
  const explain_concept = tool(
    async ({ problem, cardStyle }) => {
      try {
        const cards = await generateCards(problem, cardStyle ?? style)
        return JSON.stringify(cards)
      } catch (e) {
        return JSON.stringify({ error: String(e) })
      }
    },
    {
      name: 'explain_concept',
      description:
        'Generate cinematic educational cards for a math problem or concept. ' +
        'Call this whenever the student asks for help with any math question, wants a concept explained, or needs homework help.',
      schema: z.object({
        problem: z.string().describe('The exact math problem or concept the student wants help with'),
        cardStyle: z
          .enum(['geometric', 'algebraic', 'intuitive'])
          .optional()
          .describe('Learning style override for card tone (defaults to student profile style)'),
      }),
    },
  )

  // 2. get_student_profile — ML mastery profile
  const get_student_profile = tool(
    async ({ sid }) => {
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
    {
      name: 'get_student_profile',
      description:
        "Fetch the student's ML learning profile: concept mastery scores, top strengths, and top knowledge gaps. " +
        'Call when asked about progress, strengths, weaknesses, how they are doing, or their learning profile.',
      schema: z.object({
        sid: z.string().optional().describe('Student Firebase UID (omit to use current student)'),
      }),
    },
  )

  // 3. get_recommendations — personalised concept suggestions
  const get_recommendations = tool(
    async ({ mode }) => {
      try {
        if (!studentId) return 'No student ID available.'
        const res = await fetch(`${mlBase}/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId, target_concepts: [], mode }),
        })
        if (!res.ok) return 'No recommendations available yet.'
        const data = await res.json()
        const recs = (data.recommendations ?? []).slice(0, 5)
        return JSON.stringify(recs)
      } catch {
        return 'Unable to fetch recommendations right now.'
      }
    },
    {
      name: 'get_recommendations',
      description:
        'Get personalised concept recommendations ranked by the ML engine. ' +
        'Call when the student asks what to study next, which topics to focus on, or for a personalised study plan.',
      schema: z.object({
        mode: z
          .enum(['curriculum', 'exam', 'explore'])
          .default('curriculum')
          .describe('Recommendation mode: curriculum (next in sequence), exam (gap-filling), explore (curiosity)'),
      }),
    },
  )

  // 4. get_session_history — recent tutoring sessions from Firestore
  const get_session_history = tool(
    async ({ limit }) => {
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
          return {
            date:     data.date,
            subject:  data.subject,
            topics:   data.topics,
            duration: data.duration,
            tutorId:  data.tutorId,
          }
        })
        return JSON.stringify(sessions)
      } catch {
        return 'Unable to fetch session history right now.'
      }
    },
    {
      name: 'get_session_history',
      description:
        "Retrieve the student's recent tutoring sessions from the database. " +
        'Call when asked about past sessions, what was covered recently, when the last class was, or session history.',
      schema: z.object({
        limit: z.number().optional().describe('Number of recent sessions to return (default 3, max 10)'),
      }),
    },
  )

  // 5. navigate — tell the frontend to route to a page
  const navigate = tool(
    ({ page, concept }) => {
      return JSON.stringify({ page, concept })
    },
    {
      name: 'navigate',
      description:
        'Navigate the student to a specific page in the MindCraft app. ' +
        'Call when the student says "go to", "take me to", "show me", "open", or mentions a page by name. ' +
        'For knowledge-graph, include the concept name if the student specified one (e.g. "study quadratic equations").',
      schema: z.object({
        page: z
          .enum(['dashboard', 'knowledge-graph', 'practice', 'book', 'study-timer'])
          .describe('The destination page'),
        concept: z
          .string()
          .optional()
          .describe('For knowledge-graph: the concept to explore (e.g. "quadratic equations")'),
      }),
    },
  )

  return [explain_concept, get_student_profile, get_recommendations, get_session_history, navigate]
}
