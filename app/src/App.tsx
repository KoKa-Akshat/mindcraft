/**
 * App.tsx
 *
 * Root of the React app. Handles:
 *   - Auth state listening (Firebase onAuthStateChanged)
 *   - Route protection via AuthGuard
 *   - Public routes; landing site is joinmindcraft.com
 *
 * Adding a new page:
 *   1. Create the component in pages/
 *   2. Import it here
 *   3. Add a <Route> entry — wrap in <AuthGuard> if login is required
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { createContext, useContext, useEffect, useState, lazy, Suspense } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import Login         from './pages/Login'
import Dashboard     from './pages/Dashboard'
import TutorDashboard from './pages/TutorDashboard'
import TutorStudentLiveView from './pages/TutorStudentLiveView'
import SessionDetail from './pages/SessionDetail'
import FindTutor      from './pages/FindTutor'
import Admin         from './pages/Admin'
import Chat          from './pages/Chat'
import StudyTimer        from './pages/StudyTimer'
import StudentSessions   from './pages/StudentSessions'
import KnowledgeGraph  from './pages/KnowledgeGraph'
import OrganizeNotes   from './pages/OrganizeNotes'
import Practice        from './pages/Practice'
import ConceptChapterPage from './pages/ConceptChapterPage'
import FirstSpark      from './pages/FirstSpark'
import DevColdCheckPreview from './pages/DevColdCheckPreview' // THROWAWAY — remove with its route below
import DevJarvisPreview from './pages/DevJarvisPreview' // THROWAWAY — remove with its route below
import DevUnifiedLearn from './pages/DevUnifiedLearn' // THROWAWAY — remove with its route below
// Production promotion of the DevUnifiedLearn prototype, wired to the real
// migrated content library, real auth, and the real generation endpoints.
import Learn           from './pages/Learn'
import ConstellationCard from './components/ConstellationCard'
import Prep            from './pages/Prep'
import Diagnostic      from './pages/Diagnostic'
import { enableDemoMode, makeDemoUser } from './lib/demoMode'
import ConstellationGpsLab from './pages/ConstellationGpsLab'
import ParentDashboard    from './pages/ParentDashboard'
import SessionWork        from './pages/SessionWork'
import HomeworkSession    from './pages/HomeworkSession'
import WorksheetSession   from './pages/WorksheetSession'
import WeeklyPracticePaperPage from './pages/WeeklyPracticePaperPage'
import LiveSessionPage    from './pages/LiveSessionPage'
import JoinClassroom      from './pages/JoinClassroom'
import QAToolbar       from './components/QAToolbar'
import { MARKETING_BASE } from './lib/siteUrls'
import { fetchKnowledgeGraph } from './lib/graphCache'
import { isTestProfileEmail, resetStudentProfile } from './lib/testProfile'
import { installDeskAskAuthBridge } from './lib/deskAsk'
import { clearAuthHandoff, isAuthHandoffActive } from './lib/postLogin'


// Hidden action-math zone: dynamic import() so its own chunk (a 2D layered
// scene as of the 2026-07-21 pivot, ~44KB — was ~622KB with the earlier
// Three.js engine) never bloats the normal dashboard bundle for the vast
// majority of students who never open the portal. THIS WIRING HAS BEEN LOST
// TO CONCURRENT OVERWRITES ON THIS SHARED CHECKOUT THREE TIMES IN ONE
// SESSION (see ACTIVE_TASK.md / LESSONS.md) — if you are reading this
// comment, it survived; if the route is missing again, restore it exactly
// as shown here and in the two <Route> entries below.
const ManjushreeZone = lazy(() => import('./manjushree/ManjushreeZone'))
const StorySlideshow = lazy(() => import('./pages/StorySlideshow'))

function ZoneLoading() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
      background: '#cdeee0', color: '#17301f', fontFamily: 'Nunito Sans, system-ui, sans-serif',
      fontWeight: 700,
    }}>
      the valley is forming...
    </div>
  )
}

function StoryLoading() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
      background: '#080e14', color: '#f7f3ee', fontFamily: 'DM Sans, system-ui, sans-serif',
      fontWeight: 700,
    }}>
      opening the chapter…
    </div>
  )
}

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
          role === 'admin' ? '/admin'
          : role === 'tutor' ? '/tutor'
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

/** Public ACT Demo dashboard: real UI, sessionStorage only, tab close resets. */
function TryDemoDashboard() {
  enableDemoMode()
  return (
    <UserContext.Provider value={makeDemoUser()}>
      <Dashboard preview />
    </UserContext.Provider>
  )
}

/** Blocks unauthenticated access. Redirects to /login if not signed in. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [, setHandoffTick] = useState(0)
  const isQA = sessionStorage.getItem('mc-qa-mode') === '1'

  useEffect(() => {
    if (new URLSearchParams(location.search).get('qa') === '1') {
      sessionStorage.setItem('mc-qa-mode', '1')
    }
  }, [location.search])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser)
    void auth.authStateReady().then(() => setAuthReady(true))
    // Bridge Firebase auth into web Desk OS Ask (`window.__MC_DESK_AUTH__`).
    installDeskAskAuthBridge()
    return unsub
  }, [])

  // Re-render when the post-login handoff window expires so we don't spin forever.
  useEffect(() => {
    if (!isAuthHandoffActive()) return
    const id = window.setInterval(() => setHandoffTick(t => t + 1), 500)
    return () => window.clearInterval(id)
  }, [authReady, user])
  useEffect(() => {
    if (user) clearAuthHandoff()
    if (!user) return
    // Test profiles start fresh even when Firebase restores a persisted session
    // (reload / reopened tab), where Login's routeAfterLogin never runs. Once
    // per tab session — the login-path reset covers explicit sign-ins.
    if (isTestProfileEmail(user.email) && sessionStorage.getItem('mc-test-reset') !== '1') {
      sessionStorage.setItem('mc-test-reset', '1')
      void resetStudentProfile(user.uid)
    }
    warmML()
    // Only students have a personal KG; tutors/parents read other uids on their dashboards.
    getDoc(doc(db, 'users', user.uid))
      .then(snap => {
        const role = snap.data()?.role
        if (!role || role === 'student') void fetchKnowledgeGraph(user.uid)
      })
      .catch(() => { void fetchKnowledgeGraph(user.uid) })
  }, [user])
  if (!authReady || user === undefined) {
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
    if (isAuthHandoffActive()) {
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

/** Full-page jump into the Desk OS static prototype (Piano + ACT books). */
function DeskOsRedirect() {
  useEffect(() => {
    window.location.replace('/desk-os/?v=r9b')
  }, [])
  return null
}

function DeskStudioRedirect() {
  useEffect(() => {
    window.location.replace('/desk-os/studio/?v=spatial2')
  }, [])
  return null
}

function DeskWorkflowsRedirect() {
  useEffect(() => {
    window.location.replace('/desk-os/workflows/?v=f5')
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/spark" element={<FirstSpark />} />
        <Route path="/dev-cold-check" element={<DevColdCheckPreview />} /> {/* THROWAWAY — remove */}
        <Route path="/dev-jarvis" element={<DevJarvisPreview />} /> {/* THROWAWAY — remove */}
        <Route path="/dev-learn" element={<DevUnifiedLearn />} /> {/* THROWAWAY — remove */}
        {/* Old plain list-only booking page — permanently redirects to the
            richer Find-a-Tutor page (map + proximity search + honest
            no-fake-reviews handling). Keep the redirect, not the old page,
            so existing bookmarks/links to /book still work. */}
        <Route path="/book"  element={<Navigate to="/find-a-tutor" replace />} />
        <Route path="/find-a-tutor" element={<FindTutor />} />
        <Route path="/qa"    element={<AuthGuard><QAEntry /></AuthGuard>} />
        <Route path="/dashboard-projected" element={<Navigate to="/dashboard" replace />} />

        {/* Authenticated routes */}
        <Route path="/dashboard"           element={<AuthGuard><Dashboard /></AuthGuard>} />
        {/* Learn: free-text search over the whole 4118-concept library, guided
            prerequisite paths, auto-simplified chapters, real sims. Also
            reachable in-place as /dashboard?view=learn; this standalone route
            exists so it can be linked and bookmarked directly, with ?q= to
            run a search on arrival. */}
        <Route path="/learn"               element={<AuthGuard><Learn /></AuthGuard>} />
        <Route path="/parent"              element={<AuthGuard><ParentDashboard /></AuthGuard>} />
        <Route path="/tutor"               element={<AuthGuard><TutorDashboard /></AuthGuard>} />
        <Route path="/tutor/session/:id"   element={<AuthGuard><SessionDetail /></AuthGuard>} />
        <Route path="/tutor/student/:studentId" element={<AuthGuard><TutorStudentLiveView /></AuthGuard>} />
        <Route path="/admin"               element={<AuthGuard><Admin /></AuthGuard>} />
        <Route path="/chat/:partnerId"     element={<AuthGuard><Chat /></AuthGuard>} />
        <Route path="/study-timer"         element={<AuthGuard><StudyTimer /></AuthGuard>} />
        <Route path="/sessions"            element={<AuthGuard><StudentSessions /></AuthGuard>} />
        <Route path="/session-work/:sessionId" element={<AuthGuard><SessionWork /></AuthGuard>} />
        <Route path="/homework/:homeworkId"    element={<AuthGuard><HomeworkSession /></AuthGuard>} />
        <Route path="/worksheet"               element={<AuthGuard><WorksheetSession /></AuthGuard>} />
        <Route path="/join-classroom"         element={<AuthGuard><JoinClassroom /></AuthGuard>} />
        <Route path="/diagnostic"          element={<AuthGuard><Diagnostic /></AuthGuard>} />
        {/* Marketing Try Demo: ACT diagnostic → ephemeral dashboard (no login, resets). */}
        <Route path="/try/diagnostic"      element={<Diagnostic preview />} />
        <Route path="/try/dashboard"       element={<TryDemoDashboard />} />
        <Route path="/try/notebook"        element={<Navigate to="/try/dashboard" replace />} />
        {/* GradeOnboard.tsx (the older, heavier "grade + ~10 probe questions"
            flow) is retired from the live gate. Diagnostic.tsx (Jesse's
            Kitchen: goals + time horizon + confidence taps) is now the one
            canonical diagnostic. Route kept as a redirect, not deleted, so no
            stale bookmark/link 404s. See ACTIVE_TASK.md 2026-07-21 entry. */}
        <Route path="/onboard"             element={<Navigate to="/diagnostic" replace />} />
        <Route path="/knowledge-graph"     element={<AuthGuard><KnowledgeGraph /></AuthGuard>} />
        <Route path="/knowledge-graph/:concept" element={<AuthGuard><KnowledgeGraph /></AuthGuard>} />
        <Route path="/constellation-gps-lab" element={<AuthGuard><ConstellationGpsLab /></AuthGuard>} />
        <Route path="/learning-gps"        element={<Navigate to="/dashboard?view=gps" replace />} />
        <Route path="/constellation"       element={<AuthGuard><ConstellationPage /></AuthGuard>} />
        <Route path="/organize-notes"          element={<AuthGuard><OrganizeNotes /></AuthGuard>} />
        <Route path="/practice"                element={<AuthGuard><Practice /></AuthGuard>} />
        <Route path="/weekly-paper"            element={<AuthGuard><WeeklyPracticePaperPage /></AuthGuard>} />
        <Route path="/live-session/:sessionId" element={<AuthGuard><LiveSessionPage /></AuthGuard>} />
        <Route path="/concept/:conceptId"      element={<AuthGuard><ConceptChapterPage /></AuthGuard>} />
        <Route path="/prep"                    element={<Prep />} />

        {/* Sword of Wisdom + story slideshow.
            /manjushree + /story-loop/* stay AuthGuard-wrapped for signed-in students.
            /try/* is the public landing-preview path (no login) — marketing panel
            iframes these, and the kitchen handoff lands here so visitors can try
            one full loop without an account. */}
        <Route path="/manjushree" element={
          <AuthGuard>
            <Suspense fallback={<ZoneLoading />}>
              <ManjushreeZone />
            </Suspense>
          </AuthGuard>
        } />
        <Route path="/try/manjushree" element={
          <Suspense fallback={<ZoneLoading />}>
            <ManjushreeZone preview />
          </Suspense>
        } />
        {import.meta.env.DEV && (
          <Route path="/manjushree-dev" element={
            <Suspense fallback={<ZoneLoading />}>
              <ManjushreeZone preview />
            </Suspense>
          } />
        )}

        <Route path="/story-loop/:conceptId" element={
          <AuthGuard>
            <Suspense fallback={<StoryLoading />}>
              <StorySlideshow />
            </Suspense>
          </AuthGuard>
        } />
        <Route path="/try/story/:conceptId" element={
          <Suspense fallback={<StoryLoading />}>
            <StorySlideshow />
          </Suspense>
        } />
        {import.meta.env.DEV && (
          <Route path="/story-loop-dev/:conceptId" element={
            <Suspense fallback={<StoryLoading />}>
              <StorySlideshow />
            </Suspense>
          } />
        )}

        {/* Desk OS prototype shell (static under /desk-os/, synced at build).
            Short in-app aliases so the live preview is easy to open. */}
        <Route path="/desk" element={<DeskOsRedirect />} />
        <Route path="/try/desk" element={<DeskOsRedirect />} />
        <Route path="/studio" element={<DeskStudioRedirect />} />
        <Route path="/try/studio" element={<DeskStudioRedirect />} />
        <Route path="/workflows" element={<DeskWorkflowsRedirect />} />
        <Route path="/try/workflows" element={<DeskWorkflowsRedirect />} />

        {/* Root of app host → marketing site (landing lives on joinmindcraft.com) */}
        <Route path="/" element={<MarketingRedirect />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
