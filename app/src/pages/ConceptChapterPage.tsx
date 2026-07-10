import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { PenLine } from 'lucide-react'
import conceptStoriesRaw from '../data/conceptStories.json'
import contextFramesRaw from '../data/questionContextFrames.json'
import { getQuestions, questionFormat } from '../lib/questionBank'
import { canonicalConceptId } from '../lib/conceptAliases'
import { useUser } from '../App'
import BookmarkButton from '../components/BookmarkButton'
import { loadDashboardPersonalization, toggleBookmark } from '../lib/dashboardPersonalization'
import { loadQuestionWork, saveQuestionWork } from '../lib/studentWork'
import { submitWorkEvidenceIfReady } from '../lib/workEvidence'
import { appendChapterWorkToJournal } from '../lib/chapterJournal'
import InteractiveWidget from '../components/InteractiveWidget'
import { buildStoryDisplay } from '../lib/storyDisplay'
import MathText from '../components/MathText'
import ScratchPad, { exportScratchImage, type LineOverlay } from '../components/ScratchPad'
import type { ScratchStrokeData } from '../types'
import ScratchTranscriptionPane, { type ScratchInkState } from '../components/ScratchTranscriptionPane'
import PingTutor from '../components/PingTutor'
import HighlightedStem from '../components/HighlightedStem'
import JarvisGuide from '../components/JarvisGuide'
import { useJournalGuide } from '../hooks/useJournalGuide'
import { insightsForSide } from '../lib/journalGuide'
import { fetchStoryModule, type StoryModule } from '../lib/storyModule'
import BookShell from '../components/book/BookShell'
import BookPage from '../components/book/BookPage'
import PageFlipTransition from '../components/book/PageFlipTransition'
import s from './ConceptChapterPage.module.css'

// ── Types ───────────────────────────────────────────────────────────────────

type CS = {
  conceptId: string
  conceptName: string
  story: string
  ingredientStories: Record<string, unknown>
}
const DB = conceptStoriesRaw as unknown as Record<string, CS>

type ContextFrame = {
  protagonist: string
  settingLine: string
  questionBridge: string
  diceFrame: string | null
  spinnerFrame: string | null
}
const FRAMES = contextFramesRaw as unknown as Record<string, ContextFrame>

// Resolve any short/legacy concept ID to the canonical ontology ID,
// then look up in DB (conceptStories.json keys = canonical IDs).
// Falls back to a synthetic story so the chapter page never hard-errors.
function resolveId(conceptId: string): string {
  return canonicalConceptId(conceptId)
}

// FRAME_ALIAS handles the few cases where frames use a different key than
// the canonical concept ID (e.g. frames use 'basic_probability', not
// 'probability'; 'representation_translation' instead of 'coordinate_geometry').
const FRAME_ALIAS: Record<string, string> = {
  coordinate_geometry: 'representation_translation',
  absolute_value:      'algebraic_manipulation',
}

function getFrame(rawId: string): ContextFrame | null {
  const id = resolveId(rawId)
  return FRAMES[id] ?? FRAMES[FRAME_ALIAS[rawId] ?? ''] ?? FRAMES[FRAME_ALIAS[id] ?? ''] ?? null
}

function makeSyntheticStory(name: string, conceptId: string): CS {
  return {
    conceptId,
    conceptName: name,
    story: `${name} is a foundational concept in mathematics. Work through the questions below to build your understanding — each one isolates a key idea so you can see exactly where your reasoning holds and where it needs sharpening.`,
    ingredientStories: {},
  }
}

function lookupStory(rawId: string): CS {
  const canonical = resolveId(rawId)
  return DB[canonical] ?? DB[rawId] ?? makeSyntheticStory(
    canonical.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    canonical,
  )
}

function storyTeaser(story: string, max = 220): string {
  if (!story || story.length <= max) return story
  const cut = story.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

// ── Cluster identity ─────────────────────────────────────────────────────────

type Cluster = 'algebra' | 'geometry' | 'functions' | 'data'

// Cluster accent per concept — keys must match canonical ontology concept ids.
// Source of truth: ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json
// See DASHBOARD_CONCEPT_ID_CONSISTENCY_FIX.md when adding/renaming concepts.
const CLUSTER_MAP: Record<string, Cluster> = {
  fractions_decimals: 'algebra',  ratios_proportions: 'algebra',
  percent_ratio: 'algebra',       order_of_operations: 'algebra',
  basic_equations: 'algebra',     linear_equations: 'algebra',
  linear_inequalities: 'algebra', systems_of_linear_equations: 'algebra',
  exponent_rules: 'algebra',      radical_expressions: 'algebra',
  absolute_value: 'algebra',      integer_operations: 'algebra',
  polynomial_operations: 'algebra', factors_multiples: 'algebra',
  number_properties: 'algebra',   rational_expressions: 'algebra',
  algebraic_manipulation: 'algebra', measurement_units: 'algebra',
  factoring_polynomials: 'algebra', polynomials: 'algebra',
  quadratic_equations: 'algebra',
  act_strategy: 'algebra', representation_translation: 'algebra',
  functions_basics: 'functions',  function_notation: 'functions',
  quadratic_functions: 'functions', exponential_functions: 'functions',
  logarithms: 'functions',        composite_inverse: 'functions',
  trigonometry_basics: 'functions', sequences_series: 'functions',
  logarithmic_functions: 'functions',
  applications_of_derivatives: 'functions', applications_of_integrals: 'functions',
  derivatives: 'functions', integrals: 'functions', limits_continuity: 'functions',
  right_triangle_geometry: 'geometry', triangles_similarity: 'geometry',
  circles: 'geometry',            coordinate_geometry: 'geometry',
  geometric_transformations: 'geometry', solid_geometry: 'geometry',
  area_volume: 'geometry', circles_geometry: 'geometry',
  lines_angles: 'geometry', triangles_congruence: 'geometry',
  conic_sections: 'geometry', vectors: 'geometry',
  statistics_basics: 'data',      probability: 'data',
  data_interpretation: 'data',    regression: 'data',
  counting_combinatorics: 'data', complex_numbers: 'data',
  matrices: 'data',
  quadratics: 'functions',
  quadratic: 'functions',
  statistics: 'data',
  trigonometry: 'functions',
  basic_probability: 'data', descriptive_statistics: 'data',
  inferential_statistics: 'data', probability_distributions: 'data',
}

const JOURNAL_PAPER = {
  bg: '#080e14',
  paper: '#f7f3ee',
  ink: '#1c1a17',
  dim: '#6f6a61',
  lineBg: 'rgba(29, 58, 138, 0.09)',
}

const CLUSTER_THEME = {
  algebra:   { ...JOURNAL_PAPER, accent: '#1d3a8a', chip: '#1d3a8a' },
  geometry:  { ...JOURNAL_PAPER, accent: '#1e5f8a', chip: '#1e5f8a' },
  functions: { ...JOURNAL_PAPER, accent: '#247a4d', chip: '#247a4d' },
  data:      { ...JOURNAL_PAPER, accent: '#7a2e26', chip: '#7a2e26' },
}

// ── Cluster glyphs ───────────────────────────────────────────────────────────

const GLYPH: Record<Cluster, React.ReactNode> = {
  algebra: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <line x1="40" y1="16" x2="40" y2="56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8"  y1="36" x2="72" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="12" cy="36" r="9"  stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="68" cy="36" r="9"  stroke="currentColor" strokeWidth="2" fill="none"/>
    </svg>
  ),
  geometry: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4"/>
      <polygon points="40,12 67,67 13,67" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
    </svg>
  ),
  functions: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <line x1="8" y1="72" x2="72" y2="72" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="8"  x2="8"  y2="72" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 70 C22 70 18 18 40 23 C56 26 52 62 72 57" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <circle cx="40" cy="23" r="3.5" fill="currentColor"/>
    </svg>
  ),
  data: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden>
      <line x1="8" y1="72" x2="72" y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="8" y1="8"  x2="8"  y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="8" y1="68" x2="72" y2="16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.55"/>
      {[{x:16,y:60},{x:26,y:52},{x:36,y:44},{x:46,y:36},{x:56,y:26},{x:66,y:20}].map((p,i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="currentColor"/>
      ))}
    </svg>
  ),
}

// ── Spread spec — left + right pages flip together like the dashboard book ──
//
// Question spreads used to be TWO spreads (a question page, then a separate
// "your work" scratch page) — the disjointed two-panel flow this rebuild
// removes. Each question is now ONE spread: the left page is a quiet scene
// companion (recap + progress), the right page is the full combined entry —
// story bridge, stem, widget, choices, hints, and a full-page annotation
// surface, all on one sheet.
type SpreadSide =
  | { kind: 'cover' }
  | { kind: 'story'; paras: string[]; isFirst?: boolean }
  | { kind: 'context'; qIdx: number }
  | { kind: 'question'; qIdx: number }

type Spread = { left: SpreadSide; right: SpreadSide }

function buildSpreads(text: string, qCount: number): Spread[] {
  const paras = text.split('\n').map(p => p.trim()).filter(p => p.length > 15)
  const spreads: Spread[] = []

  // Opening spread: cover (left) + first story beat (right)
  spreads.push({
    left: { kind: 'cover' },
    right: paras[0]
      ? { kind: 'story', paras: [paras[0]], isFirst: true }
      : { kind: 'story', paras: ['Your chapter opens here.'], isFirst: true },
  })

  // One short paragraph per page — story continues across spreads
  for (let i = 1; i < paras.length; i += 2) {
    spreads.push({
      left: { kind: 'story', paras: [paras[i]] },
      right: paras[i + 1]
        ? { kind: 'story', paras: [paras[i + 1]] }
        : { kind: 'story', paras: ['The scene holds. Turn the page when you are ready.'] },
    })
  }

  for (let q = 0; q < qCount; q++) {
    spreads.push({
      left: { kind: 'context', qIdx: q },
      right: { kind: 'question', qIdx: q },
    })
  }

  return spreads
}

function folioNum(spreadIdx: number, side: 'left' | 'right'): number {
  return spreadIdx * 2 + (side === 'left' ? 1 : 2)
}

// ── Choice text formatter — clean up "33.333 ... %" etc. ─────────────────────

function fmtChoice(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*\.\.\.\s*(\d*)/g, '$1…$2')
    .replace(/\s+(%|°)/g, '$1')
    .replace(/(\d)\s+\/\s+(\d)/g, '$1/$2')
    .trim()
}

// ── Calculator ───────────────────────────────────────────────────────────────

function Calculator() {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState<number | null>(null)
  const [op, setOp] = useState<string | null>(null)
  const [fresh, setFresh] = useState(true)

  const press = (val: string) => {
    if ('0123456789.'.includes(val)) {
      if (val === '.' && display.includes('.')) return
      setDisplay(d => fresh ? val === '.' ? '0.' : val : d === '0' ? val : d + val)
      setFresh(false)
    } else if (val === '←') {
      setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0')
    } else if (val === 'C') {
      setDisplay('0'); setPrev(null); setOp(null); setFresh(true)
    } else if (val === '±') {
      setDisplay(d => d === '0' ? '0' : d.startsWith('-') ? d.slice(1) : '-' + d)
    } else if (val === '√') {
      const n = parseFloat(display)
      setDisplay(n < 0 ? 'Error' : String(parseFloat(Math.sqrt(n).toFixed(8))))
      setFresh(true)
    } else if (['+', '−', '×', '÷'].includes(val)) {
      setPrev(parseFloat(display)); setOp(val); setFresh(true)
    } else if (val === '=' && prev !== null && op) {
      const n = parseFloat(display)
      let r: number
      if (op === '+') r = prev + n
      else if (op === '−') r = prev - n
      else if (op === '×') r = prev * n
      else r = n === 0 ? NaN : prev / n
      setDisplay(isFinite(r) ? String(parseFloat(r.toFixed(10))) : 'Error')
      setPrev(null); setOp(null); setFresh(true)
    }
  }

  const BTNS = [
    ['C', '←', '√', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '−'],
    ['1', '2', '3', '+'],
    ['±', '0', '.', '='],
  ]

  return (
    <div className={s.calcPanel}>
      <div className={s.calcDisplay}>{display}</div>
      {BTNS.map((row, ri) => (
        <div key={ri} className={s.calcRow}>
          {row.map(btn => (
            <button
              key={btn}
              className={`${s.calcBtn} ${btn === '=' ? s.calcEq : ''} ${['C','←','√','÷','×','−','+'].includes(btn) ? s.calcOp : ''}`}
              onClick={() => press(btn)}
            >
              {btn}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ConceptChapterPage() {
  const { conceptId = '' } = useParams<{ conceptId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useUser()
  const fromDashboard = Boolean((location.state as { fromDashboard?: boolean } | null)?.fromDashboard)
  const canonicalId = resolveId(conceptId)

  const cs = lookupStory(conceptId)
  const cluster = CLUSTER_MAP[conceptId] ?? 'algebra'
  const theme = CLUSTER_THEME[cluster]
  const glyph = GLYPH[cluster]

  const questions = useMemo(() => {
    if (!conceptId) return []
    const qs = [...getQuestions(conceptId, 1, 4), ...getQuestions(conceptId, 2, 4)]
    const seen = new Set<string>()
    return qs.filter(q => { if (seen.has(q.question)) return false; seen.add(q.question); return true }).slice(0, 4)
  }, [conceptId])

  const spreads = useMemo(
    () => buildSpreads(cs.story, Math.min(questions.length, 4)),
    [cs.story, questions.length],
  )

  // Story is shown once per concept — return visits skip straight to the questions.
  const storySeenKey = `mc-story-seen-${resolveId(conceptId)}`
  const [hasSeenStory] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem(storySeenKey))

  const firstQuestionSpread = useMemo(
    () => spreads.findIndex(sp => sp.left.kind === 'context'),
    [spreads],
  )
  const [spreadIdx, setSpreadIdx] = useState(() => (
    hasSeenStory && firstQuestionSpread > 0 ? firstQuestionSpread : 0
  ))

  // Mark the story as seen once the student reaches any question spread.
  useEffect(() => {
    const sp = spreads[spreadIdx]
    if (sp?.right.kind === 'question' && !localStorage.getItem(storySeenKey)) {
      localStorage.setItem(storySeenKey, '1')
    }
  }, [spreadIdx, spreads, storySeenKey])
  const [dir, setDir] = useState<'f' | 'b'>('f')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({})
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [scratchStrokes, setScratchStrokes] = useState<Record<number, ScratchStrokeData>>({})
  const [scratchInk, setScratchInk] = useState<Record<number, ScratchInkState>>({})
  const [debugOutlines, setDebugOutlines] = useState(false)
  const [scratchRev, setScratchRev] = useState<Record<number, number>>({})
  // hintsShownPerQ tracks how many hints have been revealed per question index
  const [hintsShownPerQ, setHintsShownPerQ] = useState<Record<number, number>>({})
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now())
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<string[]>([])
  const hydratedWorkRef = useRef<Set<string>>(new Set())
  const [showCalc, setShowCalc] = useState(false)
  // Full-page "write anywhere" annotation mode — off by default so choices,
  // hints, and the submit button stay clickable; the pencil toggle turns the
  // entire page into a writing surface without a separate scratch page.
  const [writeMode, setWriteMode] = useState(false)
  useEffect(() => { setWriteMode(false) }, [spreadIdx])
  const journaledRef = useRef<Set<string>>(new Set())

  // Story module — the same Groq reskin practice sessions use, so the chapter's
  // questions are told inside the chapter's story instead of dropped in raw.
  // Fail-soft: null keeps the plain bank stems.
  const [storyMod, setStoryMod] = useState<StoryModule | null>(null)
  // Stems the student has already seen in story form — never revert those,
  // and never swap a stem under a question they already started answering.
  const storyAppliedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (questions.length === 0 || !cs.story) return
    let cancelled = false
    void fetchStoryModule(canonicalId, cs.conceptName, cs.story, questions)
      .then(mod => { if (!cancelled && mod) setStoryMod(mod) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalId, questions])

  const currentSpread = spreads[spreadIdx]

  useEffect(() => {
    if (!user?.uid) return
    void loadDashboardPersonalization(user.uid).then(p => setBookmarkedQuestions(p.bookmarkedQuestions))
  }, [user?.uid])

  const spec = currentSpread?.right.kind === 'question'
    ? { kind: 'question' as const, qIdx: currentSpread.right.qIdx }
    : { kind: 'other' as const, qIdx: -1 }

  const journalQIdx = currentSpread?.right.kind === 'question' ? currentSpread.right.qIdx : -1

  useEffect(() => {
    if (journalQIdx >= 0) setQuestionStartedAt(Date.now())
  }, [journalQIdx, spreadIdx])

  const activeQuestion = journalQIdx >= 0 ? questions[journalQIdx] : null
  const activeStem = useMemo(
    () => (activeQuestion ? buildStoryDisplay(activeQuestion).stem : ''),
    [activeQuestion],
  )
  const transcribing = Boolean(
    journalQIdx >= 0
    && (scratchStrokes[journalQIdx]?.strokes?.length ?? 0) > 0
    && !(scratchInk[journalQIdx]?.workLines?.some(l => l.text.trim() || l.latex.trim())),
  )

  const journalGuide = useJournalGuide({
    conceptId: canonicalId,
    questionText: activeStem,
    strokeData: journalQIdx >= 0 ? scratchStrokes[journalQIdx] : null,
    inkState: journalQIdx >= 0 ? scratchInk[journalQIdx] : null,
    transcribing,
    answerSelected: journalQIdx >= 0 ? answers[journalQIdx] != null : false,
    questionStartedAt,
  })

  useEffect(() => {
    if (!user?.uid || spec.kind !== 'question') return
    const q = questions[spec.qIdx]
    if (!q?.id || hydratedWorkRef.current.has(q.id)) return
    let cancelled = false
    void loadQuestionWork(user.uid, q.id).then(doc => {
      if (cancelled || !doc) {
        if (q.id) hydratedWorkRef.current.add(q.id)
        return
      }
      const qIdx = spec.qIdx
      if (doc.scratchStrokes) {
        setScratchStrokes(s => ({ ...s, [qIdx]: doc.scratchStrokes! }))
      }
      if (doc.scratchImage) {
        setNotes(n => ({ ...n, [qIdx]: doc.scratchImage! }))
      }
      if (doc.workLines?.length || doc.scratchTranscription) {
        setScratchInk(s => ({
          ...s,
          [qIdx]: {
            workLines: doc.workLines ?? [],
            transcription: doc.scratchTranscription ?? { text: '', latex: '', editedByStudent: false },
          },
        }))
      }
      hydratedWorkRef.current.add(q.id)
    })
    return () => { cancelled = true }
  }, [user?.uid, spreadIdx, spec, questions])

  useEffect(() => {
    if (!user?.uid || spec.kind !== 'question') return
    const q = questions[spec.qIdx]
    if (!q?.id || !hydratedWorkRef.current.has(q.id)) return
    const qIdx = spec.qIdx
    const timer = window.setTimeout(() => {
      void saveQuestionWork(user.uid, {
        questionId: q.id,
        conceptId: canonicalId,
        source: 'chapter',
        level: q.level,
        formatId: questionFormat(q),
        scratchImage: notes[qIdx] ?? '',
        scratchStrokes: scratchStrokes[qIdx] ?? { strokes: [], width: 0, height: 0 },
        workLines: scratchInk[qIdx]?.workLines ?? [],
        scratchTranscription: scratchInk[qIdx]?.transcription ?? { text: '', latex: '', editedByStudent: false },
        selectedAnswerIndex: answers[qIdx] ?? undefined,
      })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [user?.uid, spec, questions, scratchStrokes, scratchInk, notes, canonicalId, spreadIdx, answers])

  const goBack = () => {
    if (fromDashboard) navigate('/dashboard')
    else navigate(-1)
  }

  const goToSpread = (i: number, d: 'f' | 'b') => {
    if (i < 0) {
      goBack()
      return
    }
    if (i >= spreads.length) {
      navigate('/dashboard', { replace: true })
      return
    }
    setDir(d)
    setSpreadIdx(i)
  }

  // Keyboard page flipping — left/right arrows flip spreads like the dashboard
  // book. Suppressed while writing on the page, typing anywhere, or mid-turn,
  // so drawing a horizontal stroke or filling in a text field never fires a
  // page turn underneath the student.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (writeMode) return
      const target = e.target as HTMLElement | null
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return
      if (target?.isContentEditable) return
      e.preventDefault()
      if (e.key === 'ArrowRight') goToSpread(spreadIdx + 1, 'f')
      else goToSpread(spreadIdx - 1, 'b')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadIdx, writeMode, spreads.length])

  // Touch swipe — flip pages like a real book on iPad. Ignores gestures that
  // start on interactive surfaces (scratch canvas, inputs, buttons) so writing
  // and tapping never accidentally turn the page.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (writeMode || target.closest('canvas, textarea, input, button, select, a')) {
      touchStart.current = null
      return
    }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 2) return
    if (dx < 0) goToSpread(spreadIdx + 1, 'f')
    else if (spreadIdx > 0) goToSpread(spreadIdx - 1, 'b')
  }

  const isLast = spreadIdx === spreads.length - 1
  const qSpreadCount = spreads.filter(sp => sp.right.kind === 'question').length

  const pingContext = useMemo(() => {
    const base = { conceptName: cs.conceptName }
    if (spec.kind !== 'question') return base
    const q = questions[spec.qIdx]
    return {
      ...base,
      questionLabel: `Q${spec.qIdx + 1}`,
      questionText: q?.question,
    }
  }, [spec, questions, cs.conceptName])

  const spread = spreads[spreadIdx]

  function renderStory(side: Extract<SpreadSide, { kind: 'story' }>) {
    const frame = getFrame(conceptId)
    return (
      <div className={s.storyLayout}>
        {frame && (
          <div className={s.sceneStamp}>
            <span className={s.sceneProtagonist} style={{ color: theme.accent }}>{frame.protagonist}</span>
            <span className={s.sceneDivider} style={{ color: theme.dim }}>·</span>
            <span className={s.sceneSetting} style={{ color: theme.dim }}>{frame.settingLine}</span>
          </div>
        )}
        <div className={s.storyBody}>
          {side.paras.map((p, i) => (
            <p key={i} className={`${s.storyPara} ${side.isFirst && i === 0 ? s.firstPara : ''}`}>
              {side.isFirst && i === 0 && p.length > 0 && (
                <span className={s.dropCap} style={{ color: theme.accent }}>{p[0]}</span>
              )}
              {side.isFirst && i === 0 ? p.slice(1) : p}
            </p>
          ))}
        </div>
      </div>
    )
  }

  // The left companion page for a question spread — a quiet scene recap and
  // a progress spine, so the left page is never blank while the right page
  // carries the full combined entry.
  function renderContextPanel(qIdx: number) {
    const frame = getFrame(conceptId)
    return (
      <div className={s.contextPanel}>
        {frame && (
          <div className={s.sceneStamp}>
            <span className={s.sceneProtagonist} style={{ color: theme.accent }}>{frame.protagonist}</span>
            <span className={s.sceneDivider} style={{ color: theme.dim }}>·</span>
            <span className={s.sceneSetting} style={{ color: theme.dim }}>{frame.settingLine}</span>
          </div>
        )}
        <p className={s.contextTeaser} style={{ color: theme.ink }}>
          {storyTeaser(cs.story)}
        </p>
        <div className={s.contextProgress}>
          <span className={s.contextProgressLabel} style={{ color: theme.dim }}>
            question {qIdx + 1} of {qSpreadCount}
          </span>
          <div className={s.contextDots} aria-hidden>
            {Array.from({ length: qSpreadCount }).map((_, i) => (
              <span
                key={i}
                className={s.contextDot}
                style={{ background: i <= qIdx ? theme.accent : 'rgba(0,0,0,0.14)' }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  function lockAnswer(qIdx: number) {
    const chosen = answers[qIdx]
    if (chosen === null || chosen === undefined) return
    setSubmitted(d => ({ ...d, [qIdx]: true }))

    const q = questions[qIdx]
    if (!user?.uid || !q?.id) return

    const workLines = scratchInk[qIdx]?.workLines ?? []
    void saveQuestionWork(user.uid, {
      questionId: q.id,
      conceptId: canonicalId,
      source: 'chapter',
      level: q.level,
      formatId: questionFormat(q),
      scratchImage: notes[qIdx] ?? '',
      scratchStrokes: scratchStrokes[qIdx] ?? { strokes: [], width: 0, height: 0 },
      workLines,
      scratchTranscription: scratchInk[qIdx]?.transcription ?? { text: '', latex: '', editedByStudent: false },
      selectedAnswerIndex: chosen,
    })
    void submitWorkEvidenceIfReady({
      studentId: user.uid,
      questionId: q.id,
      conceptId: canonicalId,
      workLines,
    })

    // Work-to-journal: a worked, submitted question becomes a dated entry in
    // Notes — same homework_sessions shape DashboardNotesPanel already reads,
    // so no new panel or read path is needed.
    if (!journaledRef.current.has(q.id)) {
      journaledRef.current.add(q.id)
      void appendChapterWorkToJournal({
        studentId: user.uid,
        conceptId: canonicalId,
        conceptName: cs.conceptName,
        questionId: q.id,
        questionNumber: qIdx + 1,
        correct: chosen === q.correctIndex,
        hasWork: workLines.some(l => l.text.trim() || l.latex.trim()) || Boolean(notes[qIdx]),
      })
    }
  }

  function renderQuestionPanel(qIdx: number) {
    const q = questions[qIdx]
    if (!q) return null
    const qNum = qIdx + 1
    const chosen = answers[qIdx] ?? null
    const isDone = submitted[qIdx] ?? false
    const frame = getFrame(conceptId)
    const storyItem = storyMod?.[q.id]
    const useStoryStem = Boolean(storyItem) && (
      storyAppliedRef.current.has(q.id) || (chosen === null && !isDone)
    )
    if (useStoryStem) storyAppliedRef.current.add(q.id)
    const storyDisplay = buildStoryDisplay(q)
    const stemText = useStoryStem ? storyItem!.storyStem : storyDisplay.stem
    const socraticHints = useStoryStem ? (storyItem!.socratic ?? []) : []
    const allHints = [...socraticHints, ...(q.hints ?? [])]
    const txt = q.question.toLowerCase()
    const bridge = frame && !useStoryStem
      ? (txt.includes('die') || txt.includes('dice') || txt.includes('roll')) && frame.diceFrame
        ? frame.diceFrame
        : (txt.includes('spinner') || txt.includes('spin')) && frame.spinnerFrame
          ? frame.spinnerFrame
          : frame.questionBridge
      : null

    const hasInk = Boolean(notes[qIdx]) || (scratchStrokes[qIdx]?.strokes?.length ?? 0) > 0

    return (
      <div className={s.guideRow}>
        <div className={s.guideBody}>
          <div className={s.qPanel}>
            <div className={s.combinedPage}>
              <header className={s.qHead}>
                <span className={s.qKicker}>question {qNum} of {qSpreadCount}</span>
                <div className={s.qHeadActions}>
                  <BookmarkButton
                    active={bookmarkedQuestions.includes(q.id)}
                    onToggle={() => {
                      if (!user?.uid) return
                      void toggleBookmark(user.uid, q.id, bookmarkedQuestions).then(setBookmarkedQuestions)
                    }}
                  />
                  <button
                    type="button"
                    className={`${s.writeToggle} ${writeMode ? s.writeToggleActive : ''}`}
                    style={writeMode ? { borderColor: theme.accent, color: theme.accent } : undefined}
                    onClick={() => setWriteMode(v => !v)}
                    aria-pressed={writeMode}
                  >
                    <PenLine size={13} strokeWidth={2} />
                    {writeMode ? 'stop writing' : 'write on this page'}
                  </button>
                  {hasInk && (
                    <button
                      type="button"
                      className={s.writeClear}
                      onClick={() => {
                        setNotes(n => ({ ...n, [qIdx]: '' }))
                        setScratchStrokes(st => { const next = { ...st }; delete next[qIdx]; return next })
                        setScratchInk(st => { const next = { ...st }; delete next[qIdx]; return next })
                        setDebugOutlines(false)
                        setScratchRev(r => ({ ...r, [qIdx]: (r[qIdx] ?? 0) + 1 }))
                      }}
                    >
                      clear my work
                    </button>
                  )}
                </div>
              </header>

              {q.storyIntro ? (
                <p className={s.storyBridgeText} style={{ color: theme.ink, opacity: 0.72 }}>
                  {q.storyIntro}
                </p>
              ) : q.storyContext ? (
                <p className={s.storyBridgeText} style={{ color: theme.accent + 'cc' }}>{q.storyContext}</p>
              ) : frame && bridge ? (
                <p className={s.storyBridgeText} style={{ color: theme.accent + 'cc' }}>{bridge}</p>
              ) : null}

              <div className={s.qGrid}>
                <div className={s.qStemCol}>
                  <HighlightedStem
                    text={stemText}
                    ink={theme.ink}
                    accent={theme.accent}
                    highlights={journalGuide.highlights}
                  />
                  <InteractiveWidget
                    conceptId={conceptId}
                    questionText={stemText}
                    format={questionFormat(q)}
                    theme={{ accent: theme.accent, ink: theme.ink, bg: theme.bg, dim: theme.dim }}
                  />
                </div>

                <div className={s.qChoicesCol}>
                  <div className={s.qChoices}>
                    {q.choices.slice(0, 4).map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`${s.choice} ${chosen === i ? s.choiceChosen : ''} ${isDone ? s.choiceDone : ''}`}
                        style={chosen === i ? {
                          borderColor: theme.accent,
                          background: theme.accent + '10',
                          '--choice-bg': theme.accent + '10',
                        } as React.CSSProperties : undefined}
                        onClick={() => !isDone && setAnswers(a => ({ ...a, [qIdx]: i }))}
                        disabled={isDone}
                      >
                        <span className={s.choiceLetter} style={{ color: theme.accent }}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className={s.choiceText}><MathText text={fmtChoice(c)} /></span>
                      </button>
                    ))}
                  </div>

                  {!isDone && allHints.length > 0 && (
                    <div className={s.hintStrip}>
                      {(hintsShownPerQ[qIdx] ?? 0) < allHints.length && (
                        <button
                          type="button"
                          className={s.hintBtn}
                          style={{ borderColor: theme.accent + '55', color: theme.accent }}
                          onClick={() => setHintsShownPerQ(h => ({ ...h, [qIdx]: (h[qIdx] ?? 0) + 1 }))}
                        >
                          need a hint?
                        </button>
                      )}
                      {allHints.slice(0, hintsShownPerQ[qIdx] ?? 0).map((hint, hi) => (
                        <div key={hi} className={s.hintBubble} style={{ borderLeftColor: theme.accent + '66', color: theme.dim }}>
                          <MathText text={hint} />
                        </div>
                      ))}
                    </div>
                  )}

                  {isDone && chosen !== null && chosen !== q.correctIndex && q.misconception_label && (
                    <div className={s.misconception}>
                      <span className={s.misconceptionLabel}>common slip</span>
                      {q.misconception_label}
                    </div>
                  )}

                  {!isDone ? (
                    <button
                      type="button"
                      className={s.submitBtn}
                      style={{ background: theme.ink, color: theme.paper }}
                      disabled={chosen === null}
                      onClick={() => lockAnswer(qIdx)}
                    >
                      {chosen === null ? 'choose an answer' : 'lock it in →'}
                    </button>
                  ) : (
                    <p className={s.qDoneNote} style={{ color: theme.dim }}>
                      {chosen === q.correctIndex ? 'noted. keep going.' : 'noted. check your work.'}
                    </p>
                  )}
                </div>
              </div>

              <ScratchTranscriptionPane
                imageDataUrl={notes[qIdx] ?? ''}
                strokeData={scratchStrokes[qIdx] ?? null}
                resetKey={`${qIdx}-${scratchRev[qIdx] ?? 0}`}
                className={s.transcriptionPane}
                onChange={state => {
                  if (state) setScratchInk(st => ({ ...st, [qIdx]: state }))
                  else setScratchInk(st => { const next = { ...st }; delete next[qIdx]; return next })
                }}
                onDebugChange={setDebugOutlines}
              />

              {/* Full-page annotation surface — write anywhere on the page,
                  not confined to one boxed scratch area. Pointer events only
                  engage while writeMode is on, so the rest of the page (choices,
                  hints, submit) stays clickable the rest of the time. */}
              <div
                className={`${s.annotationLayer} ${writeMode ? s.annotationActive : ''}`}
                style={{ '--line-color': theme.lineBg } as React.CSSProperties}
              >
                {writeMode && <div className={s.annotationHint}>tap the pencil again to stop writing</div>}
                <ScratchPad
                  key={`${qIdx}-${scratchRev[qIdx] ?? 0}`}
                  paperMode
                  questionId={`${conceptId}-q${qIdx}`}
                  evalLines={scratchInk[qIdx]?.workLines?.map(l => ({ bbox: l.bbox, text: l.text, latex: l.latex }))}
                  lineOverlays={(() => {
                    const lines = scratchInk[qIdx]?.workLines ?? []
                    const overlays: LineOverlay[] = lines
                      .filter(line => line.verdict === 'wrong')
                      .map(line => ({ bbox: line.bbox, kind: 'suspect' as const }))
                    if (debugOutlines) {
                      overlays.push(...lines.map(line => ({ bbox: line.bbox, kind: 'debug' as const })))
                    }
                    return overlays.length ? overlays : undefined
                  })()}
                  onChange={(_canvas, strokeData) => {
                    setScratchStrokes(st => ({ ...st, [qIdx]: strokeData }))
                    setNotes(n => ({
                      ...n,
                      [qIdx]: strokeData.strokes.length
                        ? exportScratchImage(strokeData.strokes, strokeData.width, strokeData.height, 1)
                        : '',
                    }))
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <JarvisGuide
          insights={insightsForSide(journalGuide.insights, 'work')}
          thinking={journalGuide.thinking}
          side="work"
        />
      </div>
    )
  }

  function renderSpreadSide(side: SpreadSide, runningHead?: string) {
    if (side.kind === 'cover') {
      return (
        <div className={s.coverLayout}>
          <div className={s.coverGlyph} style={{ color: theme.accent }}>{glyph}</div>
          <h1 className={s.coverTitle} style={{ color: theme.ink }}>{cs.conceptName}</h1>
        </div>
      )
    }
    if (side.kind === 'story') return renderStory(side)
    if (side.kind === 'context') return renderContextPanel(side.qIdx)
    if (side.kind === 'question') return renderQuestionPanel(side.qIdx)
    return null
  }

  function runningHeadFor(side: SpreadSide): string | undefined {
    if (side.kind === 'cover') return undefined
    if (side.kind === 'story') return 'the story'
    if (side.kind === 'context') return 'the scene'
    if (side.kind === 'question') return cs.conceptName
    return undefined
  }

  return (
    <div
      className={s.chapterDesk}
      style={{
        '--theme-bg': theme.bg,
        '--theme-paper': theme.paper,
        '--theme-ink': theme.ink,
        '--theme-accent': theme.accent,
        '--theme-dim': theme.dim,
      } as React.CSSProperties}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <BookShell
        wordmark={cs.conceptName}
        chromeLeft={(
          <button type="button" className={s.chromeBack} onClick={goBack}>← back</button>
        )}
        chromeRight={(
          <>
            <PingTutor context={pingContext} compact />
            <div className={s.calcWrap}>
              <button
                type="button"
                className={s.miniCalc}
                onClick={() => setShowCalc(c => !c)}
                aria-label="Calculator"
                aria-expanded={showCalc}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <line x1="8" x2="16" y1="6" y2="6" />
                </svg>
              </button>
              {showCalc && <div className={s.calcDrop}><Calculator /></div>}
            </div>
          </>
        )}
        left={(
          <BookPage
            side="left"
            runningHead={runningHeadFor(spread.left)}
            folio={<span>page {folioNum(spreadIdx, 'left')}</span>}
          >
            <PageFlipTransition viewKey={`${spreadIdx}-L`} direction={dir === 'f' ? 'forward' : 'back'}>
              {renderSpreadSide(spread.left)}
            </PageFlipTransition>
          </BookPage>
        )}
        right={(
          <BookPage
            side="right"
            ribbon={spread.left.kind === 'cover'}
            runningHead={runningHeadFor(spread.right)}
            folio={<span>page {folioNum(spreadIdx, 'right')}</span>}
          >
            <PageFlipTransition viewKey={`${spreadIdx}-R`} direction={dir === 'f' ? 'forward' : 'back'}>
              {renderSpreadSide(spread.right)}
            </PageFlipTransition>
          </BookPage>
        )}
      />

      <nav className={s.spreadNav}>
        <button type="button" className={s.navArrow} onClick={() => goToSpread(spreadIdx - 1, 'b')} aria-label="Previous spread">←</button>
        <div className={s.navDots}>
          {spreads.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${s.dot} ${i === spreadIdx ? s.dotActive : ''} ${i < spreadIdx ? s.dotPast : ''}`}
              style={i === spreadIdx ? { background: theme.accent } : i < spreadIdx ? { background: theme.accent + '55' } : undefined}
              onClick={() => goToSpread(i, i > spreadIdx ? 'f' : 'b')}
              aria-label={`Spread ${i + 1}`}
            />
          ))}
        </div>
        {isLast ? (
          <button
            type="button"
            className={s.navPrimary}
            style={{ background: theme.ink, color: theme.paper }}
            onClick={() => navigate('/practice', { state: { conceptId } })}
          >
            practice →
          </button>
        ) : (
          <button type="button" className={s.navArrow} onClick={() => goToSpread(spreadIdx + 1, 'f')} aria-label="Next spread">→</button>
        )}
      </nav>
    </div>
  )
}
