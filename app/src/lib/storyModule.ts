/**
 * storyModule.ts
 *
 * Client for /api/story-module — the Groq agent that re-sets a session's
 * questions inside the concept's story world and attaches Socratic guidance.
 *
 * Fail-soft by design: any error, timeout, or partial result degrades to the
 * plain question bank stems. The math (choices/correctIndex) never comes from
 * here — only narrative stems and guidance text keyed by question id.
 */

import type { Question } from './questionBank'
import { questionFormat } from './questionBank'

const ENDPOINT = 'https://mindcraft-webhook.vercel.app/api/story-module'
const SESSION_PREFIX = 'storymod_v1_'
const TIMEOUT_MS = 25_000

export interface StoryModuleItem {
  storyStem: string
  socratic: string[]
  steps: string[]
  misconceptionCallout?: string
}

/** questionId → story-mode content for that question. */
export type StoryModule = Record<string, StoryModuleItem>

function sessionKey(conceptId: string, questions: Question[]): string {
  const ids = questions.map(q => q.id).sort().join(',')
  // djb2 — tiny stable hash so the key stays short
  let h = 5381
  for (let i = 0; i < ids.length; i++) h = ((h << 5) + h + ids.charCodeAt(i)) | 0
  return `${SESSION_PREFIX}${conceptId}_${(h >>> 0).toString(36)}`
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
  try { sessionStorage.setItem(key, JSON.stringify(mod)) } catch { /* full — non-fatal */ }
}

/**
 * Fetch the story module for a session's question set.
 * Returns null on any failure so callers can fall back to plain questions.
 */
export async function fetchStoryModule(
  conceptId: string,
  conceptName: string,
  story: string,
  questions: Question[],
): Promise<StoryModule | null> {
  if (questions.length === 0) return null

  const key = sessionKey(conceptId, questions)
  const cached = readSession(key)
  if (cached && Object.keys(cached).length > 0) return cached

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        conceptId,
        conceptName,
        story,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          choices: q.choices,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          hints: q.hints,
          level: q.level,
          format: questionFormat(q),
          misconceptionLabel: q.misconception_label,
        })),
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { items?: StoryModule }
    const items = data.items ?? {}
    if (Object.keys(items).length === 0) return null
    writeSession(key, items)
    return items
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}
