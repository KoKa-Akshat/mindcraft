/**
 * JoinClassroom.tsx — student enters a tutor's classroom join code.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import { WEBHOOK_BASE } from '../lib/mlApi'
import Sidebar from '../components/Sidebar'
import s from './JoinClassroom.module.css'

export default function JoinClassroom() {
  const user = useUser()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState<{ tutorName: string } | null>(null)

  useEffect(() => {
    void (async () => {
      const snap = await getDoc(doc(db, 'users', user.uid))
      const data = snap.data()
      const role = data?.role
      if (role === 'tutor' || role === 'admin') {
        navigate('/tutor', { replace: true })
        return
      }
      if (data?.classroomId && data?.tutorId) {
        const tutorSnap = await getDoc(doc(db, 'users', data.tutorId))
        const tutorName = tutorSnap.data()?.displayName ?? tutorSnap.data()?.email ?? 'your tutor'
        setJoined({ tutorName })
      }
      setLoading(false)
    })()
  }, [user.uid, navigate])

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setJoining(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const res = await fetch(`${WEBHOOK_BASE}/api/join-classroom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not join classroom')
        return
      }
      setJoined({ tutorName: data.tutorName ?? 'your tutor' })
      setCode('')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className={s.shell}>
        <Sidebar />
        <div className={s.spinner} />
      </div>
    )
  }

  return (
    <div className={s.shell}>
      <Sidebar />
      <main className={s.page}>
        <h1 className={s.title}>Join your tutor&apos;s classroom</h1>
        <p className={s.sub}>
          Enter the 6-character code your tutor shared. You only need to do this once.
        </p>

        {joined ? (
          <div className={`${s.card} ${s.success}`}>
            <div className={s.successIcon}>✓</div>
            <h2 className={s.successTitle}>You&apos;re connected</h2>
            <p className={s.successSub}>
              You&apos;re in {joined.tutorName}&apos;s classroom.
            </p>
            <Link to="/dashboard" className={s.backLink}>Back to dashboard →</Link>
          </div>
        ) : (
          <div className={s.card}>
            <input
              className={s.input}
              placeholder="ABC123"
              value={code}
              maxLength={8}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            {error && <p className={s.error}>{error}</p>}
            <button
              className={s.btn}
              type="button"
              onClick={handleJoin}
              disabled={joining || !code.trim()}
            >
              {joining ? 'Joining…' : 'Join classroom'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
