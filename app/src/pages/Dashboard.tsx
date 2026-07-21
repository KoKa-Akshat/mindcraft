import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { Compass, NotebookPen, Wand2, Settings, Sparkles, FileUp } from 'lucide-react'
import { auth, db } from '../firebase'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { usePracticePathQueue } from '../lib/practicePathQueue'
import { isDiagnosticComplete, markDiagnosticComplete, persistDiagnosticDoneLocal, getUserRole } from '../lib/practiceState'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import { fetchPracticeHubRecommendations, type NextConcept } from '../lib/recommendNextConcept'
import { pawHubDisplayText, type CurriculumTrack } from '../lib/curriculumTrack'
import type { Confidence } from '../lib/bridgePractice'
import SessionCallCard from '../components/SessionCallCard'
import DashboardRoutePanel from '../components/DashboardRoutePanel'
import DashboardNotesPanel from '../components/DashboardNotesPanel'
import DashboardWorksheetPanel from '../components/DashboardWorksheetPanel'
import ActTrailMap from '../components/ActTrailMap'
import JournalStyleDrawer from '../components/book/JournalStyleDrawer'
import StickerLayer from '../components/book/StickerLayer'
import CoverLanding, { coverAlreadySeen } from '../components/book/CoverLanding'
import { ACT_TOC_SECTIONS, actConceptLabel } from '../lib/actToc'
import {
  loadDashboardPersonalization,
  saveCustomStickers,
  saveDashboardStickers,
  saveDashboardTheme,
  STICKER_CAP,
  type CustomSticker,
  type DashboardSticker,
  type DashboardTheme,
  type StickerSelection,
  DEFAULT_THEME,
} from '../lib/dashboardPersonalization'
import conceptStoriesData from '../data/conceptStories.json'
import ConceptVignette from '../components/book/ConceptVignette'
import BookShell from '../components/book/BookShell'
import BookPage from '../components/book/BookPage'
import CoverNavItem from '../components/book/CoverNavItem'
import PageFlipTransition from '../components/book/PageFlipTransition'
import book from '../components/book/Book.module.css'
import s from './Dashboard.module.css'

/** Max characters accepted by the inline problem-solver pad. */
const SOLVER_MAX_CHARS = 1200

const STORIES = conceptStoriesData as Record<string, { conceptName: string; story: string }>

function storyTeaser(conceptId: string, max = 160): string {
  const raw = STORIES[conceptId]?.story ?? ''
  if (raw.length <= max) return raw
  const cut = raw.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

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
  const [learn, setLearn] = useState<NextConcept | null>(null) // kept for hub fetch shape; unused in ACT TOC UI
  void learn
  const [curriculumTrack, setCurriculumTrack] = useState<CurriculumTrack | null>(null)
  const [recLoading, setRecLoading] = useState(true)
  const [solverText, setSolverText] = useState('')
  const [turningConceptId, setTurningConceptId] = useState<string | null>(null)
  const [parentEmail, setParentEmail] = useState('')
  const [parentEmailSaved, setParentEmailSaved] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(DEFAULT_THEME)
  const [dashboardStickers, setDashboardStickers] = useState<DashboardSticker[]>([])
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<string[]>([])
  const [styleDrawerOpen, setStyleDrawerOpen] = useState(false)
  const [customStickers, setCustomStickers] = useState<CustomSticker[]>([])
  const [selectedSticker, setSelectedSticker] = useState<StickerSelection | null>(null)
  const [showCover, setShowCover] = useState(() => (
    typeof window !== 'undefined' && window.innerWidth >= 900 && !coverAlreadySeen()
  ))
  // Tutor's permanent Meet room — join-link fallback when the session doc has
  // no meetingUrl of its own. users/{uid} docs are readable by any signed-in user.
  const [tutorMeetUrl, setTutorMeetUrl] = useState<string | null>(null)
  // Hidden action-math zone portal. Always present (a small, quiet corner
  // affordance) but glows when the student's own onboarding goals mention
  // game/adventure/fantasy/action -- a real signal read from Firestore, not
  // invented. Restored 2026-07-21 after a concurrent commit on this same
  // checkout dropped the portal wiring (see ACTIVE_TASK.md).
  const [manjushreeGlow, setManjushreeGlow] = useState(false)

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

  const view = searchParams.get('view') ?? 'today'
  const gpsMode = view === 'gps'
  const routeMode = view === 'route'
  const homeworkMode = view === 'homework'
  const worksheetMode = view === 'worksheet'
  // Saved bookmarks live inside Notes now — old ?view=saved redirects there.
  const notesMode = view === 'notes' || view === 'saved'
  const todayMode = !gpsMode && !routeMode && !notesMode && !homeworkMode && !worksheetMode

  const conceptParam = searchParams.get('concept')
  const targetParam = searchParams.get('target')

  function openGps() { navigate('/dashboard?view=gps', { replace: true }) }
  function openRoute(targetId: string) {
    openChapter(targetId)
  }
  function openNotes() { navigate('/dashboard?view=notes', { replace: true }) }
  function openHomework() { navigate('/dashboard?view=homework', { replace: true }) }
  function openWorksheet() { navigate('/dashboard?view=worksheet', { replace: true }) }
  function closePanel() { navigate('/dashboard', { replace: true }) }

  // Arrow-key page navigation — left/right flips between the notebook's
  // section pages (Plan · Map · Homework · Solver · Notes · Saved), the same
  // destinations as the fore-edge tabs. Skipped while typing, mid page-turn,
  // drilled into a route detail, or before the cover has been opened.
  const TAB_ORDER: Array<{ mode: string; open: () => void }> = [
    { mode: 'today', open: closePanel },
    { mode: 'gps', open: openGps },
    { mode: 'worksheet', open: openWorksheet },
    { mode: 'homework', open: openHomework },
    { mode: 'notes', open: openNotes },
  ]
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (showCover || styleDrawerOpen || turningConceptId || routeMode) return
      const target = e.target as HTMLElement | null
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return
      if (target?.isContentEditable) return
      const currentMode = todayMode ? 'today' : view
      const idx = TAB_ORDER.findIndex(t => t.mode === currentMode)
      if (idx < 0) return
      const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1
      if (nextIdx < 0 || nextIdx >= TAB_ORDER.length) return
      e.preventDefault()
      TAB_ORDER[nextIdx].open()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCover, styleDrawerOpen, turningConceptId, routeMode, todayMode, view])

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
      openGps()
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

  useEffect(() => {
    if (!uid) return
    void loadDashboardPersonalization(uid).then(p => {
      setDashboardTheme(p.theme)
      setDashboardStickers(p.stickers)
      setCustomStickers(p.customStickers)
      setBookmarkedQuestions(p.bookmarkedQuestions)
    })
  }, [uid])

  function handleThemeChange(theme: DashboardTheme) {
    setDashboardTheme(theme)
    if (uid) void saveDashboardTheme(uid, theme)
  }

  function handlePlaceSticker(x: number, y: number) {
    if (!selectedSticker || dashboardStickers.length >= STICKER_CAP) return
    const next: DashboardSticker[] = [
      ...dashboardStickers,
      {
        stickerId: selectedSticker.stickerId,
        customUrl: selectedSticker.customUrl,
        x,
        y,
        rotation: Math.round((Math.random() - 0.5) * 16),
      },
    ]
    setDashboardStickers(next)
    setSelectedSticker(null)
    if (uid) void saveDashboardStickers(uid, next)
  }

  function handleMoveSticker(index: number, x: number, y: number) {
    const next = dashboardStickers.map((sticker, i) => (
      i === index ? { ...sticker, x, y } : sticker
    ))
    setDashboardStickers(next)
    if (uid) void saveDashboardStickers(uid, next)
  }

  function handleRemoveSticker(index: number) {
    const next = dashboardStickers.filter((_, i) => i !== index)
    setDashboardStickers(next)
    if (uid) void saveDashboardStickers(uid, next)
  }

  function handleClearStickers() {
    setDashboardStickers([])
    setSelectedSticker(null)
    if (uid) void saveDashboardStickers(uid, [])
  }

  function handleCustomStickersChange(stickers: CustomSticker[]) {
    setCustomStickers(stickers)
    if (uid) void saveCustomStickers(uid, stickers)
  }

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
      let done = await isDiagnosticComplete(user.uid)
      // Only trust localStorage shortcut if Firestore already has some data for
      // this student — prevents a stale 'mc-diag-done' from bypassing the gap
      // scan on a fresh or reset account.
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
      if (!done) navigate('/onboard', { replace: true })
      else {
        setDiagChecked(true)
        persistDiagnosticDoneLocal()
      }
    })()
    return () => { cancelled = true }
  }, [user.uid, navigate, searchParams])

  const weaknessLabel = weakness ? pawHubDisplayText(weakness.label, curriculumTrack) : null
  const displayName   = data.displayName ?? user?.email?.split('@')[0] ?? ''
  const flagColor     = getFlagColor()
  const sparkId = weakness?.conceptId ?? null

  const coverEntryLabel = path.completedOnPath > 0
    ? `Entry ${path.completedOnPath} · pick up where you left off`
    : 'Entry 1 · unwritten'

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
    <>
    {/* Hidden portal to the Manjushree action-math zone. Quiet by default;
        glows only when the student's own stated goals suggest they'd like
        it (see the effect above). "found between the pages" -- a small
        corner tab, not a banner. */}
    <button
      type="button"
      onClick={() => navigate('/manjushree')}
      title="?"
      aria-label="A quiet corner of the notebook"
      style={{
        position: 'fixed', right: 14, bottom: 14, zIndex: 40,
        width: 30, height: 30, borderRadius: '50%', border: 'none',
        cursor: 'pointer', padding: 0,
        background: manjushreeGlow ? 'radial-gradient(circle, #ffe07a, #d3a900)' : 'rgba(23,48,31,0.08)',
        boxShadow: manjushreeGlow ? '0 0 14px rgba(211,169,0,0.7)' : 'none',
        transition: 'box-shadow .4s ease, background .4s ease',
      }}
    />
    {showCover && (
      <CoverLanding
        entryLabel={coverEntryLabel}
        onOpen={() => setShowCover(false)}
      />
    )}
    <BookShell
      theme={dashboardTheme}
      chromeRight={
        <>
          {displayName && <span className={book.chromeUser}>{displayName}</span>}
          <button className={book.chromeBtn} onClick={() => void handleSignOut()}>sign out</button>
        </>
      }
      left={
        <BookPage side="left" flipping={Boolean(turningConceptId)}>
          {turningConceptId && STORIES[turningConceptId] && (
            <div className={s.chapterTurnLeft} aria-live="polite">
              <div className={s.chapterTurnVignette}>
                <ConceptVignette id={turningConceptId} />
              </div>
              <span className={s.chapterTurnKicker}>opening chapter</span>
              <p className={s.chapterTurnStory}>{storyTeaser(turningConceptId, 140)}</p>
            </div>
          )}
          <div className={turningConceptId ? s.pageTurnHidden : undefined}>
          <StickerLayer
            stickers={dashboardStickers}
            editable={styleDrawerOpen}
            selectedSticker={selectedSticker}
            onPlace={handlePlaceSticker}
            onMove={handleMoveSticker}
            onRemove={handleRemoveSticker}
          />
          <button
            type="button"
            className={s.decorateBtn}
            onClick={() => setStyleDrawerOpen(open => !open)}
            aria-label="Decorate journal"
          >
            <Sparkles size={14} strokeWidth={1.75} />
            <span>decorate</span>
          </button>
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

          {/* ACT table of contents — left page */}
          <div className={s.todayPlan}>
            <div className={s.actTocHead}>
              <span className={s.actTocKicker}>ACT Math</span>
              <h2 className={s.actTocTitle}>Contents</h2>
            </div>

            <div className={s.actTocScroll}>
              {ACT_TOC_SECTIONS.map(section => (
                <div key={section.id} className={s.actTocSection}>
                  <div className={s.actTocSectionTitle}>{section.title}</div>
                  <ul className={s.actTocList}>
                    {section.conceptIds.map(id => {
                      const isSpark = id === sparkId
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            className={`${s.actTocItem} ${isSpark ? s.actTocSpark : ''}`}
                            onClick={() => openChapter(id)}
                            disabled={Boolean(turningConceptId)}
                          >
                            {isSpark && <span className={s.actTocStar} aria-hidden>★</span>}
                            <span>{actConceptLabel(id)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {isAdmin && (
              <button type="button" className={s.adminQuietLink} onClick={() => navigate('/admin')}>
                admin
              </button>
            )}
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
              <button className={`${s.tab} ${todayMode ? s.tabActive : ''}`} onClick={closePanel}>Home</button>
              <button className={`${s.tab} ${s.tabMap} ${(gpsMode || routeMode) ? s.tabActive : ''}`} onClick={openGps}>Map</button>
              <button className={`${s.tab} ${worksheetMode ? s.tabActive : ''}`} onClick={openWorksheet}>Homework</button>
              <button className={`${s.tab} ${homeworkMode ? s.tabActive : ''}`} onClick={openHomework}>Solver</button>
              <button className={`${s.tab} ${notesMode ? s.tabActive : ''}`} onClick={openNotes}>Notes</button>
            </div>
          }
        >
          {turningConceptId && STORIES[turningConceptId] && (
            <div className={s.chapterTurnRight} aria-live="polite">
              <span className={s.chapterTurnName}>{STORIES[turningConceptId].conceptName}</span>
              <p className={s.chapterTurnContinued}>{storyTeaser(turningConceptId, 100)}</p>
              <span className={s.chapterTurnHint}>turning page…</span>
            </div>
          )}
          <div className={turningConceptId ? s.pageTurnHidden : undefined}>
          <PageFlipTransition viewKey={view}>
            {todayMode ? (
              <>
                <div className={book.runningHead}>ACT notebook</div>

                {weakness ? (
                  <button type="button" className={s.sparkCard} onClick={goChallenge}>
                    <span className={s.sparkEyebrow}>today’s spark ★</span>
                    <span className={s.sparkName}>{weaknessLabel}</span>
                    <span className={s.sparkGo}>play →</span>
                  </button>
                ) : (
                  <button type="button" className={s.sparkCard} onClick={openGps}>
                    <span className={s.sparkEyebrow}>pick a topic</span>
                    <span className={s.sparkName}>Your ACT map is ready</span>
                    <span className={s.sparkGo}>open map →</span>
                  </button>
                )}

                <div className={s.dashTools}>
                  <CoverNavItem
                    icon={<FileUp size={19} strokeWidth={1.75} />}
                    label="Homework"
                    sub="Drop a worksheet"
                    active={worksheetMode}
                    onClick={openWorksheet}
                  />
                  <CoverNavItem
                    icon={<Wand2 size={19} strokeWidth={1.75} />}
                    label="Solver"
                    sub="Stuck on a problem?"
                    active={homeworkMode}
                    onClick={openHomework}
                  />
                  <CoverNavItem
                    icon={<NotebookPen size={19} strokeWidth={1.75} />}
                    label="Notes"
                    sub={bookmarkedQuestions.length ? `${bookmarkedQuestions.length} saved ★` : 'Tutor + saved'}
                    active={notesMode}
                    onClick={openNotes}
                  />
                  <CoverNavItem
                    icon={<Compass size={19} strokeWidth={1.75} />}
                    label="Map"
                    sub="All ACT topics"
                    active={gpsMode || routeMode}
                    onClick={openGps}
                  />
                </div>

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
              </>
            ) : routeMode && targetParam ? (
              <div className={s.panelPage}>
                <div className={s.panelPageHeader}>
                  <button className={s.panelBackBtn} onClick={closePanel}>← home</button>
                  <span className={s.panelTitle}>route</span>
                </div>
                <div className={s.panelContent}>
                  <DashboardRoutePanel targetId={targetParam} onBack={closePanel} />
                </div>
              </div>
            ) : notesMode ? (
              <div className={s.panelPage}>
                <div className={s.panelPageHeader}>
                  <button className={s.panelBackBtn} onClick={closePanel}>← home</button>
                  <span className={s.panelTitle}>notes</span>
                </div>
                <div className={s.panelContent}>
                  <DashboardNotesPanel
                    uid={uid}
                    bookmarkedIds={bookmarkedQuestions}
                    onBookmarksChange={setBookmarkedQuestions}
                  />
                </div>
              </div>
            ) : worksheetMode ? (
              <div className={s.panelPage}>
                <div className={s.panelPageHeader}>
                  <button className={s.panelBackBtn} onClick={closePanel}>← home</button>
                  <span className={s.panelTitle}>homework</span>
                </div>
                <div className={s.panelContent}>
                  <DashboardWorksheetPanel />
                </div>
              </div>
            ) : homeworkMode ? (
              <div className={s.panelPage}>
                <div className={s.panelPageHeader}>
                  <button className={s.panelBackBtn} onClick={closePanel}>← home</button>
                  <span className={s.panelTitle}>solver</span>
                </div>
                <div className={s.solverBody}>
                  <textarea
                    className={s.solverInput}
                    placeholder="Paste a problem…"
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
                    Get hints →
                  </button>
                </div>
              </div>
            ) : gpsMode ? (
              <div className={s.panelPage}>
                <div className={s.panelPageHeader}>
                  <button className={s.panelBackBtn} onClick={closePanel}>← home</button>
                  <span className={s.panelTitle}>ACT map</span>
                </div>
                <div className={`${s.panelContent} ${s.mapInset}`}>
                  <ActTrailMap sparkId={sparkId} onOpenLesson={openChapter} />
                </div>
              </div>
            ) : null}
          </PageFlipTransition>
          </div>
        </BookPage>
      }
    />
    <JournalStyleDrawer
      open={styleDrawerOpen}
      onClose={() => { setStyleDrawerOpen(false); setSelectedSticker(null) }}
      uid={uid}
      theme={dashboardTheme}
      stickers={dashboardStickers}
      customStickers={customStickers}
      selectedSticker={selectedSticker}
      onThemeChange={handleThemeChange}
      onSelectSticker={setSelectedSticker}
      onClearStickers={handleClearStickers}
      onCustomStickersChange={handleCustomStickersChange}
    />
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
