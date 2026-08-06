import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { PenLine } from 'lucide-react'
import conceptStoriesRaw from '../data/conceptStories.json'
import { getQuestions, questionFormat, type Question } from '../lib/questionBank'
import { canonicalConceptId } from '../lib/conceptAliases'
import { useUser } from '../App'
import BookmarkButton from '../components/BookmarkButton'
import { loadDashboardPersonalization, toggleBookmark } from '../lib/dashboardPersonalization'
import { loadQuestionWork, saveQuestionWork } from '../lib/studentWork'
import { submitWorkEvidenceIfReady } from '../lib/workEvidence'
import { appendChapterWorkToJournal } from '../lib/chapterJournal'
import { recordWrongAnswer, resolveWrongAnswerNote } from '../lib/wrongAnswerNotes'
import { selectStoryForConcept } from '../lib/storySelection'
import { selectSceneForQuestion } from '../lib/sceneSelection'
import { resolveQuestionStem } from '../lib/questionStem'
import { getPastMistakeCallback, type PastMistakeCallback } from '../lib/pastMistakeCallback'
import WizardMascot from '../components/canvas/WizardMascot'
import MathText from '../components/MathText'
import ScratchPad, { exportScratchImage, type LineOverlay } from '../components/ScratchPad'
import GraphBox from '../components/GraphBox'
import { GRAPHABLE_CONCEPT_IDS } from '../lib/graphableConcepts'
import { extractPlottablePoints, extractGraphableExpression } from '../lib/plottablePoints'
import { resolveConceptNotes } from '../lib/conceptContent'
import type { ScratchStrokeData } from '../types'
import type { ScratchInkState } from '../components/ScratchTranscriptionPane'
import PingTutor from '../components/PingTutor'
import HighlightedStem from '../components/HighlightedStem'
import { useJournalGuide } from '../hooks/useJournalGuide'
import { hasConceptAccurateArt, storyArtFor, storyArtTilt } from '../lib/storyArt'
import DoodleReward, { pickDoodleStamp } from '../components/doodle/DoodleReward'
import SoundToggle from '../components/SoundToggle'
import { playChime, playTap } from '../lib/uiSound'
import s from './ConceptChapterPage.module.css'

// ── Types ───────────────────────────────────────────────────────────────────

type ContextFrame = {
  protagonist: string
  settingLine: string
  questionBridge: string
  diceFrame: string | null
  spinnerFrame: string | null
}
type CS = {
  conceptId: string
  conceptName: string
  story: string
  ingredientStories: Record<string, unknown>
  contextFrame?: ContextFrame
}
const DB = conceptStoriesRaw as unknown as Record<string, CS>

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
  return DB[id]?.contextFrame ?? DB[FRAME_ALIAS[rawId] ?? '']?.contextFrame ?? DB[FRAME_ALIAS[id] ?? '']?.contextFrame ?? null
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
  paper: '#14261c',
  ink: '#f4efe2',
  dim: 'rgba(244, 239, 226, 0.62)',
  lineBg: 'rgba(185, 232, 111, 0.12)',
}

const CLUSTER_THEME = {
  algebra:   { ...JOURNAL_PAPER, accent: '#7ec8e3', chip: '#7ec8e3' },
  geometry:  { ...JOURNAL_PAPER, accent: '#6eb6ff', chip: '#6eb6ff' },
  functions: { ...JOURNAL_PAPER, accent: '#b9e86f', chip: '#b9e86f' },
  data:      { ...JOURNAL_PAPER, accent: '#f5d348', chip: '#f5d348' },
}

// ── Horizontal canvas panels (story + questions blend on one sheet) ─────────
type Panel =
  | { kind: 'open'; paras: string[]; pageNum: number; pageCount: number }
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

/** Pages the reader steps through before the questions start. Picks a page
 * count from the story's own total length first (short stories still get
 * 2 pages, long ones cap at 5), chunks beats toward an even per-page share
 * of that total, then merges the smallest adjacent pair repeatedly until
 * the page count lands exactly on target — keeps every page a comparable
 * size instead of leaving one lopsided page holding whatever didn't fit
 * under a fixed budget. */
const STORY_TARGET_PAGE_CHARS = 550
const STORY_MIN_PAGES = 2
const STORY_MAX_PAGES = 5

function storyPages(text: string): string[][] {
  const beats = storyBeats(text)
  if (beats.length === 0) {
    return [['Your chapter opens here — the scene is already waiting.']]
  }
  const totalLen = beats.reduce((sum, b) => sum + b.length, 0)
  const targetPages = Math.min(
    STORY_MAX_PAGES,
    Math.max(STORY_MIN_PAGES, Math.round(totalLen / STORY_TARGET_PAGE_CHARS)),
  )
  const perPageBudget = totalLen / targetPages

  const pages: string[][] = []
  let current: string[] = []
  let currentLen = 0
  for (const beat of beats) {
    if (current.length && currentLen + beat.length > perPageBudget) {
      pages.push(current)
      current = []
      currentLen = 0
    }
    current.push(beat)
    currentLen += beat.length
  }
  if (current.length) pages.push(current)

  const pageLen = (p: string[]) => p.reduce((sum, b) => sum + b.length, 0)
  while (pages.length > targetPages) {
    let bestIdx = 0
    let bestSum = Infinity
    for (let i = 0; i < pages.length - 1; i++) {
      const sum = pageLen(pages[i]) + pageLen(pages[i + 1])
      if (sum < bestSum) {
        bestSum = sum
        bestIdx = i
      }
    }
    pages.splice(bestIdx, 2, [...pages[bestIdx], ...pages[bestIdx + 1]])
  }
  return pages
}

function buildPanels(text: string, qCount: number): Panel[] {
  const pages = storyPages(text)
  const panels: Panel[] = pages.map((paras, i) => ({
    kind: 'open' as const,
    paras,
    pageNum: i + 1,
    pageCount: pages.length,
  }))

  // Quest panels no longer carry rendered story flavor (narrative wrapping
  // removed from the question stem, see ACTIVE_TASK.md) — beat/beatIndex
  // stay on the panel shape for a future dedicated wrapping agent only.
  for (let q = 0; q < qCount; q++) {
    panels.push({
      kind: 'quest',
      qIdx: q,
      beat: null,
      beatIndex: q + 1,
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
 * conceptStories contextFrame exactly as before, unchanged behavior.
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

  // One-time concept cover (Cursor brief #5): generated story-{id} art as a
  // full-bleed landing plate the first time you enter this chapter. Skipped
  // when only theme-fallback photos exist, so we never flash a recycled
  // fractions plate as if it were this concept's cover.
  const coverSeenKey = `mc-concept-cover-seen-${canonicalId}`
  const [showConceptCover, setShowConceptCover] = useState(() => {
    if (typeof window === 'undefined') return false
    if (!hasConceptAccurateArt(canonicalId)) return false
    try { return localStorage.getItem(coverSeenKey) !== '1' } catch { return false }
  })

  const firstQuestIdx = useMemo(
    () => panels.findIndex(p => p.kind === 'quest'),
    [panels],
  )
  const [panelIdx, setPanelIdx] = useState(() => (
    hasSeenStory && firstQuestIdx > 0 ? firstQuestIdx : 0
  ))
  const [slideDir, setSlideDir] = useState<'f' | 'b'>('f')

  function openConceptCover() {
    try { localStorage.setItem(coverSeenKey, '1') } catch { /* ignore */ }
    setShowConceptCover(false)
    playTap()
  }

  // Formula / key-rules sheet before story/questions — always shown once per
  // chapter open (resolveConceptNotes falls back when curated content is thin).
  const conceptNotes = useMemo(() => resolveConceptNotes(canonicalId), [canonicalId])
  const [showFormulaSheet, setShowFormulaSheet] = useState(true)

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
  /** Soft-wrong coach: wizard under Graph explains the miss, then student retries. */
  const [wrongCoach, setWrongCoach] = useState<{ qIdx: number; line: string } | null>(null)
  useEffect(() => {
    setWriteMode(false)
    setWrongCoach(null)
  }, [panelIdx])
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
  // Displayed stem = the shared C-4 resolve chain (baked themed stem >
  // framedLocalStem > plain), identical to what Practice serves. journalGuide
  // highlights key off this same resolved text so they line up with what
  // renderQuestPanel actually renders.
  const activeStem = useMemo(
    () => (activeQuestion ? resolveQuestionStem(activeQuestion) : ''),
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

  // Title click + "Go to Notes" both land here: this chapter's open gaps on
  // the Notes page (StudentSessions.tsx), scoped via ?concept=. Does not
  // touch the page-dot nav below — those still only flip panels.
  const goToChapterNotes = () => {
    navigate(`/sessions?concept=${encodeURIComponent(canonicalId)}`)
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

  function renderOpenPanel(paras: string[], pageNum: number, pageCount: number) {
    const isFirstPage = pageNum === 1
    return (
      <div className={s.blendSheet}>
        <Polaroid salt={panelIdx} className={s.polaroidHero} />
        <div className={s.blendCopy}>
          {isFirstPage && pastMistake && (
            <div className={s.pastMistakeWizard}>
              <WizardMascot line={pastMistake.line} cheering={false} compact />
            </div>
          )}
          <p className={s.blendEyebrow}>
            {isFirstPage ? 'ACT chapter' : `${cs.conceptName} · continued`}
          </p>
          {isFirstPage ? (
            <h1 className={s.blendTitle}>{cs.conceptName}</h1>
          ) : (
            pageCount > 1 && (
              <p className={s.blendStamp} style={{ color: theme.dim }}>
                page {pageNum} of {pageCount}
              </p>
            )
          )}
          {isFirstPage && frame && (
            <p className={s.blendStamp} style={{ color: theme.accent }}>
              {frame.protagonist}
              {frame.settingLine ? ` · ${frame.settingLine}` : ''}
            </p>
          )}
          {paras.map((p, i) => (
            <p key={i} className={`${s.blendPara} ${isFirstPage && i === 0 ? s.blendLead : ''}`}>
              {isFirstPage && i === 0 && p.length > 0 && (
                <span className={s.dropCap} style={{ color: theme.accent }}>{p[0]}</span>
              )}
              {isFirstPage && i === 0 ? p.slice(1) : p}
            </p>
          ))}
        </div>
      </div>
    )
  }

  function coachLineForWrong(q: Question): string {
    const raw = (q.hints?.[0] ?? '').trim()
    if (raw) {
      const cleaned = raw
        .replace(/^KEY INSIGHT:\s*/i, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/\s+/g, ' ')
        .trim()
      const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned
      if (sentence.length >= 12 && sentence.length <= 140) return sentence
      if (cleaned.length > 12) return `${cleaned.slice(0, 120).trim()}…`
    }
    if (q.misconception_label?.trim()) {
      return `Common trap: ${q.misconception_label.trim()}`
    }
    return 'That one’s out. Pick again — what is the question really asking?'
  }

  function lockAnswer(qIdx: number) {
    const chosen = answers[qIdx]
    if (chosen === null || chosen === undefined) return
    const q = questions[qIdx]
    if (!q) return

    // Soft wrong: wiggle + dim the sticker, keep trying — no red buzz, no lock.
    if (chosen !== q.correctIndex) {
      playTap()
      setWriteMode(false) // exit Write so choices are tappable again
      setWrongCoach({ qIdx, line: coachLineForWrong(q) })
      // Gap note: only the FIRST wrong pick on this question gets saved — an
      // empty eliminated list here means this is that first pick. Later
      // wrong picks at the same question never overwrite it (see
      // recordWrongAnswer's own no-op-if-already-open guard too).
      if (user?.uid && (eliminated[qIdx] ?? []).length === 0) {
        void recordWrongAnswer(user.uid, {
          question: q,
          conceptId: canonicalId,
          conceptName: cs.conceptName,
          selectedIndex: chosen,
          source: 'chapter',
        })
      }
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

    playChime()
    setWrongCoach(null)
    setRewardPhrase(pickDoodleStamp(qIdx + chosen))
    setSubmitted(d => ({ ...d, [qIdx]: true }))

    if (!user?.uid || !q?.id) return

    void resolveWrongAnswerNote(user.uid, q.id)

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
    // Displayed stem comes from the shared C-4 chain; chapterStem stays wired
    // as the page-local fallback shape for a future dedicated wrapping agent.
    const narrativeStem = chapterStem(q, frame, protagonist, canonicalId)
    const scene = selectSceneForQuestion(q, canonicalId)
    void narrativeStem
    const displayStem = resolveQuestionStem(q)
    const allHints = (q.hints ?? []).slice(0, 2)
    // GraphBox should plot the question's OWN figure when one is parseable
    // (real points or a stated equation), not always the generic default
    // curve — see lib/plottablePoints.ts. These parse the RAW bank text on
    // purpose: the narrative wrap is display-only and not machine-readable.
    const graphPoints = extractPlottablePoints(q.question)
    const graphExpr = extractGraphableExpression(q.question)

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
            </div>
          </header>

          {/* Scene-beat narrative teaser removed (see ACTIVE_TASK.md). beat/
              beatIndex/storyTeaser stay wired on the panel plumbing for a
              future dedicated wrapping agent; intentionally not rendered
              here anymore. */}

          <HighlightedStem
            text={displayStem}
            ink={theme.ink}
            accent={theme.accent}
            highlights={journalGuide.highlights}
            questionId={q.id}
            graphAlreadyShown={!!graphPoints || !!graphExpr}
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
              chalkInk
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
          {/* Polaroid + scene-setting text removed (see ACTIVE_TASK.md).
              GraphBox takes the top-right slot instead. Polaroid/scene stay
              wired above for a future dedicated wrapping agent. */}
          <GraphBox
            key={`chapter-graph-${q.id}`}
            defaultOpen={GRAPHABLE_CONCEPT_IDS.has(canonicalId) || !!graphPoints || !!graphExpr}
            points={graphPoints ?? undefined}
            initialExpression={graphExpr ?? undefined}
          />
          {wrongCoach?.qIdx === qIdx && (
            <div className={s.wrongCoach} aria-live="polite">
              <p className={s.wrongCoachEyebrow}>What happened</p>
              <WizardMascot line={wrongCoach.line} cheering={false} compact />
            </div>
          )}
        </aside>
      </div>
    )
  }

  function renderPanel() {
    if (!currentPanel) return null
    if (currentPanel.kind === 'open') {
      return renderOpenPanel(currentPanel.paras, currentPanel.pageNum, currentPanel.pageCount)
    }
    return renderQuestPanel(currentPanel.qIdx, currentPanel.beat, currentPanel.beatIndex)
  }

  if (showConceptCover) {
    return (
      <div className={s.conceptCover} style={{ '--theme-accent': theme.accent } as React.CSSProperties}>
        <img className={s.conceptCoverArt} src={artSrc} alt="" draggable={false} />
        <div className={s.conceptCoverScrim} aria-hidden="true" />
        <div className={s.conceptCoverFace}>
          <p className={s.conceptCoverEyebrow}>Chapter</p>
          <h1 className={s.conceptCoverTitle}>{cs.conceptName}</h1>
          {localStory?.settingLine && (
            <p className={s.conceptCoverSetting}>{localStory.settingLine}</p>
          )}
          <button type="button" className={s.conceptCoverOpen} onClick={openConceptCover}>
            Open chapter
          </button>
          <button type="button" className={s.conceptCoverBack} onClick={goBack}>
            ← back
          </button>
        </div>
      </div>
    )
  }

  if (showFormulaSheet) {
    return (
      <div className={s.formulaSheet} style={{ '--theme-accent': theme.accent } as React.CSSProperties}>
        <header className={s.formulaSheetHead}>
          <button type="button" className={s.chromeBack} onClick={goBack}>← back</button>
          <p className={s.formulaSheetEyebrow}>Chapter notes · {questions.length} questions next</p>
          <h1 className={s.formulaSheetTitle}>{cs.conceptName}</h1>
          <p className={s.formulaSheetTag}>{conceptNotes.tagline}</p>
        </header>
        {conceptNotes.formula && (
          <p className={s.formulaSheetBanner}>{conceptNotes.formula}</p>
        )}
        <div className={s.formulaSheetGrid}>
          <section>
            <h2>Key rules</h2>
            <ul>
              {conceptNotes.keyRules.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </section>
          <section>
            <h2>Pro tips</h2>
            <ul>
              {conceptNotes.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </section>
          <section>
            <h2>Watch out</h2>
            <ul>
              {conceptNotes.watchOut.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </section>
          <section className={s.formulaSheetHighlight}>
            <h2>For this batch</h2>
            <p>
              Today&apos;s {questions.length} questions lean on the rules above.
              Highlighted formulas stay pinned in your head: read once, then write.
            </p>
            {conceptNotes.examples.slice(0, 2).map((ex, i) => (
              <div key={i} className={s.formulaSheetExample}>
                <strong>{ex.problem}</strong>
                <span>{ex.solution}</span>
              </div>
            ))}
          </section>
        </div>
        <button
          type="button"
          className={s.formulaSheetCta}
          onClick={() => { setShowFormulaSheet(false); playTap() }}
        >
          Start chapter →
        </button>
      </div>
    )
  }

  return (
    <div
      className={`${s.chapterDesk} ${writeMode ? s.chapterDeskLocked : ''}`}
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
        <button
          type="button"
          className={`${s.canvasWordmark} ${s.wordmarkBtn}`}
          onClick={goToChapterNotes}
          title="Go to your notes for this chapter"
        >
          {cs.conceptName}
        </button>
        <div className={s.canvasChromeRight}>
          <button
            type="button"
            className={s.notesChromeBtn}
            onClick={goToChapterNotes}
          >
            Go to Notes
          </button>
          {currentPanel?.kind === 'quest' && (
            <button
              type="button"
              className={`${s.writeChromeBtn} ${writeMode ? s.writeChromeBtnActive : ''}`}
              onClick={() => setWriteMode(v => !v)}
              aria-pressed={writeMode}
              aria-label={writeMode ? 'Done writing — tap answers again' : 'Write on this page'}
            >
              <PenLine size={16} strokeWidth={2.4} />
              <span>{writeMode ? 'Done' : 'Write'}</span>
            </button>
          )}
          <SoundToggle className={s.soundToggle} />
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
        className={`${s.canvasStage} ${slideDir === 'f' ? s.slideFwd : s.slideBack} ${writeMode ? s.canvasStageWriting : ''}`}
        key={panelIdx}
      >
        {renderPanel()}
      </main>

      {currentPanel?.kind === 'quest' && writeMode && (
        <div className={s.writeDock} role="status">
          <span className={s.writeDockLabel}>Writing on the page</span>
          <div className={s.writeDockActions}>
            {Boolean(notes[currentPanel.qIdx] || (scratchStrokes[currentPanel.qIdx]?.strokes?.length ?? 0) > 0) && (
              <button
                type="button"
                className={s.writeDockClear}
                onClick={() => {
                  const qIdx = currentPanel.qIdx
                  setNotes(n => ({ ...n, [qIdx]: '' }))
                  setScratchStrokes(st => { const next = { ...st }; delete next[qIdx]; return next })
                  setScratchInk(st => { const next = { ...st }; delete next[qIdx]; return next })
                  setDebugOutlines(false)
                  setScratchRev(r => ({ ...r, [qIdx]: (r[qIdx] ?? 0) + 1 }))
                }}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className={s.writeDockDone}
              onClick={() => setWriteMode(false)}
            >
              Done writing
            </button>
          </div>
        </div>
      )}

      <nav className={s.spreadNav}>
        <button type="button" className={s.navArrow} onClick={() => goToPanel(panelIdx - 1, 'b')} aria-label="Previous">←</button>
        {/* Return visits skip straight to the first quest panel (see the
            `hasSeenStory` gate above) — the story pages are never actually
            gone, but nothing distinguished a "story" dot from a "quest" dot
            below, so a returning student (or anyone testing the same
            concept twice in one browser) had no way to tell those dimmed
            dots were the story rather than already-answered questions. This
            reads as "the story is missing" even though it's one click away.
            Fix: story dots get their own shape (see .dotStory) + a proper
            label, and a quick "Story" jump-back link shows up whenever
            you're on a quest panel with story pages behind you. */}
        {currentPanel?.kind === 'quest' && panels.some(p => p.kind === 'open') && (
          <button
            type="button"
            className={s.storyJumpBack}
            style={{ color: theme.accent }}
            onClick={() => goToPanel(0, 'b')}
          >
            ↺ Story
          </button>
        )}
        <div className={s.navDots}>
          {panels.map((p, i) => (
            <button
              key={i}
              type="button"
              className={[
                s.dot,
                p.kind === 'open' ? s.dotStory : '',
                i === panelIdx ? s.dotActive : '',
                i < panelIdx ? s.dotPast : '',
              ].filter(Boolean).join(' ')}
              style={i === panelIdx ? { background: theme.accent } : i < panelIdx ? { background: theme.accent + '55' } : undefined}
              onClick={() => goToPanel(i, i > panelIdx ? 'f' : 'b')}
              aria-label={p.kind === 'open' ? `Story page ${p.pageNum} of ${p.pageCount}` : `Question ${p.qIdx + 1}`}
            />
          ))}
        </div>
        {isLast ? (
          <button
            type="button"
            className={s.navPrimary}
            style={{ background: theme.ink, color: theme.paper }}
            onClick={() => navigate('/dashboard', { replace: true })}
          >
            Go to Dashboard →
          </button>
        ) : (
          <button type="button" className={s.navArrow} onClick={() => goToPanel(panelIdx + 1, 'f')} aria-label="Next">→</button>
        )}
      </nav>
    </div>
  )
}
