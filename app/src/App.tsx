import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TutorDashboard from './pages/TutorDashboard'
import Book from './pages/Book'
import Admin from './pages/Admin'
import Seed from './pages/Seed'

export const UserContext = createContext<User | null>(null)
export const useUser = () => useContext(UserContext)!

function RoleRedirect() {
  const user = useUser()
  const [dest, setDest] = useState<string | null>(null)
  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const role = snap.data()?.role
      setDest(role === 'tutor' || role === 'admin' ? '/tutor' : '/dashboard')
    }).catch(() => setDest('/dashboard'))
  }, [user])
  if (!dest) return null
  return <Navigate to={dest} replace />
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  if (user === undefined) return null
  if (!user) return <Navigate to="/login" replace />
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/tutor" element={<AuthGuard><TutorDashboard /></AuthGuard>} />
        <Route path="/book" element={<Book />} />
        <Route path="/admin" element={<AuthGuard><Admin /></AuthGuard>} />
        <Route path="/seed" element={<Seed />} />
        <Route path="/" element={<AuthGuard><RoleRedirect /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
