/**
 * api/story-module.ts
 *
 * Story module agent — wraps a practice session's questions in the concept's
 * story world and attaches Socratic guidance, using Groq (Llama 3.3 70B).
 *
 * THE CONTRACT (deterministic spine, LLM skin):
 *   The LLM NEVER touches the math. Choices, correctIndex, and every numeric
 *   value stay byte-identical — it only rewrites the *stem* as a scene in the
 *   story and derives guidance (Socratic prompts + step plan) from the given
 *   explanation and misconception. Items that fail numeric validation are
 *   dropped; the client falls back to the plain question.
 *
 * Signals given to the model per question: stem, choices, the correct answer
 * text, the worked explanation ("how to solve"), existing hints, level,
 * format/vessel, and the tagged misconception.
 *
 * Caching: per-question docs in `story_module_cache` (30-day TTL) — reskins
 * are stable per question, so any student who draws the same bank question
 * reuses the same scene. Only uncached questions hit Groq, in ONE batch call.
 *
 * POST {
 *   conceptId, conceptName, story,
 *   questions: [{ id, question, choices, correctIndex, explanation,
 *                 hints?, level?, format?, misconceptionLabel? }]
 * }
 * → { items: { [questionId]: StoryModuleItem }, cached: n, generated: n }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ChatGroq } from '@langchain/groq'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { JsonOutputParser } from '@langchain/core/output_parsers'
import { db } from '../lib/firebase'

const ALLOWED_ORIGIN = 'https://mindcraft-93858.web.app'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 d — bank questions are static
const CACHE_VERSION = 'v1'
const MAX_QUESTIONS = 12
const MAX_STORY_CHARS = 4000

export interface StoryModuleItem {
  storyStem: string          // the question re-set inside the story world
  socratic: string[]         // 2 guiding questions, no answers revealed
  steps: string[]            // 2-5 step plan derived from the explanation
  misconceptionCallout?: string // story-voiced warning about the tagged trap
}

interface IncomingQuestion {
  id: string
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
  hints?: string[]
  level?: number
  format?: string
  misconceptionLabel?: string
}

function cacheDocId(conceptId: string, questionId: string): string {
  // Firestore doc ids cannot contain '/'
  const safe = (s: string) => s.replace(/\//g, '_').slice(0, 180)
  return `${CACHE_VERSION}__${safe(conceptId)}__${safe(questionId)}`
}

/** Every digit-run in the original stem must survive into the story stem —
 *  the reskin may add narrative numbers but never lose mathematical ones. */
function numbersPreserved(originalStem: string, storyStem: string): boolean {
  const nums = originalStem.match(/\d+(?:\.\d+)?/g) ?? []
  return nums.every(n => storyStem.includes(n))
}

const BANNED_MARKUP = /(<script|<svg|<iframe|javascript:|on\w+=)/i

function isValidItem(
  raw: unknown,
  original: IncomingQuestion,
): raw is StoryModuleItem {
  if (!raw || typeof raw !== 'object') return false
  const item = raw as Partial<StoryModuleItem>
  if (typeof item.storyStem !== 'string' || item.storyStem.trim().length < 20) return false
  if (item.storyStem.length > 2200) return false
  if (BANNED_MARKUP.test(item.storyStem)) return false
  if (!numbersPreserved(original.question, item.storyStem)) return false
  if (!Array.isArray(item.socratic)
    || item.socratic.length < 1 || item.socratic.length > 3
    || !item.socratic.every(sq => typeof sq === 'string' && sq.trim().length > 0)) return false
  if (!Array.isArray(item.steps)
    || item.steps.length < 2 || item.steps.length > 6
    || !item.steps.every(st => typeof st === 'string' && st.trim().length > 0)) return false
  if (item.misconceptionCallout !== undefined
    && typeof item.misconceptionCallout !== 'string') return false
  // Guidance must not leak the answer letter or the exact correct choice text.
  const correctText = original.choices[original.correctIndex] ?? ''
  const leaky = (s: string) =>
    correctText.length > 2 && s.toLowerCase().includes(correctText.toLowerCase())
  if (item.socratic.some(leaky)) return false
  return true
}

const SYSTEM_TEMPLATE = `You are MindCraft's story-module composer. A student is about to practice the math concept "{concept_name}". The concept has an origin story — a real historical narrative of why this math exists. Your job is to re-set each practice question INSIDE that story's world and attach guidance, so the session feels like living the story rather than grinding a worksheet.

THE STORY:
{story}

ABSOLUTE RULES — the math is frozen:
1. NEVER change, remove, or reorder any number, variable, equation, unit, or mathematical relationship in a question. Every numeric value in the original stem MUST appear verbatim in your rewrite.
2. NEVER mention the answer choices — the app renders them unchanged. Your stem must ask for exactly the same quantity the original asks for.
3. Keep any LaTeX (\\( \\), $ $, \\[ \\]) exactly as written.
4. Each storyStem must stand alone (2-4 sentences of scene + the full mathematical ask). Do NOT reference other questions or "the previous scene" — questions can appear in any order.
5. Use the story's actual characters, places, and stakes. If the original stem's context conflicts with the story world, translate the surface context but keep the math identical.

GUIDANCE — derived from the signals given per question:
• "socratic": exactly 2 short guiding questions a great tutor would ask, in story voice. Lead toward the method, never reveal the answer or the correct choice.
• "steps": 2-5 short imperative steps distilled from the worked explanation ("how to solve"). Plain language a 9th grader follows. No final numeric answer in the steps — end with "…which gives your answer."
• "misconceptionCallout": ONLY if a misconception is tagged — one sentence, story-voiced, warning about that exact trap without shame. Omit the field otherwise.
• Never say: wrong, failed, bad, stupid, easy. Direct and respectful, no cheerleading, no emojis.

QUESTIONS (JSON — per question you get the stem, choices, correct answer, worked explanation, hints, difficulty level, format, and tagged misconception):
{questions_json}

Return ONLY a JSON object keyed by question id — no markdown fences, no commentary:
{{"<questionId>": {{"storyStem": "...", "socratic": ["...", "..."], "steps": ["...", "..."], "misconceptionCallout": "..."}}}}`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Abuse guard: reject oversized payloads before doing any work.
  const contentLength = Number(req.headers['content-length'] ?? 0)
  if (contentLength > 120_000) return res.status(413).json({ error: 'Payload too large' })

  const { conceptId, conceptName, story, questions } = (req.body ?? {}) as {
    conceptId?: string
    conceptName?: string
    story?: string
    questions?: IncomingQuestion[]
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

  // ── 1. Per-question cache lookup ────────────────────────────────────────────
  let uncached: IncomingQuestion[] = batch
  try {
    const refs = batch.map(q => db.collection('story_module_cache').doc(cacheDocId(conceptId, q.id)))
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

  // ── 2. One batched Groq call for the misses ────────────────────────────────
  if (uncached.length > 0) {
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY ?? '',
      model: 'llama-3.3-70b-versatile',
      temperature: 0.55, // fidelity over flair — the math must survive
      maxTokens: 6000,
    })

    const prompt = ChatPromptTemplate.fromMessages([['system', SYSTEM_TEMPLATE]])
    const chain = prompt.pipe(model).pipe(new JsonOutputParser())

    const questionsJson = JSON.stringify(uncached.map(q => ({
      id: q.id,
      stem: q.question,
      choices: q.choices,
      correctAnswer: q.choices[q.correctIndex] ?? '',
      howToSolve: q.explanation,
      existingHints: q.hints ?? [],
      difficultyLevel: q.level ?? 2,
      format: q.format ?? 'symbolic_expression',
      misconception: q.misconceptionLabel ?? null,
    })))

    try {
      const raw = await chain.invoke({
        concept_name: conceptName,
        story: story.slice(0, MAX_STORY_CHARS),
        questions_json: questionsJson,
      }) as Record<string, unknown>

      const writes: Promise<unknown>[] = []
      for (const q of uncached) {
        const candidate = raw?.[q.id]
        if (isValidItem(candidate, q)) {
          items[q.id] = candidate
          writes.push(
            db.collection('story_module_cache').doc(cacheDocId(conceptId, q.id)).set({
              item: candidate,
              conceptId,
              questionId: q.id,
              cachedAt: Date.now(),
            }).catch(() => { /* non-fatal */ }),
          )
        }
        // invalid/missing → omitted; client shows the plain question
      }
      await Promise.all(writes)
    } catch {
      // Groq failure — return whatever the cache had; client falls back
    }
  }

  return res.json({
    items,
    cached: cachedCount,
    generated: Object.keys(items).length - cachedCount,
  })
}
