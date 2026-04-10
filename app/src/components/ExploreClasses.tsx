import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { useUser } from '../App'
import s from './ExploreClasses.module.css'

interface ClassCard {
  icon:      string
  bg:        string
  name:      string
  sub:       string
  badge:     string
  badgeType: 'new' | 'free' | 'soon'
}

const SUGGESTIONS: ClassCard[] = [
  { icon: '📐', bg: 'linear-gradient(135deg, #2D5016, #58CC02)', name: 'Mathematics',       sub: 'Algebra · Calculus · Stats',   badge: 'Book', badgeType: 'new'  },
  { icon: '⚛️', bg: 'linear-gradient(135deg, #1A2A6C, #4A7BF7)', name: 'Sciences',          sub: 'Physics · Chemistry · Bio',    badge: 'Book', badgeType: 'free' },
  { icon: '💹', bg: 'linear-gradient(135deg, #1A3C2A, #00B09B)', name: 'Accounting',        sub: 'Finance · Tax · Bookkeeping',  badge: 'Book', badgeType: 'new'  },
  { icon: '🎹', bg: 'linear-gradient(135deg, #2C1654, #8E44AD)', name: 'Piano',             sub: 'Beginner to Advanced',         badge: 'Book', badgeType: 'free' },
  { icon: '🚀', bg: 'linear-gradient(135deg, #7B0000, #E74C3C)', name: 'Entrepreneurship',  sub: 'Startups · Strategy · Pitch',  badge: 'Book', badgeType: 'soon' },
  { icon: '📊', bg: 'linear-gradient(135deg, #0D3349, #2471A3)', name: 'Data Science',      sub: 'Python · ML · Analytics',     badge: 'Book', badgeType: 'new'  },
  { icon: '📖', bg: 'linear-gradient(135deg, #7B4F00, #F59E0B)', name: 'English',           sub: 'Writing · Literature · SAT',  badge: 'Book', badgeType: 'soon' },
  { icon: '📜', bg: 'linear-gradient(135deg, #4A1A6C, #9B59B6)', name: 'History',           sub: 'AP · World · US History',     badge: 'Book', badgeType: 'soon' },
]

const SUBJECT_META: Record<string, Pick<ClassCard, 'icon' | 'bg'>> = {
  'Math':              { icon: '📐', bg: 'linear-gradient(135deg, #2D5016, #58CC02)' },
  'AP Calculus':       { icon: '📐', bg: 'linear-gradient(135deg, #2D5016, #58CC02)' },
  'Pre-Calculus':      { icon: '📐', bg: 'linear-gradient(135deg, #2D5016, #58CC02)' },
  'Algebra':           { icon: '📐', bg: 'linear-gradient(135deg, #2D5016, #58CC02)' },
  'Statistics':        { icon: '📊', bg: 'linear-gradient(135deg, #0D3349, #2471A3)' },
  'Physics':           { icon: '⚛️', bg: 'linear-gradient(135deg, #1A2A6C, #4A7BF7)' },
  'AP Physics':        { icon: '⚛️', bg: 'linear-gradient(135deg, #1A2A6C, #4A7BF7)' },
  'Chemistry':         { icon: '🧪', bg: 'linear-gradient(135deg, #7B1A1A, #E74C3C)' },
  'Biology':           { icon: '🧬', bg: 'linear-gradient(135deg, #1A5C2A, #27AE60)' },
  'English':           { icon: '📖', bg: 'linear-gradient(135deg, #7B4F00, #F59E0B)' },
  'History':           { icon: '📜', bg: 'linear-gradient(135deg, #4A1A6C, #9B59B6)' },
  'Accounting':        { icon: '💹', bg: 'linear-gradient(135deg, #1A3C2A, #00B09B)' },
  'Piano':             { icon: '🎹', bg: 'linear-gradient(135deg, #2C1654, #8E44AD)' },
  'Entrepreneurship':  { icon: '🚀', bg: 'linear-gradient(135deg, #7B0000, #E74C3C)' },
  'Data Science':      { icon: '📊', bg: 'linear-gradient(135deg, #0D3349, #2471A3)' },
  'SAT Prep':          { icon: '✏️', bg: 'linear-gradient(135deg, #4A3000, #F39C12)' },
  'Tutoring Session':  { icon: '📚', bg: 'linear-gradient(135deg, #2D5016, #58CC02)' },
}

export default function ExploreClasses() {
  const user     = useUser()
  const navigate = useNavigate()
  const [cards, setCards]   = useState<ClassCard[]>([])
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
        const key  = data.subject as string
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
        setCards(Array.from(map.entries()).map(([subject, info]) => {
          const meta = SUBJECT_META[subject] ?? { icon: '📚', bg: 'linear-gradient(135deg, var(--forest), var(--g))' }
          return {
            icon:      meta.icon,
            bg:        meta.bg,
            name:      subject,
            sub:       `with ${info.tutorName || 'your tutor'} · ${info.count} session${info.count !== 1 ? 's' : ''}`,
            badge:     info.hasUpcoming ? 'Upcoming' : 'Completed',
            badgeType: (info.hasUpcoming ? 'new' : 'soon') as ClassCard['badgeType'],
          }
        }))
      } else {
        setCards(SUGGESTIONS)
      }
      setLoading(false)
    }).catch(() => { setCards(SUGGESTIONS); setLoading(false) })
  }, [user])

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <span className={s.label}>{hasReal ? 'My Classes' : 'Explore Classes'}</span>
        <button className={s.seeAll} onClick={() => navigate('/book')}>
          {hasReal ? 'Book another →' : 'See all →'}
        </button>
      </div>

      {loading ? (
        <div className={s.scrollRow}>
          {[1,2,3].map(i => <div key={i} className={`${s.card} ${s.skeleton}`} />)}
        </div>
      ) : (
        <div className={s.scrollRow}>
          {cards.map((c, i) => (
            <div key={i} className={s.card} onClick={() => navigate('/book')}>
              <div className={s.iconBox} style={{ background: c.bg }}>
                <span className={s.icon}>{c.icon}</span>
              </div>
              <div className={s.name}>{c.name}</div>
              <div className={s.sub}>{c.sub}</div>
              <span className={`${s.badge} ${s[`badge_${c.badgeType}`]}`}>{c.badge}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
