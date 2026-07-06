import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { usePracticePathQueue } from '../lib/practicePathQueue'
import { isDiagnosticComplete, markDiagnosticComplete, persistDiagnosticDoneLocal } from '../lib/practiceState'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import { fetchPracticeHubRecommendations, type NextConcept } from '../lib/recommendNextConcept'
import { pawHubDisplayText, pawHubLearnSub, type CurriculumTrack } from '../lib/curriculumTrack'
import type { Confidence } from '../lib/bridgePractice'
import ConstellationGpsExplorer from '../components/ConstellationGpsExplorer'
import DashboardRoutePanel from '../components/DashboardRoutePanel'
import DashboardNotesPanel from '../components/DashboardNotesPanel'
import s from './Dashboard.module.css'

// Concept discovery cards — supplementary ACT concepts to explore
const EXPLORE_CARDS = [
  {
    id: 'quadratics',
    label: 'Quadratics',
    symbol: 'x²',
    bg: 'linear-gradient(135deg, #1e2a4a 0%, #2f4370 55%, #22304f 100%)',
  },
  {
    id: 'trigonometry',
    label: 'Trig',
    symbol: 'θ',
    bg: 'linear-gradient(135deg, #3d1f24 0%, #6b3540 55%, #452328 100%)',
  },
  {
    id: 'statistics',
    label: 'Statistics',
    symbol: 'σ',
    bg: 'linear-gradient(135deg, #402d1a 0%, #6b4a26 55%, #47331d 100%)',
  },
  {
    id: 'coordinate_geometry',
    label: 'Coord. Plane',
    symbol: 'xy',
    bg: 'linear-gradient(135deg, #3b2440 0%, #5c3a63 55%, #402a47 100%)',
  },
  {
    id: 'logarithms',
    label: 'Logarithms',
    symbol: 'ln',
    bg: 'linear-gradient(135deg, #14383a 0%, #226266 55%, #17403f 100%)',
  },
  {
    id: 'probability',
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
    }, 450)
  }

  function goToConcept(conceptId: string, _isDone: boolean) {
    openChapter(conceptId)
  }

  function launchSolver() {
    const text = solverText.trim()
    if (!text) return
    navigate('/practice', { state: { problemText: text } })
  }

  async function handleSignOut() {
    try { await signOut(auth) } catch { /* ignore */ }
    navigate('/login')
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
        const track = snap.data()?.curriculumTrack as CurriculumTrack | undefined
        if (track) setCurriculumTrack(track)
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

      let done = await isDiagnosticComplete(user.uid)
      if (!done && localStorage.getItem('mc-diag-done') === '1') {
        await markDiagnosticComplete(user.uid, { exam: 'ACT', confidenceMap: {} })
        done = true
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

  return (
    <div className={s.shell}>
      {/* ── desk chrome ── */}
      <div className={s.deskChrome}>
        <span className={s.wordmark}>MindCraft</span>
        <div className={s.deskRight}>
          {displayName && <span className={s.deskUser}>{displayName}</span>}
          <button className={s.signOutBtn} onClick={() => void handleSignOut()}>sign out</button>
        </div>
      </div>

      {!diagChecked ? (
        <div className={s.loading}><div className={s.spinner} /></div>
      ) : (
        <div className={`${s.notebook} ${turningConceptId ? s.notebookTurning : ''}`}>

          {/* ── left page: the record ── */}
          <div className={s.leftPage}>
            <div className={s.pageEdgeLeft} aria-hidden="true" />
            <div className={s.pageInner}>
              <div className={s.pageRunningHeader}>the record</div>

              {/* Route concept list */}
              {path.loading ? (
                <p style={{
                  fontFamily: 'var(--font-katha)',
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: 'var(--ink-pencil)',
                  transform: 'rotate(-0.3deg)',
                  margin: 0,
                }}>
                  Loading your path…
                </p>
              ) : routeConcepts.length > 0 ? (
                <>
                  <div className={s.routeSectionLabel}>your act route · {path.exam ?? 'act'}</div>
                  <div className={s.routeConceptList}>
                    {routeConcepts.map((c, i) => {
                      const isDone = i < (path.completedOnPath ?? 0)
                      const isActive = c.id === path.activeConceptId
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={s.routeConceptItem}
                          onClick={() => goToConcept(c.id, isDone)}
                          disabled={Boolean(turningConceptId)}
                          title={`Open ${c.label}`}
                        >
                          <div className={`${s.routeDot} ${isDone ? s.routeDotDone : isActive ? s.routeDotActive : s.routeDotInactive}`} />
                          <span className={`${s.routeConceptName} ${isDone ? s.routeConceptNameDone : isActive ? s.routeConceptNameActive : ''}`}>
                            {c.label}
                          </span>
                        </button>
                      )
                    })}
                    {path.pathConcepts.length > 7 && (
                      <button
                        type="button"
                        className={s.routeConceptItem}
                        style={{ opacity: 0.45 }}
                        onClick={openGps}
                      >
                        <div className={`${s.routeDot} ${s.routeDotInactive}`} />
                        <span className={s.routeConceptName} style={{ fontStyle: 'italic' }}>
                          +{path.pathConcepts.length - 7} more on the map
                        </span>
                      </button>
                    )}
                  </div>
                  <button className={s.seeMapBtn} onClick={openGps}>see full map ↗</button>
                </>
              ) : (
                <span style={{
                  fontSize: 14,
                  fontFamily: 'var(--font-katha)',
                  fontStyle: 'italic',
                  color: 'var(--ink-pencil)',
                  transform: 'rotate(-0.3deg)',
                  display: 'block',
                }}>
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
                        <div
                          className={s.exploreCardBg}
                          style={{ background: card.bg }}
                        />
                        <span className={s.exploreCardSymbol} aria-hidden="true">
                          {card.symbol}
                        </span>
                        <span className={s.exploreCardLabel}>{card.label}</span>
                        <span className={s.exploreCardArrow}>explore →</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className={s.pageNumber}>
                {path.completedOnPath > 0
                  ? `${path.completedOnPath} concept${path.completedOnPath !== 1 ? 's' : ''} completed`
                  : 'entry 1 · unwritten'}
              </div>
            </div>
          </div>

          {/* ── binding gutter ── */}
          <div className={s.gutter} aria-hidden="true">
            <div className={s.stitch} />
            <div className={s.stitchSmall} />
            <div className={s.stitch} />
            <div className={s.stitchSmall} />
            <div className={s.stitch} />
            <div className={s.stitchSmall} />
            <div className={s.stitch} />
            <div className={s.stitchSmall} />
            <div className={s.stitch} />
          </div>

          {/* ── right page: today / panels ── */}
          <div className={s.rightPage}>
            <div className={s.pageEdgeRight} aria-hidden="true" />

            {/* fore-edge tabs */}
            <div className={s.foreedge}>
              <button className={`${s.tab} ${todayMode ? s.tabActive : ''}`} onClick={closePanel}>Today</button>
              <button className={`${s.tab} ${s.tabMap} ${(gpsMode || routeMode) ? s.tabActive : ''}`} onClick={openGps}>Map</button>
              <button className={`${s.tab} ${homeworkMode ? s.tabActive : ''}`} onClick={openHomework}>Solver</button>
              <button className={`${s.tab} ${notesMode ? s.tabActive : ''}`} onClick={openNotes}>Notes</button>
            </div>

            <div className={s.pageInner}>
              {todayMode ? (
                <>
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

                    {/* index line */}
                    <div className={s.indexLine}>
                      <button className={s.indexBtn} onClick={openHomework}>problem solver</button>
                      <span className={s.indexDot}>·</span>
                      <button className={s.indexBtn} onClick={openNotes}>session notes</button>
                      <span className={s.indexDot}>·</span>
                      <button className={s.indexBtn} onClick={openGps}>the map ↗</button>
                    </div>
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
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
