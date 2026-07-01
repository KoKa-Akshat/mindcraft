import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import s from './Book.module.css'

interface Tutor {
  id: string
  displayName: string
  bio: string
  subjects: string[]
  calendlyUrl: string
  sessionsCompleted: number
  avatarColor: string
  available: boolean
}

const DEFAULT_TUTOR_BIO = 'Calm, step-by-step math support for students who want a clearer plan, stronger habits, and less panic before exams.'

const DEMO_TUTORS: Tutor[] = [
  {
    id: 'akshat-koirala',
    displayName: 'Akshat Koirala',
    bio: DEFAULT_TUTOR_BIO,
    subjects: ['ACT Math', 'AP Calculus', 'Pre-Calc', 'Statistics'],
    calendlyUrl: 'https://calendly.com/joinmindcraft/30min',
    sessionsCompleted: 40,
    avatarColor: 'linear-gradient(135deg, #2D5016, #58CC02)',
    available: true,
  },
  {
    id: 'abhigya-koirala',
    displayName: 'Abhigya Koirala',
    bio: 'Applied math depth for students who want rigorous, calm support. Booking opens soon.',
    subjects: ['Applied Math', 'Calculus', 'Proofs', 'Advanced Problem Solving'],
    calendlyUrl: '',
    sessionsCompleted: 0,
    avatarColor: 'linear-gradient(135deg, #4b001d, #e4bf6a)',
    available: false,
  },
]

function loadCalendly(url: string) {
  if (!document.getElementById('calendly-css')) {
    const link = document.createElement('link')
    link.id   = 'calendly-css'
    link.rel  = 'stylesheet'
    link.href = 'https://assets.calendly.com/assets/external/widget.css'
    document.head.appendChild(link)
  }
  if ((window as any).Calendly) {
    ;(window as any).Calendly.initPopupWidget({ url })
  } else {
    const script = document.createElement('script')
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.onload = () => (window as any).Calendly.initPopupWidget({ url })
    document.head.appendChild(script)
  }
}

export default function Book() {
  const [tutors, setTutors] = useState<Tutor[]>(DEMO_TUTORS)

  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'tutor')))
      .then(snap => {
        if (snap.empty) return
        const remoteTutors = snap.docs.map(d => {
          const data = d.data()
          // Derive Calendly URL from stored calendlyUrl, or from email slug
          const email: string = data.calendlyEmail ?? data.email ?? ''
          const slug = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase()
          const calendlyUrl = data.calendlyUrl || (slug ? `https://calendly.com/${slug}` : '')
          return {
            id: d.id,
            displayName: data.displayName ?? 'Tutor',
            bio: data.bio || DEFAULT_TUTOR_BIO,
            subjects: data.subjects ?? [],
            calendlyUrl,
            sessionsCompleted: data.sessionsCompleted ?? 0,
            avatarColor: data.avatarColor ?? 'linear-gradient(135deg, #2D5016, #58CC02)',
            available: data.available ?? true,
          }
        })
        const demoIds = new Set(DEMO_TUTORS.map(t => t.id))
        setTutors([...DEMO_TUTORS, ...remoteTutors.filter(t => !demoIds.has(t.id))])
      })
      .catch(() => {})
  }, [])

  return (
    <div className={s.page}>

      <nav className={s.nav}>
        <Link to="/" className={s.logo}>Mind<span>Craft</span></Link>
      </nav>

      <div className={s.hero}>
        <div className={s.heroInner}>
            <div className={s.heroPill}>Private tutoring studio</div>
            <h1 className={s.heroH1}>Find your tutor.<br />Book in 60 seconds.</h1>
          <p className={s.heroSub}>
            Choose a calm expert, pick a time, and start building a better math plan.
          </p>
        </div>
      </div>

      <div className={s.taglineWrap}>
        <div className={s.taglineCard}>
          <div className={s.taglineTitle}>The right tutor changes everything.</div>
          <div className={s.taglineSub}>Every session connects homework help, concept gaps, and what to practice next.</div>
        </div>
      </div>

      <div className={s.section}>
        <h2 className={s.sectionTitle}>Available Tutors</h2>
        <div className={s.tutorGrid}>
          {tutors.map(tutor => (
            <div key={tutor.id} className={s.tutorCard}>
              <div className={s.tutorHeader}>
                <div className={s.avatar} style={{ background: tutor.avatarColor }}>
                  {tutor.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className={s.tutorName}>{tutor.displayName}</div>
                  <div className={s.tutorStat}>{tutor.available ? `${tutor.sessionsCompleted}+ sessions` : 'Unavailable right now'}</div>
                </div>
              </div>
              <p className={s.tutorBio}>{tutor.bio}</p>
              <div className={s.subjects}>
                {tutor.subjects.map(sub => (
                  <span key={sub} className={s.subjectTag}>{sub}</span>
                ))}
              </div>
              <button
                className={`${s.bookBtn} ${!tutor.available ? s.bookBtnDisabled : ''}`}
                disabled={!tutor.available}
                onClick={() => tutor.available && loadCalendly(tutor.calendlyUrl)}
              >
                {tutor.available ? 'Book Free Session →' : 'Booking Opens Soon'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={s.footer}>
        Already have an account?{' '}
        <Link to="/login">Sign in to your dashboard →</Link>
      </div>

    </div>
  )
}
