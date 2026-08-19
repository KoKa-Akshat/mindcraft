/**
 * lib/generationBudget.ts
 *
 * Cost control for live gated generation (LIVE_GATED_GENERATION_TEST_SPEC.md,
 * "Cost control"). Two independent layers, checked in order:
 *
 *   1. PLATFORM_MONTHLY_BUDGET_USD — a real dollar ceiling on total spend
 *      across every student this calendar month. This is the actual number
 *      Akshat set (2026-08-19: $20/mo) for the closed-test phase this spec
 *      describes — not a placeholder. It is deliberately simple (one global
 *      counter, no per-student fairness split) because the closed test only
 *      has a handful of testers; Blake's fuller budget model (per-student
 *      allocation, rolling windows, alerting) still has to happen before any
 *      wider rollout — this just stops the bleeding at a hard, real number
 *      in the meantime.
 *   2. PLACEHOLDER_DAILY_ATTEMPT_CAP — the original per-student rail, kept
 *      as a secondary safeguard: even if the platform cap resets on a new
 *      month right as one student starts hammering the button, no single
 *      student can run past a few attempts a day on their own.
 *
 * Both are enforced with Firestore transactions (not read-then-write) and
 * fail closed (deny) on any doubt — asking again denies for free, an
 * accidental double-spend does not.
 *
 * Real spend, not an estimate: the platform counter is incremented by
 * `recordActualSpend()` using the REAL token usage the generation service
 * reports per job (`ServiceJobUsage` in generatedSimContract.ts), summed via
 * `usageCostUsd()`. A start-time attempt cap (the old design) could only
 * guess at cost per attempt; this can't drift from the real bill because it
 * IS the real bill, computed the same way Anthropic prices the call.
 */
import { db } from './firebase'

/** The real monthly dollar ceiling for this closed-test phase (Akshat,
 * 2026-08-19). Recorded spend that would push the running total at or past
 * this number blocks all NEW generation starts until next calendar month —
 * in-flight jobs still get their terminal poll answered (a job already
 * running has already spent the money; refusing to relay its own answer
 * doesn't save anything and would strand the student on a spinner). */
export const PLATFORM_MONTHLY_BUDGET_USD = 20

/** Per-student secondary safety rail — unchanged from the original design.
 * Deliberately conservative so that even if every other safeguard were
 * bypassed, one student could not run up more than a few billed attempts a
 * day. */
export const PLACEHOLDER_DAILY_ATTEMPT_CAP = 3

export interface BudgetVerdict {
  allowed: boolean
  attemptsToday: number
  cap: number
}

export interface PlatformBudgetVerdict {
  allowed: boolean
  spentThisMonthUsd: number
  capUsd: number
}

/** UTC day key — a cheap, timezone-stable reset boundary. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** UTC month key — same reasoning as todayKey, one level up. A student
 * mid-request when the month rolls over just sees the counter reset under
 * them; that's fine, it only ever makes the check MORE permissive at the
 * boundary, never less. */
function monthKey(): string {
  return new Date().toISOString().slice(0, 7)
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

const PLATFORM_BUDGET_DOC = db.collection('generation_budgets').doc('_platform')

/** Read-only — call before starting a new job. Does NOT reserve spend
 * (unlike checkAndRecordAttempt, a job's real cost isn't known until it
 * finishes), so this alone can't prevent every possible overshoot from
 * jobs that are already in flight when the month is close to the cap —
 * see recordActualSpend for why that's an accepted, bounded gap. */
export async function checkPlatformBudget(): Promise<PlatformBudgetVerdict> {
  const snap = await PLATFORM_BUDGET_DOC.get()
  const data = snap.exists ? (snap.data() as { monthKey?: string; spentUsd?: number }) : {}
  const spent = data.monthKey === monthKey() ? data.spentUsd ?? 0 : 0
  return { allowed: spent < PLATFORM_MONTHLY_BUDGET_USD, spentThisMonthUsd: spent, capUsd: PLATFORM_MONTHLY_BUDGET_USD }
}

/**
 * Records real spend from one finished job (called from handlePoll on every
 * terminal status — passed, no_good_result, AND error all cost money once
 * the service has made an API call, which is why this takes a plain
 * costUsd rather than only firing on success). Transaction-based additive
 * increment so concurrent jobs finishing at the same moment don't clobber
 * each other's contribution.
 *
 * Accepted gap: because cost is only known at job END, a burst of jobs that
 * all START while the running total is just under the cap can collectively
 * overshoot it before any of their bills land — bounded by
 * (PLACEHOLDER_DAILY_ATTEMPT_CAP x concurrent students), not unbounded, and
 * acceptable for a closed test with a handful of testers. Closing this
 * fully would need reserving an estimated cost at start and reconciling at
 * end — real design work, deferred rather than half-built here.
 */
export async function recordActualSpend(costUsd: number): Promise<void> {
  if (!(costUsd > 0)) return
  const month = monthKey()
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(PLATFORM_BUDGET_DOC)
    const data = snap.exists ? (snap.data() as { monthKey?: string; spentUsd?: number }) : {}
    const priorSpend = data.monthKey === month ? data.spentUsd ?? 0 : 0
    tx.set(PLATFORM_BUDGET_DOC, {
      monthKey: month,
      spentUsd: priorSpend + costUsd,
      updatedAt: new Date().toISOString(),
    })
  })
}
