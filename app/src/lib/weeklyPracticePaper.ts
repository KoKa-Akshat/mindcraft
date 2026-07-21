/**
 * Weekly practice paper — Anki-flavored mix of strengths + weaknesses.
 * Combines "practice next" (weakness) and "learn new" (fresh) into one
 * printable/playable set for the week. Pure client scaffold for now;
 * mastery evidence still flows through /record-outcomes as usual.
 */
import { getQuestions, type Question, shuffle } from './questionBank'
import type { NextConcept } from './recommendNextConcept'

export type WeeklyPaperSlot = {
  conceptId: string
  role: 'strengthen' | 'stretch' | 'review'
  label: string
}

export type WeeklyPracticePaper = {
  weekKey: string
  title: string
  slots: WeeklyPaperSlot[]
  questionIds: string[]
  builtAt: string
}

function weekKey(d = new Date()): string {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil((((d.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Build a short weekly mix: mostly weakness drills, a stretch of learn-next,
 * plus light review. Caps questions so the paper feels like a warm quiz, not
 * a marathon.
 */
export function buildWeeklyPracticePaper(opts: {
  weakness: NextConcept | null
  learn: NextConcept | null
  reviewConceptIds?: string[]
  questionsPerSlot?: number
}): WeeklyPracticePaper {
  const per = opts.questionsPerSlot ?? 3
  const slots: WeeklyPaperSlot[] = []

  if (opts.weakness) {
    slots.push({
      conceptId: opts.weakness.conceptId,
      role: 'strengthen',
      label: opts.weakness.label,
    })
  }
  if (opts.learn && opts.learn.conceptId !== opts.weakness?.conceptId) {
    slots.push({
      conceptId: opts.learn.conceptId,
      role: 'stretch',
      label: opts.learn.label,
    })
  }
  for (const id of opts.reviewConceptIds ?? []) {
    if (slots.some(s => s.conceptId === id)) continue
    if (slots.length >= 4) break
    slots.push({ conceptId: id, role: 'review', label: id.replace(/_/g, ' ') })
  }

  const questions: Question[] = []
  for (const slot of slots) {
    const level = slot.role === 'stretch' ? 1 : slot.role === 'strengthen' ? 2 : 1
    const batch = getQuestions(slot.conceptId, level as 1 | 2 | 3, per)
    questions.push(...batch)
  }

  const mixed = shuffle(questions).slice(0, Math.max(6, slots.length * per))

  return {
    weekKey: weekKey(),
    title: 'This week’s paper',
    slots,
    questionIds: mixed.map(q => q.id),
    builtAt: new Date().toISOString(),
  }
}

const STORAGE_KEY = 'mc-weekly-paper'

export function loadCachedWeeklyPaper(): WeeklyPracticePaper | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const paper = JSON.parse(raw) as WeeklyPracticePaper
    if (paper.weekKey !== weekKey()) return null
    return paper
  } catch {
    return null
  }
}

export function cacheWeeklyPaper(paper: WeeklyPracticePaper) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paper))
  } catch { /* ignore */ }
}
