/**
 * ParentDashboard.tsx
 *
 * Real parent view — kept deliberately simple per the founder's brief:
 * a kid switcher (if linked to more than one), a "tutor comment" box (the
 * most recent session's tutorNotes for that kid — reuses the field
 * TutorDashboard.tsx already writes, no new write path), and underneath it
 * the SAME live student dashboard view already proven safe for tutors/
 * admins (Dashboard's viewAsStudentId + embedded mode — read-only, no
 * writes attributed to the parent). Not a rebuild of the tutor dashboard's
 * roster/Calendly/location machinery — parents only ever see their own
 * linked kid(s).
 */
import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useNavigate } from 'react-router-dom'
import {
  doc, getDoc, getDocs,
  collection, query, where, orderBy, limit,
} from 'firebase/firestore'
import { useUser } from '../App'
import { MARKETING_BASE } from '../lib/siteUrls'
import Dashboard from './Dashboard'
import s from './ParentDashboard.module.css'

export default function ParentDashboard() {
  const user = useUser()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [childIds, setChildIds] = useState<string[]>([])
  const [childNames, setChildNames] = useState<Record<string, string>>({})
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [tutorComment, setTutorComment] = useState<string | null>(null)
  const [tutorCommentFrom, setTutorCommentFrom] = useState<string | null>(null)

  // ── load parent doc → linked kid(s) ──
  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const data = snap.data() ?? {}
      if (data.role !== 'parent' && data.role !== 'admin') {
        navigate('/dashboard', { replace: true })
        return
      }
      const rawIds: unknown = data.childIds
      const ids = Array.isArray(rawIds) && rawIds.length > 0
        ? [...new Set(rawIds.filter((x): x is string => typeof x === 'string'))]
        : (typeof data.childId === 'string' ? [data.childId] : [])
      setChildIds(ids)
      if (ids.length > 0) setSelectedChildId(ids[0])
      setLoading(false)
    })
  }, [user, navigate])

  // ── names for the kid switcher ──
  useEffect(() => {
    if (childIds.length === 0) return
    let cancelled = false
    void Promise.all(
      childIds.map(id => getDoc(doc(db, 'users', id)).then(snap => {
        const d = snap.data()
        return [id, d?.displayName || d?.email?.split('@')[0] || 'Student'] as const
      })),
    ).then(pairs => {
      if (cancelled) return
      setChildNames(Object.fromEntries(pairs))
    })
    return () => { cancelled = true }
  }, [childIds])

  // ── the selected kid's most recent tutor comment (from their latest session) ──
  useEffect(() => {
    setTutorComment(null)
    setTutorCommentFrom(null)
    if (!selectedChildId) return
    let cancelled = false
    void getDocs(
      query(
        collection(db, 'sessions'),
        where('studentId', '==', selectedChildId),
        orderBy('scheduledAt', 'desc'),
        limit(1),
      ),
    ).then(snap => {
      if (cancelled || snap.empty) return
      const sd = snap.docs[0].data()
      if (typeof sd.tutorNotes === 'string' && sd.tutorNotes.trim()) {
        setTutorComment(sd.tutorNotes.trim())
        setTutorCommentFrom(sd.tutorName || null)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [selectedChildId])

  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <a href={MARKETING_BASE} className={s.logo}>
          <img src="/brand/logo-mark.png" alt="" className={s.logoMark} />
          <span>MindCraft</span>
        </a>
        <div className={s.topRight}>
          <span className={s.userChip}>{user.email}</span>
          <button type="button" className={s.signOut} onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </header>

      {loading && (
        <div className={s.centerNote}>Loading…</div>
      )}

      {!loading && childIds.length === 0 && (
        <div className={s.centerNote}>
          <h1 className={s.emptyTitle}>No student linked yet</h1>
          <p className={s.emptySub}>
            Ask an admin to link your account to your student, or ask your
            student to add your email as their parent email so you can be
            linked.
          </p>
        </div>
      )}

      {!loading && childIds.length > 0 && (
        <>
          {childIds.length > 1 && (
            <div className={s.kidSwitcher}>
              {childIds.map(id => (
                <button
                  key={id}
                  type="button"
                  className={`${s.kidPill} ${id === selectedChildId ? s.kidPillActive : ''}`}
                  onClick={() => setSelectedChildId(id)}
                >
                  {childNames[id] || 'Loading…'}
                </button>
              ))}
            </div>
          )}

          {tutorComment && (
            <div className={s.tutorCommentBox}>
              <span className={s.tutorCommentLabel}>
                {tutorCommentFrom ? `Note from ${tutorCommentFrom}` : 'Tutor note'}
              </span>
              <p className={s.tutorCommentText}>{tutorComment}</p>
            </div>
          )}

          {selectedChildId && (
            <div className={s.dashFrame}>
              <Dashboard viewAsStudentId={selectedChildId} embedded />
            </div>
          )}
        </>
      )}
    </div>
  )
}
