/**
 * Embedded session notes — paginated into book leaves. Clicking a note flips
 * to a detail leaf (no vertical accordion). Swipe left/right on iPad to turn.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { useUser } from '../App'
import PageFlipTransition from './book/PageFlipTransition'
import { useSwipeFlip } from '../hooks/useSwipeFlip'
import n from './DashboardPanels.module.css'

interface Session {
  id: string
  subject: string
  tutorName: string
  date: string
  duration: string
  title: string
  bullets: string[]
  /** Present for self-directed homework entries — detail view links here instead of showing bullets only. */
  homeworkId?: string
}

const NOTES_PER_LEAF = 3

export default function DashboardNotesPanel() {
  const navigate = useNavigate()
  const authUser = useUser()
  const swipeRef = useRef<HTMLDivElement>(null)
  const [tutorSessions, setTutorSessions] = useState<Session[]>([])
  const [homeworkNotes, setHomeworkNotes] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [leaf, setLeaf] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [flipDir, setFlipDir] = useState<'forward' | 'back'>('forward')

  useEffect(() => {
    if (!authUser?.email) return
    const q = query(
      collection(db, 'sessions'),
      where('studentEmail', '==', authUser.email),
    )
    const unsub = onSnapshot(q, snap => {
      const docs: Session[] = []
      snap.forEach(d => {
        const data = d.data()
        if (!data.summary?.published) return
        docs.push({
          id: d.id,
          subject: data.subject ?? 'General',
          tutorName: data.tutorName ?? 'Tutor',
          date: data.summary.date ?? '',
          duration: data.summary.duration ?? '',
          title: data.summary.title ?? '(no title)',
          bullets: data.summary.bullets ?? [],
        })
      })
      setTutorSessions(docs)
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [authUser?.email])

  // Self-directed homework uploads — completed worksheets read back as
  // journal entries alongside tutor-published notes.
  useEffect(() => {
    if (!authUser?.uid) return
    const q = query(
      collection(db, 'homework_sessions'),
      where('studentId', '==', authUser.uid),
    )
    const unsub = onSnapshot(q, snap => {
      const docs: Session[] = []
      snap.forEach(d => {
        const data = d.data()
        if (data.status !== 'completed' || !data.summary) return
        docs.push({
          id: `hw-${d.id}`,
          homeworkId: d.id,
          subject: 'Homework',
          tutorName: 'your own work',
          date: data.summary.date ?? '',
          duration: '',
          title: data.title ?? 'Homework',
          bullets: data.summary.bullets ?? [],
        })
      })
      setHomeworkNotes(docs)
    }, () => {})
    return () => unsub()
  }, [authUser?.uid])

  const sessions = useMemo(() => {
    const merged = [...tutorSessions, ...homeworkNotes]
    merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    return merged
  }, [tutorSessions, homeworkNotes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter(sess =>
      sess.title.toLowerCase().includes(q)
      || sess.subject.toLowerCase().includes(q)
      || sess.tutorName.toLowerCase().includes(q)
      || sess.bullets.some(b => b.toLowerCase().includes(q)),
    )
  }, [sessions, search])

  const leafCount = Math.max(1, Math.ceil(filtered.length / NOTES_PER_LEAF))
  const currentLeaf = Math.min(leaf, leafCount - 1)
  const visible = filtered.slice(
    currentLeaf * NOTES_PER_LEAF,
    (currentLeaf + 1) * NOTES_PER_LEAF,
  )
  const detail = detailId ? filtered.find(s => s.id === detailId) ?? null : null

  const turnLeaf = useCallback((next: number) => {
    if (next < 0 || next >= leafCount) return
    setFlipDir(next > currentLeaf ? 'forward' : 'back')
    setDetailId(null)
    setLeaf(next)
  }, [currentLeaf, leafCount])

  const openDetail = useCallback((id: string) => {
    setFlipDir('forward')
    setDetailId(id)
  }, [])

  const closeDetail = useCallback(() => {
    setFlipDir('back')
    setDetailId(null)
  }, [])

  useSwipeFlip(
    swipeRef,
    () => {
      if (detailId) closeDetail()
      else turnLeaf(currentLeaf + 1)
    },
    () => {
      if (detailId) closeDetail()
      else turnLeaf(currentLeaf - 1)
    },
    !loading && filtered.length > 0,
  )

  const viewKey = detailId ? `detail-${detailId}` : `leaf-${currentLeaf}-${search}`

  return (
    <div className={n.paperPanelBody} ref={swipeRef}>
      <input
        className={n.paperSearchLine}
        placeholder="search notes by keyword…"
        value={search}
        onChange={e => { setSearch(e.target.value); setLeaf(0); setDetailId(null) }}
        aria-label="Search notes"
      />

      <div className={n.scrollBody}>
        {loading ? (
          <p className={n.paperLoading}>Loading your sessions…</p>
        ) : filtered.length === 0 ? (
          <div className={n.empty}>
            <p className={n.paperEmptyHint}>
              {search ? 'No notes match that search.' : 'No published notes yet.'}
            </p>
            <button type="button" className={n.paperTextLink} onClick={() => navigate('/book')}>
              Book a session →
            </button>
          </div>
        ) : (
          <PageFlipTransition viewKey={viewKey} direction={flipDir}>
            {detail ? (
              <article className={n.noteDetailLeaf}>
                <button type="button" className={n.noteDetailBack} onClick={closeDetail}>
                  ← notes
                </button>
                <span className={n.noteMeta}>{detail.date} · {detail.tutorName}</span>
                <h3 className={n.noteDetailTitle}>{detail.title}</h3>
                <p className={n.noteTutor}>{detail.subject}{detail.duration ? ` · ${detail.duration}` : ''}</p>
                <ul className={n.noteBullets}>
                  {detail.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                {detail.homeworkId && (
                  <button
                    type="button"
                    className={n.paperTextLink}
                    onClick={() => navigate(`/homework/${detail.homeworkId}`)}
                  >
                    Open this worksheet →
                  </button>
                )}
              </article>
            ) : (
              <div className={n.notesList}>
                {visible.map(sess => (
                  <article key={sess.id} className={n.noteEntry}>
                    <button
                      type="button"
                      className={n.noteHead}
                      onClick={() => openDetail(sess.id)}
                    >
                      <span className={n.noteMeta}>{sess.date} · {sess.tutorName}</span>
                      <strong className={n.noteTitle}>{sess.title}</strong>
                      <span className={n.noteTutor}>{sess.subject}{sess.duration ? ` · ${sess.duration}` : ''}</span>
                      <span className={n.noteTurnHint}>turn page →</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </PageFlipTransition>
        )}

        {!detailId && leafCount > 1 && (
          <div className={n.leafNav}>
            <button
              type="button"
              className={n.leafNavBtn}
              onClick={() => turnLeaf(currentLeaf + 1)}
              disabled={currentLeaf >= leafCount - 1}
            >
              ← older
            </button>
            <span className={n.leafNavCount}>leaf {currentLeaf + 1} of {leafCount}</span>
            <button
              type="button"
              className={n.leafNavBtn}
              onClick={() => turnLeaf(currentLeaf - 1)}
              disabled={currentLeaf === 0}
            >
              newer →
            </button>
          </div>
        )}

        <button type="button" className={n.paperTextLink} onClick={() => navigate('/sessions')}>
          Open full notes →
        </button>
      </div>
    </div>
  )
}
