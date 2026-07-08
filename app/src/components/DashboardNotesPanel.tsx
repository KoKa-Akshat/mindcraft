import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { useUser } from '../App'
import { getQuestionById } from '../lib/questionBank'
import { groupStudentWorkLedger } from '../lib/workEvidence'
import { useSwipeFlip } from '../hooks/useSwipeFlip'
import type { StudentWorkEntry } from '../types'
import PageFlipTransition from './book/PageFlipTransition'
import QuestionWorkView from './QuestionWorkView'
import n from './DashboardPanels.module.css'

const NOTES_PER_LEAF = 3

export default function DashboardNotesPanel() {
  const navigate = useNavigate()
  const user = useUser()
  const swipeRef = useRef<HTMLDivElement>(null)
  const [entries, setEntries] = useState<StudentWorkEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [leaf, setLeaf] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [flipDir, setFlipDir] = useState<'forward' | 'back'>('forward')

  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(db, 'student_work'),
      where('studentId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
    )
    const unsub = onSnapshot(q, snap => {
      const docs: StudentWorkEntry[] = snap.docs.map(d => {
        const data = d.data() as Omit<StudentWorkEntry, 'id'>
        return {
          ...data,
          id: d.id,
          prompt: data.prompt ?? '',
          reasoningText: data.reasoningText ?? '',
          wasStuck: Boolean(data.wasStuck),
        }
      })
      setEntries(docs)
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [user?.uid])

  const grouped = useMemo(() => groupStudentWorkLedger(entries), [entries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return grouped
    return grouped.filter(entry => {
      const question = entry.questionId ? getQuestionById(entry.questionId) : undefined
      const hay = [
        question?.question ?? '',
        entry.prompt ?? '',
        entry.conceptId ?? '',
        entry.source ?? '',
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [grouped, search])

  const leafCount = Math.max(1, Math.ceil(filtered.length / NOTES_PER_LEAF))
  const currentLeaf = Math.min(leaf, leafCount - 1)
  const visible = filtered.slice(currentLeaf * NOTES_PER_LEAF, (currentLeaf + 1) * NOTES_PER_LEAF)
  const detail = detailId ? filtered.find(entry => entry.id === detailId) ?? null : null

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
        placeholder="search worked questions…"
        value={search}
        onChange={e => { setSearch(e.target.value); setLeaf(0); setDetailId(null) }}
        aria-label="Search notes"
      />

      <div className={n.scrollBody}>
        {loading ? (
          <p className={n.paperLoading}>Loading your notes…</p>
        ) : filtered.length === 0 ? (
          <div className={n.empty}>
            <p className={n.paperEmptyHint}>
              {search ? 'No worked questions match that search.' : 'No worked questions saved yet.'}
            </p>
            <button type="button" className={n.paperTextLink} onClick={() => navigate('/practice')}>
              Open practice →
            </button>
          </div>
        ) : (
          <PageFlipTransition viewKey={viewKey} direction={flipDir}>
            {detail ? (
              <article className={n.noteDetailLeaf}>
                <button type="button" className={n.noteDetailBack} onClick={closeDetail}>
                  ← notes
                </button>
                <QuestionWorkView entry={detail} />
              </article>
            ) : (
              <div className={n.notesList}>
                {visible.map(entry => {
                  const question = entry.questionId ? getQuestionById(entry.questionId) : undefined
                  const title = question?.question ?? (entry.prompt || 'Worked question')
                  return (
                    <article key={entry.id} className={n.noteEntry}>
                      <button
                        type="button"
                        className={n.noteHead}
                        onClick={() => openDetail(entry.id)}
                      >
                        <span className={n.noteMeta}>
                          {(entry.source ?? 'work')} · {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                        <strong className={n.noteTitle}>
                          {title.length > 96 ? `${title.slice(0, 95)}…` : title}
                        </strong>
                        <span className={n.noteTutor}>
                          {(entry.conceptId ?? 'general').replace(/_/g, ' ')}
                        </span>
                        <span className={n.noteTurnHint}>turn page →</span>
                      </button>
                    </article>
                  )
                })}
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
