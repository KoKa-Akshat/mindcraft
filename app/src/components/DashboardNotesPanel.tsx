/**
 * Embedded session notes — scrollable list with keyword search.
 */
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { useUser } from '../App'
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

export default function DashboardNotesPanel() {
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
    <div className={n.paperPanelBody}>
      <input
        className={n.paperSearchLine}
        placeholder="search notes by keyword…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        aria-label="Search session notes"
      />

      <div className={n.scrollBody}>
        {loading ? (
          <p className={n.paperLoading}>Loading your sessions…</p>
        ) : filtered.length === 0 ? (
          <div className={n.empty}>
            <p className={n.paperEmptyHint}>
              {search ? 'No notes match that search.' : 'No published session notes yet.'}
            </p>
            <button type="button" className={n.paperTextLink} onClick={() => navigate('/book')}>
              Book a session →
            </button>
          </div>
        ) : (
          <div className={n.notesList}>
            {filtered.map(sess => {
              const open = expanded === sess.id
              return (
                <article key={sess.id} className={n.noteEntry}>
                  <button
                    type="button"
                    className={n.noteHead}
                    onClick={() => setExpanded(open ? null : sess.id)}
                  >
                    <span className={n.noteMeta}>{sess.date} · {sess.tutorName}</span>
                    <strong className={n.noteTitle}>{sess.title}</strong>
                    <span className={n.noteTutor}>{sess.subject}{sess.duration ? ` · ${sess.duration}` : ''}</span>
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

        <button type="button" className={n.paperTextLink} onClick={() => navigate('/sessions')}>
          Open full notes page →
        </button>
      </div>
    </div>
  )
}
