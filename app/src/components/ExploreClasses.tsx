import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { useUser } from '../App'
import s from './Card.module.css'

interface SubjectRow {
  icon: string
  bg: string
  name: string
  sub: string
  badge: string
  badgeType: string
}

const SUGGESTIONS: SubjectRow[] = [
  { icon: '📐', bg: 'linear-gradient(135deg, #2D5016, #58CC02)', name: 'Mathematics', sub: 'Algebra · Calculus · Stats', badge: 'Book', badgeType: 'new' },
  { icon: '⚛️', bg: 'linear-gradient(135deg, #1A2A6C, #4A7BF7)', name: 'Sciences', sub: 'Physics · Chemistry · Bio', badge: 'Book', badgeType: 'free' },
  { icon: '📖', bg: 'linear-gradient(135deg, #7B4F00, #F59E0B)', name: 'English', sub: 'Writing · Literature · SAT', badge: 'Book', badgeType: 'soon' },
]

const SUBJECT_META: Record<string, Pick<SubjectRow, 'icon' | 'bg'>> = {
  'Math':             { icon: '📐', bg: 'linear-gradient(135deg, #2D5016, #58CC02)' },
  'Physics':          { icon: '⚛️', bg: 'linear-gradient(135deg, #1A2A6C, #4A7BF7)' },
  'Chemistry':        { icon: '🧪', bg: 'linear-gradient(135deg, #7B1A1A, #E74C3C)' },
  'Biology':          { icon: '🧬', bg: 'linear-gradient(135deg, #1A5C2A, #27AE60)' },
  'English':          { icon: '📖', bg: 'linear-gradient(135deg, #7B4F00, #F59E0B)' },
  'History':          { icon: '📜', bg: 'linear-gradient(135deg, #4A1A6C, #9B59B6)' },
  'Tutoring Session': { icon: '📚', bg: 'linear-gradient(135deg, #2D5016, #58CC02)' },
}

export default function ExploreClasses() {
  const user = useUser()
  const navigate = useNavigate()
  const [rows, setRows] = useState<SubjectRow[]>([])
  const [hasReal, setHasReal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.email) return
    getDocs(query(
      collection(db, 'sessions'),
      where('studentEmail', '==', user.email),
      orderBy('scheduledAt', 'desc'),
    )).then(snap => {
      const map = new Map<string, { count: number; tutorName: string; hasUpcoming: boolean }>()
      snap.docs.forEach(d => {
        const data = d.data()
        const key = data.subject as string
        if (!map.has(key)) {
          map.set(key, { count: 1, tutorName: data.tutorName ?? '', hasUpcoming: data.status === 'scheduled' })
        } else {
          const c = map.get(key)!
          c.count++
          if (data.status === 'scheduled') c.hasUpcoming = true
        }
      })

      if (map.size > 0) {
        setHasReal(true)
        setRows(Array.from(map.entries()).slice(0, 3).map(([subject, info]) => {
          const meta = SUBJECT_META[subject] ?? { icon: '📚', bg: 'linear-gradient(135deg, var(--forest), var(--g))' }
          return {
            icon: meta.icon,
            bg: meta.bg,
            name: subject,
            sub: `with ${info.tutorName || 'your tutor'} · ${info.count} session${info.count !== 1 ? 's' : ''}`,
            badge: info.hasUpcoming ? 'Upcoming' : 'Completed',
            badgeType: info.hasUpcoming ? 'new' : 'soon',
          }
        }))
      } else {
        setRows(SUGGESTIONS)
      }
      setLoading(false)
    }).catch(() => { setRows(SUGGESTIONS); setLoading(false) })
  }, [user])

  return (
    <div className={s.card}>
      <p className={s.label}>{hasReal ? 'My Classes' : 'Explore Classes'}</p>
      {loading ? (
        <div className={s.empty}><span style={{ color: 'var(--bd)' }}>Loading…</span></div>
      ) : (
        <>
          <div className={s.classRowList}>
            {rows.map((c, i) => (
              <div key={i} className={s.classRow}>
                <div className={s.classRowIcon} style={{ background: c.bg }}>
                  <span>{c.icon}</span>
                </div>
                <div className={s.classRowBody}>
                  <div className={s.classRowName}>{c.name}</div>
                  <div className={s.classRowSub}>{c.sub}</div>
                </div>
                <span className={`${s.badge} ${s[`badge_${c.badgeType}`]}`}>{c.badge}</span>
              </div>
            ))}
          </div>
          <div className={s.divider} />
          <button className={s.btnOutline} style={{ fontSize: 12 }} onClick={() => navigate('/book')}>
            {hasReal ? 'Book another session →' : 'See all classes →'}
          </button>
        </>
      )}
    </div>
  )
}
