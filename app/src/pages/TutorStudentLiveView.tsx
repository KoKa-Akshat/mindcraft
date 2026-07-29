/**
 * Tutor Admin → full live student dashboard (same UI the student sees).
 * Practice writes stay on the student account; tutor can browse live Home/Map/Work/Notes.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import Dashboard from './Dashboard'

export default function TutorStudentLiveView() {
  const { studentId = '' } = useParams()
  const user = useUser()
  const navigate = useNavigate()
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
      if (!studentId) {
        navigate('/tutor', { replace: true })
        return
      }
      const snap = await getDoc(doc(db, 'users', studentId))
      if (cancelled) return
      if (!snap.exists()) {
        navigate('/tutor', { replace: true })
        return
      }
      setAllowed(true)
    })()
    return () => { cancelled = true }
  }, [user.uid, studentId, navigate])

  if (!allowed || !studentId) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '3px solid rgba(20,58,46,.15)',
          borderTopColor: '#143a2e',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return <Dashboard viewAsStudentId={studentId} />
}
