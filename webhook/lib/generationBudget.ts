/**
 * lib/generationBudget.ts
 *
 * Per-student cost cap for live gated generation — the seam the spec
 * (LIVE_GATED_GENERATION_TEST_SPEC.md, "Cost control") requires to exist
 * before this feature can ever touch a real student. Every generation
 * attempt costs real money REGARDLESS of whether it clears the quality
 * gate (a failed attempt still spent the generation + rubric + vision
 * calls), and at the measured 1/10-6/10 yield one shown result can mean
 * several billed attempts — so this counts ATTEMPTS at request time, not
 * results.
 *
 * The enforcement mechanics are real (Firestore transaction, honest 429 to
 * the caller). The NUMBER is a placeholder: the actual per-student cap /
 * budget model is Blake's call and has not been designed yet — see the
 * spec's own "not yet designed, has to be before this ships." Do not treat
 * PLACEHOLDER_DAILY_ATTEMPT_CAP as a product decision; treat it as the
 * hook the real decision plugs into.
 */
import { db } from './firebase'

/** PLACEHOLDER pending Blake — deliberately conservative so that even if
 * every other safeguard were bypassed, one student could not run up more
 * than a few billed attempts a day. Not a designed budget. */
export const PLACEHOLDER_DAILY_ATTEMPT_CAP = 3

export interface BudgetVerdict {
  allowed: boolean
  attemptsToday: number
  cap: number
}

/** UTC day key — a cheap, timezone-stable reset boundary. Good enough for
 * a placeholder cap; a real budget design may want rolling windows or
 * dollar amounts instead (Blake's call, see file header). */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Atomically checks and (when allowed) records one generation attempt for
 * this student. A denied check does NOT increment — asking again tomorrow
 * shouldn't be penalized for having asked today. Transaction, not
 * read-then-write: two simultaneous requests from one student must not
 * both slip under the cap.
 */
export async function checkAndRecordAttempt(uid: string): Promise<BudgetVerdict> {
  const ref = db.collection('generation_budgets').doc(uid)
  const day = todayKey()
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.exists ? (snap.data() as { dayKey?: string; attempts?: number }) : {}
    const attempts = data.dayKey === day ? data.attempts ?? 0 : 0
    if (attempts >= PLACEHOLDER_DAILY_ATTEMPT_CAP) {
      return { allowed: false, attemptsToday: attempts, cap: PLACEHOLDER_DAILY_ATTEMPT_CAP }
    }
    tx.set(ref, { dayKey: day, attempts: attempts + 1, updatedAt: new Date().toISOString() })
    return { allowed: true, attemptsToday: attempts + 1, cap: PLACEHOLDER_DAILY_ATTEMPT_CAP }
  })
}
