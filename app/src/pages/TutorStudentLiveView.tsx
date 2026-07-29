/**
 * Live read-only view of a student's dash signals for tutors.
 * Admin wires tutor-student links; this page just loads live ML + briefing.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import TutorBriefingPanel from '../components/TutorBriefingPanel'
import StudentIntelPanel from '../components/StudentIntelPanel'
import s from './TutorDashboard.module.css'

export default function TutorStudentLiveView() {
  const { studentId = '' } = useParams()
  const user = useUser()
  const navigate = useNavigate()
  const [name, setName] = useState('Student')
  const [examTrack, setExamTrack] = useState('ACT')
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const tutorSnap = await getDoc(doc(db, 'users', user.uid))
      const role = tutorSnap.data()?.role
      if (role !== 'tutor' && role !== 'admin') {
        navigate('/dashboard', { replace: true })
        return
      }
      if (!studentId) return
      const snap = await getDoc(doc(db, 'users', studentId))
      if (cancelled) return
      if (!snap.exists()) {
        navigate('/tutor', { replace: true })
        return
      }
      const d = snap.data()
      setName(d.displayName || d.email?.split('@')[0] || 'Student')
      setExamTrack(d.examTrack || d.exam || d.diagnosticExam || 'ACT')
      setAllowed(true)
    })()
    return () => { cancelled = true }
  }, [user.uid, studentId, navigate])

  if (!allowed) {
    return (
      <div className={s.shell}>
        <div className={s.loading}><div className={s.spinner} /></div>
      </div>
    )
  }

  return (
    <div className={s.shell}>
      <header className={s.topBar}>
        <div className={s.topLeft}>
          <Link to="/tutor" className={s.logo}>Mind<span>Craft</span></Link>
          <span className={s.topLabel}>Live student view</span>
        </div>
        <div className={s.topRight}>
          <button type="button" className={s.signOutBtn} onClick={() => navigate('/tutor')}>
            Back to tutor
          </button>
        </div>
      </header>

      <main className={s.livePage}>
        <div className={s.liveBanner}>
          Viewing <strong>{name}</strong> live. Same briefing and intel the student dash draws from.
        </div>
        <div className={s.grid}>
          <div className={s.col}>
            <TutorBriefingPanel studentId={studentId} studentName={name} examTrack={examTrack} />
          </div>
          <div className={s.col}>
            <div className={s.card}>
              <div className={s.cardHeader}>
                <span className={s.cardLabel}>Intelligence</span>
              </div>
              <StudentIntelPanel studentId={studentId} studentName={name} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
