/**
 * Weekly practice paper — Anki-flavored mix of strengths + weaknesses.
 * Combines "practice next" (weakness) and "learn new" (fresh) into one
 * printable/playable set for the week. Pure client scaffold for now;
 * mastery evidence still flows through /record-outcomes as usual.
 *
 * Topic picker (Dashboard Weekly Review): three modes — all / manual /
 * recommended — choose which concept dots light up before the paper builds.
 */
import { allActConceptIds, actConceptLabel } from './actToc'
import { getQuestions, questionCount, type Question, shuffle } from './questionBank'
import type { NextConcept } from './recommendNextConcept'

export type TopicPickMode = 'all' | 'manual' | 'recommended'

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
  /** How topics were chosen for this paper (topic picker). */
  mode?: TopicPickMode
  selectedConceptIds?: string[]
}

/** Same calendar-week key scheme as `isoWeek()` in ParentDashboard.tsx — kept
 * in one place here (exported) so the lock/unlock check in Dashboard.tsx
 * compares against the exact same cadence the paper's content is built on,
 * instead of inventing a second date convention. */
export function weekKey(d = new Date()): string {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil((((d.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Short, friendly copy for the locked card once this week's paper is done —
 * "unlocks Monday" is the cadence anchor (a new week's paper is available
 * from Monday). Never returns "in 0 days": if today IS Monday, the next
 * unlock is necessarily next week. */
export function daysUntilNextUnlock(d = new Date()): number {
  const day = d.getDay() // 0=Sun .. 6=Sat
  const diff = (8 - day) % 7
  return diff === 0 ? 7 : diff
}

export function nextUnlockLabel(d = new Date()): string {
  const days = daysUntilNextUnlock(d)
  if (days === 1) return 'Unlocks tomorrow'
  return `Unlocks in ${days} days`
}

/** ACT TOC concepts that can actually serve practice questions. */
export function playableActConceptIds(): string[] {
  return allActConceptIds().filter(id =>
    ([1, 2, 3] as const).some(level => questionCount(id, level) > 0),
  )
}

/**
 * Algo picks for "recommended" mode — same weakness + stretch + light review
 * mix the original scaffold used when auto-building the paper.
 */
export function recommendedConceptIds(opts: {
  weakness: NextConcept | null
  learn: NextConcept | null
  reviewConceptIds?: string[]
  max?: number
}): string[] {
  const max = opts.max ?? 4
  const ids: string[] = []
  if (opts.weakness) ids.push(opts.weakness.conceptId)
  if (opts.learn && !ids.includes(opts.learn.conceptId)) ids.push(opts.learn.conceptId)
  for (const id of opts.reviewConceptIds ?? []) {
    if (ids.includes(id)) continue
    ids.push(id)
    if (ids.length >= max) break
  }
  return ids.slice(0, max)
}

function roleForConcept(
  conceptId: string,
  weakness: NextConcept | null,
  learn: NextConcept | null,
): WeeklyPaperSlot['role'] {
  if (weakness && conceptId === weakness.conceptId) return 'strengthen'
  if (learn && conceptId === learn.conceptId) return 'stretch'
  return 'review'
}

/**
 * Build a short weekly mix. Prefer explicit `selectedConceptIds` from the
 * topic picker; otherwise fall back to weakness/learn/review scaffold.
 */
export function buildWeeklyPracticePaper(opts: {
  weakness: NextConcept | null
  learn: NextConcept | null
  reviewConceptIds?: string[]
  selectedConceptIds?: string[]
  questionsPerSlot?: number
  mode?: TopicPickMode
  /** Hard cap on total questions (all-topics mode uses a lower per-slot count). */
  maxQuestions?: number
}): WeeklyPracticePaper {
  const mode = opts.mode ?? (opts.selectedConceptIds ? 'manual' : 'recommended')
  const selected = opts.selectedConceptIds?.length
    ? [...new Set(opts.selectedConceptIds)]
    : recommendedConceptIds(opts)

  const slots: WeeklyPaperSlot[] = selected.map(conceptId => ({
    conceptId,
    role: roleForConcept(conceptId, opts.weakness, opts.learn),
    label: actConceptLabel(conceptId),
  }))

  // Keep enough questions per topic that playthrough never feels like a
  // single-item quiz — even when the picker lights up many concepts.
  const many = slots.length > 6
  const per = opts.questionsPerSlot ?? (many ? 2 : 3)
  const maxQuestions = opts.maxQuestions ?? (many
    ? Math.min(24, Math.max(12, slots.length * per))
    : Math.max(8, slots.length * per))

  const questions: Question[] = []
  for (const slot of slots) {
    const level = slot.role === 'stretch' ? 1 : slot.role === 'strengthen' ? 2 : 1
    const batch = getQuestions(slot.conceptId, level as 1 | 2 | 3, per)
    questions.push(...batch)
  }

  const mixed = shuffle(questions).slice(0, maxQuestions)

  return {
    weekKey: weekKey(),
    title: 'This week’s paper',
    slots,
    questionIds: mixed.map(q => q.id),
    builtAt: new Date().toISOString(),
    mode,
    selectedConceptIds: selected,
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

export function clearCachedWeeklyPaper() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}
