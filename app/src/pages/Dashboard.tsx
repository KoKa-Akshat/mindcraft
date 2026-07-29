import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { isDiagnosticComplete, markDiagnosticComplete, persistDiagnosticDoneLocal, getUserRole } from '../lib/practiceState'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import { fetchPracticeHubRecommendations, type NextConcept } from '../lib/recommendNextConcept'
import { playTap } from '../lib/uiSound'
import { pawHubDisplayText, type CurriculumTrack } from '../lib/curriculumTrack'
import type { Confidence } from '../lib/bridgePractice'
import SessionCallCard from '../components/SessionCallCard'
import DashboardNotesPanel from '../components/DashboardNotesPanel'
import ConstellationGpsExplorer from '../components/ConstellationGpsExplorer'
import WorkStudio from '../components/canvas/WorkStudio'
import WizardMascot from '../components/canvas/WizardMascot'
import TocSectionMark from '../components/canvas/TocSectionMark'
import NotebookIntro, { introAlreadySeen } from '../components/canvas/NotebookIntro'
import CoverLanding, { coverAlreadySeen } from '../components/book/CoverLanding'
import { ACT_TOC_SECTIONS, actConceptBlurb, actConceptLabel } from '../lib/actToc'
import { conceptIconUrl } from '../lib/conceptIcon'
import { fetchKnowledgeGraph } from '../lib/graphCache'
import { STATUS_COLOR } from '../lib/learningPathGraph'
import {
  buildWeeklyPracticePaper,
  cacheWeeklyPaper,
  loadCachedWeeklyPaper,
  nextUnlockLabel,
} from '../lib/weeklyPracticePaper'
import { loadDashboardPersonalization } from '../lib/dashboardPersonalization'
import {
  demoConceptProgress,
  demoWeaknessConceptId,
  readDemoDiagnostic,
} from '../lib/demoMode'
import blockPlus from '../assets/canvas/generated/mindcraft-blocks/mindcraft-block-plus.png'
import blockFraction from '../assets/canvas/generated/mindcraft-blocks/mindcraft-block-fraction.png'
import blockPi from '../assets/canvas/generated/mindcraft-blocks/mindcraft-block-pi.png'
import blockX from '../assets/canvas/generated/mindcraft-blocks/mindcraft-block-x.png'
import blockParabola from '../assets/canvas/generated/mindcraft-blocks/mindcraft-block-parabola.png'
import blockPercent from '../assets/canvas/generated/mindcraft-blocks/mindcraft-block-percent.png'
import blockEquals from '../assets/canvas/generated/mindcraft-blocks/mindcraft-block-equals.png'
import blockRadical from '../assets/canvas/generated/mindcraft-blocks/mindcraft-block-radical.png'
import s from './Dashboard.module.css'

const SOLVER_MAX_CHARS = 1200

/** Ambient floating MindCraft-block decorations (2026-07-25). Purely
 * decorative — scattered across the stage's own dead corner whitespace,
 * behind the Contents roadmap and the rest of the real UI (low z-index,
 * pointer-events: none, small, low-opacity — see .mcBlock in the CSS
 * module). Hand-placed positions/rotations/sizes/delays, not a random
 * scatter, so the same "restrained handful" layout renders identically
 * every load rather than reshuffling. */
const MC_BLOCKS: Array<{
  name: string
  src: string
  top: string
  left: string
  size: string
  rotate: string
  delay: string
}> = [
  // Positions bias toward the two confirmed-open zones on this canvas: the
  // top header band (above the lane cards, roughly y 0-11%) and the thin
  // margin past the last lane before the stage's rounded corner (y 90%+) —
  // verified against real renders, since the lane cards themselves fill
  // almost the full card width/height and would otherwise hide a block
  // behind their solid backgrounds.
  { name: 'pi',       src: blockPi,       top: '1%',  left: '18%', size: '40px', rotate: '-9deg',  delay: '0s' },
  { name: 'x',        src: blockX,        top: '3%',  left: '70%', size: '34px', rotate: '7deg',   delay: '1.1s' },
  { name: 'fraction', src: blockFraction, top: '2%',  left: '46%', size: '30px', rotate: '6deg',   delay: '0.6s' },
  { name: 'parabola', src: blockParabola, top: '92%', left: '92%', size: '48px', rotate: '-5deg',  delay: '1.8s' },
  { name: 'percent',  src: blockPercent,  top: '8%',  left: '34%', size: '28px', rotate: '10deg',  delay: '2.4s' },
  { name: 'equals',   src: blockEquals,   top: '95%', left: '4%',  size: '34px', rotate: '-8deg',  delay: '0.3s' },
  { name: 'plus',     src: blockPlus,     top: '5%',  left: '60%', size: '26px', rotate: '4deg',   delay: '3s' },
  { name: 'radical',  src: blockRadical,  top: '95%', left: '48%', size: '30px', rotate: '-6deg',  delay: '2s' },
]

/** Contents roadmap dot state. Backed by the same per-concept `status`/
 * `mastery` the Knowledge Map (ConstellationGpsExplorer) reads off
 * GET /knowledge-graph/{uid} — same signal, same status vocabulary
 * (learningPathGraph.ts STATUS_COLOR), so a topic that reads "mastered" here
 * reads mastered on the Map too. Not a new/invented completion metric. */
const TOC_MASTERED_STATUSES = new Set(['mastered', 'stable', 'comeback_built', 'ready_for_challenge'])
const TOC_STRUGGLING_STATUSES = new Set(['struggling', 'open_gap'])

type TocDotState = 'complete' | 'needs' | 'progress' | 'locked'

function tocDotState(status: string): TocDotState {
  if (TOC_MASTERED_STATUSES.has(status)) return 'complete'
  if (TOC_STRUGGLING_STATUSES.has(status)) return 'needs'
  if (status === 'in_progress' || status === 'repairing') return 'progress'
  return 'locked'
}

export default function Dashboard({ preview = false }: { preview?: boolean }) {
  const user = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const data = useStudentData(user)
  const uid = user?.uid ?? ''
  const homeBase = preview ? '/try/dashboard' : '/dashboard'

  const [diagChecked, setDiagChecked] = useState(preview)
  const [weakness, setWeakness] = useState<NextConcept | null>(null)
  const [learn, setLearn] = useState<NextConcept | null>(null)
  const [curriculumTrack, setCurriculumTrack] = useState<CurriculumTrack | null>(null)
  const [recLoading, setRecLoading] = useState(!preview)
  const [solverText, setSolverText] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<string[]>([])
  const [showCover, setShowCover] = useState(() => (
    typeof window !== 'undefined' && !preview && !coverAlreadySeen()
  ))
  const [showIntro, setShowIntro] = useState(() => (
    typeof window !== 'undefined' && !preview && !introAlreadySeen()
  ))
  const [tutorMeetUrl, setTutorMeetUrl] = useState<string | null>(null)
  const [manjushreeGlow, setManjushreeGlow] = useState(false)
  const [conceptProgress, setConceptProgress] = useState<Record<string, { mastery: number; status: string }>>({})

  const rawView = searchParams.get('view') ?? 'home'
  const view = (
    rawView === 'today' || rawView === 'route' ? 'home'
    : rawView === 'gps' ? 'map'
    : rawView === 'homework' || rawView === 'worksheet' ? 'work'
    : rawView === 'saved' ? 'notes'
    : rawView
  ) as 'home' | 'map' | 'work' | 'notes'

  function openHome() { navigate(homeBase, { replace: true }) }
  function openMap() { navigate(`${homeBase}?view=map`, { replace: true }) }
  function openWork() { navigate(`${homeBase}?view=work`, { replace: true }) }
  function openNotes() { navigate(`${homeBase}?view=notes`, { replace: true }) }

  function goChallenge() {
    if (preview) {
      navigate('/try/manjushree')
      return
    }
    if (weakness) {
      navigate('/practice', {
        state: {
          conceptId: weakness.conceptId,
          missionType: 'weakness',
          formatId: weakness.formatId,
          ingredientId: weakness.ingredientId,
          misconceptionId: weakness.misconceptionId,
        },
      })
    } else {
      openMap()
    }
  }

  function openChapter(conceptId: string) {
    playTap()
    if (preview) {
      navigate(`/try/story/${encodeURIComponent(conceptId)}`)
      return
    }
    navigate(`/concept/${encodeURIComponent(conceptId)}`, {
      state: { fromDashboard: true },
    })
  }

  function launchSolver() {
    if (preview) {
      window.location.href = 'https://mindcraft-marketing-site.web.app/#intake'
      return
    }
    const text = solverText.trim().slice(0, SOLVER_MAX_CHARS)
    if (!text) return
    navigate('/practice', { state: { problemText: text } })
  }

  async function handleSignOut() {
    if (preview) {
      try {
        sessionStorage.removeItem('mc-demo-mode')
        sessionStorage.removeItem('mc-demo-diagnostic')
      } catch { /* ignore */ }
      window.location.href = 'https://mindcraft-marketing-site.web.app/'
      return
    }
    try { await signOut(auth) } catch { /* ignore */ }
    navigate('/login')
  }

  useEffect(() => {
    if (preview) {
      const demo = readDemoDiagnostic()
      const confidence = demo?.confidence ?? {}
      setConceptProgress(demoConceptProgress(confidence))
      const weakId = demoWeaknessConceptId(confidence)
      if (weakId) {
        setWeakness({
          conceptId: weakId,
          label: actConceptLabel(weakId),
          mastery: 0.12,
          status: 'open_gap',
        })
      } else {
        setWeakness(null)
      }
      const learnId = Object.entries(confidence).find(([, v]) => v === 'easy')?.[0] ?? null
      if (learnId) {
        setLearn({
          conceptId: learnId,
          label: actConceptLabel(learnId),
          mastery: 0.72,
          status: 'stable',
        })
      } else {
        setLearn(null)
      }
      setCurriculumTrack('act_prep')
      setRecLoading(false)
      setDiagChecked(true)
      setManjushreeGlow(true)
    }
  }, [preview])

  useEffect(() => {
    if (preview || !data.tutorId) { setTutorMeetUrl(null); return }
    let cancelled = false
    void getDoc(doc(db, 'users', data.tutorId))
      .then(snap => {
        if (cancelled) return
        const url = snap.data()?.googleMeetUrl
        setTutorMeetUrl(typeof url === 'string' && url ? url : null)
      })
      .catch(() => { if (!cancelled) setTutorMeetUrl(null) })
    return () => { cancelled = true }
  }, [data.tutorId, preview])

  useEffect(() => {
    if (preview || !uid) return
    void loadDashboardPersonalization(uid).then(p => {
      setBookmarkedQuestions(p.bookmarkedQuestions)
    })
  }, [uid, preview])

  useEffect(() => { localStorage.setItem('dashboardView', 'web') }, [])

  useEffect(() => {
    if (preview || !uid) return
    getUserRole(uid).then(role => setIsAdmin(role === 'admin'))
  }, [uid, preview])

  // Contents roadmap completion signal — same GET /knowledge-graph/{uid} the
  // Map view reads (see graphCache.ts), so "lit up" here means the same
  // per-concept mastery/status the rest of the app already shows.
  useEffect(() => {
    if (preview || !uid) return
    let cancelled = false
    void fetchKnowledgeGraph(uid).then(kg => {
      if (cancelled || !kg) return
      const nodes = (kg.nodes ?? []) as Array<{ id?: unknown; mastery?: unknown; status?: unknown }>
      const next: Record<string, { mastery: number; status: string }> = {}
      for (const n of nodes) {
        if (typeof n.id !== 'string') continue
        next[n.id] = {
          mastery: typeof n.mastery === 'number' ? n.mastery : 0,
          status: typeof n.status === 'string' ? n.status : 'untouched',
        }
      }
      setConceptProgress(next)
    })
    return () => { cancelled = true }
  }, [uid, preview])

  useEffect(() => {
    if (preview || !uid) return
    let cancelled = false
    void getDoc(doc(db, 'users', uid)).then(snap => {
      if (cancelled) return
      const goals = snap.data()?.goals as { tags?: string[]; text?: string } | undefined
      const haystack = [...(goals?.tags ?? []), goals?.text ?? ''].join(' ').toLowerCase()
      const keywords = ['game', 'adventure', 'fantasy', 'action']
      setManjushreeGlow(keywords.some(k => haystack.includes(k)))
    }).catch(() => { if (!cancelled) setManjushreeGlow(false) })
    return () => { cancelled = true }
  }, [uid, preview])

  useEffect(() => {
    if (preview || !uid) return
    let cancelled = false
    void (async () => {
      setRecLoading(true)
      try {
        const snap = await getDoc(doc(db, 'users', uid))
        if (cancelled) return
        const profile = snap.data()
        const track = profile?.curriculumTrack as CurriculumTrack | undefined
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
  }, [uid, preview])

  useEffect(() => {
    if (preview) return
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
          await markDiagnosticComplete(user.uid, { exam: exam ?? 'ACT', confidenceMap: confidence })
          persistDiagnosticDoneLocal()
          if (!cancelled) {
            setDiagChecked(true)
            navigate('/dashboard', { replace: true })
          }
        } catch {
          if (!cancelled) setDiagChecked(true)
        }
        return
      }

      if (sessionStorage.getItem('mc-diag-just-completed') === '1') {
        sessionStorage.removeItem('mc-diag-just-completed')
        setDiagChecked(true)
        persistDiagnosticDoneLocal()
        return
      }
      let done = await isDiagnosticComplete(user.uid)
      if (!done && localStorage.getItem('mc-diag-done') === '1') {
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
      if (!done) navigate('/diagnostic', { replace: true })
      else {
        setDiagChecked(true)
        persistDiagnosticDoneLocal()
      }
    })()
    return () => { cancelled = true }
  }, [user.uid, navigate, searchParams])

  const weaknessLabel = weakness ? pawHubDisplayText(weakness.label, curriculumTrack) : null
  const displayName = data.displayName ?? user?.email?.split('@')[0] ?? ''
  const sparkId = weakness?.conceptId ?? null

  const weeklyPaper = useMemo(() => {
    const cached = loadCachedWeeklyPaper()
    if (cached) return cached
    if (recLoading) return null
    const paper = buildWeeklyPracticePaper({
      weakness,
      learn,
      reviewConceptIds: ACT_TOC_SECTIONS[0]?.conceptIds.slice(0, 2) ?? [],
      questionsPerSlot: 3,
    })
    if (paper.questionIds.length) cacheWeeklyPaper(paper)
    return paper
  }, [weakness, learn, recLoading])

  // The wizard's own speech-bubble box (previously reading "Weekly Review")
  // is removed from next to the mascot per Akshat's follow-up brief — the
  // "this week's paper" CTA now carries the "Weekly Review" label itself
  // (see .homeTopActions below), so having it twice was redundant. The
  // WizardMascot component (components/canvas/, out of this lane) still
  // requires a `line` string prop; it's kept computed here but its bubble
  // is hidden purely via CSS (`.heroMiddle > aside > div` in
  // Dashboard.module.css) so the sprite alone remains next to today's
  // spark, with no dead empty box left behind.
  const wizardLine = weaknessLabel
    ? 'Weekly Review'
    : 'Pick any sticker on the map and we’ll dive in ★'

  // Locked once the student has finished this week's paper (weekKey-keyed
  // completion flag, self-written by the student's own browser same as
  // diagnosticCompleted — see practiceState.ts). Stays unlocked the whole
  // week up until then; re-locks only on completion, not on a timer.
  const paperLocked = !!weeklyPaper && data.weeklyPaperCompletedWeek === weeklyPaper.weekKey
  const paperUnlockLabel = useMemo(() => nextUnlockLabel(), [])

  function playWeeklyPaper() {
    if (preview) {
      navigate('/try/manjushree')
      return
    }
    if (!weeklyPaper?.slots[0] || paperLocked) {
      openMap()
      return
    }
    const first = weeklyPaper.slots[0]
    navigate('/practice', {
      state: {
        conceptId: first.conceptId,
        missionType: first.role === 'stretch' ? 'learn' : 'weakness',
        weeklyPaper: true,
        weeklyPaperWeekKey: weeklyPaper.weekKey,
      },
    })
  }

  if (!diagChecked) {
    return (
      <div className={s.canvasDesk}>
        <div className={s.heroBar}>
          <span className={s.canvasWordmark}>Mind<span className={s.canvasWordmarkCraft}>Craft</span></span>
        </div>
        <div className={s.loading}><div className={s.spinner} /></div>
      </div>
    )
  }

  return (
    <>
      {preview && (
        <div
          style={{
            position: 'fixed',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 80,
            padding: '8px 14px',
            borderRadius: 999,
            background: 'rgba(20,58,46,.92)',
            color: '#f4efe2',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            boxShadow: '0 10px 28px rgba(20,58,46,.22)',
          }}
        >
          Demo dashboard · nothing is saved
        </div>
      )}
      <button
        type="button"
        onClick={() => navigate(preview ? '/try/manjushree' : '/manjushree')}
        title="?"
        aria-label="A quiet corner of the notebook"
        className={s.secretPortal}
        data-glow={manjushreeGlow ? '1' : '0'}
      />
      {showCover && (
        <CoverLanding
          entryLabel="your ACT study notebook"
          accountName={displayName}
          onOpen={() => setShowCover(false)}
        />
      )}
      {!showCover && showIntro && (
        <NotebookIntro onContinue={() => setShowIntro(false)} />
      )}

      <div className={s.canvasDesk}>
        {/* ONE hero bar, ONE row (was three stacked bands: nav row,
           "Contents" + wizard row, yellow spark banner)  -  merged per
           Akshat's brief so logo, section nav, the wizard sprite, today's
           spark CTA, and the username/sign-out all read as one continuous
           strip, not two internal bands. Rendered once, outside the view
           switch below, so it appears identically on Home/Map/Work/Notes
            -  not just Contents. .heroMiddle is the flexible zone (wizard +
           spark) that absorbs width pressure; the wordmark, nav, and user
           block hold their size. Below 720px it wraps onto extra lines
           rather than truncating content. The wizard's own speech-bubble
           box is hidden here (see .heroMiddle > aside > div in the CSS
           module) so today's spark sits right up against the sprite instead
           of leaving the bubble's old footprint as dead space. */}
        <header className={s.heroBar}>
          <span className={s.canvasWordmark}>Mind<span className={s.canvasWordmarkCraft}>Craft</span></span>
          <nav className={s.canvasNav} aria-label="Notebook sections">
            <button type="button" className={view === 'home' ? s.navActive : s.navBtn} onClick={openHome}>Home</button>
            <button type="button" className={view === 'map' ? s.navActive : s.navBtn} onClick={openMap}>Map</button>
            <button type="button" className={view === 'work' ? s.navActive : s.navBtn} onClick={openWork}>Work</button>
            <button type="button" className={view === 'notes' ? s.navActive : s.navBtn} onClick={openNotes}>Notes</button>
          </nav>
          <div className={s.heroMiddle}>
            <WizardMascot line={wizardLine} compact />
            {weakness && (
              <button type="button" className={s.heroSpark} onClick={goChallenge}>
                <img className={s.heroSparkIcon} src={conceptIconUrl(weakness.conceptId)} alt="" draggable={false} />
                <span className={s.sparkText}>
                  <span className={s.sparkEyebrow}>today’s spark</span>
                  <span className={s.sparkName}>{weaknessLabel}</span>
                </span>
                <span className={s.sparkGo}>play</span>
              </button>
            )}
          </div>
          <div className={s.canvasUser}>
            {displayName && <span>{displayName}</span>}
            <button type="button" className={s.signOut} onClick={() => void handleSignOut()}>sign out</button>
          </div>
        </header>

        <main className={s.canvasStage}>
          {/* Spiral/binding-ring motif  -  a left-edge spine on the shared
             stage, present under every view (Home/Map/Work/Notes) since it
             lives outside the view switch, echoing the cover's own
             bound-notebook look (DASHBOARD_NOTEBOOK_SPEC.md's ring/binding
             vocabulary, scoped to this one visual detail  -  not that spec's
             full dark "Deep Field" rebuild). */}
          <div className={s.deskSpine} aria-hidden="true">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className={s.deskRing} />
            ))}
          </div>

          <div key={view} className={s.stagePane}>
            {view === 'home' && (
              <div className={s.homeCanvas}>
                <div className={s.homeTop}>
                  <div className={s.homeTopMain}>
                    <h1 className={s.homeTitle}>Contents</h1>
                  </div>
                  <div className={s.homeTopActions}>
                    {weeklyPaper && weeklyPaper.questionIds.length > 0 && (
                      paperLocked ? (
                        <div className={s.paperCtaLocked} aria-live="off">
                          <span className={s.paperCtaLockIcon} aria-hidden="true">🔒</span>
                          <span className={s.paperCtaLockedText}>
                            <span className={s.paperCtaEyebrow}>this week’s paper</span>
                            <span className={s.paperCtaUnlockLabel}>Done! {paperUnlockLabel}</span>
                          </span>
                        </div>
                      ) : (
                        // Reuses .bookSessionLink verbatim (Akshat: label
                        // should read "Weekly Review" and look "just like a
                        // find a tutor button" — same pill, no arrow, no new
                        // CSS invented for it).
                        <button type="button" className={s.bookSessionLink} onClick={playWeeklyPaper}>Weekly Review</button>
                      )
                    )}
                    <button type="button" className={s.bookSessionLink} onClick={() => navigate('/find-a-tutor')}>Find a Tutor</button>
                  </div>
                </div>

                <div className={s.horizontalToc}>
                  {ACT_TOC_SECTIONS.map(section => (
                    <section
                      key={section.id}
                      className={s.tocLane}
                      style={{
                        background: section.wash,
                        ['--lane-accent' as string]: section.accent,
                        ['--lane-ink' as string]: section.ink,
                      }}
                    >
                      <header className={s.tocLaneHead}>
                        <TocSectionMark id={section.id} accent={section.accent} />
                        <div className={s.tocLaneCopy}>
                          <h2 className={s.tocLaneTitle}>{section.title}</h2>
                          <p className={s.tocLaneBlurb}>{section.blurb}</p>
                        </div>
                      </header>
                      <div className={s.tocTrack}>
                        {section.conceptIds.map(id => {
                          const progress = conceptProgress[id]
                          const mastery = Math.max(0, Math.min(1, progress?.mastery ?? 0))
                          const status = progress?.status ?? 'untouched'
                          const dotState = tocDotState(status)
                          const dotColor = STATUS_COLOR[status] ?? STATUS_COLOR.untouched
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`${s.tocNode} ${id === sparkId ? s.tocNodeSpark : ''}`}
                              data-state={dotState}
                              style={{
                                ['--node-color' as string]: dotColor,
                                ['--node-fill' as string]: `${Math.round(mastery * 100)}%`,
                              }}
                              title={`${actConceptLabel(id)} — ${Math.round(mastery * 100)}% mastery`}
                              onClick={() => openChapter(id)}
                            >
                              <span className={s.tocNodeName}>{actConceptLabel(id)}</span>
                              <span className={s.tocNodeDot} aria-hidden="true">
                                {dotState === 'complete' && <span className={s.tocNodeCheck}>✓</span>}
                              </span>
                              <span className={s.tocNodeBlurb}>{actConceptBlurb(id)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>

                {/* Map/Work/Notes pills retired here  -  they duplicated the
                   top nav (Home/Map/Work/Notes), which already covers this
                   navigation. "This week's paper" moved up next to Contents
                   (see .homeTopActions above). Only the admin link remains,
                   when relevant. */}
                {isAdmin && (
                  <div className={s.homeActions}>
                    <button type="button" className={s.adminQuietLink} onClick={() => navigate('/admin')}>admin</button>
                  </div>
                )}
              </div>
            )}

            {view === 'map' && (
              <div className={s.mapCanvas}>
                <ConstellationGpsExplorer
                  embedded
                  autoPlotConceptId={searchParams.get('concept') || sparkId}
                />
              </div>
            )}

            {view === 'work' && (
              <WorkStudio
                solverText={solverText}
                onSolverText={setSolverText}
                onSolve={launchSolver}
              />
            )}

            {view === 'notes' && (
              <div className={s.notesCanvas}>
                <h2 className={s.homeTitle}>Notes</h2>
                <DashboardNotesPanel
                  uid={uid}
                  bookmarkedIds={bookmarkedQuestions}
                  onBookmarksChange={setBookmarkedQuestions}
                />
              </div>
            )}
          </div>

          {/* Ambient floating MindCraft-block decorations  -  ornamental only
             (aria-hidden, no pointer events), scattered in the stage's own
             dead corner whitespace behind the Contents roadmap. Same
             position: relative stage as .deskSpine above, present on every
             view since it lives outside the view switch. Respects
             prefers-reduced-motion (see .mcBlock's @media query in the CSS
             module) - the drift pauses, the blocks just sit still. */}
          <div className={s.mcBlocks} aria-hidden="true">
            {MC_BLOCKS.map(b => (
              <img
                key={b.name}
                src={b.src}
                alt=""
                draggable={false}
                className={s.mcBlock}
                style={{
                  '--block-top': b.top,
                  '--block-left': b.left,
                  '--block-size': b.size,
                  '--block-rotate': b.rotate,
                  '--block-delay': b.delay,
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Small second wordmark, bottom-left corner  -  a page-watermark,
             not a nav element (the real logo/nav lives in .heroBar above).
             Low-opacity, non-interactive, echoes the notebook's own
             hand-drawn wordmark font at a fraction of the size. */}
          <span className={s.pageWatermark} aria-hidden="true">
            Mind<span className={s.pageWatermarkCraft}>Craft</span>
          </span>
        </main>
      </div>

      {data.nextSession?.scheduledAt && (data.nextSession.meetingUrl || tutorMeetUrl) ? (
        <SessionCallCard
          sessionId={data.nextSession.id ?? `next-${data.nextSession.scheduledAt}`}
          meetingUrl={(data.nextSession.meetingUrl ?? tutorMeetUrl)!}
          personName={data.nextSession.tutor || 'Your tutor'}
          subject={data.nextSession.subject}
          scheduledAt={data.nextSession.scheduledAt}
          endAt={data.nextSession.endAt}
        />
      ) : null}
    </>
  )
}
