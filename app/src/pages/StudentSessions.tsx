/**
 * StudentSessions.tsx
 *
 * Student-facing "Session Notes" page.
 * Lists published session summaries + follow-up work prompts from tutors.
 */

import { useEffect, useMemo, useState } from 'react'
import { db } from '../firebase'
import { collection, query, where, onSnapshot, getDocs, orderBy } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import QuestionWorkView from '../components/QuestionWorkView'
import Sidebar  from '../components/Sidebar'
import conceptStoriesData from '../data/conceptStories.json'
import { getQuestionById } from '../lib/questionBank'
import { groupWorkByConcept } from '../lib/workEvidence'
import type { StudentWorkEntry } from '../types'
import s        from './StudentSessions.module.css'

interface Session {
  id:          string
  subject:     string
  tutorName:   string
  scheduledAt: number
  date:        string
  duration:    string
  title:       string
  bullets:     string[]
  workPrompts: string[]
  pendingWork: boolean
}

const SUBJECT_COLORS: Record<string, string> = {
  Math:           '#0069FF',
  Sciences:       '#58CC02',
  Piano:          '#9B59B6',
  Entrepreneurship: '#F59E0B',
  English:        '#00d2c8',
  History:        '#E67E22',
  'Data Science': '#1ABC9C',
  Accounting:     '#E74C3C',
}

type ArtifactType = 'flashcards' | 'mindmap' | 'slides' | 'figure'

const CONCEPT_STORIES = conceptStoriesData as Record<string, { conceptName?: string }>

export default function StudentSessions() {
  const user     = useUser()
  const navigate = useNavigate()
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [workEntries, setWorkEntries] = useState<StudentWorkEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [expandedWork, setExpandedWork] = useState<string | null>(null)
  const [expandedConcept, setExpandedConcept] = useState<string | null>(null)
  const [selectedSources, setSelectedSources] = useState<Record<string, string[]>>({})
  const [artifactType, setArtifactType] = useState<ArtifactType>('flashcards')
  const [filterSub, setFilterSub] = useState<string>('All')

  useEffect(() => {
    if (!user?.email) return
    const q = query(
      collection(db, 'sessions'),
      where('studentEmail', '==', user.email),
    )
    const unsub = onSnapshot(q, async snap => {
      try {
        const docs: Session[] = []
        await Promise.all(snap.docs.map(async d => {
          const data = d.data()
          const published = !!data.summary?.published
          const workPrompts: string[] = (data.workPrompts ?? []).filter(Boolean)

          let pendingWork = false
          if (workPrompts.length) {
            const workSnap = await getDocs(collection(db, 'sessions', d.id, 'studentWork'))
            const submitted = new Set(workSnap.docs.map(w => w.data().prompt as string))
            pendingWork = workPrompts.some(p => !submitted.has(p))
          }

          if (!published && !pendingWork) return

          docs.push({
            id:          d.id,
            subject:     data.subject     ?? 'General',
            tutorName:   data.tutorName   ?? 'Tutor',
            scheduledAt: data.scheduledAt ?? 0,
            date:        data.summary?.date ?? data.date ?? '',
            duration:    data.summary?.duration ?? data.duration ?? '',
            title:       data.summary?.title ?? `${data.subject ?? 'Session'} follow-up`,
            bullets:     data.summary?.bullets ?? [],
            workPrompts,
            pendingWork,
          })
        }))
        docs.sort((a, b) => b.scheduledAt - a.scheduledAt)
        setSessions(docs)
      } finally {
        setLoading(false)
      }
    }, () => setLoading(false))
    return () => unsub()
  }, [user?.email])

  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(db, 'student_work'),
      where('studentId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
    )
    const unsub = onSnapshot(q, snap => {
      setWorkEntries(snap.docs.map(d => {
        const data = d.data() as Omit<StudentWorkEntry, 'id'>
        return {
          ...data,
          id: d.id,
          prompt: data.prompt ?? '',
          reasoningText: data.reasoningText ?? '',
          wasStuck: Boolean(data.wasStuck),
        }
      }))
    })
    return () => unsub()
  }, [user?.uid])

  const conceptWorkGroups = useMemo(() => groupWorkByConcept(workEntries, {
    getConceptName: conceptId => CONCEPT_STORIES[conceptId]?.conceptName,
    getQuestionStem: entry => entry.questionId ? getQuestionById(entry.questionId)?.question : entry.prompt,
  }), [workEntries])
  const workCount = conceptWorkGroups.reduce((sum, group) => sum + group.entries.length, 0)

  function toggleSource(conceptId: string, entryId: string) {
    setSelectedSources(prev => {
      const current = prev[conceptId] ?? []
      const next = current.includes(entryId)
        ? current.filter(id => id !== entryId)
        : [...current, entryId]
      return { ...prev, [conceptId]: next }
    })
  }

  const pendingSessions = sessions.filter(sess => sess.pendingWork)
  const subjects = ['All', ...Array.from(new Set(sessions.filter(sess => sess.bullets.length > 0).map(sess => sess.subject))).sort()]
  const visible  = filterSub === 'All'
    ? sessions.filter(sess => sess.bullets.length > 0)
    : sessions.filter(sess => sess.bullets.length > 0 && sess.subject === filterSub)

  return (
    <div className={s.shell}>
      <Sidebar />

      <main className={s.page}>
        <div className={s.header}>
          <div className={s.headerLeft}>
            <h1 className={s.title}>Notes</h1>
            <p className={s.sub}>
              {workCount} question{workCount !== 1 ? 's' : ''} in my work
            </p>
          </div>
          <button className={s.graphBtn} onClick={() => navigate('/knowledge-graph')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
              <circle cx="12" cy="8" r="2"/><circle cx="12" cy="16" r="2"/>
              <line x1="7" y1="12" x2="10" y2="9"/><line x1="7" y1="12" x2="10" y2="15"/>
              <line x1="14" y1="8" x2="17" y2="6"/><line x1="14" y1="16" x2="17" y2="18"/>
              <line x1="13" y1="10" x2="13" y2="14"/>
            </svg>
            View Map
          </button>
        </div>

        {!loading && pendingSessions.length > 0 && (
          <div className={s.workSection}>
            <h2 className={s.workSectionTitle}>Follow-up work from your tutor</h2>
            {pendingSessions.map(sess => (
              <div key={sess.id} className={s.workCard}>
                <div>
                  <span className={s.workSubject}>{sess.subject}</span>
                  <p className={s.workMeta}>{sess.tutorName} · {sess.workPrompts.length} problem{sess.workPrompts.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  className={s.workBtn}
                  onClick={() => navigate(`/session-work/${sess.id}`)}
                >
                  Work through what we covered →
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && conceptWorkGroups.length > 0 && (
          <div className={s.workLedger}>
            <h2 className={s.workSectionTitle}>My work</h2>
            <div className={s.list}>
              {conceptWorkGroups.map(group => {
                const isConceptOpen = expandedConcept === group.conceptId
                const selected = selectedSources[group.conceptId] ?? []
                return (
                  <div key={group.conceptId} className={`${s.card} ${isConceptOpen ? s.cardOpen : ''}`}>
                    <div className={s.cardTop} onClick={() => setExpandedConcept(isConceptOpen ? null : group.conceptId)}>
                      <div className={s.cardLeft}>
                        <span className={s.subject}>notebook</span>
                        <h3 className={s.sessionTitle}>{group.conceptName}</h3>
                        <div className={s.meta}>
                          <span>{group.entries.length} problem{group.entries.length !== 1 ? 's' : ''} worked</span>
                          <span className={s.dot}>·</span>
                          <span>{new Date(group.lastWorkedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className={s.cardRight}>
                        <span className={s.bulletCount}>{selected.length} selected</span>
                        <svg className={`${s.chevron} ${isConceptOpen ? s.chevronOpen : ''}`}
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </div>

                    {isConceptOpen && (
                      <div className={s.notebookBody}>
                        <div className={s.artifactBar}>
                          <div className={s.artifactTypes} role="group" aria-label="Artifact type">
                            {(['flashcards', 'mindmap', 'slides', 'figure'] as ArtifactType[]).map(type => (
                              <button
                                key={type}
                                type="button"
                                className={`${s.artifactTypeBtn} ${artifactType === type ? s.artifactTypeActive : ''}`}
                                onClick={() => setArtifactType(type)}
                              >
                                {type === 'mindmap' ? 'mind map' : type}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            className={s.generateBtn}
                            disabled
                            title={selected.length === 0 ? 'Select sources first' : 'Artifact generation lands in B2'}
                          >
                            Generate
                          </button>
                        </div>

                        <div className={s.questionRows}>
                          {group.entries.map(entry => {
                            const question = entry.questionId ? getQuestionById(entry.questionId) : undefined
                            const title = question?.question ?? (entry.prompt || 'Worked question')
                            const isOpen = expandedWork === entry.id
                            const isSelected = selected.includes(entry.id)
                            return (
                              <div key={entry.id} className={s.questionRow}>
                                <div className={s.questionSummary}>
                                  <label className={s.sourceCheck}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSource(group.conceptId, entry.id)}
                                    />
                                    <span>{entry.recallTag ?? title}</span>
                                  </label>
                                  <button
                                    type="button"
                                    className={s.openWorkBtn}
                                    onClick={() => setExpandedWork(isOpen ? null : entry.id)}
                                    aria-expanded={isOpen}
                                  >
                                    {isOpen ? 'Close work' : 'Open work'}
                                  </button>
                                </div>
                                <div className={s.questionMeta}>
                                  <span>{entry.source ?? 'work'}</span>
                                  <span className={s.dot}>·</span>
                                  <span>{entry.workLines?.length ?? 0} steps</span>
                                  <span className={s.dot}>·</span>
                                  <span>{new Date(entry.updatedAt ?? entry.createdAt).toLocaleDateString()}</span>
                                </div>
                                {isOpen && (
                                  <div className={s.workDrill}>
                                    <QuestionWorkView entry={entry} showPrompt />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && subjects.length > 2 && (
          <div className={s.filters}>
            {subjects.map(sub => (
              <button
                key={sub}
                className={`${s.filterBtn} ${filterSub === sub ? s.filterActive : ''}`}
                style={filterSub === sub && sub !== 'All' ? { borderColor: SUBJECT_COLORS[sub] ?? '#00d2c8', color: SUBJECT_COLORS[sub] ?? '#00d2c8' } : {}}
                onClick={() => setFilterSub(sub)}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : visible.length === 0 && pendingSessions.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon}>📋</div>
            <p className={s.emptyTitle}>No sessions yet</p>
            <p className={s.emptySub}>Once you work through a question or your tutor publishes notes, it’ll appear here.</p>
            <button className={s.bookBtn} onClick={() => navigate('/book')}>Book a Session →</button>
          </div>
        ) : visible.length === 0 ? null : (
          <div className={s.summarySection}>
            <h2 className={s.workSectionTitle}>Published summaries</h2>
            <div className={s.list}>
            {visible.map(sess => {
              const color   = SUBJECT_COLORS[sess.subject] ?? '#00d2c8'
              const isOpen  = expanded === sess.id
              return (
                <div key={sess.id} className={`${s.card} ${isOpen ? s.cardOpen : ''}`}
                     style={{ '--accent': color } as React.CSSProperties}>
                  <div className={s.cardAccent} />

                  <div className={s.cardTop} onClick={() => setExpanded(isOpen ? null : sess.id)}>
                    <div className={s.cardLeft}>
                      <span className={s.subject}>{sess.subject}</span>
                      <h3 className={s.sessionTitle}>{sess.title}</h3>
                      <div className={s.meta}>
                        <span>{sess.tutorName}</span>
                        <span className={s.dot}>·</span>
                        <span>{sess.date}</span>
                        {sess.duration && <><span className={s.dot}>·</span><span>{sess.duration}</span></>}
                      </div>
                    </div>
                    <div className={s.cardRight}>
                      <span className={s.bulletCount}>{sess.bullets.length} key points</span>
                      <svg className={`${s.chevron} ${isOpen ? s.chevronOpen : ''}`}
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>

                  {isOpen && (
                    <div className={s.bullets}>
                      {sess.bullets.map((b, i) => (
                        <div key={i} className={s.bullet}>
                          <span className={s.bulletNum}>{i + 1}</span>
                          <span>{b}</span>
                        </div>
                      ))}
                      <div className={s.cardActions}>
                        {sess.pendingWork && (
                          <button
                            className={s.workBtnInline}
                            onClick={() => navigate(`/session-work/${sess.id}`)}
                          >
                            Work through what we covered →
                          </button>
                        )}
                        <button className={s.graphLink}
                          onClick={() => navigate(`/knowledge-graph/${encodeURIComponent(sess.subject)}`)}>
                          Explore {sess.subject} Graph →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
