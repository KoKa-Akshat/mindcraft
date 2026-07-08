/**
 * adaptiveDiagnostic — belief updates + probe queue reshuffle.
 * Mirrors engine intuition (uncertainty × severity) without calling ML per step.
 */
import type { Question } from './questionBank'
import { getQuestions } from './questionBank'
import { isRenderableQuestion } from './diagnosticQuestions'
import { buildStoryDisplay } from './storyDisplay'

export interface ProbeOutcome {
  conceptId: string
  questionId: string
  correct: boolean
}

export interface ConceptBelief {
  correct: number
  total: number
  masteryEst: number
  uncertainty: number
}

export type BeliefState = Record<string, ConceptBelief>

export function initBelief(conceptIds: string[]): BeliefState {
  const b: BeliefState = {}
  for (const c of conceptIds) {
    b[c] = { correct: 0, total: 0, masteryEst: 0.5, uncertainty: 1 }
  }
  return b
}

/** Beta(1,1) posterior mean after one more observation. */
export function updateBelief(state: BeliefState, conceptId: string, correct: boolean): BeliefState {
  const prev = state[conceptId] ?? { correct: 0, total: 0, masteryEst: 0.5, uncertainty: 1 }
  const correctN = prev.correct + (correct ? 1 : 0)
  const totalN = prev.total + 1
  const masteryEst = (correctN + 1) / (totalN + 2)
  const uncertainty = (1 - Math.abs(2 * masteryEst - 1)) * Math.min(1, totalN / 2)
  return {
    ...state,
    [conceptId]: { correct: correctN, total: totalN, masteryEst, uncertainty },
  }
}

function conceptWeight(
  conceptId: string,
  tutorFocus: string[],
  goalBoost: Set<string>,
): number {
  let w = 1
  if (tutorFocus.includes(conceptId)) w *= 1.5
  if (goalBoost.has(conceptId)) w *= 1.2
  return w
}

/** Reorder remaining probes — highest uncertainty × weight first. */
export function reorderProbeQueue(
  remaining: Question[],
  belief: BeliefState,
  tutorFocus: string[] = [],
  goalBoost: string[] = [],
): Question[] {
  const boost = new Set(goalBoost)
  return [...remaining].sort((a, b) => {
    const ua = (belief[a.conceptId]?.uncertainty ?? 1) * conceptWeight(a.conceptId, tutorFocus, boost)
    const ub = (belief[b.conceptId]?.uncertainty ?? 1) * conceptWeight(b.conceptId, tutorFocus, boost)
    return ub - ua
  })
}

/** After wrong answer: pull a follow-up from same concept (prefer L1). */
export function pickFollowUpQuestion(
  conceptId: string,
  usedIds: Set<string>,
  wrongCount: number,
): Question | null {
  const level = wrongCount >= 2 ? 1 : 2
  for (const lv of ([level, 1, 2] as const)) {
    const pool = getQuestions(conceptId, lv, 8, [...usedIds], 'General')
      .filter(q => isRenderableQuestion(q) && !usedIds.has(q.id))
    const ranked = [...pool].sort((a, b) => storyVisualScore(b) - storyVisualScore(a))
    if (ranked[0]) return ranked[0]
  }
  return null
}

function storyVisualScore(q: Question): number {
  const d = buildStoryDisplay(q)
  if (d.table) return 4
  if (d.visual === 'polygon') return 3
  if (d.visual === 'vignette') return 2
  if (d.visual === 'figure') return 1
  return 0
}

export function applyProbeOutcome(
  queue: Question[],
  currentIdx: number,
  outcome: ProbeOutcome,
  belief: BeliefState,
  opts: {
    followUps: boolean
    tutorFocus?: string[]
    goalBoost?: string[]
    usedIds: Set<string>
  },
): { queue: Question[]; belief: BeliefState; currentIdx: number } {
  let nextBelief = updateBelief(belief, outcome.conceptId, outcome.correct)
  const tail = queue.slice(currentIdx + 1)
  let reordered = reorderProbeQueue(tail, nextBelief, opts.tutorFocus, opts.goalBoost)

  if (opts.followUps && !outcome.correct) {
    const wrongN = nextBelief[outcome.conceptId]?.total ?? 1
    const followUp = pickFollowUpQuestion(outcome.conceptId, opts.usedIds, wrongN)
    if (followUp) {
      reordered = [followUp, ...reordered.filter(q => q.id !== followUp.id)]
      opts.usedIds.add(followUp.id)
    }
  }

  return {
    queue: [...queue.slice(0, currentIdx + 1), ...reordered],
    belief: nextBelief,
    currentIdx,
  }
}
