/**
 * questionAgent.ts
 *
 * Client wrapper for the /api/generate-questions Vercel endpoint.
 *
 * Two-layer cache:
 *   1. sessionStorage — instant, lasts the browser tab lifetime
 *   2. Firestore (server-side, 24 h) — handled by the backend
 *
 * Returns Question[] in the same shape as questionBank.ts so Practice.tsx
 * can drop them in without any schema changes.
 */

import type { Question } from './questionBank'

const ENDPOINT = 'https://mindcraft-webhook.vercel.app/api/generate-questions'
const SESSION_PREFIX = 'qgen_'

function sessionKey(conceptId: string, level: number, examType: string, count: number) {
  return `${SESSION_PREFIX}${conceptId}_L${level}_${examType}_N${count}`
}

function readSession(key: string): Question[] | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as Question[]
  } catch {
    return null
  }
}

function writeSession(key: string, questions: Question[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify(questions))
  } catch {
    // sessionStorage full or unavailable — non-fatal
  }
}

/**
 * Fetch dynamically generated questions for a concept/level/exam combo.
 * Returns [] on any error so callers can fall back to the static bank.
 */
export async function generateQuestions(
  conceptId: string,
  level: 1 | 2 | 3,
  examType = 'General',
  count = 8,
): Promise<Question[]> {
  const key = sessionKey(conceptId, level, examType, count)

  // 1. sessionStorage hit
  const cached = readSession(key)
  if (cached && cached.length > 0) return cached

  // 2. Fetch from backend (which checks Firestore cache first)
  try {
    const res = await fetch(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ conceptId, level, examType, count }),
    })

    if (!res.ok) return []

    const data = await res.json() as { questions?: Question[] }
    const questions = data.questions ?? []

    if (questions.length > 0) {
      writeSession(key, questions)
    }

    return questions
  } catch {
    return []
  }
}

/** Clear cached questions for a specific combo (e.g. after a session completes) */
export function evictQuestionCache(conceptId: string, level: number, examType: string) {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(`${SESSION_PREFIX}${conceptId}_L${level}_${examType}_N`)) {
        sessionStorage.removeItem(key)
      }
    }
  } catch {
    // ignore
  }
}
