/**
 * Embedded session notes — scrollable list with keyword search.
 */
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { useUser } from '../App'
import s from '../pages/ConstellationGpsLab.module.css'
import n from './DashboardPanels.module.css'

interface Session {
  id: string
  subject: string
  tutorName: string
  date: string
  duration: string
  title: string
  bullets: string[]
}

const SUBJECT_COLORS: Record<string, string> = {
  Math: '#0069FF',
  Sciences: '#58CC02',
  Piano: '#9B59B6',
  Entrepreneurship: '#F59E0B',
  English: '#00d2c8',
}

export default function DashboardNotesPanel({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate()
  const authUser = useUser()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

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
      docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setSessions(docs)
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [authUser?.email])

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

  return (
    <div className={s.embeddedRoot}>
      <div className={s.embeddedHeader}>
        <button type="button" className={s.embeddedBack} onClick={onBack}>
          ← Back to hub
        </button>
        <div className={s.embeddedTitleRow}>
          <h2 className={s.embeddedTitle}>Session Notes</h2>
          <span className={s.embeddedSub}>{sessions.length} published</span>
        </div>
        <div className={s.searchWrap}>
          <svg className={s.searchIcon} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className={s.searchInput}
            placeholder="Search notes by keyword…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className={`${s.panelRoute} ${n.scrollBody}`}>
        {loading ? (
          <p className={s.sectionHint}>Loading your sessions…</p>
        ) : filtered.length === 0 ? (
          <div className={n.empty}>
            <p className={s.sectionHint}>
              {search ? 'No notes match that search.' : 'No published session notes yet.'}
            </p>
            <button type="button" className={s.btnGhost} onClick={() => navigate('/book')}>
              Book a session →
            </button>
          </div>
        ) : (
          <div className={n.notesList}>
            {filtered.map(sess => {
              const color = SUBJECT_COLORS[sess.subject] ?? '#00d2c8'
              const open = expanded === sess.id
              return (
                <article
                  key={sess.id}
                  className={`${n.noteCard} ${open ? n.noteCardOpen : ''}`}
                  style={{ ['--accent' as string]: color }}
                >
                  <button
                    type="button"
                    className={n.noteHead}
                    onClick={() => setExpanded(open ? null : sess.id)}
                  >
                    <span className={n.noteSubject}>{sess.subject}</span>
                    <strong className={n.noteTitle}>{sess.title}</strong>
                    <span className={n.noteMeta}>{sess.tutorName} · {sess.date}</span>
                  </button>
                  {open && (
                    <ul className={n.noteBullets}>
                      {sess.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>
        )}

        <button type="button" className={s.btnGhost} onClick={() => navigate('/sessions')}>
          Open full notes page →
        </button>
      </div>
    </div>
  )
}
