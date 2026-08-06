/**
 * LiveSessionPage — the shared "Call" view (plan: snuggly-wandering-candle.md,
 * build-order step 3), used by BOTH the student who created the session (via
 * `CallButton`) and a tutor/parent who joins it (a later step's
 * `LiveJoinBanner`). Renders a context header from the session doc's own
 * snapshot fields (never a live question-bank refetch — the doc is
 * self-contained), the co-writable `ScratchPad`, and a simple "Talk" link-out
 * plus End/Leave controls.
 *
 * Access check: Firestore rules are the real gate. This page does a defense-
 * in-depth check on top — on mount, `getDoc` the session once and confirm the
 * signed-in user is the student, the linked tutor, or a linked parent — purely
 * a UX layer (avoid rendering someone else's scratch pad before rules would
 * deny the reads anyway), not a substitute for the rules themselves.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  collection, doc, getDoc, getDocs, query, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import ScratchPad from '../components/ScratchPad'
import {
  endLiveSession, subscribeLiveSession, subscribeLiveStrokes,
} from '../lib/liveSession'
import type {
  LiveSessionAuthorRole, LiveSessionEntry, LiveStrokeEntry,
} from '../lib/liveSession'
import type { ScratchStrokePoint } from '../types'
import s from './LiveSessionPage.module.css'

type AccessState = 'checking' | 'allowed' | 'denied'

/** Resolves the signed-in user's role in this session, or null if they have
 * no legitimate reason to be here. Checks student/tutor first (no extra
 * read), falls back to a parent-link check (`users/{uid}.childId`/`childIds`,
 * the same fields `subscribeActiveLiveSessionsForParent` reads) only when
 * neither matches. */
async function resolveRole(
  uid: string,
  session: Pick<LiveSessionEntry, 'studentId' | 'tutorId'>,
): Promise<LiveSessionAuthorRole | null> {
  if (uid === session.studentId) return 'student'
  if (session.tutorId && uid === session.tutorId) return 'tutor'
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const data = snap.data() ?? {}
    const childId = typeof data.childId === 'string' ? data.childId : null
    const childIds = Array.isArray(data.childIds) ? data.childIds : []
    if (childId === session.studentId || childIds.includes(session.studentId)) return 'parent'
  } catch {
    // fail closed below
  }
  return null
}

function contextLabel(session: LiveSessionEntry | null): string {
  if (!session) return ''
  return session.contextType === 'weekly_paper' ? 'Weekly paper' : 'Practice question'
}

/** Mirrors `SessionCallCard`'s own "is this booked session happening right
 * now" window (10 min before `scheduledAt` through `endAt`, defaulting to a
 * 90-min session when `endAt` is missing — SessionCallCard.tsx:23,59-60),
 * plus a same-doc `meetingUrl` requirement: an active booked session with no
 * link of its own isn't usable as tier 1, so it falls through to the
 * tutor's permanent room instead. Pure and exported so it's unit-testable
 * without touching Firestore (same pattern as `isLiveSessionStale` in
 * `lib/liveSession.ts`). */
const TALK_CALL_EARLY_MS = 10 * 60 * 1000
const TALK_DEFAULT_SESSION_MS = 90 * 60 * 1000

export interface BookedSessionCandidate {
  studentId?: string | null
  status?: string
  scheduledAt?: number
  endAt?: number
  meetingUrl?: string | null
}

export function isBookedSessionCurrentlyActive(
  sess: BookedSessionCandidate,
  now = Date.now(),
): boolean {
  if (sess.status !== 'scheduled') return false
  if (typeof sess.meetingUrl !== 'string' || !sess.meetingUrl) return false
  if (typeof sess.scheduledAt !== 'number') return false
  const end = sess.endAt ?? sess.scheduledAt + TALK_DEFAULT_SESSION_MS
  return now >= sess.scheduledAt - TALK_CALL_EARLY_MS && now <= end
}

/** Picks the first currently-active session out of an already
 * student-scoped candidate list. Callers are responsible for the scoping
 * (see `resolveTalkUrl`): a student's own query is inherently scoped by
 * `studentEmail`, while a tutor's query spans every one of their students
 * and must be filtered to `studentId` first — that filter isn't folded in
 * here because a session doc missing `studentId` (not yet backfilled, see
 * `Session.studentId: string | null` in `types/index.ts`) would otherwise
 * be ambiguous: "unscoped" for the student case, but "wrong student" for
 * the tutor case. Split out from `resolveTalkUrl` purely so the active-
 * window logic is unit-testable without mocking Firestore. */
export function pickActiveBookedSession(
  candidates: BookedSessionCandidate[],
  now = Date.now(),
): BookedSessionCandidate | null {
  return candidates.find(sd => isBookedSessionCurrentlyActive(sd, now)) ?? null
}

/** Two-tier "Talk" link resolution (plan build-order step 6) — the same
 * precedence `SessionCallCard`'s existing callers use elsewhere in the app
 * (`Dashboard.tsx` ~line 999: `nextSession.meetingUrl ?? tutorMeetUrl`;
 * `TutorDashboard.tsx` ~line 636-637: `callSession.meetingUrl ?? meetUrl`):
 * a currently-active booked (Calendly) session's own `meetingUrl` first,
 * then the tutor's permanent `users/{tutorId}.googleMeetUrl`. This function
 * does the lookup those callers already had on hand from their own
 * `sessions`/`users` subscriptions — this page has neither, so it fetches
 * once on demand instead of subscribing (a "Talk" click is a one-shot
 * action, not something that needs to live-update).
 *
 * `firebase/firestore.rules`' `sessions` block has no parent-read clause
 * today (the same kind of pre-existing gap the plan's footnote calls out
 * for `interactions`) — a parent viewer's tier-1 query is denied by rules,
 * caught here, and treated as "no active booked session" rather than an
 * error, falling straight through to tier 2. */
async function resolveTalkUrl(params: {
  role: LiveSessionAuthorRole
  userUid: string
  userEmail: string | null | undefined
  studentId: string
  tutorId: string | null
}): Promise<string | null> {
  try {
    let candidates: BookedSessionCandidate[] = []
    if (params.role === 'student' && params.userEmail) {
      // Same query shape as useStudentData.ts's own `nextSession` lookup.
      const snap = await getDocs(query(collection(db, 'sessions'), where('studentEmail', '==', params.userEmail)))
      candidates = snap.docs.map(d => d.data() as BookedSessionCandidate)
    } else if (params.role === 'tutor') {
      // Same single-field query TutorDashboard.tsx uses (no composite index
      // needed) — spans every one of this tutor's students, so filter
      // client-side to this session's student before picking the active one.
      const snap = await getDocs(query(collection(db, 'sessions'), where('tutorId', '==', params.userUid)))
      candidates = snap.docs
        .map(d => d.data() as BookedSessionCandidate)
        .filter(sd => sd.studentId === params.studentId)
    }
    const active = pickActiveBookedSession(candidates)
    if (active?.meetingUrl) return active.meetingUrl
  } catch {
    // fail-soft (e.g. a parent viewer denied by rules) — fall through to tier 2
  }

  if (!params.tutorId) return null
  try {
    const snap = await getDoc(doc(db, 'users', params.tutorId))
    const url = snap.data()?.googleMeetUrl
    return typeof url === 'string' && url ? url : null
  } catch {
    return null
  }
}

export default function LiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const user = useUser()
  const navigate = useNavigate()

  const [access, setAccess] = useState<AccessState>('checking')
  const [role, setRole] = useState<LiveSessionAuthorRole | null>(null)
  const [session, setSession] = useState<LiveSessionEntry | null>(null)
  const [strokes, setStrokes] = useState<LiveStrokeEntry[]>([])
  const [meetUrl, setMeetUrl] = useState<string | null | undefined>(undefined) // undefined = not looked up yet
  const [ending, setEnding] = useState(false)

  // One-time defense-in-depth access check on mount.
  useEffect(() => {
    if (!sessionId || !user?.uid) return
    let cancelled = false
    getDoc(doc(db, 'liveSessions', sessionId))
      .then(async snap => {
        if (cancelled) return
        if (!snap.exists()) { setAccess('denied'); return }
        const data = snap.data() as LiveSessionEntry
        const resolvedRole = await resolveRole(user.uid, data)
        if (cancelled) return
        if (!resolvedRole) { setAccess('denied'); return }
        setRole(resolvedRole)
        setAccess('allowed')
      })
      .catch(() => { if (!cancelled) setAccess('denied') })
    return () => { cancelled = true }
  }, [sessionId, user?.uid])

  // Realtime session doc — context header + status, once access is confirmed.
  useEffect(() => {
    if (access !== 'allowed' || !sessionId) return
    return subscribeLiveSession(sessionId, setSession)
  }, [access, sessionId])

  // Realtime strokes, excluding this user's own — their own strokes already
  // paint locally via ScratchPad's committed-strokes path, so including them
  // here would double-draw (the exact double-draw the props doc warns about).
  useEffect(() => {
    if (access !== 'allowed' || !sessionId) return
    return subscribeLiveStrokes(sessionId, setStrokes)
  }, [access, sessionId])

  const remoteStrokes = useMemo<ScratchStrokePoint[][]>(
    () => strokes.filter(st => st.authorId !== user?.uid).map(st => st.points),
    [strokes, user?.uid],
  )

  async function handleTalk() {
    if (!session || !user?.uid) { setMeetUrl(null); return }
    const url = await resolveTalkUrl({
      role: role ?? 'student',
      userUid: user.uid,
      userEmail: user.email,
      studentId: session.studentId,
      tutorId: session.tutorId,
    })
    setMeetUrl(url)
    if (url) window.open(url, '_blank', 'noopener')
  }

  async function handleEnd() {
    if (!sessionId || ending) return
    setEnding(true)
    await endLiveSession(sessionId)
    navigate('/practice')
  }

  function handleLeave() {
    navigate(role === 'parent' ? '/parent' : role === 'tutor' ? '/tutor' : '/practice')
  }

  if (access === 'checking') {
    return <div className={s.loadWrap}><div className={s.spinner} /></div>
  }

  if (access === 'denied') {
    return (
      <div className={s.shell}>
        <main className={s.page}>
          <div className={s.card}>
            <p className={s.deniedTitle}>Can&apos;t open this call</p>
            <p className={s.deniedSub}>
              This live session doesn&apos;t exist anymore, or you&apos;re not part of it.
            </p>
            <Link to="/dashboard" className={s.submitBtn} style={{ display: 'inline-block', textDecoration: 'none' }}>
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const isStudent = role === 'student'
  const ended = session?.status === 'ended'

  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <Link to="/dashboard" className={s.logo}>Mind<span>Craft</span></Link>
        <div className={s.navActions}>
          <button type="button" className={s.talkBtn} onClick={() => void handleTalk()}>
            {meetUrl === null ? 'no meeting link set' : 'talk →'}
          </button>
          {isStudent ? (
            <button type="button" className={s.endBtn} onClick={() => void handleEnd()} disabled={ending}>
              {ending ? 'ending…' : 'end call'}
            </button>
          ) : (
            <button type="button" className={s.back} onClick={handleLeave}>leave</button>
          )}
        </div>
      </nav>

      <main className={s.page}>
        {ended && (
          <div className={s.endedBanner}>This call has ended.</div>
        )}

        <div className={s.progress}>
          Live call · {contextLabel(session)}
        </div>
        <h1 className={s.title}>
          {session?.conceptName || 'Working together'}
        </h1>
        {session?.questionText && (
          <p className={s.sub}>{session.questionText}</p>
        )}

        <div className={s.card}>
          <ScratchPad
            height={380}
            fillHeight
            liveSessionId={sessionId}
            authorId={user?.uid}
            authorRole={role ?? 'student'}
            remoteStrokes={remoteStrokes}
          />
        </div>
      </main>
    </div>
  )
}
