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
import {
  buildWeeklyPracticePaper,
  cacheWeeklyPaper,
  loadCachedWeeklyPaper,
} from '../lib/weeklyPracticePaper'
import { loadDashboardPersonalization } from '../lib/dashboardPersonalization'
import s from './Dashboard.module.css'

const SOLVER_MAX_CHARS = 1200

export default function Dashboard() {
  const user = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const data = useStudentData(user)
  const uid = user?.uid ?? ''

  const [diagChecked, setDiagChecked] = useState(false)
  const [weakness, setWeakness] = useState<NextConcept | null>(null)
  const [learn, setLearn] = useState<NextConcept | null>(null)
  const [curriculumTrack, setCurriculumTrack] = useState<CurriculumTrack | null>(null)
  const [recLoading, setRecLoading] = useState(true)
  const [solverText, setSolverText] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<string[]>([])
  const [showCover, setShowCover] = useState(() => (
    typeof window !== 'undefined' && !coverAlreadySeen()
  ))
  const [showIntro, setShowIntro] = useState(() => (
    typeof window !== 'undefined' && !introAlreadySeen()
  ))
  const [tutorMeetUrl, setTutorMeetUrl] = useState<string | null>(null)
  const [manjushreeGlow, setManjushreeGlow] = useState(false)

  const rawView = searchParams.get('view') ?? 'home'
  const view = (
    rawView === 'today' || rawView === 'route' ? 'home'
    : rawView === 'gps' ? 'map'
    : rawView === 'homework' || rawView === 'worksheet' ? 'work'
    : rawView === 'saved' ? 'notes'
    : rawView
  ) as 'home' | 'map' | 'work' | 'notes'

  function openHome() { navigate('/dashboard', { replace: true }) }
  function openMap() { navigate('/dashboard?view=map', { replace: true }) }
  function openWork() { navigate('/dashboard?view=work', { replace: true }) }
  function openNotes() { navigate('/dashboard?view=notes', { replace: true }) }

  function goChallenge() {
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
    navigate(`/concept/${encodeURIComponent(conceptId)}`, {
      state: { fromDashboard: true },
    })
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

  useEffect(() => {
    if (!data.tutorId) { setTutorMeetUrl(null); return }
    let cancelled = false
    void getDoc(doc(db, 'users', data.tutorId))
      .then(snap => {
        if (cancelled) return
        const url = snap.data()?.googleMeetUrl
        setTutorMeetUrl(typeof url === 'string' && url ? url : null)
      })
      .catch(() => { if (!cancelled) setTutorMeetUrl(null) })
    return () => { cancelled = true }
  }, [data.tutorId])

  useEffect(() => {
    if (!uid) return
    void loadDashboardPersonalization(uid).then(p => {
      setBookmarkedQuestions(p.bookmarkedQuestions)
    })
  }, [uid])

  useEffect(() => { localStorage.setItem('dashboardView', 'web') }, [])

  useEffect(() => {
    if (!uid) return
    getUserRole(uid).then(role => setIsAdmin(role === 'admin'))
  }, [uid])

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    void getDoc(doc(db, 'users', uid)).then(snap => {
      if (cancelled) return
      const goals = snap.data()?.goals as { tags?: string[]; text?: string } | undefined
      const haystack = [...(goals?.tags ?? []), goals?.text ?? ''].join(' ').toLowerCase()
      const keywords = ['game', 'adventure', 'fantasy', 'action']
      setManjushreeGlow(keywords.some(k => haystack.includes(k)))
    }).catch(() => { if (!cancelled) setManjushreeGlow(false) })
    return () => { cancelled = true }
  }, [uid])

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

  const wizardLine = weaknessLabel
    ? `Let’s tackle ${weaknessLabel} next. You’ve got this!`
    : 'Pick any sticker on the map and we’ll dive in ★'

  function playWeeklyPaper() {
    if (!weeklyPaper?.slots[0]) {
      openMap()
      return
    }
    const first = weeklyPaper.slots[0]
    navigate('/practice', {
      state: {
        conceptId: first.conceptId,
        missionType: first.role === 'stretch' ? 'learn' : 'weakness',
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
      <button
        type="button"
        onClick={() => navigate('/manjushree')}
        title="?"
        aria-label="A quiet corner of the notebook"
        className={s.secretPortal}
        data-glow={manjushreeGlow ? '1' : '0'}
      />
      {showCover && (
        <CoverLanding
          entryLabel="your ACT study notebook"
          onOpen={() => setShowCover(false)}
        />
      )}
      {!showCover && showIntro && (
        <NotebookIntro onContinue={() => setShowIntro(false)} />
      )}

      <div className={s.canvasDesk}>
        {/* ONE hero bar, ONE row (was three stacked bands: nav row,
           "Contents" + wizard row, yellow spark banner)  -  merged per
           Akshat's brief so logo, section nav, the wizard's encouragement,
           today's spark CTA, and the username/sign-out all read as one
           continuous strip, not two internal bands. Rendered once, outside
           the view switch below, so it appears identically on
           Home/Map/Work/Notes  -  not just Contents. .heroMiddle is the
           flexible zone (wizard + spark) that absorbs width pressure; the
           wordmark, nav, and user block hold their size. Below 720px it
           wraps onto extra lines rather than truncating content. */}
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
                <span className={s.sparkGo}>play →</span>
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
                    <p className={s.homeLead}>Four lanes. Pick a topic, the Map keeps the messy connected graph.</p>
                  </div>
                  <div className={s.homeTopActions}>
                    {weeklyPaper && weeklyPaper.questionIds.length > 0 && (
                      <button type="button" className={s.paperCta} onClick={playWeeklyPaper}>
                        <span className={s.paperCtaEyebrow}>this week’s paper</span>
                        <span className={s.paperCtaGo}>Start →</span>
                      </button>
                    )}
                    <button type="button" className={s.bookSessionLink} onClick={() => navigate('/book')}>Book a Session →</button>
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
                      <div className={s.tocChips}>
                        {section.conceptIds.map(id => (
                          <button
                            key={id}
                            type="button"
                            className={`${s.tocChip} ${id === sparkId ? s.tocChipSpark : ''}`}
                            onClick={() => openChapter(id)}
                          >
                            <img className={s.tocChipEmoji} src={conceptIconUrl(id)} alt="" draggable={false} />
                            <span className={s.tocChipCopy}>
                              <span className={s.tocChipName}>{actConceptLabel(id)}</span>
                              <span className={s.tocChipBlurb}>{actConceptBlurb(id)}</span>
                            </span>
                          </button>
                        ))}
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
