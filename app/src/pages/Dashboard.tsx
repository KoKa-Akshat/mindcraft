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
import { type CurriculumTrack } from '../lib/curriculumTrack'
import type { Confidence } from '../lib/bridgePractice'
import SessionCallCard from '../components/SessionCallCard'
import DashboardNotesPanel from '../components/DashboardNotesPanel'
import ActEmojiMap from '../components/canvas/ActEmojiMap'
import WorkStudio from '../components/canvas/WorkStudio'
import WizardMascot from '../components/canvas/WizardMascot'
import StickersShelf from '../components/book/StickersShelf'
import {
  coverStickerById,
  DEFAULT_MASCOT_STICKER_ID,
  loadMascotStickerId,
  parseStickerPlan,
  saveMascotStickerId,
  type StickerPlan,
} from '../lib/coverStickers'
import TocSectionMark from '../components/canvas/TocSectionMark'
import NotebookIntro, { introAlreadySeen } from '../components/canvas/NotebookIntro'
import CoverLanding, { clearCoverSeen, coverAlreadySeen } from '../components/book/CoverLanding'
import { ACT_TOC_SECTIONS, actConceptLabel, type ActTocSection } from '../lib/actToc'
import { storyArtFor } from '../lib/storyArt'
import { CalendarCheck, Lock, MessageCircle, LogOut, Map, PenLine, NotebookPen, Sparkles } from 'lucide-react'
import { fetchKnowledgeGraph } from '../lib/graphCache'
import { STATUS_COLOR } from '../lib/learningPathGraph'
import WeeklyReviewPicker from '../components/WeeklyReviewPicker'
import {
  nextUnlockLabel,
  weekKey,
  type WeeklyPracticePaper,
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
 * decorative, scattered across the stage's own dead corner whitespace,
 * behind the Contents roadmap and the rest of the real UI (low z-index,
 * pointer-events: none, small, low-opacity: see .mcBlock in the CSS
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
  // margin past the last lane before the stage's rounded corner (y 90%+),
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
 * `mastery` the Knowledge Map (ActEmojiMap) reads off
 * GET /knowledge-graph/{uid}, same signal, same status vocabulary
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

/* ── Contents lane grid math (2026-08-05) ──────────────────────────────────
 * Replaces hand-guessed `nth-child` span rules in the CSS module (which
 * hardcoded which cell gets bigger to fill dead space for TODAY's specific
 * per-lane concept counts) with a real computation off each lane's actual
 * `conceptIds.length`. Three pieces:
 *   1. `tocColumnsFor(count)` — how many columns a lane's thumbnail grid
 *      should use: a near-square layout (ceil(sqrt(count))), clamped to a
 *      legible range, but never MORE columns than items (so a 2-item lane
 *      gets a clean 2-column single row, not 2 items adrift in 6 columns).
 *   2. `tocTrailingSpans(remainder, columns)` — when `count` doesn't divide
 *      evenly by `columns`, the leftover row's cells get computed
 *      `grid-column: span N` values that sum back to `columns`, so the last
 *      row always fills edge-to-edge (Akshat's "lone leftover becomes a
 *      clean 1x2" ask) instead of sitting next to dead cells.
 *   3. `tocLaneSpanPair(colsA, colsB)` — the two lanes drawn on the same row
 *      of the outer 12-column `.horizontalToc` grid split that width
 *      proportional to how many thumbnail columns each actually needs, so a
 *      lane with fewer concepts doesn't inherit a wide track sized for its
 *      neighbor. (Verified this reproduces the previously hand-tuned 5/7
 *      split on today's live counts — it's the same visual result, just
 *      derived instead of guessed, and it moves when the counts do.)
 */
function tocColumnsFor(count: number): number {
  if (count <= 0) return 1
  if (count <= 4) return count
  // Prefer 4-across tiles (Pinterest-calm) over dense 5–6 col grids.
  const ideal = Math.ceil(Math.sqrt(count))
  return Math.min(4, Math.max(3, ideal))
}

function tocTrailingSpans(remainder: number, columns: number): number[] {
  if (remainder <= 0) return []
  const base = Math.floor(columns / remainder)
  const extra = columns - base * remainder
  return Array.from({ length: remainder }, (_, i) => base + (i < extra ? 1 : 0))
}

type TocLaneLayout = {
  /** Thumbnail columns for this lane's own track. */
  columns: number
  /** grid-column span (out of 12) for this lane on the outer .horizontalToc grid. */
  laneSpan: number
  /** Index (0-based) of the first concept in the incomplete trailing row, or null if none. */
  lastRowStart: number | null
  /** grid-column span per node in the trailing row, aligned to lastRowStart. */
  trailingSpans: number[]
}

function tocLaneSpanPair(colsA: number, colsB: number): [number, number] {
  const total = colsA + colsB
  if (total <= 0) return [6, 6]
  const spanA = Math.min(10, Math.max(2, Math.round((colsA / total) * 12)))
  return [spanA, 12 - spanA]
}

/** Computes the full per-lane grid layout from the real section list, once. */
function computeTocLaneLayouts(sections: readonly ActTocSection[]): Record<string, TocLaneLayout> {
  const columnsBySection = sections.map(sec => tocColumnsFor(sec.conceptIds.length))
  const layouts: Record<string, TocLaneLayout> = {}
  for (let i = 0; i < sections.length; i += 2) {
    const colsA = columnsBySection[i]
    const colsB = columnsBySection[i + 1]
    const spans = colsB !== undefined ? tocLaneSpanPair(colsA, colsB) : [12, 12]
    for (let offset = 0; offset < 2 && i + offset < sections.length; offset++) {
      const section = sections[i + offset]
      const count = section.conceptIds.length
      const columns = columnsBySection[i + offset]
      const remainder = columns > 0 ? count % columns : 0
      layouts[section.id] = {
        columns,
        laneSpan: spans[offset],
        lastRowStart: remainder !== 0 ? count - remainder : null,
        trailingSpans: tocTrailingSpans(remainder, columns),
      }
    }
  }
  return layouts
}

/** Computed once at module load — ACT_TOC_SECTIONS is a fixed module-level
 *  array, so this never needs to be recomputed per render/component instance. */
const TOC_LANE_LAYOUTS = computeTocLaneLayouts(ACT_TOC_SECTIONS)

export default function Dashboard({
  preview = false,
  viewAsStudentId,
  embedded = false,
  frameEmbed = false,
  onExit,
}: {
  preview?: boolean
  /** Tutor/admin live view of a linked student's dashboard. */
  viewAsStudentId?: string
  /** Render inside tutor dash main (stays on /tutor; local Home/Map/Work/Notes). */
  embedded?: boolean
  /** True when loaded inside an iframe (?embed=1). */
  frameEmbed?: boolean
  onExit?: () => void
}) {
  const user = useUser()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const viewingAs = !!viewAsStudentId
  const data = useStudentData(user, { viewAsUid: viewAsStudentId })
  const uid = viewAsStudentId || user?.uid || ''
  const homeBase = preview
    ? '/try/dashboard'
    : viewingAs && !embedded
      ? `/tutor/student/${viewAsStudentId}${frameEmbed ? '?embed=1' : ''}`
      : '/dashboard'
  const coverInUrl = searchParams.get('cover') === '1'

  const [diagChecked, setDiagChecked] = useState(preview || viewingAs)
  const [weakness, setWeakness] = useState<NextConcept | null>(null)
  const [learn, setLearn] = useState<NextConcept | null>(null)
  const [curriculumTrack, setCurriculumTrack] = useState<CurriculumTrack | null>(null)
  const [recLoading, setRecLoading] = useState(!preview)
  const [solverText, setSolverText] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<string[]>([])
  // Cover is a real history step (?cover=1) so browser Back returns to the
  // shelf — not out to the marketing site.
  const [showCover, setShowCover] = useState(() => (
    typeof window !== 'undefined'
    && !preview
    && !viewingAs
    && (new URLSearchParams(window.location.search).get('cover') === '1' || !coverAlreadySeen())
  ))
  const [showIntro, setShowIntro] = useState(() => (
    typeof window !== 'undefined' && !preview && !viewingAs && !introAlreadySeen()
  ))

  // Keep cover ↔ URL in sync (Back/Forward + first paint).
  useEffect(() => {
    if (preview || viewingAs) return
    if (coverInUrl) {
      // Back onto the shelf = cover is "unread" again this session.
      clearCoverSeen()
      setShowCover(true)
      return
    }
    if (coverAlreadySeen()) setShowCover(false)
  }, [coverInUrl, preview, viewingAs])

  // Stamp ?cover=1 when the shelf is up so this visit is a history entry.
  useEffect(() => {
    if (preview || viewingAs || !showCover || coverInUrl) return
    const next = new URLSearchParams(searchParams)
    next.set('cover', '1')
    setSearchParams(next, { replace: true })
  }, [showCover, coverInUrl, preview, viewingAs, searchParams, setSearchParams])

  function openCoverBook() {
    setShowCover(false)
    const next = new URLSearchParams(searchParams)
    next.delete('cover')
    // Push (not replace) so Back restores ?cover=1 → CoverLanding.
    setSearchParams(next, { replace: false })
  }
  const [tutorMeetUrl, setTutorMeetUrl] = useState<string | null>(null)
  const [manjushreeGlow, setManjushreeGlow] = useState(false)
  const [conceptProgress, setConceptProgress] = useState<Record<string, { mastery: number; status: string; eventCount: number }>>({})
  const [embedView, setEmbedView] = useState<'home' | 'map' | 'work' | 'notes'>('home')
  const [showWeeklyPicker, setShowWeeklyPicker] = useState(false)

  const rawView = embedded ? embedView : (searchParams.get('view') ?? 'home')
  const view = (
    rawView === 'today' || rawView === 'route' ? 'home'
    : rawView === 'gps' ? 'map'
    : rawView === 'homework' || rawView === 'worksheet' ? 'work'
    : rawView === 'saved' ? 'notes'
    : rawView
  ) as 'home' | 'map' | 'work' | 'notes'

  function withEmbed(path: string) {
    if (!frameEmbed || !viewingAs) return path
    if (path.includes('embed=1')) return path
    return path.includes('?') ? `${path}&embed=1` : `${path}?embed=1`
  }

  function openHome() {
    if (embedded) { setEmbedView('home'); return }
    navigate(withEmbed(homeBase.split('?')[0]), { replace: true })
  }
  function openMap() {
    if (embedded) { setEmbedView('map'); return }
    navigate(withEmbed(`${homeBase.split('?')[0]}?view=map`), { replace: true })
  }
  function openWork() {
    if (embedded) { setEmbedView('work'); return }
    navigate(withEmbed(`${homeBase.split('?')[0]}?view=work`), { replace: true })
  }
  function openNotes() {
    if (embedded) { setEmbedView('notes'); return }
    navigate(withEmbed(`${homeBase.split('?')[0]}?view=notes`), { replace: true })
  }

  function openChapter(conceptId: string) {
    playTap()
    if (viewingAs) {
      openMap()
      return
    }
    if (preview) {
      navigate(`/try/story/${encodeURIComponent(conceptId)}`)
      return
    }
    navigate(`/concept/${encodeURIComponent(conceptId)}`, {
      state: { fromDashboard: true },
    })
  }

  function launchSolver() {
    if (viewingAs) return
    if (preview) {
      window.location.href = 'https://mindcraft-marketing-site.web.app/#intake'
      return
    }
    const text = solverText.trim().slice(0, SOLVER_MAX_CHARS)
    if (!text) return
    navigate('/practice', { state: { problemText: text } })
  }

  async function handleSignOut() {
    if (viewingAs) {
      if (onExit) { onExit(); return }
      navigate('/tutor')
      return
    }
    if (preview) {
      try {
        sessionStorage.removeItem('mc-demo-mode')
        sessionStorage.removeItem('mc-demo-diagnostic')
      } catch { /* ignore */ }
      window.location.href = 'https://mindcraft-marketing-site.web.app/'
      return
    }
    clearCoverSeen()
    try { await signOut(auth) } catch { /* ignore */ }
    navigate('/login')
  }

  useEffect(() => {
    if (!uid || preview) {
      setStickerPlan('testing')
      return
    }
    let cancelled = false
    void getDoc(doc(db, 'users', uid))
      .then(snap => {
        if (!cancelled) setStickerPlan(parseStickerPlan(snap.data()?.stickerPlan))
      })
      .catch(() => { if (!cancelled) setStickerPlan('testing') })
    return () => { cancelled = true }
  }, [uid, preview])

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
    if (preview || viewingAs || !user?.uid) return
    getUserRole(user.uid).then(role => setIsAdmin(role === 'admin'))
  }, [user?.uid, preview, viewingAs])

  // Contents roadmap completion signal: same GET /knowledge-graph/{uid} the
  // Map view reads (see graphCache.ts), so "lit up" here means the same
  // per-concept mastery/status the rest of the app already shows.
  useEffect(() => {
    if (preview || !uid) return
    let cancelled = false
    void fetchKnowledgeGraph(uid).then(kg => {
      if (cancelled || !kg) return
      const nodes = (kg.nodes ?? []) as Array<{
        id?: unknown
        mastery?: unknown
        status?: unknown
        eventCount?: unknown
        event_count?: unknown
      }>
      const next: Record<string, { mastery: number; status: string; eventCount: number }> = {}
      for (const n of nodes) {
        if (typeof n.id !== 'string') continue
        const events = typeof n.eventCount === 'number'
          ? n.eventCount
          : typeof n.event_count === 'number'
            ? n.event_count
            : 0
        next[n.id] = {
          mastery: typeof n.mastery === 'number' ? n.mastery : 0,
          status: typeof n.status === 'string' ? n.status : 'untouched',
          eventCount: events,
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
    if (preview || viewingAs) {
      setDiagChecked(true)
      return
    }
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
  }, [user.uid, navigate, searchParams, preview, viewingAs])

  const displayName = data.displayName ?? user?.email?.split('@')[0] ?? ''
  const sparkId = weakness?.conceptId ?? null
  /** Weak spot first, else learn-next — same signal the Map spark uses. */
  const nextTopic = weakness ?? learn

  const weeklyReviewIds = useMemo(
    () => ACT_TOC_SECTIONS[0]?.conceptIds.slice(0, 2) ?? [],
    [],
  )
  // Lock is weekKey-keyed against the student's completion flag only.
  // The topic picker builds (and caches) the paper on Start.
  const thisWeekKey = useMemo(() => weekKey(), [])

  const [stickersOpen, setStickersOpen] = useState(false)
  const [mascotId, setMascotId] = useState(() => loadMascotStickerId())
  const [stickerPlan, setStickerPlan] = useState<StickerPlan>('testing')
  const mascot = coverStickerById(mascotId) ?? coverStickerById(DEFAULT_MASCOT_STICKER_ID)!
  const wizardLine = mascot.blurb

  // Locked once the student has finished this week's paper (weekKey-keyed
  // completion flag, self-written by the student's own browser same as
  // diagnosticCompleted, see practiceState.ts). Stays unlocked the whole
  // week up until then; re-locks only on completion, not on a timer.
  const paperLocked = data.weeklyPaperCompletedWeek === thisWeekKey
  const paperUnlockLabel = useMemo(() => nextUnlockLabel(), [])
  const showWeeklyCta = !recLoading

  function openWeeklyReview() {
    if (viewingAs) {
      openMap()
      return
    }
    if (preview) {
      navigate('/try/manjushree')
      return
    }
    if (paperLocked) {
      openMap()
      return
    }
    setShowWeeklyPicker(true)
  }

  /** Guided Weekly Review: story → formula → questions per lit topic. */
  function startWeeklyPlaythrough(paper: WeeklyPracticePaper) {
    setShowWeeklyPicker(false)
    if (!paper.questionIds.length) {
      openMap()
      return
    }
    navigate('/practice', { state: { weeklyWalkthrough: true } })
  }

  // Cover first — before the diagnostic loading gate — so login lands on the
  // notebook cover, not a spinner or Contents.
  if (showCover && !viewingAs) {
    return (
      <CoverLanding
        accountName={displayName}
        onOpen={openCoverBook}
      />
    )
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
      {viewingAs && !frameEmbed && !embedded && (
        <div
          style={{
            position: 'fixed',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            borderRadius: 999,
            background: 'rgba(20,58,46,.92)',
            color: '#f4efe2',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            boxShadow: '0 10px 28px rgba(20,58,46,.22)',
          }}
        >
          <span>Live student dash · {displayName || 'student'}</span>
          <button
            type="button"
            onClick={() => (onExit ? onExit() : navigate('/tutor'))}
            style={{
              border: '1px solid rgba(244,239,226,.35)',
              background: 'transparent',
              color: '#f4efe2',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Back to tutor
          </button>
        </div>
      )}
      {!viewingAs && (
      <button
        type="button"
        onClick={() => navigate(preview ? '/try/manjushree' : '/manjushree')}
        title="?"
        aria-label="A quiet corner of the notebook"
        className={s.secretPortal}
        data-glow={manjushreeGlow ? '1' : '0'}
      />
      )}
      {showIntro && (
        <NotebookIntro onContinue={() => setShowIntro(false)} />
      )}

      <div className={`${s.canvasDesk} ${embedded || frameEmbed ? s.canvasDeskFrameEmbed : ''}`}>
        {/* ONE hero bar, ONE row (was three stacked bands: nav row,
           "Contents" + wizard row, yellow spark banner)  -  merged per
           Akshat's brief so logo, section nav, the wizard sprite, today's
           spark CTA, and the username/sign-out all read as one continuous
           strip, not two internal bands. Rendered once, outside the view
           switch below, so it appears identically on Home/Map/Work/Notes
            -  not just Contents. .heroMiddle is the flexible zone (wizard +
           spark) that absorbs width pressure; the wordmark, nav, and user
           block hold their size. Below 720px it wraps onto extra lines
           rather than truncating content. The wizard quote is plain text
           beside the sticker (no speech-bubble chrome). */}
        <header className={s.heroBar}>
          <button
            type="button"
            className={s.canvasWordmark}
            onClick={openHome}
            aria-label="Home"
            title="Home"
          >
            Mind<span className={s.canvasWordmarkCraft}>Craft</span>
          </button>
          <nav className={s.canvasNav} aria-label="Notebook sections">
            <button
              type="button"
              className={view === 'map' ? s.navActive : s.navBtn}
              onClick={openMap}
              aria-label="Map"
              title="Map"
            >
              <Map size={22} strokeWidth={2.25} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={view === 'work' ? s.navActive : s.navBtn}
              onClick={openWork}
              aria-label="Work"
              title="Work"
            >
              <PenLine size={22} strokeWidth={2.25} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={view === 'notes' ? s.navActive : s.navBtn}
              onClick={openNotes}
              aria-label="Notes"
              title="Notes"
            >
              <NotebookPen size={22} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </nav>
          <div className={s.heroMiddle}>
            <WizardMascot
              line={wizardLine}
              spriteSrc={mascot.src}
              onSpriteClick={viewingAs || preview ? undefined : () => setStickersOpen(true)}
              compact
            />
          </div>
          <div className={s.canvasUser}>
            {displayName && <span className={s.canvasUserName}>{displayName}</span>}
            <button
              type="button"
              className={s.signOut}
              onClick={() => void handleSignOut()}
              aria-label={viewingAs ? 'Back' : 'Sign out'}
              title={viewingAs ? 'Back' : 'Sign out'}
            >
              <LogOut size={18} strokeWidth={2.25} aria-hidden="true" />
            </button>
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
                    <ul className={s.ringLegend} aria-label="Status color guide">
                      <li><span className={s.ringSwatch} style={{ ['--swatch' as string]: STATUS_COLOR.mastered }} /> Mastered (✓)</li>
                      <li><span className={s.ringSwatch} style={{ ['--swatch' as string]: STATUS_COLOR.in_progress }} /> In progress</li>
                      <li><span className={s.ringSwatch} style={{ ['--swatch' as string]: STATUS_COLOR.struggling }} /> Needs work</li>
                      <li><span className={s.ringSwatch} style={{ ['--swatch' as string]: STATUS_COLOR.untouched }} /> Not started</li>
                    </ul>
                  </div>
                  <div className={s.homeTopActions}>
                    {nextTopic && !recLoading && (
                      <button
                        type="button"
                        className={s.nextTopicCard}
                        onClick={() => openChapter(nextTopic.conceptId)}
                        title={`Open ${nextTopic.label} and tackle questions`}
                      >
                        <Sparkles size={20} aria-hidden="true" />
                        <div>
                          <span className={s.weeklyCardEyebrow}>
                            {weakness ? 'Suggested next' : 'Learn next'}
                          </span>
                          <span className={s.weeklyCardTitle}>{nextTopic.label}</span>
                        </div>
                      </button>
                    )}
                    {showWeeklyCta && (
                      paperLocked ? (
                        <div className={s.weeklyCardLocked} aria-live="off">
                          <Lock size={18} aria-hidden="true" />
                          <div>
                            <span className={s.weeklyCardEyebrow}>This week</span>
                            <span className={s.weeklyCardTitle}>Done · {paperUnlockLabel}</span>
                          </div>
                        </div>
                      ) : (
                        <button type="button" className={s.weeklyCard} onClick={openWeeklyReview}>
                          <CalendarCheck size={22} aria-hidden="true" />
                          <div>
                            <span className={s.weeklyCardEyebrow}>This week</span>
                            <span className={s.weeklyCardTitle}>Weekly Review</span>
                          </div>
                        </button>
                      )
                    )}
                    {data.tutorId && data.parents.length > 0 ? (
                      <div className={s.iconSelectWrap}>
                        <MessageCircle size={14} className={s.iconSelectIcon} aria-hidden="true" />
                        <select
                          className={`${s.bookSessionLink} ${s.iconSelect}`}
                          defaultValue=""
                          aria-label="Message tutor or parent"
                          onChange={e => {
                            if (e.target.value) navigate(`/chat/${e.target.value}`)
                            e.target.value = ''
                          }}
                        >
                          <option value="" disabled>Message…</option>
                          <option value={data.tutorId}>Message Tutor</option>
                          {data.parents.map(p => (
                            <option key={p.id} value={p.id}>Message {p.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : data.tutorId ? (
                      <button
                        type="button"
                        className={s.bookSessionLink}
                        onClick={() => navigate(`/chat/${data.tutorId}`)}
                      >
                        <MessageCircle size={14} aria-hidden="true" />
                        <span>Message Tutor</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className={s.horizontalToc}>
                  {ACT_TOC_SECTIONS.map(section => {
                    const layout = TOC_LANE_LAYOUTS[section.id]
                    return (
                    <section
                      key={section.id}
                      className={s.tocLane}
                      data-lane={section.id}
                      style={{
                        background: section.wash,
                        ['--lane-accent' as string]: section.accent,
                        ['--lane-ink' as string]: section.ink,
                        ['--lane-span' as string]: String(layout.laneSpan),
                      }}
                    >
                      <header className={s.tocLaneHead}>
                        <TocSectionMark id={section.id} accent={section.accent} />
                        <h2 className={s.tocLaneTitle}>{section.title}</h2>
                      </header>
                      <div
                        className={s.tocTrack}
                        style={{ ['--lane-columns' as string]: String(layout.columns) }}
                      >
                        {section.conceptIds.map((id, index) => {
                          const progress = conceptProgress[id]
                          const mastery = Math.max(0, Math.min(1, progress?.mastery ?? 0))
                          const status = progress?.status ?? 'untouched'
                          const dotState = tocDotState(status)
                          const dotColor = STATUS_COLOR[status] ?? STATUS_COLOR.untouched
                          // Trailing-row cells (computed above, off the lane's real
                          // concept count) get a computed column span so the last
                          // row always fills edge-to-edge instead of leaving dead
                          // cells beside an arbitrarily-sized leftover box.
                          const trailingIndex = layout.lastRowStart === null ? -1 : index - layout.lastRowStart
                          const colSpan = trailingIndex >= 0 ? layout.trailingSpans[trailingIndex] : 1
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`${s.tocNode} ${id === sparkId ? s.tocNodeSpark : ''}`}
                              data-state={dotState}
                              style={{
                                ['--node-color' as string]: dotColor,
                                ['--mastery' as string]: String(mastery),
                                ...(colSpan > 1 ? { gridColumn: `span ${colSpan}` } : null),
                              }}
                              title={`${actConceptLabel(id)}: ${Math.round(mastery * 100)}% mastery`}
                              onClick={() => openChapter(id)}
                            >
                              <span className={s.tocNodeIcon} aria-hidden="true">
                                <img src={storyArtFor(id)} alt="" />
                                {dotState === 'complete' && <span className={s.tocNodeCheck}>✓</span>}
                              </span>
                              <span className={s.tocNodeName}>{actConceptLabel(id)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                    )
                  })}
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
                <ActEmojiMap
                  sparkId={searchParams.get('concept') || sparkId}
                  onOpenLesson={openChapter}
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

      {showWeeklyPicker && (
        <WeeklyReviewPicker
          weakness={weakness}
          learn={learn}
          reviewConceptIds={weeklyReviewIds}
          onClose={() => setShowWeeklyPicker(false)}
          onPlayThrough={startWeeklyPlaythrough}
        />
      )}

      {stickersOpen && (
        <StickersShelf
          plan={stickerPlan}
          activeId={mascotId}
          onClose={() => setStickersOpen(false)}
          onPickMascot={id => {
            setMascotId(id)
            saveMascotStickerId(id)
            setStickersOpen(false)
          }}
        />
      )}
    </>
  )
}
