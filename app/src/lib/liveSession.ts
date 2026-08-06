/**
 * liveSession.ts
 *
 * Data access for "Call" live co-working sessions (plan:
 * snuggly-wandering-candle.md, build-order step 1). A student-initiated
 * `liveSessions/{sessionId}` doc snapshots the shared context (question or
 * weekly paper) and an append-only `strokes` subcollection carries the
 * shared scratchpad ink, one doc per completed stroke so two people drawing
 * at once don't clobber each other.
 *
 * Trust boundary is the same one already enforced elsewhere in this app
 * (see firebase/firestore.rules `liveSessions` block): only the session's
 * own student, their linked tutor (`users/{uid}.tutorId`, Admin-SDK-set),
 * or a linked parent (`childId`/`childIds`) can read/write. `firestore.rules`
 * is the actual gate — everything here is fail-soft on top of it, same
 * spirit as `saveQuestionWork` in studentWork.ts: this is a nice-to-have
 * collaboration feature, not core functionality, so a failed write must
 * never throw into the caller.
 *
 * NOT built here (later steps of the same plan): ScratchPad.tsx wiring,
 * CallButton/LiveSessionPage/LiveJoinBanner UI, the route.
 */
import {
  addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import type { ScratchStrokePoint } from '../types'

const COLLECTION = 'liveSessions'
const STROKES_SUBCOLLECTION = 'strokes'

/** Sessions with no activity for this long are treated as "not live"
 * everywhere active sessions are listed — no presence/heartbeat protocol
 * for v1, per the plan. */
const STALE_MS = 20 * 60 * 1000

export type LiveSessionContextType = 'question' | 'weekly_paper' | 'worksheet'
export type LiveSessionAuthorRole = 'student' | 'tutor' | 'parent'
export type LiveSessionStatus = 'active' | 'ended'

export interface LiveSessionDoc {
  studentId: string
  tutorId: string | null
  contextType: LiveSessionContextType
  questionId: string | null
  conceptId: string | null
  conceptName: string | null
  questionText: string | null
  /**
   * Worksheet context only ('write on it' live calls): a small snapshot of
   * the page being worked on, pre-downscaled by
   * `homework.ts#downscaleForLiveSession` specifically to stay well under
   * Firestore's document size cap (see that function's doc comment for the
   * sizing rationale) — never the full-resolution `pagesFromFile()` output.
   * Fixed for the lifetime of the call, same as `questionText` for a
   * question-context call: a worksheet call is scoped to the one page it
   * was started on, it does not follow the student flipping pages
   * afterward (there is no in-call page navigation, mirroring how a
   * question-context call has none either). null for question/weekly_paper.
   */
  pageImage: string | null
  /** 0-based index of the snapshotted page, for the "page X of Y" header. */
  pageIndex: number | null
  /** Total page count of the source upload, for the "page X of Y" header. */
  pageCount: number | null
  status: LiveSessionStatus
  createdAt: Timestamp | null
  lastActivityAt: Timestamp | null
  endedAt: Timestamp | null
}

export interface LiveSessionEntry extends LiveSessionDoc {
  id: string
}

export interface LiveStrokeDoc {
  authorId: string
  authorRole: LiveSessionAuthorRole
  points: ScratchStrokePoint[]
  createdAt: Timestamp | null
}

export interface LiveStrokeEntry extends LiveStrokeDoc {
  id: string
}

/** Firestore's wire format for one point. Firestore rejects arrays whose
 * elements are themselves arrays ("Nested arrays are not supported") — a
 * real constraint confirmed against the emulator, not a guess. `points:
 * ScratchStrokePoint[]` (an array of [x,y,pressure] tuples) is exactly that
 * shape, so it can never be written as-is. Everywhere OUTSIDE this file
 * still sees the normal `ScratchStrokePoint[]` tuple shape (matching every
 * other consumer of this type, e.g. ScratchPad.tsx) — these two helpers are
 * the only place the flat-object wire format exists. */
export interface FirestorePoint { x: number; y: number; p: number }

export function toFirestorePoints(points: ScratchStrokePoint[]): FirestorePoint[] {
  return points.map(([x, y, p]) => ({ x, y, p }))
}

export function fromFirestorePoints(raw: unknown): ScratchStrokePoint[] {
  if (!Array.isArray(raw)) return []
  return raw.map(pt => {
    const p = pt as { x?: number; y?: number; p?: number }
    return [p?.x ?? 0, p?.y ?? 0, p?.p ?? 0] as ScratchStrokePoint
  })
}

function timestampMillis(ts: Timestamp | null | undefined): number {
  return ts?.toMillis?.() ?? 0
}

/** Pure staleness check — split out so it's independently unit-testable
 * (the Firestore calls in this file aren't, per plan). A session counts as
 * live only while `status === 'active'` AND its last activity is within
 * `STALE_MS`; a session with no activity timestamp at all (still writing
 * its first stroke) is treated as fresh. */
export function isLiveSessionStale(
  session: Pick<LiveSessionDoc, 'status' | 'lastActivityAt' | 'createdAt'>,
  now = Date.now(),
): boolean {
  if (session.status !== 'active') return true
  const last = timestampMillis(session.lastActivityAt) || timestampMillis(session.createdAt)
  if (!last) return false
  return now - last > STALE_MS
}

export interface CreateLiveSessionInput {
  studentId: string
  /** Denormalized from users/{studentId}.tutorId at creation time — null if
   * the student has no linked tutor yet. Rules cross-check this against the
   * student's own user doc, so it can't be spoofed to a different tutor. */
  tutorId: string | null
  contextType: LiveSessionContextType
  questionId?: string | null
  conceptId?: string | null
  conceptName?: string | null
  questionText?: string | null
  /** Worksheet context only — see `LiveSessionDoc.pageImage`. */
  pageImage?: string | null
  pageIndex?: number | null
  pageCount?: number | null
}

/** Creates a new live session and returns its id, or null on failure
 * (fail-soft — callers should treat null as "Call didn't start,
 * try again"). */
export async function createLiveSession(input: CreateLiveSessionInput): Promise<string | null> {
  if (!input.studentId) return null
  try {
    const ref = await addDoc(collection(db, COLLECTION), {
      studentId: input.studentId,
      tutorId: input.tutorId ?? null,
      contextType: input.contextType,
      questionId: input.questionId ?? null,
      conceptId: input.conceptId ?? null,
      conceptName: input.conceptName ?? null,
      questionText: input.questionText ?? null,
      pageImage: input.pageImage ?? null,
      pageIndex: input.pageIndex ?? null,
      pageCount: input.pageCount ?? null,
      status: 'active',
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      endedAt: null,
    })
    return ref.id
  } catch {
    return null
  }
}

/** Marks a session ended. Fail-soft (empty catch), same pattern as
 * `saveQuestionWork` — meant to be called from a page-unmount effect where
 * throwing would be actively harmful. */
export async function endLiveSession(sessionId: string): Promise<void> {
  if (!sessionId) return
  try {
    await setDoc(doc(db, COLLECTION, sessionId), {
      status: 'ended',
      endedAt: serverTimestamp(),
    }, { merge: true })
  } catch {
    // fail-soft
  }
}

/** Appends one completed stroke (additive — never overwrites another
 * author's strokes) and best-effort bumps the parent session's
 * `lastActivityAt` so the staleness checks above have something to read.
 * The activity bump is a second, independent try/catch: a failure there
 * must never be reported as a failed stroke write. */
export async function appendLiveStroke(
  sessionId: string,
  authorId: string,
  authorRole: LiveSessionAuthorRole,
  points: ScratchStrokePoint[],
): Promise<void> {
  if (!sessionId || !authorId || !points?.length) return
  try {
    await addDoc(collection(db, COLLECTION, sessionId, STROKES_SUBCOLLECTION), {
      authorId,
      authorRole,
      points: toFirestorePoints(points),
      createdAt: serverTimestamp(),
    })
  } catch {
    // fail-soft — a dropped stroke must never crash the scratchpad
    return
  }
  try {
    await setDoc(doc(db, COLLECTION, sessionId), { lastActivityAt: serverTimestamp() }, { merge: true })
  } catch {
    // fail-soft — missing the activity bump just makes staleness detection
    // a little early, it never invalidates the stroke that was just saved
  }
}

/** Realtime subscription to the session doc itself (context header, status).
 * Fails soft to `null` so a missing/denied doc never blocks the page. */
export function subscribeLiveSession(
  sessionId: string,
  onChange: (session: LiveSessionEntry | null) => void,
): () => void {
  if (!sessionId) {
    onChange(null)
    return () => {}
  }
  return onSnapshot(
    doc(db, COLLECTION, sessionId),
    snap => onChange(snap.exists() ? { id: snap.id, ...(snap.data() as LiveSessionDoc) } : null),
    () => onChange(null),
  )
}

/** Realtime subscription to the strokes subcollection, oldest-first so
 * redraw() can replay them in order. Deliberately no `where()` filter (the
 * rule resolves access via get() on the parent doc so an unfiltered list
 * stays legal) — fails soft to an empty list. */
export function subscribeLiveStrokes(
  sessionId: string,
  onChange: (strokes: LiveStrokeEntry[]) => void,
): () => void {
  if (!sessionId) {
    onChange([])
    return () => {}
  }
  const q = query(
    collection(db, COLLECTION, sessionId, STROKES_SUBCOLLECTION),
    orderBy('createdAt', 'asc'),
  )
  return onSnapshot(q, snap => {
    onChange(snap.docs.map(d => {
      const data = d.data() as { authorId: string; authorRole: LiveSessionAuthorRole; points: unknown; createdAt: Timestamp | null }
      return {
        id: d.id,
        authorId: data.authorId,
        authorRole: data.authorRole,
        points: fromFirestorePoints(data.points),
        createdAt: data.createdAt,
      }
    }))
  }, () => onChange([]))
}

/** Realtime subscription for a tutor's live-join banner. Single-field query
 * (`tutorId` only) — same discipline as `flagged_questions` in
 * TutorDashboard.tsx (~line 289-291) — so this never needs a new composite
 * index; status/staleness are filtered client-side. Fails soft to []. */
export function subscribeActiveLiveSessionsForTutor(
  tutorId: string,
  onChange: (sessions: LiveSessionEntry[]) => void,
): () => void {
  if (!tutorId) {
    onChange([])
    return () => {}
  }
  const q = query(collection(db, COLLECTION), where('tutorId', '==', tutorId))
  return onSnapshot(q, snap => {
    const rows = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as LiveSessionDoc) }))
      .filter(s => !isLiveSessionStale(s))
    onChange(rows)
  }, () => onChange([]))
}

/** Realtime subscription for a parent's live-join banner. Resolves the
 * parent's linked child ids (own `childId`/`childIds`, same fields
 * ParentDashboard.tsx reads) once via getDoc, then queries `liveSessions`
 * with a single-field `studentId in [...]` filter — still one field, no new
 * composite index, same discipline as the tutor subscription above. Fails
 * soft to [] at every step. */
export function subscribeActiveLiveSessionsForParent(
  parentId: string,
  onChange: (sessions: LiveSessionEntry[]) => void,
): () => void {
  if (!parentId) {
    onChange([])
    return () => {}
  }
  let cancelled = false
  let innerUnsub: (() => void) | null = null

  getDoc(doc(db, 'users', parentId))
    .then(snap => {
      if (cancelled) return
      const data = snap.data() ?? {}
      const ids = new Set<string>()
      if (typeof data.childId === 'string' && data.childId) ids.add(data.childId)
      if (Array.isArray(data.childIds)) {
        for (const id of data.childIds) {
          if (typeof id === 'string' && id) ids.add(id)
        }
      }
      // Firestore 'in' queries cap at 30 values.
      const childIds = Array.from(ids).slice(0, 30)
      if (childIds.length === 0) {
        onChange([])
        return
      }
      const q = query(collection(db, COLLECTION), where('studentId', 'in', childIds))
      innerUnsub = onSnapshot(q, snap2 => {
        const rows = snap2.docs
          .map(d => ({ id: d.id, ...(d.data() as LiveSessionDoc) }))
          .filter(s => !isLiveSessionStale(s))
        onChange(rows)
      }, () => onChange([]))
    })
    .catch(() => { if (!cancelled) onChange([]) })

  return () => {
    cancelled = true
    if (innerUnsub) innerUnsub()
  }
}
