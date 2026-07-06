/**
 * App.tsx
 *
 * Root of the React app. Handles:
 *   - Auth state listening (Firebase onAuthStateChanged)
 *   - Route protection via AuthGuard
 *   - Public routes; landing site is mindcraft-marketing-site.web.app
 *
 * Adding a new page:
 *   1. Create the component in pages/
 *   2. Import it here
 *   3. Add a <Route> entry — wrap in <AuthGuard> if login is required
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import OrganizeNotes   from './pages/OrganizeNotes'
import Practice        from './pages/Practice'
import ConceptChapterPage from './pages/ConceptChapterPage'
import GradeOnboard    from './pages/GradeOnboard'
import ConstellationCard from './components/ConstellationCard'
import Prep            from './pages/Prep'
import Diagnostic      from './pages/Diagnostic'
import ConstellationGpsLab from './pages/ConstellationGpsLab'
import ParentDashboard    from './pages/ParentDashboard'
import QAToolbar       from './components/QAToolbar'
import { MARKETING_BASE } from './lib/siteUrls'
import { fetchKnowledgeGraph } from './lib/graphCache'


export const UserContext = createContext<User | null>(null)
export const useUser = () => useContext(UserContext)!

// Wake the ML Cloud Run service the moment auth resolves, so the first graph
// fetch (PracticeHubPanel on the dashboard, or the Knowledge Graph page)
// hits a warm instance instead of eating a 30–60s cold start (min-instances 0).
// Fire-and-forget, once per page session.
const ML_API_URL =
  import.meta.env.VITE_ML_API_URL ?? import.meta.env.VITE_ML_URL ?? ''
let mlWarmed = false
function warmML() {
  if (mlWarmed || !ML_API_URL) return
  mlWarmed = true
  fetch(`${ML_API_URL}/health`).catch(() => {})
}

/** Constellation-style knowledge graph for the current user. */
function ConstellationPage() {
  const user = useUser()
  return <ConstellationCard userId={user.uid} />
}

/** Reads the user's Firestore role and redirects to the correct dashboard. */
function RoleRedirect() {
  const user = useUser()
  const [dest, setDest] = useState<string | null>(null)

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid))
      .then(snap => {
        const role = snap.data()?.role
        setDest(
          role === 'tutor' || role === 'admin' ? '/tutor'
          : role === 'parent' ? '/parent'
          : '/dashboard',
        )
      })
      .catch(() => setDest('/dashboard'))
  }, [user])

  if (!dest) return null
  return <Navigate to={dest} replace />
}

/** Sets QA mode and redirects to /dashboard — entry point for the test harness. */
function QAEntry() {
  sessionStorage.setItem('mc-qa-mode', '1') // must be sync — Navigate fires before any useEffect
  return <Navigate to="/dashboard" replace />
}

/** Blocks unauthenticated access. Redirects to /login if not signed in. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const isQA = sessionStorage.getItem('mc-qa-mode') === '1'

  useEffect(() => {
    if (new URLSearchParams(location.search).get('qa') === '1') {
      sessionStorage.setItem('mc-qa-mode', '1')
    }
  }, [location.search])

  useEffect(() => onAuthStateChanged(auth, setUser), [])
  useEffect(() => {
    if (!user) return
    warmML()
    // Only students have a personal KG; tutors/parents read other uids on their dashboards.
    getDoc(doc(db, 'users', user.uid))
      .then(snap => {
        const role = snap.data()?.role
        if (!role || role === 'student') void fetchKnowledgeGraph(user.uid)
      })
      .catch(() => { void fetchKnowledgeGraph(user.uid) })
  }, [user])
  if (user === undefined) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'flex-end',
        padding: '28px 32px', gap: '10px',
      }}>
        <div style={{
          width: 22, height: 22,
          border: '2px solid rgba(255,255,255,0.12)',
          borderTopColor: 'rgba(255,255,255,0.7)',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return (
    <UserContext.Provider value={user}>
      {children}
      {isQA && <QAToolbar />}
    </UserContext.Provider>
  )
}

/** App root sends visitors to the marketing landing site. */
function MarketingRedirect() {
  useEffect(() => {
    window.location.replace(MARKETING_BASE)
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/book"  element={<Book />} />
        <Route path="/qa"    element={<AuthGuard><QAEntry /></AuthGuard>} />
        <Route path="/dashboard-projected" element={<Navigate to="/dashboard" replace />} />

        {/* Authenticated routes */}
        <Route path="/dashboard"           element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/parent"              element={<AuthGuard><ParentDashboard /></AuthGuard>} />
        <Route path="/tutor"               element={<AuthGuard><TutorDashboard /></AuthGuard>} />
        <Route path="/tutor/session/:id"   element={<AuthGuard><SessionDetail /></AuthGuard>} />
        <Route path="/admin"               element={<AuthGuard><Admin /></AuthGuard>} />
        <Route path="/chat/:partnerId"     element={<AuthGuard><Chat /></AuthGuard>} />
        <Route path="/study-timer"         element={<AuthGuard><StudyTimer /></AuthGuard>} />
        <Route path="/sessions"            element={<AuthGuard><StudentSessions /></AuthGuard>} />
        <Route path="/diagnostic"          element={<AuthGuard><Diagnostic /></AuthGuard>} />
        <Route path="/onboard"             element={<AuthGuard><GradeOnboard /></AuthGuard>} />
        <Route path="/knowledge-graph"     element={<AuthGuard><KnowledgeGraph /></AuthGuard>} />
        <Route path="/knowledge-graph/:concept" element={<AuthGuard><KnowledgeGraph /></AuthGuard>} />
        <Route path="/constellation-gps-lab" element={<AuthGuard><ConstellationGpsLab /></AuthGuard>} />
        <Route path="/learning-gps"        element={<Navigate to="/dashboard?view=gps" replace />} />
        <Route path="/constellation"       element={<AuthGuard><ConstellationPage /></AuthGuard>} />
        <Route path="/organize-notes"          element={<AuthGuard><OrganizeNotes /></AuthGuard>} />
        <Route path="/practice"                element={<AuthGuard><Practice /></AuthGuard>} />
        <Route path="/concept/:conceptId"      element={<AuthGuard><ConceptChapterPage /></AuthGuard>} />
        <Route path="/prep"                    element={<Prep />} />

        {/* Root of app host → marketing site (landing lives on mindcraft-marketing-site.web.app) */}
        <Route path="/" element={<MarketingRedirect />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
