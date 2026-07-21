/**
 * Embedded session notes — paginated into book leaves. Saved bookmarks
 * sit at the top with a highlight strip (Saved tab removed from dashboard).
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { useUser } from '../App'
import { getQuestionById } from '../lib/questionBank'
import { toggleBookmark } from '../lib/dashboardPersonalization'
import PageFlipTransition from './book/PageFlipTransition'
import BookmarkButton from './BookmarkButton'
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
  homeworkId?: string
}

const NOTES_PER_LEAF = 3

export default function DashboardNotesPanel({
  uid = '',
  bookmarkedIds = [],
  onBookmarksChange,
}: {
  uid?: string
  bookmarkedIds?: string[]
  onBookmarksChange?: (ids: string[]) => void
}) {
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

  const savedItems = useMemo(
    () => bookmarkedIds
      .map(id => ({ id, q: getQuestionById(id) }))
      .filter((item): item is { id: string; q: NonNullable<ReturnType<typeof getQuestionById>> } => !!item.q),
    [bookmarkedIds],
  )

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
          tutorName: 'you',
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

  async function handleUnbookmark(questionId: string) {
    if (!uid || !onBookmarksChange) return
    const next = await toggleBookmark(uid, questionId, bookmarkedIds)
    onBookmarksChange(next)
  }

  return (
    <div className={n.paperPanelBody} ref={swipeRef}>
      {savedItems.length > 0 && (
        <section className={n.savedStrip} aria-label="Saved questions">
          <div className={n.savedStripHead}>
            <span className={n.savedStripStar}>★</span>
            <span className={n.savedStripTitle}>Saved</span>
            <span className={n.savedStripCount}>{savedItems.length}</span>
          </div>
          <ul className={n.savedList}>
            {savedItems.slice(0, 6).map(({ id, q }) => (
              <li key={id} className={n.savedRow}>
                <button
                  type="button"
                  className={n.savedOpen}
                  onClick={() => navigate('/practice', {
                    state: { conceptId: q.conceptId, missionType: 'learn' },
                  })}
                >
                  {q.question.slice(0, 72)}{q.question.length > 72 ? '…' : ''}
                </button>
                <BookmarkButton
                  active
                  onToggle={() => { void handleUnbookmark(id) }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <input
        className={n.paperSearchLine}
        placeholder="Search…"
        value={search}
        onChange={e => { setSearch(e.target.value); setLeaf(0); setDetailId(null) }}
        aria-label="Search notes"
      />

      <div className={n.scrollBody}>
        {loading ? (
          <p className={n.paperLoading}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className={n.empty}>
            <p className={n.paperEmptyHint}>
              {search ? 'Nothing matches.' : 'No notes yet.'}
            </p>
          </div>
        ) : (
          <PageFlipTransition viewKey={viewKey} direction={flipDir}>
            {detail ? (
              <article className={n.noteDetailLeaf}>
                <button type="button" className={n.noteDetailBack} onClick={closeDetail}>
                  ← back
                </button>
                <span className={n.noteMeta}>{detail.date}</span>
                <h3 className={n.noteDetailTitle}>{detail.title}</h3>
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
                    Open worksheet →
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
                      <span className={n.noteMeta}>{sess.date}</span>
                      <strong className={n.noteTitle}>{sess.title}</strong>
                      <span className={n.noteTurnHint}>→</span>
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
            <span className={n.leafNavCount}>{currentLeaf + 1} / {leafCount}</span>
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
      </div>
    </div>
  )
}
