import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'

// Placeholder — the full React dashboard comes next
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      if (!u) navigate('/login', { replace: true })
      else setUser(u)
    })
  }, [navigate])

  const name = user?.displayName || user?.email || '...'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'Nunito, sans-serif', background: '#F5F6F8'
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A3C2A', marginBottom: 8 }}>
          You're in, {name}
        </h1>
        <p style={{ color: '#777', marginBottom: 32, lineHeight: 1.6 }}>
          Firebase Auth is working. The full dashboard is next.
        </p>
        <button
          onClick={() => signOut(auth).then(() => navigate('/login', { replace: true }))}
          style={{
            padding: '12px 28px', background: '#58CC02', color: '#fff',
            border: 'none', borderRadius: 12, fontFamily: 'Nunito', fontWeight: 800,
            cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 0 #4CAD00',
            letterSpacing: '.3px', textTransform: 'uppercase'
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
