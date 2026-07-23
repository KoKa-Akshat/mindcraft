import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { PenLine } from 'lucide-react'
import conceptStoriesRaw from '../data/conceptStories.json'
import contextFramesRaw from '../data/questionContextFrames.json'
import { getQuestions, questionFormat, type Question } from '../lib/questionBank'
import { canonicalConceptId } from '../lib/conceptAliases'
import { useUser } from '../App'
import BookmarkButton from '../components/BookmarkButton'
import { loadDashboardPersonalization, toggleBookmark } from '../lib/dashboardPersonalization'
import { loadQuestionWork, saveQuestionWork } from '../lib/studentWork'
import { submitWorkEvidenceIfReady } from '../lib/workEvidence'
import { appendChapterWorkToJournal } from '../lib/chapterJournal'
import { selectStoryForConcept } from '../lib/storySelection'
import { selectSceneForQuestion } from '../lib/sceneSelection'
import { getPastMistakeCallback, type PastMistakeCallback } from '../lib/pastMistakeCallback'
import WizardMascot from '../components/canvas/WizardMascot'
import MathText from '../components/MathText'
import ScratchPad, { exportScratchImage, type LineOverlay } from '../components/ScratchPad'
import type { ScratchStrokeData } from '../types'
import type { ScratchInkState } from '../components/ScratchTranscriptionPane'
import PingTutor from '../components/PingTutor'
import HighlightedStem from '../components/HighlightedStem'
import { useJournalGuide } from '../hooks/useJournalGuide'
import { storyArtFor, storyArtTilt } from '../lib/storyArt'
import DoodleReward, { pickDoodleStamp } from '../components/doodle/DoodleReward'
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

function storyTeaser(story: string, max = 90): string {
  if (!story || story.length <= max) return story
  const cut = story.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

/** Chapter depth — same ballpark as Practice SESSION_LENGTH (Bloom ~10). */
const CHAPTER_Q_COUNT = 10

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

// ── Horizontal canvas panels (story + questions blend on one sheet) ─────────
type Panel =
  | { kind: 'open'; paras: string[] }
  | { kind: 'quest'; qIdx: number; beat: string | null; beatIndex: number }

/** Split concept story into short advancing beats — never reuse the same left copy. */
function storyBeats(text: string): string[] {
  const paras = text.split('\n').map(p => p.trim()).filter(p => p.length > 15)
  const beats: string[] = []
  for (const p of paras) {
    if (p.length <= 260) {
      beats.push(p)
      continue
    }
    const sentences = p.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [p]
    let buf = ''
    for (const raw of sentences) {
      const s = raw.trim()
      if (!s) continue
      if (buf && (buf + ' ' + s).length > 240) {
        beats.push(buf)
        buf = s
      } else {
        buf = buf ? `${buf} ${s}` : s
      }
    }
    if (buf) beats.push(buf)
  }
  return beats
}

function buildPanels(text: string, qCount: number): Panel[] {
  const beats = storyBeats(text)
  const panels: Panel[] = []
  panels.push({
    kind: 'open',
    paras: beats.slice(0, 1).length
      ? beats.slice(0, 1)
      : ['Your chapter opens here — the scene is already waiting.'],
  })

  // One unique beat per question (after the opener). Never repeat the opener.
  for (let q = 0; q < qCount; q++) {
    const beatIndex = q + 1
    panels.push({
      kind: 'quest',
      qIdx: q,
      beat: beats[beatIndex] ?? null,
      beatIndex,
    })
  }
  return panels
}

/**
 * Strip folk-tale / bank narrative wrappers so we can re-wrap in THIS chapter's
 * protagonist (Simon Stevin, etc.). Keeps the actual math ask + numbers.
 */
function extractMathAsk(text: string): string {
  const cleaned = text.replace(/\r/g, '').trim()
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^(What|Find|Compute|Which|How|Solve|Determine|Calculate|Evaluate|Simplify)\b/i.test(lines[i])) {
      return lines[i]
    }
  }
  const m = cleaned.match(
    /(?:What|Find|Compute|Which|How|Solve|Determine|Calculate|Evaluate|Simplify)[\s\S]{0,220}?[.?]/i,
  )
  if (m) return m[0].trim()
  // Last sentence often holds the ask when the bank already storied the stem
  const sentences = cleaned.split(/(?<=[.?!])\s+/).filter(Boolean)
  return (sentences[sentences.length - 1] ?? cleaned).trim()
}

/**
 * Concept-locked stem — never mix folk Kwame into a Stevin chapter.
 *
 * `conceptId` (canonical ontology id) is used to look up a scene from the
 * concept's `scenes[]` list (see lib/sceneSelection.ts). Concepts without a
 * scenes array (everything except the fractions_decimals pilot, for now)
 * get `null` back and this falls through to the single locked
 * questionContextFrames.json frame exactly as before, unchanged behavior.
 */
function chapterStem(
  q: Question,
  frame: ContextFrame | null,
  protagonist: string,
  conceptId: string,
): string {
  const ask = extractMathAsk(q.question)
  const scene = selectSceneForQuestion(q, conceptId)
  const bridge = scene?.questionBridge
    ?? frame?.questionBridge
    ?? `${protagonist} slides the ledger toward you.`
  const settingLine = scene?.settingLine ?? frame?.settingLine ?? ''
  const setting = settingLine ? `✦ ${settingLine}` : ''
  return [setting, bridge, ask].filter(Boolean).join('\n\n')
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

  const questions = useMemo(() => {
    if (!conceptId) return []
    const qs = [
      ...getQuestions(conceptId, 1, CHAPTER_Q_COUNT),
      ...getQuestions(conceptId, 2, CHAPTER_Q_COUNT),
      ...getQuestions(conceptId, 3, Math.ceil(CHAPTER_Q_COUNT / 2)),
    ]
    const seen = new Set<string>()
    return qs
      .filter(q => {
        if (seen.has(q.question)) return false
        seen.add(q.question)
        return true
      })
      .slice(0, CHAPTER_Q_COUNT)
  }, [conceptId])

  const panels = useMemo(
    () => buildPanels(cs.story, questions.length),
    [cs.story, questions.length],
  )

  // Opening story once per concept — return visits skip to first quest.
  // v2: bust old key so students see the new canvas opener after the redesign.
  const storySeenKey = `mc-story-seen-v2-${resolveId(conceptId)}`
  const [hasSeenStory] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem(storySeenKey))

  const firstQuestIdx = useMemo(
    () => panels.findIndex(p => p.kind === 'quest'),
    [panels],
  )
  const [panelIdx, setPanelIdx] = useState(() => (
    hasSeenStory && firstQuestIdx > 0 ? firstQuestIdx : 0
  ))
  const [slideDir, setSlideDir] = useState<'f' | 'b'>('f')

  useEffect(() => {
    if (panels[panelIdx]?.kind === 'quest' && !localStorage.getItem(storySeenKey)) {
      localStorage.setItem(storySeenKey, '1')
    }
  }, [panelIdx, panels, storySeenKey])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({})
  /** Soft-wrong: eliminated sticker indices per question (retry without penalty). */
  const [eliminated, setEliminated] = useState<Record<number, number[]>>({})
  const [wiggleChoice, setWiggleChoice] = useState<{ qIdx: number; i: number } | null>(null)
  const [rewardPhrase, setRewardPhrase] = useState<string | null>(null)
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
  useEffect(() => { setWriteMode(false) }, [panelIdx])
  const journaledRef = useRef<Set<string>>(new Set())

  const currentPanel = panels[panelIdx]

  // Callback mechanic: resurface this student's own past struggle on THIS
  // concept once there's real evidence they've since improved (see
  // lib/pastMistakeCallback.ts for exactly what's recorded vs not). Fetched
  // once per chapter open; fails soft to null so a student with no history
  // yet, or an offline read, just sees the normal opener.
  const [pastMistake, setPastMistake] = useState<PastMistakeCallback | null>(null)
  useEffect(() => {
    setPastMistake(null)
    if (!user?.uid || !canonicalId) return
    let cancelled = false
    void getPastMistakeCallback(user.uid, canonicalId, cs.conceptName).then(cb => {
      if (!cancelled) setPastMistake(cb)
    })
    return () => { cancelled = true }
  }, [user?.uid, canonicalId, cs.conceptName])

  useEffect(() => {
    if (!user?.uid) return
    void loadDashboardPersonalization(user.uid).then(p => setBookmarkedQuestions(p.bookmarkedQuestions))
  }, [user?.uid])

  const spec = currentPanel?.kind === 'quest'
    ? { kind: 'question' as const, qIdx: currentPanel.qIdx }
    : { kind: 'other' as const, qIdx: -1 }

  const journalQIdx = currentPanel?.kind === 'quest' ? currentPanel.qIdx : -1

  useEffect(() => {
    if (journalQIdx >= 0) setQuestionStartedAt(Date.now())
  }, [journalQIdx, panelIdx])

  const activeQuestion = journalQIdx >= 0 ? questions[journalQIdx] : null
  const activeStem = useMemo(() => {
    if (!activeQuestion) return ''
    const f = getFrame(conceptId)
    const story = selectStoryForConcept(canonicalId)
    return chapterStem(activeQuestion, f, story?.protagonist ?? cs.conceptName, canonicalId)
  }, [activeQuestion, conceptId, canonicalId, cs.conceptName])
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
  }, [user?.uid, panelIdx, spec, questions])

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
  }, [user?.uid, spec, questions, scratchStrokes, scratchInk, notes, canonicalId, panelIdx, answers])

  const goBack = () => {
    if (fromDashboard) navigate('/dashboard')
    else navigate(-1)
  }

  const goToPanel = (i: number, d: 'f' | 'b') => {
    if (i < 0) {
      goBack()
      return
    }
    if (i >= panels.length) {
      navigate('/dashboard', { replace: true })
      return
    }
    setSlideDir(d)
    setPanelIdx(i)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (writeMode) return
      const target = e.target as HTMLElement | null
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return
      if (target?.isContentEditable) return
      e.preventDefault()
      if (e.key === 'ArrowRight') goToPanel(panelIdx + 1, 'f')
      else goToPanel(panelIdx - 1, 'b')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelIdx, writeMode, panels.length])

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
    if (dx < 0) goToPanel(panelIdx + 1, 'f')
    else if (panelIdx > 0) goToPanel(panelIdx - 1, 'b')
  }

  const isLast = panelIdx === panels.length - 1
  const qSpreadCount = panels.filter(p => p.kind === 'quest').length
  const artSrc = storyArtFor(canonicalId)
  const localStory = selectStoryForConcept(canonicalId)
  const frame = getFrame(conceptId)

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

  function Polaroid({ salt, className }: { salt: number; className?: string }) {
    const tilt = storyArtTilt(canonicalId, salt)
    return (
      <figure
        className={`${s.polaroid} ${className ?? ''}`}
        style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
        aria-hidden
      >
        <img src={artSrc} alt="" draggable={false} />
      </figure>
    )
  }

  function renderOpenPanel(paras: string[]) {
    return (
      <div className={s.blendSheet}>
        <Polaroid salt={panelIdx} className={s.polaroidHero} />
        <div className={s.blendCopy}>
          {pastMistake && (
            <div className={s.pastMistakeWizard}>
              <WizardMascot line={pastMistake.line} cheering={false} compact />
            </div>
          )}
          <p className={s.blendEyebrow}>ACT chapter</p>
          <h1 className={s.blendTitle}>{cs.conceptName}</h1>
          {frame && (
            <p className={s.blendStamp} style={{ color: theme.accent }}>
              {frame.protagonist}
              {frame.settingLine ? ` · ${frame.settingLine}` : ''}
            </p>
          )}
          {paras.map((p, i) => (
            <p key={i} className={`${s.blendPara} ${i === 0 ? s.blendLead : ''}`}>
              {i === 0 && p.length > 0 && (
                <span className={s.dropCap} style={{ color: theme.accent }}>{p[0]}</span>
              )}
              {i === 0 ? p.slice(1) : p}
            </p>
          ))}
        </div>
      </div>
    )
  }

  function lockAnswer(qIdx: number) {
    const chosen = answers[qIdx]
    if (chosen === null || chosen === undefined) return
    const q = questions[qIdx]
    if (!q) return

    // Soft wrong: wiggle + dim the sticker, keep trying — no red buzz, no lock.
    if (chosen !== q.correctIndex) {
      setEliminated(e => ({
        ...e,
        [qIdx]: [...new Set([...(e[qIdx] ?? []), chosen])],
      }))
      setWiggleChoice({ qIdx, i: chosen })
      window.setTimeout(() => setWiggleChoice(null), 520)
      setAnswers(a => {
        const next = { ...a }
        delete next[qIdx]
        return next
      })
      return
    }

    setRewardPhrase(pickDoodleStamp(qIdx + chosen))
    setSubmitted(d => ({ ...d, [qIdx]: true }))

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

  function renderQuestPanel(qIdx: number, beat: string | null, beatIndex: number) {
    const q = questions[qIdx]
    if (!q) return null
    const qNum = qIdx + 1
    const chosen = answers[qIdx] ?? null
    const isDone = submitted[qIdx] ?? false
    const protagonist = localStory?.protagonist ?? frame?.protagonist ?? cs.conceptName
    const stemText = chapterStem(q, frame, protagonist, canonicalId)
    const scene = selectSceneForQuestion(q, canonicalId)
    const allHints = (q.hints ?? []).slice(0, 2)
    const hasInk = Boolean(notes[qIdx]) || (scratchStrokes[qIdx]?.strokes?.length ?? 0) > 0

    return (
      <div className={`${s.blendSheet} ${s.blendQuest}`}>
        <div className={s.blendQuestMain}>
          <header className={s.qHead}>
            <span className={s.qKicker}>{qNum} / {qSpreadCount}</span>
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
                aria-label={writeMode ? 'Lock page for tapping answers' : 'Write with pencil'}
                title={writeMode ? 'Tap answers' : 'Write'}
              >
                <PenLine size={15} strokeWidth={2} />
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
                  clear
                </button>
              )}
            </div>
          </header>

          {beat && (
            <p className={s.sidePassage}>
              <span className={s.beatLabel}>scene {beatIndex}</span>
              {storyTeaser(beat, 280)}
            </p>
          )}

          <HighlightedStem
            text={stemText}
            ink={theme.ink}
            accent={theme.accent}
            highlights={journalGuide.highlights}
          />

          <div className={`${s.qChoices} ${s.stickerChoices}`}>
            {q.choices.slice(0, 4).map((c, i) => {
              const out = (eliminated[qIdx] ?? []).includes(i)
              const wiggling = wiggleChoice?.qIdx === qIdx && wiggleChoice.i === i
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    s.choice,
                    s.stickerChoice,
                    chosen === i ? s.choiceChosen : '',
                    isDone && chosen === i ? s.choiceCorrect : '',
                    out ? s.choiceSoftWrong : '',
                    wiggling ? s.choiceWiggle : '',
                    isDone ? s.choiceDone : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => !isDone && !out && setAnswers(a => ({ ...a, [qIdx]: i }))}
                  disabled={isDone || out}
                >
                  <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                  <span className={s.choiceText}><MathText text={fmtChoice(c)} /></span>
                </button>
              )
            })}
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
                  hint?
                </button>
              )}
              {allHints.slice(0, hintsShownPerQ[qIdx] ?? 0).map((hint, hi) => (
                <div key={hi} className={s.hintBubble} style={{ borderLeftColor: theme.accent + '66', color: theme.dim }}>
                  <MathText text={hint} />
                </div>
              ))}
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
              {chosen === null ? 'Pick one' : 'Lock in →'}
            </button>
          ) : (
            <p className={s.qDoneNote} style={{ color: theme.dim }}>
              {chosen === q.correctIndex ? 'Nice.' : 'Try the next one.'}
            </p>
          )}

          <div
            className={`${s.annotationLayer} ${writeMode ? s.annotationActive : ''}`}
            style={{ '--line-color': theme.lineBg } as React.CSSProperties}
          >
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

        <aside className={s.blendQuestAside}>
          <Polaroid salt={qIdx + 9} className={s.polaroidQuest} />
          {(scene?.settingLine ?? frame?.settingLine) && (
            <p className={s.asideScene}>{scene?.settingLine ?? frame?.settingLine}</p>
          )}
        </aside>
      </div>
    )
  }

  function renderPanel() {
    if (!currentPanel) return null
    if (currentPanel.kind === 'open') return renderOpenPanel(currentPanel.paras)
    return renderQuestPanel(currentPanel.qIdx, currentPanel.beat, currentPanel.beatIndex)
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
      <DoodleReward phrase={rewardPhrase} onDone={() => setRewardPhrase(null)} />

      <header className={s.canvasChrome}>
        <button type="button" className={s.chromeBack} onClick={goBack}>← back</button>
        <span className={s.canvasWordmark}>{cs.conceptName}</span>
        <div className={s.canvasChromeRight}>
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
        </div>
      </header>

      <main
        className={`${s.canvasStage} ${slideDir === 'f' ? s.slideFwd : s.slideBack}`}
        key={panelIdx}
      >
        {renderPanel()}
      </main>

      <nav className={s.spreadNav}>
        <button type="button" className={s.navArrow} onClick={() => goToPanel(panelIdx - 1, 'b')} aria-label="Previous">←</button>
        <div className={s.navDots}>
          {panels.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${s.dot} ${i === panelIdx ? s.dotActive : ''} ${i < panelIdx ? s.dotPast : ''}`}
              style={i === panelIdx ? { background: theme.accent } : i < panelIdx ? { background: theme.accent + '55' } : undefined}
              onClick={() => goToPanel(i, i > panelIdx ? 'f' : 'b')}
              aria-label={`Panel ${i + 1}`}
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
          <button type="button" className={s.navArrow} onClick={() => goToPanel(panelIdx + 1, 'f')} aria-label="Next">→</button>
        )}
      </nav>
    </div>
  )
}
