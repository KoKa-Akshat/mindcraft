import { useState } from 'react'
import { auth, db } from '../firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

export default function Seed() {
  const [status, setStatus] = useState('')

  async function run() {
    const user = auth.currentUser
    if (!user) { setStatus('Not logged in — go to /login first'); return }

    setStatus('Seeding...')
    try {
      const { uid } = user

      const past = new Date()
      past.setDate(past.getDate() - 3)
      past.setHours(16, 0, 0, 0)

      const future = new Date()
      future.setDate(future.getDate() + 2)
      future.setHours(15, 30, 0, 0)

      await setDoc(doc(db, 'users', uid), {
        uid,
        email: user.email,
        displayName: user.displayName?.split(' ')[0] || user.email?.split('@')[0]?.split('.')[0] || 'there',
        role: 'student',
        streak: 5,
        practiceCount: 14,
        lastActive: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastSession: {
          id: 'seed_session_1',
          subject: 'AP Calculus',
          title: 'Integration by Parts & U-Substitution',
          date: past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          duration: '60 min',
          tutorName: 'Ms. Patel',
          scheduledAt: past.getTime(),
          bullets: [
            'Mastered u-substitution for polynomial integrals',
            'Practiced integration by parts with trig functions',
            'Reviewed chain rule applications in reverse',
            'Completed 12 practice problems with 92% accuracy',
          ],
        },
        nextSession: {
          subject: 'AP Calculus',
          time: future.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          tutor: 'Ms. Patel',
        },
        messages: [
          {
            initial: 'MP',
            isTutor: true,
            name: 'Ms. Patel',
            time: '2h ago',
            text: 'Great work today! Review the u-substitution problems before Thursday.',
            unread: true,
          },
          {
            initial: (user.displayName?.[0] || user.email?.[0] || 'A').toUpperCase(),
            isTutor: false,
            name: 'You',
            time: 'Yesterday',
            text: 'Thanks! Will do. Can we also go over the chain rule next session?',
            unread: false,
          },
        ],
      }, { merge: true })

      setStatus('✅ Done! Go to /dashboard')
    } catch (e: any) {
      setStatus('Error: ' + e.message)
    }
  }

  return (
    <div style={{ fontFamily: 'Nunito, sans-serif', maxWidth: 480, margin: '80px auto', padding: '0 24px' }}>
      <h2 style={{ fontWeight: 900, marginBottom: 8 }}>Seed Firestore</h2>
      <p style={{ color: '#8A8F98', fontSize: 14, marginBottom: 24 }}>
        Populates your account with a completed session, upcoming session, streak, practice count, and messages.
        Make sure you're logged in first.
      </p>
      <button
        onClick={run}
        style={{
          background: '#58CC02', color: '#fff', border: 'none',
          borderRadius: 12, padding: '12px 28px',
          fontFamily: 'Nunito, sans-serif', fontSize: 15, fontWeight: 900,
          cursor: 'pointer', display: 'block', marginBottom: 16,
        }}
      >
        Seed my account
      </button>
      {status && (
        <p style={{ fontSize: 14, fontWeight: 700, color: status.startsWith('✅') ? '#3A8500' : '#D00' }}>
          {status}
        </p>
      )}
    </div>
  )
}
