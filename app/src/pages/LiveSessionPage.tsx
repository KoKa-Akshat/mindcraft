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
import { doc, getDoc } from 'firebase/firestore'
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
    if (!session?.tutorId) { setMeetUrl(null); return }
    try {
      const snap = await getDoc(doc(db, 'users', session.tutorId))
      const url = snap.data()?.googleMeetUrl
      setMeetUrl(typeof url === 'string' && url ? url : null)
      if (typeof url === 'string' && url) window.open(url, '_blank', 'noopener')
    } catch {
      setMeetUrl(null)
    }
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
