/**
 * StudentSessions.tsx
 *
 * Student-facing "Session Notes" page.
 * Lists all completed sessions with published summaries, most-recent first.
 * Fetched live from Firestore: sessions where studentEmail == user.email
 *                                          and summary.published == true
 */

import { useEffect, useState } from 'react'
import { db } from '../firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
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
    // No orderBy — avoids requiring a composite Firestore index; sort in JS instead
    const q = query(
      collection(db, 'sessions'),
      where('studentEmail', '==', user.email),
    )
    const unsub = onSnapshot(q, snap => {
      const docs: Session[] = []
      snap.forEach(d => {
        const data = d.data()
        if (!data.summary?.published) return
        docs.push({
          id:          d.id,
          subject:     data.subject     ?? 'General',
          tutorName:   data.tutorName   ?? 'Tutor',
          scheduledAt: data.scheduledAt ?? 0,
          date:        data.summary.date ?? '',
          duration:    data.summary.duration ?? '',
          title:       data.summary.title ?? '(no title)',
          bullets:     data.summary.bullets ?? [],
        })
      })
      docs.sort((a, b) => b.scheduledAt - a.scheduledAt)
      setSessions(docs)
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [user?.email])

  const subjects = ['All', ...Array.from(new Set(sessions.map(s => s.subject))).sort()]
  const visible  = filterSub === 'All' ? sessions : sessions.filter(s => s.subject === filterSub)

  return (
    <div className={s.shell}>
      <Sidebar />

      <main className={s.page}>
        {/* ── Header ── */}
        <div className={s.header}>
          <div className={s.headerLeft}>
            <h1 className={s.title}>Session Notes</h1>
            <p className={s.sub}>{sessions.length} session{sessions.length !== 1 ? 's' : ''} published</p>
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

        {/* ── Subject filter tabs ── */}
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

        {/* ── Content ── */}
        {loading ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : visible.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon}>📋</div>
            <p className={s.emptyTitle}>No sessions yet</p>
            <p className={s.emptySub}>Once your tutor publishes a session summary it'll appear here.</p>
            <button className={s.bookBtn} onClick={() => navigate('/book')}>Book a Session →</button>
          </div>
        ) : (
          <div className={s.list}>
            {visible.map(sess => {
              const color   = SUBJECT_COLORS[sess.subject] ?? '#00d2c8'
              const isOpen  = expanded === sess.id
              return (
                <div key={sess.id} className={`${s.card} ${isOpen ? s.cardOpen : ''}`}
                     style={{ '--accent': color } as React.CSSProperties}>
                  {/* Colored left border */}
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
