/**
 * api/story-module.ts
 *
 * Story module agent — wraps a practice session's questions in the concept's
 * story world and attaches Socratic guidance, using Groq (Llama 3.3 70B).
 *
 * Composer core lives in `lib/storyModuleComposer.ts` (shared with the offline
 * bake — C-2). This handler owns CORS, Firestore cache, and response shaping.
 *
 * THE CONTRACT (deterministic spine, LLM skin):
 *   The LLM NEVER touches the math. Choices, correctIndex, and every numeric
 *   value stay byte-identical — it only rewrites the *stem* as a scene in the
 *   story and derives guidance (Socratic prompts + step plan) from the given
 *   explanation and misconception. Items that fail numeric validation are
 *   dropped; the client falls back to the plain question.
 *
 * Caching: per-question docs in `story_module_cache` (30-day TTL).
 *
 * POST {
 *   conceptId, conceptName, story,
 *   questions: [{ id, question, choices, correctIndex, explanation,
 *                 hints?, level?, format?, misconceptionLabel? }]
 * }
 * → { items: { [questionId]: StoryModuleItem }, cached: n, generated: n }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'
import {
  cacheDocId,
  composeStoryModuleItems,
  isValidItem,
  MAX_QUESTIONS,
  type IncomingQuestion,
  type StoryModuleItem,
} from '../lib/storyModuleComposer'

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

const ALLOWED_ORIGINS = new Set([
  'https://mindcraft-93858.web.app',
  'http://localhost:5173',
])

export type { StoryModuleItem }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin ?? '')
  res.setHeader(
    'Access-Control-Allow-Origin',
    ALLOWED_ORIGINS.has(origin) ? origin : 'https://mindcraft-93858.web.app',
  )
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const contentLength = Number(req.headers['content-length'] ?? 0)
  if (contentLength > 120_000) return res.status(413).json({ error: 'Payload too large' })

  const { conceptId, conceptName, story, questions, goals, tutorFocusConcepts, priorOutcomes, sessionKind } = (req.body ?? {}) as {
    conceptId?: string
    conceptName?: string
    story?: string
    questions?: IncomingQuestion[]
    goals?: { tags?: string[]; text?: string }
    tutorFocusConcepts?: string[]
    priorOutcomes?: Array<{ conceptId: string; questionId: string; correct: boolean }>
    sessionKind?: string
  }

  if (!conceptId || !conceptName || !story || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'conceptId, conceptName, story, and questions are required' })
  }

  const batch = questions
    .filter(q => q
      && typeof q.id === 'string'
      && typeof q.question === 'string'
      && q.question.length <= 4000
      && Array.isArray(q.choices)
      && q.choices.length <= 8
      && Number.isInteger(q.correctIndex)
      && typeof q.explanation === 'string'
      && q.explanation.length <= 6000)
    .slice(0, MAX_QUESTIONS)
  if (batch.length === 0) return res.status(400).json({ error: 'No valid questions' })

  const items: Record<string, StoryModuleItem> = {}

  let uncached: IncomingQuestion[] = batch
  try {
    const refs = batch.map(q => db.collection('story_module_cache').doc(
      cacheDocId(q.conceptId ?? conceptId, q.id),
    ))
    const snaps = await db.getAll(...refs)
    const missing: IncomingQuestion[] = []
    snaps.forEach((snap, i) => {
      const data = snap.exists ? snap.data() : undefined
      const fresh = data && Date.now() - (data.cachedAt ?? 0) < CACHE_TTL_MS
      if (fresh && isValidItem(data.item, batch[i])) {
        items[batch[i].id] = data.item as StoryModuleItem
      } else {
        missing.push(batch[i])
      }
    })
    uncached = missing
  } catch {
    // Firestore unavailable — generate everything
  }

  const cachedCount = batch.length - uncached.length

  if (uncached.length > 0) {
    const result = await composeStoryModuleItems({
      conceptId,
      conceptName,
      story,
      questions: uncached,
      context: {
        goals,
        tutorFocusConcepts,
        priorOutcomes,
        sessionKind,
      },
    })

    const writes: Promise<unknown>[] = []
    for (const [qid, item] of Object.entries(result.items)) {
      items[qid] = item
      const q = uncached.find(u => u.id === qid)
      if (!q) continue
      writes.push(
        db.collection('story_module_cache').doc(
          cacheDocId(q.conceptId ?? conceptId, q.id),
        ).set({
          item,
          conceptId: q.conceptId ?? conceptId,
          questionId: q.id,
          cachedAt: Date.now(),
        }).catch(() => { /* non-fatal */ }),
      )
    }
    await Promise.all(writes)
  }

  return res.json({
    items,
    cached: cachedCount,
    generated: Object.keys(items).length - cachedCount,
  })
}
