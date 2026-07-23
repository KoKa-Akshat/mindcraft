/**
 * pastMistakeCallback.ts — resurface a student's own past, dated struggle on a
 * concept once there is real evidence they have since improved on it. The
 * DASHBOARD_NOTEBOOK_SPEC reference is a literal handwritten quote ("you wrote
 * 'flip the sign??' here on June 12"). That exact quotable string is NOT
 * recorded anywhere the client can read back later:
 *
 *   - `attempt_observations` (ml/mindcraft_graph/firestore_adapter.py) is the
 *     ONLY store that keeps per-question detail (questionId, misconceptionId,
 *     errorType, selectedChoiceIndex) — but that collection has no Firestore
 *     rule granting client reads (see firebase/firestore.rules), so the
 *     browser cannot query it. Adding that rule is a security-surface change
 *     outside this feature's lane (Engine-owned deploy path, see CLAUDE.md).
 *   - The story-skinned `misconceptionCallout` text a student actually saw
 *     (StoryModuleItem.misconceptionCallout in lib/storyModule.ts) is cached
 *     only in sessionStorage — gone once the tab/session ends, never written
 *     to Firestore.
 *   - `student_work` (lib/studentWork.ts) does carry a durable
 *     `selectedAnswerIndex` per question, but the one write path that could
 *     populate it for a WRONG choice (ConceptChapterPage's soft-wrong retry
 *     flow) clears `answers[qIdx]` before persisting, so a wrong pick is
 *     never durably saved there either — only the eventual correct lock-in is.
 *
 * What IS durably recorded and client-readable: the `interactions` collection
 * (Firestore rule at firebase/firestore.rules:146 allows a student to read
 * their own docs), written server-side by /record-outcomes and /seed-assessment.
 * Each doc is one aggregated PRACTICE SESSION on one concept: {studentId,
 * conceptId, outcome (signed, roughly -1..1, coin-flip-neutral at 0), source,
 * timestamp}. That is real, specific, and dated — just not a quoted mistake.
 * This module builds the callback from that signal: "this concept was a real
 * struggle on that date, and here's the real count of clean sessions since."
 */
import {
  collection, getDocs, limit as fsLimit, orderBy, query, Timestamp, where,
} from 'firebase/firestore'
import { db } from '../firebase'

export interface ConceptInteractionPoint {
  /** Signed outcome from the engine (ml/mindcraft_graph/config.py outcome_from).
   *  Negative = below a coin-flip pass rate, positive = above. */
  outcome: number
  /** Epoch ms. */
  timestamp: number
  source: string
}

export interface PastMistakeCallback {
  conceptId: string
  /** The past session that reads as a real struggle. */
  struggleTimestamp: number
  /** Count of qualifying good sessions on this concept since the struggle. */
  improvedCount: number
  /** Wizard line, ready to render. */
  line: string
}

// A practice session outcome meaningfully below neutral counts as a struggle;
// meaningfully above neutral counts as a clean/good session. These leave a
// dead zone around 0 so a coin-flip session counts as neither — it should
// take a real miss and real, repeated wins to trigger a callback, never noise.
const STRUGGLE_OUTCOME_MAX = -0.15
const IMPROVED_OUTCOME_MIN = 0.15
const MIN_IMPROVED_COUNT = 2
const HISTORY_LIMIT = 400

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis()
  if (ts && typeof ts === 'object' && typeof (ts as { toMillis?: unknown }).toMillis === 'function') {
    try { return (ts as { toMillis: () => number }).toMillis() } catch { /* fall through */ }
  }
  if (typeof ts === 'number') return ts
  return NaN
}

/** Read this student's real practice-session history on ONE concept.
 *  Filters to `source === 'practice'` (actual attempts) — excludes the
 *  onboarding gap-scan seed (self-rated confidence, not observed behavior)
 *  and the tutor-session summary parser (not a graded attempt). Queries by
 *  studentId + orderBy(timestamp) only (the deployed composite index per
 *  CLAUDE.md), filtering conceptId/source client-side to avoid needing a new
 *  composite index. */
export async function fetchConceptInteractionHistory(
  studentId: string,
  conceptId: string,
): Promise<ConceptInteractionPoint[]> {
  if (!studentId || !conceptId) return []
  try {
    const q = query(
      collection(db, 'interactions'),
      where('studentId', '==', studentId),
      orderBy('timestamp', 'desc'),
      fsLimit(HISTORY_LIMIT),
    )
    const snap = await getDocs(q)
    const points: ConceptInteractionPoint[] = []
    for (const docSnap of snap.docs) {
      const d = docSnap.data() as Record<string, unknown>
      if (d.conceptId !== conceptId) continue
      if (d.source !== 'practice') continue
      const timestamp = toMillis(d.timestamp)
      const outcome = Number(d.outcome)
      if (!Number.isFinite(timestamp) || !Number.isFinite(outcome)) continue
      points.push({ outcome, timestamp, source: String(d.source) })
    }
    return points
  } catch {
    return []
  }
}

function formatCallbackDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildCallbackLine(conceptLabel: string, struggleTs: number, improvedCount: number): string {
  const dateStr = formatCallbackDate(struggleTs)
  return `${conceptLabel} was rough on ${dateStr}. You've gotten it right ${improvedCount} times since.`
}

/**
 * Pure selection logic (no Firestore) — the single most relevant past
 * mistake, or null when there isn't real evidence to support one.
 *
 * Rules:
 *  - Needs at least one real struggle session (outcome <= STRUGGLE_OUTCOME_MAX).
 *  - Needs at least MIN_IMPROVED_COUNT good sessions (outcome >= IMPROVED_OUTCOME_MIN)
 *    AFTER that struggle — "recent correct answers on the same concept."
 *  - The most recent session overall must ALSO read as good — never resurface
 *    a struggle while the student is presently still struggling; this should
 *    read as "look how far you've come," never a fresh accusation.
 *  - Among qualifying struggles, picks the MOST RECENT one (closest, most
 *    relevant callback) rather than the oldest ever recorded.
 */
export function selectPastMistakeCallback(
  history: ConceptInteractionPoint[],
  conceptId: string,
  conceptLabel: string,
): PastMistakeCallback | null {
  const points = history
    .filter(p => Number.isFinite(p.outcome) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp)

  if (points.length < MIN_IMPROVED_COUNT + 1) return null

  const latest = points[points.length - 1]
  if (latest.outcome < IMPROVED_OUTCOME_MIN) return null

  const struggles = points.filter(p => p.outcome <= STRUGGLE_OUTCOME_MAX)
  if (struggles.length === 0) return null

  for (let i = struggles.length - 1; i >= 0; i--) {
    const struggle = struggles[i]
    const after = points.filter(p => p.timestamp > struggle.timestamp)
    const improved = after.filter(p => p.outcome >= IMPROVED_OUTCOME_MIN)
    if (improved.length >= MIN_IMPROVED_COUNT) {
      return {
        conceptId,
        struggleTimestamp: struggle.timestamp,
        improvedCount: improved.length,
        line: buildCallbackLine(conceptLabel, struggle.timestamp, improved.length),
      }
    }
  }
  return null
}

/** Fetch + select in one call — what page components should use. Fails soft
 *  (returns null) on any Firestore error so it never blocks chapter open. */
export async function getPastMistakeCallback(
  studentId: string,
  conceptId: string,
  conceptLabel: string,
): Promise<PastMistakeCallback | null> {
  const history = await fetchConceptInteractionHistory(studentId, conceptId)
  return selectPastMistakeCallback(history, conceptId, conceptLabel)
}
