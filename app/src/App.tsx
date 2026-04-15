/**
 * App.tsx
 *
 * Root of the React app. Handles:
 *   - Auth state listening (Firebase onAuthStateChanged)
 *   - Route protection via AuthGuard
 *   - Role-based redirect at "/" — tutors/admins go to /tutor, students to /dashboard
 *
 * Adding a new page:
 *   1. Create the component in pages/
 *   2. Import it here
 *   3. Add a <Route> entry — wrap in <AuthGuard> if login is required
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import Login         from './pages/Login'
import Dashboard     from './pages/Dashboard'
import TutorDashboard from './pages/TutorDashboard'
import SessionDetail from './pages/SessionDetail'
import Book          from './pages/Book'
import Admin         from './pages/Admin'
import Chat          from './pages/Chat'
import StudyTimer        from './pages/StudyTimer'
import StudentSessions   from './pages/StudentSessions'
import KnowledgeGraph  from './pages/KnowledgeGraph'
import GlobalJarvis    from './components/GlobalJarvis'

export const UserContext = createContext<User | null>(null)
export const useUser = () => useContext(UserContext)!

/** Reads the user's Firestore role and redirects to the correct dashboard. */
function RoleRedirect() {
  const user = useUser()
  const [dest, setDest] = useState<string | null>(null)

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid))
      .then(snap => {
        const role = snap.data()?.role
        setDest(role === 'tutor' || role === 'admin' ? '/tutor' : '/dashboard')
      })
      .catch(() => setDest('/dashboard'))
  }, [user])

  if (!dest) return null
  return <Navigate to={dest} replace />
}

/** Blocks unauthenticated access. Redirects to /login if not signed in. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  if (user === undefined) return null // still loading auth state
  if (!user) return <Navigate to="/login" replace />
  return (
    <UserContext.Provider value={user}>
      {children}
      <GlobalJarvis />
    </UserContext.Provider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/book"  element={<Book />} />

        {/* Authenticated routes */}
        <Route path="/dashboard"           element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/tutor"               element={<AuthGuard><TutorDashboard /></AuthGuard>} />
        <Route path="/tutor/session/:id"   element={<AuthGuard><SessionDetail /></AuthGuard>} />
        <Route path="/admin"               element={<AuthGuard><Admin /></AuthGuard>} />
        <Route path="/chat/:partnerId"     element={<AuthGuard><Chat /></AuthGuard>} />
        <Route path="/study-timer"         element={<AuthGuard><StudyTimer /></AuthGuard>} />
        <Route path="/sessions"            element={<AuthGuard><StudentSessions /></AuthGuard>} />
        <Route path="/knowledge-graph"     element={<AuthGuard><KnowledgeGraph /></AuthGuard>} />
        <Route path="/knowledge-graph/:concept" element={<AuthGuard><KnowledgeGraph /></AuthGuard>} />

        {/* Root: redirect based on role */}
        <Route path="/" element={<AuthGuard><RoleRedirect /></AuthGuard>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
