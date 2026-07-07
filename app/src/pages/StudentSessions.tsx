/**
 * StudentSessions.tsx
 *
 * Student-facing "Session Notes" page.
 * Lists published session summaries + follow-up work prompts from tutors.
 */

import { useEffect, useState } from 'react'
import { db } from '../firebase'
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import Sidebar  from '../components/Sidebar'
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

export default function StudentSessions() {
  const user     = useUser()
  const navigate = useNavigate()
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)
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
              {sessions.filter(sess => sess.bullets.length > 0).length} session{sessions.filter(sess => sess.bullets.length > 0).length !== 1 ? 's' : ''} published
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
            View Knowledge Graph
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
            <p className={s.emptySub}>Once your tutor publishes a session summary it'll appear here.</p>
            <button className={s.bookBtn} onClick={() => navigate('/book')}>Book a Session →</button>
          </div>
        ) : visible.length === 0 ? null : (
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
        )}
      </main>
    </div>
  )
}
