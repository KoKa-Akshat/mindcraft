/**
 * telemetry.ts
 *
 * Wires the Manjushree zone into MindCraft's REAL learning pipeline:
 *
 *  - Fine-grained attempt telemetry -> the existing Firestore `events`
 *    collection through lib/logEvent.ts (same collection every other surface
 *    logs to; no parallel analytics system).
 *  - Aggregate outcomes -> POST /record-outcomes through lib/mlApi.ts
 *    recordOutcomes(), the identical call Practice.tsx makes, so the mastery
 *    graph and the next /recommend consume this session like any practice run.
 *
 * In dev mode (no signed-in user) everything no-ops safely.
 */

import { logEvent } from '../lib/logEvent'
import { recordOutcomes, type OutcomeInput } from '../lib/mlApi'
import { invalidateKnowledgeGraph } from '../lib/graphCache'
import { CONCEPT_ID, ENCOUNTER_INGREDIENTS } from './math/content'
import type { EncounterId } from './math/quadratics'
import type { AttemptRecord, SessionSummary } from './state'

export const WORLD_ID = 'manjushree_sword_of_wisdom'
export const CHAPTER_ID = 'the_first_cut'

export function logZoneEvent(
  uid: string | null | undefined,
  type: string,
  data: Record<string, unknown> = {},
): void {
  void logEvent(uid, type, { worldId: WORLD_ID, chapterId: CHAPTER_ID, ...data })
}

/** One event per attempt, with the full evidence the proof standard asks for. */
export function logAttempt(
  uid: string | null | undefined,
  attempt: AttemptRecord,
  ctx: { level: 1 | 2 | 3; phase: string; sightOn: boolean; inputPath: 'placed' | 'typed' },
): void {
  logZoneEvent(uid, 'manjushree_attempt', {
    encounterId: attempt.encounter,
    questionId: attempt.questionId,
    conceptId: CONCEPT_ID,
    ingredientIds: ENCOUNTER_INGREDIENTS[attempt.encounter as EncounterId] ?? [],
    submitted: attempt.submitted,
    correct: attempt.correct,
    attemptNumber: attempt.attemptNumber,
    responseTimeMs: attempt.responseTimeMs,
    hintLevel: attempt.hintLevelAtSubmit,
    misconceptionId: attempt.misconceptionId ?? null,
    level: ctx.level,
    phase: ctx.phase,
    sightOn: ctx.sightOn,
    inputPath: ctx.inputPath,
    at: attempt.at,
  })
}

/**
 * Push the finished session into the mastery graph. One outcome per math
 * encounter, shaped exactly like Practice.tsx outcomes: canonical concept id,
 * score in {0,1} (first-try correctness), level, question id, format
 * `coordinate_graph` (the vessel every encounter lives in), and the first
 * detected misconception.
 */
export async function submitZoneOutcomes(
  uid: string | null | undefined,
  summary: SessionSummary,
): Promise<boolean> {
  if (!uid) return false
  const outcomes: OutcomeInput[] = summary.outcomes.map(o => ({
    conceptId: CONCEPT_ID,
    score: o.score,
    level: summary.level,
    questionId: o.questionId,
    formatId: 'coordinate_graph',
    misconceptionId: o.misconceptionId,
  }))
  const res = await recordOutcomes(uid, outcomes)
  invalidateKnowledgeGraph(uid)
  logZoneEvent(uid, 'manjushree_complete', {
    questionId: summary.questionId,
    level: summary.level,
    totalHints: summary.totalHints,
    misconceptions: summary.misconceptions.map(m => m.id),
    outcomes: summary.outcomes,
    recorded: !!res,
  })
  return !!res
}
