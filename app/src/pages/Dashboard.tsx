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
import DashboardHomeworkPanel from '../components/DashboardHomeworkPanel'
import s from './Dashboard.module.css'

function formatDateMain() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function formatDateSub() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
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

  // Concepts to show in the left-page route list (max 7)
  const routeConcepts = path.pathConcepts.slice(0, 7)

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
        <div className={s.notebook}>

          {/* ── left page: the record ── */}
          <div className={s.leftPage}>
            <div className={s.pageEdgeLeft} aria-hidden="true" />
            <div className={s.pageInner}>
              <div className={s.pageRunningHeader}>the record</div>

              {/* Route concept list */}
              {path.loading ? (
                <p style={{ fontFamily: 'var(--font-katha)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-pencil)', transform: 'rotate(-0.4deg)' }}>
                  Loading your path…
                </p>
              ) : routeConcepts.length > 0 ? (
                <>
                  <div className={s.routeSectionLabel}>your act route · {path.exam ?? 'act'}</div>
                  <div className={s.routeConceptList}>
                    {routeConcepts.map((c, i) => {
                      const isDone = i < (path.completedOnPath ?? 0)
                      const isActive = c.conceptId === path.activeConceptId
                      return (
                        <div key={c.conceptId} className={s.routeConceptItem}>
                          <div className={`${s.routeDot} ${isDone ? s.routeDotDone : isActive ? s.routeDotActive : s.routeDotInactive}`} />
                          <span className={`${s.routeConceptName} ${isDone ? s.routeConceptNameDone : isActive ? s.routeConceptNameActive : ''}`}>
                            {c.label}
                          </span>
                        </div>
                      )
                    })}
                    {path.pathConcepts.length > 7 && (
                      <div className={s.routeConceptItem} style={{ opacity: 0.5 }}>
                        <div className={`${s.routeDot} ${s.routeDotInactive}`} />
                        <span className={s.routeConceptName} style={{ fontStyle: 'italic', color: 'var(--ink-faded)' }}>
                          +{path.pathConcepts.length - 7} more
                        </span>
                      </div>
                    )}
                  </div>
                  <button className={s.seeMapBtn} onClick={openGps}>see full map ↗</button>
                </>
              ) : (
                <span className={s.pageRunningHeader} style={{ fontSize: 13, fontFamily: 'var(--font-katha)', fontStyle: 'italic', letterSpacing: 0 }}>
                  Complete your gap scan to build your route.
                </span>
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
            <div className={s.stitch} />
            <div className={s.stitch} />
            <div className={s.stitch} />
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
                  {/* mega dateline */}
                  <div className={s.dateline}>
                    <div className={s.dateMain}>{formatDateMain()}</div>
                    <div className={s.dateSub}>{formatDateSub()}</div>
                  </div>

                  {/* today's plan */}
                  <div className={s.todayPlan}>
                    {/* The gap */}
                    <div
                      className={`${s.entryBlock} ${s.gapBlock}`}
                      onClick={goChallenge}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && goChallenge()}
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
                    </div>

                    <div className={s.rulesDivider} />

                    {/* New territory */}
                    <div
                      className={s.entryBlock}
                      onClick={goExplore}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && goExplore()}
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
                    </div>

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
                  <div className={s.panelContent}>
                    <DashboardHomeworkPanel onBack={closePanel} />
                  </div>
                </div>
              ) : gpsMode ? (
                <div className={s.panelPage}>
                  <div className={s.panelPageHeader}>
                    <button className={s.panelBackBtn} onClick={closePanel}>← today</button>
                    <span className={s.panelTitle}>knowledge map</span>
                  </div>
                  <div className={s.panelContent}>
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
