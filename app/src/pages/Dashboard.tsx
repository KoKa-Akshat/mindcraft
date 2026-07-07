import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { Compass, NotebookPen, Wand2 } from 'lucide-react'
import { auth, db } from '../firebase'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { usePracticePathQueue } from '../lib/practicePathQueue'
import { isDiagnosticComplete, markDiagnosticComplete, persistDiagnosticDoneLocal } from '../lib/practiceState'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import { fetchPracticeHubRecommendations, type NextConcept } from '../lib/recommendNextConcept'
import { pawHubDisplayText, pawHubLearnSub, type CurriculumTrack } from '../lib/curriculumTrack'
import { isTestProfileEmail } from '../lib/testProfile'
import type { Confidence } from '../lib/bridgePractice'
import ConstellationGpsExplorer from '../components/ConstellationGpsExplorer'
import DashboardRoutePanel from '../components/DashboardRoutePanel'
import DashboardNotesPanel from '../components/DashboardNotesPanel'
import BookShell from '../components/book/BookShell'
import BookPage from '../components/book/BookPage'
import CoverNavItem, { CoverNavSection } from '../components/book/CoverNavItem'
import StudyPlanList, { type StudyPlanItem } from '../components/book/StudyPlanList'
import PageFlipTransition from '../components/book/PageFlipTransition'
import book from '../components/book/Book.module.css'
import s from './Dashboard.module.css'

/** Max characters accepted by the inline problem-solver pad. */
const SOLVER_MAX_CHARS = 1200

// Concept discovery cards — supplementary ACT concepts to explore
const EXPLORE_CARDS = [
  {
    id: 'quadratic_equations',
    label: 'Quadratics',
    symbol: 'x²',
    bg: 'linear-gradient(135deg, #1e2a4a 0%, #2f4370 55%, #22304f 100%)',
  },
  {
    id: 'trigonometry_basics',
    label: 'Trig',
    symbol: 'θ',
    bg: 'linear-gradient(135deg, #3d1f24 0%, #6b3540 55%, #452328 100%)',
  },
  {
    id: 'descriptive_statistics',
    label: 'Statistics',
    symbol: 'σ',
    bg: 'linear-gradient(135deg, #402d1a 0%, #6b4a26 55%, #47331d 100%)',
  },
  {
    id: 'linear_equations',
    label: 'Coord. Plane',
    symbol: 'xy',
    bg: 'linear-gradient(135deg, #3b2440 0%, #5c3a63 55%, #402a47 100%)',
  },
  {
    id: 'logarithmic_functions',
    label: 'Logarithms',
    symbol: 'ln',
    bg: 'linear-gradient(135deg, #14383a 0%, #226266 55%, #17403f 100%)',
  },
  {
    id: 'basic_probability',
    label: 'Probability',
    symbol: 'P',
    bg: 'linear-gradient(135deg, #1f3a2a 0%, #356247 55%, #24402f 100%)',
  },
] as const

// Flag color rotates by day of week
const FLAG_COLORS = ['#c96a7e', '#4f8a8b', '#c9963f', '#7d6fa8', '#5d8a5e', '#c96a7e', '#4f8a8b']

function formatDateMain() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function formatDateSub() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
}

function getDateDay() {
  return new Date().getDate()
}

function getFlagColor() {
  return FLAG_COLORS[new Date().getDay()]
}

export default function Dashboard() {
  const user = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const data = useStudentData(user)
  const uid = user?.uid ?? ''
  const path = usePracticePathQueue(uid)

  const [diagChecked, setDiagChecked] = useState(false)
  const [plotConceptId, setPlotConceptId] = useState<string | null>(null)
  const [weakness, setWeakness] = useState<NextConcept | null>(null)
  const [learn, setLearn] = useState<NextConcept | null>(null)
  const [curriculumTrack, setCurriculumTrack] = useState<CurriculumTrack | null>(null)
  const [recLoading, setRecLoading] = useState(true)
  const [solverText, setSolverText] = useState('')
  const [turningConceptId, setTurningConceptId] = useState<string | null>(null)
  const [parentEmail, setParentEmail] = useState('')
  const [parentEmailSaved, setParentEmailSaved] = useState(false)

  const view = searchParams.get('view') ?? 'today'
  const gpsMode = view === 'gps'
  const routeMode = view === 'route'
  const notesMode = view === 'notes'
  const homeworkMode = view === 'homework'
  const todayMode = !gpsMode && !routeMode && !notesMode && !homeworkMode

  const conceptParam = searchParams.get('concept')
  const targetParam = searchParams.get('target')

  function openGps() { navigate('/dashboard?view=gps', { replace: true }) }
  function openRoute(targetId: string) {
    navigate(`/dashboard?view=route&target=${encodeURIComponent(targetId)}`, { replace: true })
  }
  function openNotes() { navigate('/dashboard?view=notes', { replace: true }) }
  function openHomework() { navigate('/dashboard?view=homework', { replace: true }) }
  function closePanel() { navigate('/dashboard', { replace: true }) }

  function goChallenge() {
    if (weakness) {
      navigate('/practice', { state: { conceptId: weakness.conceptId, missionType: 'weakness' } })
    } else {
      navigate('/practice')
    }
  }

  function goExplore() {
    if (learn) {
      navigate('/practice', { state: { conceptId: learn.conceptId, missionType: 'learn' } })
    } else {
      navigate('/practice')
    }
  }

  function openChapter(conceptId: string) {
    if (turningConceptId) return
    setTurningConceptId(conceptId)
    window.setTimeout(() => {
      navigate(`/concept/${encodeURIComponent(conceptId)}`, {
        state: { fromDashboard: true },
      })
    }, 560)
  }

  function launchSolver() {
    const text = solverText.trim().slice(0, SOLVER_MAX_CHARS)
    if (!text) return
    navigate('/practice', { state: { problemText: text } })
  }

  async function handleSignOut() {
    try { await signOut(auth) } catch { /* ignore */ }
    navigate('/login')
  }

  async function saveParentEmail() {
    if (!uid) return
    const clean = parentEmail.trim().toLowerCase()
    await setDoc(doc(db, 'users', uid), { parentEmail: clean || null }, { merge: true })
    setParentEmail(clean)
    setParentEmailSaved(true)
    window.setTimeout(() => setParentEmailSaved(false), 1800)
  }

  useEffect(() => { localStorage.setItem('dashboardView', 'web') }, [])

  useEffect(() => {
    if (!gpsMode) { setPlotConceptId(null); return }
    setPlotConceptId(conceptParam ?? null)
  }, [gpsMode, conceptParam])

  // Fetch recommendations
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    void (async () => {
      setRecLoading(true)
      try {
        const snap = await getDoc(doc(db, 'users', uid))
        if (cancelled) return
        const profile = snap.data()
        const track = profile?.curriculumTrack as CurriculumTrack | undefined
        if (track) setCurriculumTrack(track)
        setParentEmail(typeof profile?.parentEmail === 'string' ? profile.parentEmail : '')
        const rec = await fetchPracticeHubRecommendations(uid, track ?? null)
        if (!cancelled) {
          setWeakness(rec.weakness)
          setLearn(rec.learn)
        }
      } finally {
        if (!cancelled) setRecLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [uid])

  // Diagnostic gate
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const diag = searchParams.get('diag')
      if (diag) {
        try {
          const { exam, confidence, goals, excluded } = JSON.parse(diag) as {
            exam?: string
            confidence: Record<string, Confidence>
            goals?: { tags: string[]; text: string }
            excluded?: string[]
          }
          await applyDiagnosticConfidence(user.uid, exam ?? 'ACT', confidence, goals, {
            excludedConcepts: excluded ?? [],
          })
        } catch { /* fall through */ }
        if (cancelled) return
        navigate('/dashboard', { replace: true })
        setDiagChecked(true)
        persistDiagnosticDoneLocal()
        return
      }

      // Trust a diagnostic that just completed in this same tab — set by finishGapScan
      // to avoid re-gating while the Firestore write is still in flight.
      if (sessionStorage.getItem('mc-diag-just-completed') === '1') {
        sessionStorage.removeItem('mc-diag-just-completed')
        setDiagChecked(true)
        persistDiagnosticDoneLocal()
        return
      }
      const forceFreshDiagnostic = isTestProfileEmail(user.email)
      if (forceFreshDiagnostic) {
        try { localStorage.removeItem('mc-diag-done') } catch { /* ignore */ }
        if (cancelled) return
        navigate('/practice', { state: { examHelp: true } })
        return
      }
      let done = await isDiagnosticComplete(user.uid)
      // Only trust localStorage shortcut if Firestore already has some data for
      // this student — prevents a stale 'mc-diag-done' from bypassing the gap
      // scan on a fresh or reset account.
      if (!forceFreshDiagnostic && !done && localStorage.getItem('mc-diag-done') === '1') {
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const hasPriorData = !!(userSnap.data()?.practiceCount || userSnap.data()?.lastActive)
        if (hasPriorData) {
          await markDiagnosticComplete(user.uid, { exam: 'ACT', confidenceMap: {} })
          done = true
        } else {
          localStorage.removeItem('mc-diag-done')
        }
      }
      if (cancelled) return
      if (!done) navigate('/practice', { state: { examHelp: true } })
      else {
        setDiagChecked(true)
        persistDiagnosticDoneLocal()
      }
    })()
    return () => { cancelled = true }
  }, [user.uid, navigate, searchParams])

  const weaknessLabel = weakness ? pawHubDisplayText(weakness.label, curriculumTrack) : null
  const learnLabel    = learn    ? pawHubDisplayText(learn.label, curriculumTrack)    : null
  const learnSub      = pawHubLearnSub(curriculumTrack)
  const displayName   = data.displayName ?? user?.email?.split('@')[0] ?? ''
  const routeConcepts = path.pathConcepts.slice(0, 7)
  const flagColor     = getFlagColor()

  // Filter explore cards to exclude concepts already in the route
  const routeIds = new Set(path.pathConcepts.map(c => c.id))
  const visibleExploreCards = EXPLORE_CARDS.filter(c => !routeIds.has(c.id))

  // pathConcepts is already the *unmastered* queue — mastered concepts are
  // filtered out upstream and counted in completedOnPath, so rows here are
  // only ever active or upcoming (the progress inkline tells the done story).
  const planItems: StudyPlanItem[] = routeConcepts.map(c => ({
    id: c.id,
    label: pawHubDisplayText(c.label, curriculumTrack),
    state: c.id === path.activeConceptId ? 'active' : 'upcoming',
  }))

  const examLabel = pawHubDisplayText((path.exam || 'ACT').toUpperCase(), curriculumTrack)

  if (!diagChecked) {
    return (
      <div className={book.shell}>
        <div className={book.chrome}>
          <span className={book.wordmark}>MindCraft</span>
        </div>
        <div className={s.loading}><div className={s.spinner} /></div>
      </div>
    )
  }

  return (
    <BookShell
      chromeRight={
        <>
          {displayName && <span className={book.chromeUser}>{displayName}</span>}
          <button className={book.chromeBtn} onClick={() => void handleSignOut()}>sign out</button>
        </>
      }
      left={
        <BookPage side="left" flipping={Boolean(turningConceptId)}>
          {/* mega dateline with pennant flag */}
          <div className={s.dateline}>
            <div className={s.dateFlagWrap}>
              <div className={s.dateFlag} style={{ background: flagColor }}>
                <span className={s.dateFlagNum}>{getDateDay()}</span>
              </div>
            </div>
            <div className={s.dateTextBlock}>
              <div className={s.dateMain}>{formatDateMain()}</div>
              <div className={s.dateSub}>{formatDateSub()}</div>
            </div>
          </div>

          {/* today's plan */}
          <div className={s.todayPlan}>
            {/* The gap */}
            <button
              type="button"
              className={`${s.entryBlock} ${s.gapBlock}`}
              onClick={goChallenge}
            >
              <div className={s.marginFlag} aria-hidden="true" />
              <div className={s.entryLabelDisplay}>The gap</div>
              <div className={`${s.entryConceptName} ${recLoading ? s.entryConceptLoading : ''}`}>
                {weaknessLabel ?? (recLoading ? 'reading your graph…' : 'no gap found')}
              </div>
              <p className={s.entryDraft}>
                {weakness
                  ? 'The margin says this is the one.'
                  : recLoading
                    ? 'Scanning your knowledge graph.'
                    : 'Start your gap scan to find your weakest point.'}
              </p>
              <div className={s.entryCta}>▸ open a session</div>
            </button>

            <div className={s.rulesDivider} />

            {/* New territory */}
            <button
              type="button"
              className={s.entryBlock}
              onClick={goExplore}
            >
              <div className={s.entryLabelDisplay}>New territory</div>
              <div className={`${s.entryConceptName} ${recLoading ? s.entryConceptLoading : ''}`}>
                {learnLabel ?? (recLoading ? 'plotting your route…' : learnSub ?? 'explore your map')}
              </div>
              <p className={s.entryDraft}>
                {learn
                  ? 'Unwritten. First lines are the easiest.'
                  : recLoading
                    ? 'Calculating your next concept.'
                    : 'Pick any concept from your map to start.'}
              </p>
              <div className={s.entryCta}>▸ begin at level 1</div>
            </button>

            {/* contents — primary sections of the book */}
            <CoverNavSection heading="contents">
              <CoverNavItem
                icon={<Wand2 size={19} strokeWidth={1.75} />}
                label="Problem Solver"
                sub="Paste a stuck problem, get a hint path"
                active={homeworkMode}
                onClick={openHomework}
              />
              <CoverNavItem
                icon={<NotebookPen size={19} strokeWidth={1.75} />}
                label="Session Notes"
                sub="Everything your tutor wrote down"
                active={notesMode}
                onClick={openNotes}
              />
              <CoverNavItem
                icon={<Compass size={19} strokeWidth={1.75} />}
                label="The Map"
                sub="Your whole knowledge world, plotted"
                active={gpsMode || routeMode}
                onClick={openGps}
              />
            </CoverNavSection>

            <div className={s.parentEmailBox}>
              <label className={s.parentEmailLabel} htmlFor="parent-email">parent email</label>
              <div className={s.parentEmailRow}>
                <input
                  id="parent-email"
                  className={s.parentEmailInput}
                  type="email"
                  placeholder="parent@email.com"
                  value={parentEmail}
                  onChange={e => setParentEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void saveParentEmail() }}
                />
                <button
                  type="button"
                  className={s.parentEmailBtn}
                  onClick={() => void saveParentEmail()}
                  aria-label="Save parent email"
                >
                  {parentEmailSaved ? 'ok' : 'save'}
                </button>
              </div>
            </div>
          </div>
        </BookPage>
      }
      right={
        <BookPage
          side="right"
          ribbon
          flipping={Boolean(turningConceptId)}
          overlay={
            <div className={s.foreedge}>
              <button className={`${s.tab} ${todayMode ? s.tabActive : ''}`} onClick={closePanel}>Plan</button>
              <button className={`${s.tab} ${s.tabMap} ${(gpsMode || routeMode) ? s.tabActive : ''}`} onClick={openGps}>Map</button>
              <button className={`${s.tab} ${homeworkMode ? s.tabActive : ''}`} onClick={openHomework}>Solver</button>
              <button className={`${s.tab} ${notesMode ? s.tabActive : ''}`} onClick={openNotes}>Notes</button>
            </div>
          }
        >
          <PageFlipTransition viewKey={view}>
            {todayMode ? (
              <>
                <div className={book.runningHead}>the study plan</div>

                {path.loading ? (
                  <p className={s.planLoadingNote}>Loading your path…</p>
                ) : planItems.length > 0 ? (
                  <StudyPlanList
                    title="Your route"
                    examLabel={examLabel}
                    items={planItems}
                    progressPct={path.progressPct}
                    completedCount={path.completedOnPath}
                    disabled={Boolean(turningConceptId)}
                    onSelect={item => openChapter(item.id)}
                    moreCount={Math.max(0, path.pathQueue.length - routeConcepts.length - path.completedOnPath)}
                    onMore={openGps}
                  />
                ) : (
                  <span className={s.planLoadingNote}>
                    Complete your gap scan to build your route.
                  </span>
                )}

                {/* Explore concept cards */}
                {visibleExploreCards.length > 0 && (
                  <>
                    <div className={s.exploreSectionLabel}>explore more →</div>
                    <div className={s.exploreGrid}>
                      {visibleExploreCards.slice(0, 6).map(card => (
                        <button
                          key={card.id}
                          type="button"
                          className={s.exploreCard}
                          onClick={() => openChapter(card.id)}
                          disabled={Boolean(turningConceptId)}
                          title={`Explore ${card.label}`}
                        >
                          <div className={s.exploreCardBg} style={{ background: card.bg }} />
                          <span className={s.exploreCardSymbol} aria-hidden="true">{card.symbol}</span>
                          <span className={s.exploreCardLabel}>{card.label}</span>
                          <span className={s.exploreCardArrow}>explore →</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className={book.folio}>
                  <span>
                    {path.completedOnPath > 0
                      ? `${path.completedOnPath} concept${path.completedOnPath !== 1 ? 's' : ''} completed`
                      : 'entry 1 · unwritten'}
                  </span>
                  <span>p. 2</span>
                </div>
              </>
            ) : routeMode && targetParam ? (
              <div className={s.panelPage}>
                <div className={s.panelPageHeader}>
                  <button className={s.panelBackBtn} onClick={() => navigate(conceptParam
                    ? `/dashboard?view=gps&concept=${encodeURIComponent(conceptParam)}`
                    : '/dashboard?view=gps')}>← back</button>
                  <span className={s.panelTitle}>route</span>
                </div>
                <div className={s.panelContent}>
                  <DashboardRoutePanel
                    targetId={targetParam}
                    onBack={() => navigate(conceptParam
                      ? `/dashboard?view=gps&concept=${encodeURIComponent(conceptParam)}`
                      : '/dashboard?view=gps')}
                  />
                </div>
              </div>
            ) : notesMode ? (
              <div className={s.panelPage}>
                <div className={s.panelPageHeader}>
                  <button className={s.panelBackBtn} onClick={closePanel}>← today</button>
                  <span className={s.panelTitle}>session notes</span>
                </div>
                <div className={s.panelContent}>
                  <DashboardNotesPanel onBack={closePanel} />
                </div>
              </div>
            ) : homeworkMode ? (
              <div className={s.panelPage}>
                <div className={s.panelPageHeader}>
                  <button className={s.panelBackBtn} onClick={closePanel}>← today</button>
                  <span className={s.panelTitle}>problem solver</span>
                </div>
                <div className={s.solverBody}>
                  <p className={s.solverHint}>
                    Paste a stuck problem. Craft builds step-by-step hint cards.
                  </p>
                  <textarea
                    className={s.solverInput}
                    placeholder="e.g. Solve 2x + 5 = 13…"
                    value={solverText}
                    rows={8}
                    maxLength={SOLVER_MAX_CHARS}
                    onChange={e => setSolverText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) launchSolver()
                    }}
                  />
                  <button
                    type="button"
                    className={s.solverSubmit}
                    disabled={!solverText.trim()}
                    onClick={launchSolver}
                  >
                    Build hint path →
                  </button>
                  <button
                    type="button"
                    className={s.solverFullLink}
                    onClick={() => navigate('/practice', { state: { homeworkHelp: true } })}
                  >
                    Open full problem solver →
                  </button>
                </div>
              </div>
            ) : gpsMode ? (
              <div className={s.panelPage}>
                <div className={s.panelPageHeader}>
                  <button className={s.panelBackBtn} onClick={closePanel}>← today</button>
                  <span className={s.panelTitle}>knowledge map</span>
                </div>
                <div className={`${s.panelContent} ${s.mapInset}`}>
                  <ConstellationGpsExplorer
                    embedded
                    onBack={closePanel}
                    autoPlotConceptId={plotConceptId}
                    onStartRoute={openRoute}
                  />
                </div>
              </div>
            ) : null}
          </PageFlipTransition>
        </BookPage>
      }
    />
  )
}
