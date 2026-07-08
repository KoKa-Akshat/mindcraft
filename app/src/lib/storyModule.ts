/**
 * storyModule.ts — client for /api/story-module (Groq batched skin).
 * Multi-concept sessions send each question with its own concept story.
 * Incremental ensureStorySkins() covers follow-ups after adaptive reshuffle.
 */
import type { Question } from './questionBank'
import { questionFormat } from './questionBank'
import { enrichQuestionsWithStories, selectStoryForConcept } from './storySelection'

const ENDPOINT = 'https://mindcraft-webhook.vercel.app/api/story-module'
const SESSION_PREFIX = 'storymod_v3_'
const TIMEOUT_MS = 25_000

export interface StoryModuleItem {
  storyStem: string
  socratic: string[]
  steps: string[]
  misconceptionCallout?: string
}

export type StoryModule = Record<string, StoryModuleItem>

export interface StoryGoals {
  tags: string[]
  text: string
}

export interface StoryModuleContext {
  goals?: StoryGoals
  tutorFocusConcepts?: string[]
  priorOutcomes?: Array<{ conceptId: string; questionId: string; correct: boolean }>
  sessionKind?: 'diagnostic' | 'practice' | 'gapscan'
}

function sessionKey(
  questions: Question[],
  ctx?: StoryModuleContext,
): string {
  const ids = questions.map(q => q.id).sort().join(',')
  const goalsBit = ctx?.goals?.text?.trim().slice(0, 40) ?? ''
  const raw = `${ids}|${goalsBit}|${(ctx?.tutorFocusConcepts ?? []).join(',')}`
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0
  return `${SESSION_PREFIX}${(h >>> 0).toString(36)}`
}

function readSession(key: string): StoryModule | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) as StoryModule : null
  } catch {
    return null
  }
}

function writeSession(key: string, mod: StoryModule) {
  try { sessionStorage.setItem(key, JSON.stringify(mod)) } catch { /* non-fatal */ }
}

function mapQuestionsPayload(questions: Question[], ctx?: StoryModuleContext) {
  const enriched = enrichQuestionsWithStories(questions, {
    goalTags: ctx?.goals?.tags ?? [],
    goalText: ctx?.goals?.text,
    tutorFocusConcepts: ctx?.tutorFocusConcepts,
  })
  return enriched.map(q => ({
    id: q.id,
    conceptId: q.conceptId,
    conceptName: q.conceptName,
    conceptStory: q.conceptStory.slice(0, 3500),
    protagonist: q.protagonist,
    question: q.question,
    choices: q.choices,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    hints: q.hints,
    level: q.level,
    format: questionFormat(q),
    misconceptionLabel: q.misconception_label,
    storyContext: q.storyContext,
    storyIntro: q.storyIntro,
  }))
}

async function postStoryModule(body: Record<string, unknown>): Promise<StoryModule | null> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const data = await res.json() as { items?: StoryModule }
    const items = data.items ?? {}
    return Object.keys(items).length > 0 ? items : null
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

/** Single-concept practice session (legacy path). */
export async function fetchStoryModule(
  conceptId: string,
  conceptName: string,
  story: string,
  questions: Question[],
  ctx?: StoryModuleContext,
): Promise<StoryModule | null> {
  if (questions.length === 0) return null

  const key = sessionKey(questions, ctx)
  const cached = readSession(key)
  if (cached && Object.keys(cached).length > 0) return cached

  const goalTags = ctx?.goals?.tags ?? []
  const items = await postStoryModule({
    conceptId,
    conceptName,
    story,
    goals: ctx?.goals,
    tutorFocusConcepts: ctx?.tutorFocusConcepts,
    priorOutcomes: ctx?.priorOutcomes,
    sessionKind: ctx?.sessionKind,
    questions: mapQuestionsPayload(questions, ctx),
  })
  if (items) writeSession(key, items)
  return items
}

/**
 * Diagnostic / mixed-concept batch — each question carries its own story world.
 * One Groq call; webhook uses per-question conceptStory when present.
 */
export async function fetchStoryModuleForQuestions(
  questions: Question[],
  ctx?: StoryModuleContext,
): Promise<StoryModule | null> {
  if (questions.length === 0) return null

  const key = sessionKey(questions, ctx)
  const cached = readSession(key)
  if (cached && Object.keys(cached).length >= questions.length) return cached

  const concepts = [...new Set(questions.map(q => q.conceptId))]
  const anchor = selectStoryForConcept(concepts[0] ?? questions[0].conceptId)
  const storySummary = concepts.length > 1
    ? `This session spans ${concepts.length} math concepts. Each question includes its own matched folk tale or origin story — use THAT world for THAT question only. Weave the math into the protagonist's stakes.`
    : (anchor?.story ?? '')

  const items = await postStoryModule({
    conceptId: concepts.length > 1 ? 'diagnostic_mixed' : (anchor?.conceptId ?? concepts[0]),
    conceptName: concepts.length > 1 ? 'Your map' : (anchor?.conceptName ?? 'Practice'),
    story: storySummary,
    goals: ctx?.goals,
    tutorFocusConcepts: ctx?.tutorFocusConcepts,
    priorOutcomes: ctx?.priorOutcomes,
    sessionKind: ctx?.sessionKind ?? 'diagnostic',
    questions: mapQuestionsPayload(questions, ctx),
  })
  if (!items) return cached
  const merged = { ...(cached ?? {}), ...items }
  writeSession(key, merged)
  return merged
}

/** Skin only questions missing from the current module (follow-ups after reshuffle). */
export async function ensureStorySkins(
  existing: StoryModule | null,
  questions: Question[],
  ctx?: StoryModuleContext,
): Promise<StoryModule> {
  const base = existing ?? {}
  const missing = questions.filter(q => !base[q.id]?.storyStem?.trim())
  if (missing.length === 0) return base
  const added = await fetchStoryModuleForQuestions(missing, {
    ...ctx,
    priorOutcomes: ctx?.priorOutcomes,
  })
  return added ? { ...base, ...added } : base
}
