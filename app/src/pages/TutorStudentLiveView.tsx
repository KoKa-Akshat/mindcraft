/**
 * Full live student dashboard for tutors (Admin).
 * Loaded in an iframe from the tutor dash (?embed=1) so Home/Map/Work/Notes
 * navigate for real inside the frame without leaving /tutor.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import Dashboard from './Dashboard'
import { setTutorViewAsStudentId, TUTOR_EXIT_STUDENT_MSG } from '../lib/tutorViewAs'

export default function TutorStudentLiveView() {
  const { studentId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const frameEmbed = searchParams.get('embed') === '1'
  const user = useUser()
  const navigate = useNavigate()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!frameEmbed) return
    document.documentElement.classList.add('mc-frame-embed')
    document.body.classList.add('mc-frame-embed')
    return () => {
      document.documentElement.classList.remove('mc-frame-embed')
      document.body.classList.remove('mc-frame-embed')
    }
  }, [frameEmbed])

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
      setTutorViewAsStudentId(studentId)
      setAllowed(true)
    })()
    return () => {
      cancelled = true
      if (frameEmbed) setTutorViewAsStudentId(null)
    }
  }, [user.uid, studentId, navigate, frameEmbed])

  function exitToTutor() {
    setTutorViewAsStudentId(null)
    if (frameEmbed && window.parent !== window) {
      window.parent.postMessage({ type: TUTOR_EXIT_STUDENT_MSG }, window.location.origin)
      return
    }
    navigate('/tutor')
  }

  if (!allowed || !studentId) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#efe6fb' }}>
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

  return (
    <Dashboard
      viewAsStudentId={studentId}
      frameEmbed={frameEmbed}
      onExit={exitToTutor}
    />
  )
}
