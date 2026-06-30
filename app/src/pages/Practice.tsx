import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useUser } from '../App'
import { useRef, useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import AppTabBar from '../components/AppTabBar'
import { ConceptPathIcon } from '../components/ConceptPathIcon'
import { ScientificCalcPanel, ScientificCalcToggle } from '../components/ScientificCalculator'
import { useStudentData } from '../hooks/useStudentData'
import HomeworkCards, { type HomeworkSession, type HomeworkCard, type OutcomeRecord } from '../components/HomeworkCards'
import {
  type Question,
  type FormatId,
  PRACTICE_CONCEPTS,
  LEVEL_META,
  getQuestions,
  questionCount,
  questionFormat,
  shuffle,
} from '../lib/questionBank'
import { generateQuestions, evictQuestionCache } from '../lib/questionAgent'
import { getConceptContent } from '../lib/conceptContent'
import { mlIdToLabel, toOntologyId } from '../lib/conceptMap'
import { type BridgeRecommendation, allowedLevels, getRecommendedLevel as levelFromConfidence } from '../lib/bridgePractice'
import { getExamConceptIds } from '../lib/examCurricula'
import { seedAssessment, recordOutcomes, getIngredientCards, agentCheckIn, fetchExamConceptIds, type IngredientRecommendResult } from '../lib/mlApi'
import { fetchNextConcept, fetchNextNewConcept, fetchPracticeHubRecommendations } from '../lib/recommendNextConcept'
import { invalidateKnowledgeGraph } from '../lib/graphCache'
import { markDiagnosticComplete, savePracticeDraftRemote, loadPracticeDraftsRemote, loadDiagnostic, getUserRole } from '../lib/practiceState'
import { buildNoContentMessage } from '../lib/ontologyBankCoverage'
import { pathMasteredStorageKey, notifyPracticePathUpdated } from '../lib/practicePathQueue'
import { solveWithGemini, clueWithGemini } from '../lib/geminiHomework'
import s from './Practice.module.css'

const HOMEWORK_API = import.meta.env.VITE_HOMEWORK_API_URL ?? 'http://localhost:8001'
const SLACK_INVITE = 'https://join.slack.com/t/mindcraftnetwork/shared_invite/zt-3vnl9tmvm-sTq8wFPky0LcOGWcK_COHg'
const SESSION_LENGTH = 10   // Bloom's mastery: min 10 trials for 80% threshold
const MAX_SESSION    = 14   // hard cap when re-queuing wrong answers
const PRACTICE_DRAFT_VERSION = 2
const PATH_SLOT_COUNT = 6

type PracticePhase =
  | 'onboard' | 'exam-pick' | 'confidence' | 'building'
  | 'gap-analysis' | 'path' | 'explore' | 'level' | 'checkin' | 'session' | 'complete'
  | 'no-content'
type SolverPhase   = 'input' | 'loading' | 'cards' | 'done'
type Mode          = 'practice' | 'solver'
type Confidence    = 'easy' | 'kinda' | 'hard'
// A resumable mission is one of three kinds; each persists in its own slot so a
// weakness AND a learn mission can be in-progress at once.
type MissionType   = 'weakness' | 'learn' | 'gapscan'
const MISSION_LABEL: Record<MissionType, string> = {
  weakness: 'Weakness practice',
  learn:    'New concept',
  gapscan:  'Gap scan',
}

type PracticeDraft = {
  version: number
  name: string
  savedAt: number
  exam: string
  assessConceptIds: string[]
  confidenceStep: number
  confidenceMap: Record<string, Confidence>
  missionType: MissionType
  pPhase: PracticePhase
  concept: string | null
  level: 1 | 2 | 3
  questions: Question[]
  qIndex: number
  selected: number | null
  checked: boolean
  hintsShown: number
  results: boolean[]
  xp: number
  requeuedIds: string[]
  initialQCount: number
  sessionBridge: BridgeRecommendation | null
  /** C4 — gap-scan question diagnostic hides right/wrong. */
  hideCorrectness?: boolean
  /** Concepts still needing self-rating after the question diagnostic. */
  confidenceQueueIds?: string[]
}

const EXAMS = ['ACT', 'SAT', 'IB', 'AP', 'General'] as const
type ExamType = typeof EXAMS[number]

const FALLBACK_EXAM: ExamType = 'General'

const EXAM_DESCRIPTIONS: Record<ExamType, string> = {
  ACT:     '36-point math — algebra & trig',
  SAT:     '800-point math — algebra & data',
  IB:      'IB Math AI SL — modelling & stats',
  AP:      'Advanced Placement — calculus & stats',
  General: 'General math improvement',
}
const EXAM_CARD_META: Record<ExamType, { icon: string; accent: string; micro: string }> = {
  ACT:     { icon: '36', accent: '#FF6B6B', micro: 'Algebra speed' },
  SAT:     { icon: '800', accent: '#4ECDC4', micro: 'Data + functions' },
  IB:      { icon: 'AI', accent: '#A29BFE', micro: 'Modelling SL' },
  AP:      { icon: 'AP', accent: '#FFE66D', micro: 'Calc readiness' },
  General: { icon: '+', accent: '#C4F547', micro: 'Custom path' },
}

const CONFIDENCE_COPY: Record<ExamType, string> = {
  ACT:     'ACT rewards speed. Pick the level where you can solve fast without careless misses.',
  SAT:     'SAT questions hide algebra inside context. Pick how steady this skill feels under wording pressure.',
  IB:      'IB Math AI SL rewards modelling, calculator fluency, statistics, and clear interpretation. Pick how steady this feels in context.',
  AP:      'AP leans on function behavior and notation. Pick the level you can handle under exam-style setup.',
  General: 'Pick the level that matches how this skill feels today.',
}

const CONFIDENCE_OPTIONS: Record<ExamType, Record<Confidence, { label: string; desc: string }>> = {
  ACT: {
    easy:  { label: 'Fast and accurate', desc: 'Timed ACT-style questions, fewer warmups' },
    kinda: { label: 'Speed is shaky',    desc: 'Practice with traps and pacing called out' },
    hard:  { label: 'Rebuild it',        desc: 'Core skill first, then ACT shortcuts' },
  },
  SAT: {
    easy:  { label: 'Context-ready',     desc: 'Wordy SAT setups with units and data' },
    kinda: { label: 'Setup is shaky',    desc: 'Translate the wording before the math' },
    hard:  { label: 'Rebuild it',        desc: 'Foundation first, then SAT framing' },
  },
  IB: {
    easy:  { label: 'Model-ready',       desc: 'AI SL contexts, calculator-friendly questions' },
    kinda: { label: 'Interpretation shaky', desc: 'Practice setup, graph reading, and explanation' },
    hard:  { label: 'Rebuild it',        desc: 'Core concept first, then AI SL modelling' },
  },
  AP: {
    easy:  { label: 'Notation-ready',    desc: 'Functions, intervals, and AP-style prompts' },
    kinda: { label: 'Reasoning is shaky', desc: 'Work through graphs, rates, and wording' },
    hard:  { label: 'Rebuild it',        desc: 'Core idea first, then AP setup' },
  },
  General: {
    easy:  { label: 'Confident',         desc: 'Challenge questions, fewer warmups' },
    kinda: { label: 'Shaky',             desc: 'Applied practice with traps called out' },
    hard:  { label: 'Needs rebuild',     desc: 'Foundation first, then challenge style' },
  },
}

const EXAM_CONCEPT_IDS: Record<ExamType, string[]> = {
  ACT: [
    'number_properties',
    'percent_ratio',
    'linear_equations',
    'linear_inequalities',
    'absolute_value',
    'systems_of_linear_equations',
    'exponent_rules',
    'polynomials',
    'quadratic_equations',
    'rational_expressions',
    'functions_basics',
    'function_transformations',
    'word_problems',
    'descriptive_statistics',
    'basic_probability',
  ],
  SAT: [
    'linear_equations',
    'linear_inequalities',
    'systems_of_linear_equations',
    'absolute_value',
    'quadratic_equations',
    'polynomials',
    'rational_expressions',
    'exponent_rules',
    'functions_basics',
    'function_transformations',
    'word_problems',
    'percent_ratio',
    'descriptive_statistics',
    'basic_probability',
  ],
  IB: [
    'number_properties',
    'percent_ratio',
    'linear_equations',
    'linear_inequalities',
    'systems_of_linear_equations',
    'exponent_rules',
    'polynomials',
    'quadratic_equations',
    'rational_expressions',
    'functions_basics',
    'function_transformations',
    'word_problems',
    'descriptive_statistics',
    'basic_probability',
  ],
  AP: [
    'functions_basics',
    'function_transformations',
    'exponent_rules',
    'polynomials',
    'rational_expressions',
    'descriptive_statistics',
    'basic_probability',
    'word_problems',
    'linear_equations',
    'quadratic_equations',
  ],
  General: [
    'number_properties',
    'percent_ratio',
    'linear_equations',
    'linear_inequalities',
    'absolute_value',
    'systems_of_linear_equations',
    'exponent_rules',
    'polynomials',
    'quadratic_equations',
    'rational_expressions',
    'functions_basics',
    'function_transformations',
    'descriptive_statistics',
    'basic_probability',
    'word_problems',
  ],
}

function bridgeLabel(id: string) {
  return PRACTICE_CONCEPTS.find(c => c.id === id)?.label ?? mlIdToLabel(id)
}

function safeQuestionSvg(question: Question) {
  if (question.visual_type !== 'svg' || !question.visual_data) return ''
  const svg = question.visual_data.trim()
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>') || svg.length > 4500) return ''
  if (/(<script|<foreignObject|javascript:|data:|on\w+=)/i.test(svg)) return ''
  return svg
}

function practiceDraftKey(uid: string, type: MissionType) {
  return `mindcraft:exam-help:${uid}:${type}`
}
// Pre-mission-type single-slot key — migrated into the gap-scan slot on load.
function legacyPracticeDraftKey(uid: string) {
  return `mindcraft:exam-help:${uid}:process-1`
}
const MISSION_TYPES: MissionType[] = ['weakness', 'learn', 'gapscan']

function conceptsFromIds(ids: string[]) {
  return ids.flatMap(id => {
    const concept = PRACTICE_CONCEPTS.find(c => c.id === id)
    return concept ? [concept] : []
  })
}

// Map concept_chip string from homework cards → practice concept id
function chipToConceptId(chip: string): string | null {
  const normalized = chip.toLowerCase().replace(/[\s-]+/g, '_')
  const direct = PRACTICE_CONCEPTS.find(c => c.id === normalized)
  if (direct) return direct.id
  const partial = PRACTICE_CONCEPTS.find(c =>
    normalized.includes(c.id.slice(0, 6)) || c.id.includes(normalized.slice(0, 6))
  )
  return partial?.id ?? null
}

// Fallback: render the deterministic ingredient-pipeline cards in the homework UI
// when the LLM solver is unavailable. concept_chip carries the ontology id so the
// outcome buttons still feed the student graph.
function ingredientResultToSession(
  ing: IngredientRecommendResult,
  problemText: string,
): HomeworkSession {
  const concept = ing.problemFeatures.primary_concept
  const cards: HomeworkCard[] = ing.cards.map((c, i) => ({
    step_number: i + 1,
    total_steps: ing.cards.length,
    type: 'reframe',
    concept_chip: concept,
    content: c.prompt ? `${c.body}\n\n${c.prompt}` : c.body,
    visual_type: 'none',
    visual_data: '',
    is_visual_step: false,
  }))
  return {
    session_id: `ingredient-${Date.now()}`,
    problem_summary: problemText,
    target_concept: mlIdToLabel(concept),
    path_framing: ing.compositionPrompt || 'Work through these building blocks in order.',
    cards,
    paths_explored: 1,
  }
}

function PixelCraft({ size = 'sm', className = '' }: { size?: 'sm' | 'lg' | 'md'; className?: string }) {
  return (
    <div className={`${s.pixelCraft} ${s[`pixelCraft${size.toUpperCase()}`]} ${className}`} aria-label="Craft mascot" role="img">
      <span className={s.pixelEarLeft} />
      <span className={s.pixelEarRight} />
      <span className={s.pixelHead}>
        <span className={s.pixelMaskLeft} />
        <span className={s.pixelMaskRight} />
        <span className={s.pixelEyeLeft} />
        <span className={s.pixelEyeRight} />
        <span className={s.pixelNose} />
      </span>
      <span className={s.pixelHeart} />
    </div>
  )
}

export default function Practice() {
  const user     = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { streak, practiceCount } = useStudentData(user)
  const fileRef  = useRef<HTMLInputElement>(null)
  const answerInputRef = useRef<HTMLInputElement>(null)
  const draftHydratedRef = useRef(false)
  const skipDiagnosticRestoreRef = useRef(
    !!(location.state as { examHelp?: boolean } | null)?.examHelp,
  )
  const remoteSaveTimer = useRef<number | null>(null)

  const [mode, setMode] = useState<Mode>('practice')

  // ── Onboarding state ──────────────────────────────────────────────────────
  const [exam,           setExam]           = useState<string>('')
  const [assessConcepts, setAssessConcepts] = useState<typeof PRACTICE_CONCEPTS>([])
  const [confidenceStep, setConfidenceStep] = useState(0)
  const [confidenceMap,  setConfidenceMap]  = useState<Record<string, Confidence>>({})

  // ── Practice state ────────────────────────────────────────────────────────
  const [pPhase,     setPPhase]     = useState<PracticePhase>('path')
  const [concept,    setConcept]    = useState<string | null>(null)
  const [level,      setLevel]      = useState<1|2|3>(1)
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [qIndex,     setQIndex]     = useState(0)
  const [selected,   setSelected]   = useState<number | null>(null)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [showCalc,   setShowCalc]   = useState(false)
  const [checked,    setChecked]    = useState(false)
  const [hintsShown, setHintsShown] = useState(0)
  const [results,      setResults]      = useState<boolean[]>([])
  const [xp,           setXp]           = useState(0)
  const [requeuedIds,  setRequeuedIds]  = useState<string[]>([])
  const [initialQCount,setInitialQCount]= useState(0)
  const [sessionBridge,setSessionBridge]= useState<BridgeRecommendation | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [masteredPathIds, setMasteredPathIds] = useState<Set<string>>(() => new Set())
  // One resumable draft per mission type (weakness / learn / gapscan).
  const [savedDrafts, setSavedDrafts] = useState<Partial<Record<MissionType, PracticeDraft>>>({})
  // Which mission is currently active (drives which slot autosave writes to), and
  // which hub start-card is loading.
  const [missionType, setMissionType] = useState<MissionType | null>(null)
  const [missionLoading, setMissionLoading] = useState<'weakness' | 'learn' | null>(null)
  const [diagnosticHydrated, setDiagnosticHydrated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  /** C4 — gap-scan question diagnostic: record outcomes, never show right/wrong. */
  const [hideCorrectness, setHideCorrectness] = useState(false)
  /** Concepts still needing self-rating after the question diagnostic. */
  const [confidenceQueue, setConfidenceQueue] = useState<typeof PRACTICE_CONCEPTS>([])
  /** Format vessel for format-gap weakness missions (C3). */
  const [sessionFormat, setSessionFormat] = useState<FormatId | null>(null)

  // ── Check-in state ────────────────────────────────────────────────────────
  const [checkinText,    setCheckinText]    = useState('')
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [contentGapMessage, setContentGapMessage] = useState<string | null>(null)
  // Pending session params while the check-in screen is shown
  const checkinPendingRef = useRef<{ conceptId: string; lv: 1|2|3; bridge?: BridgeRecommendation } | null>(null)

  // ── Solver state ──────────────────────────────────────────────────────────
  const [sPhase,     setSPhase]     = useState<SolverPhase>('input')
  const [problem,    setProblem]    = useState('')
  const [solverFile, setSolverFile] = useState<File | null>(null)
  const [session,    setSession]    = useState<HomeworkSession | null>(null)
  const [sResults,   setSResults]   = useState<OutcomeRecord[]>([])
  const [error,      setError]      = useState('')
  const [slowLoad,   setSlowLoad]   = useState(false)

  function clearPracticeDraft(type: MissionType) {
    localStorage.removeItem(practiceDraftKey(user.uid, type))
    setSavedDrafts(prev => { const next = { ...prev }; delete next[type]; return next })
    void savePracticeDraftRemote(user.uid, type, null)
  }

  function beginGapScan() {
    clearPracticeDraft('gapscan')
    setDraftRestored(false)
    setMissionType('gapscan')
    setMode('practice')
    setPPhase('exam-pick')
    setExam('')
    setConfidenceMap({})
    setConfidenceStep(0)
    setAssessConcepts([])
    setConcept(null)
    setSelected(null)
    setChecked(false)
    setHintsShown(0)
    setResults([])
    setXp(0)
    setRequeuedIds([])
    setInitialQCount(0)
    setSessionBridge(null)
    setMasteredPathIds(new Set())
    setHideCorrectness(false)
    setConfidenceQueue([])
    setSessionFormat(null)
    localStorage.removeItem(pathMasteredStorageKey(user.uid))
  }

  function restorePracticeDraft(draft: PracticeDraft): boolean {
    const type: MissionType = draft.missionType ?? 'gapscan'
    const restoredConcepts = conceptsFromIds(draft.assessConceptIds ?? [])
    // Gap-scan missions need their assessment concepts; weakness/learn just need
    // a target concept.
    if (type === 'gapscan' && restoredConcepts.length === 0) return false
    if (type !== 'gapscan' && !draft.concept) return false

    setMode('practice')
    setMissionType(type)
    setExam(draft.exam)
    setAssessConcepts(restoredConcepts)
    setConfidenceStep(Math.min(draft.confidenceStep, Math.max(restoredConcepts.length - 1, 0)))
    setConfidenceMap(draft.confidenceMap ?? {})
    const restoredPhase = draft.pPhase === 'onboard' ? 'path'
      : draft.pPhase === 'session' && !draft.questions?.length
      ? (type === 'gapscan' ? 'path' : 'level')
      : draft.pPhase === 'building' || draft.pPhase === 'gap-analysis'
      ? 'path'
      : draft.pPhase
    setPPhase(restoredPhase)
    setConcept(draft.concept)
    setLevel(draft.level ?? 1)
    setQuestions(Array.isArray(draft.questions) ? draft.questions : [])
    const questionCount = Array.isArray(draft.questions) ? draft.questions.length : 0
    setQIndex(Math.min(draft.qIndex ?? 0, Math.max(questionCount - 1, 0)))
    setSelected(draft.selected ?? null)
    setChecked(draft.checked ?? false)
    setHintsShown(draft.hintsShown ?? 0)
    setResults(Array.isArray(draft.results) ? draft.results : [])
    setXp(draft.xp ?? 0)
    setRequeuedIds(Array.isArray(draft.requeuedIds) ? draft.requeuedIds : [])
    setInitialQCount(draft.initialQCount ?? 0)
    setSessionBridge(draft.sessionBridge ?? null)
    setHideCorrectness(draft.hideCorrectness ?? false)
    const queueIds = draft.confidenceQueueIds ?? []
    setConfidenceQueue(queueIds.flatMap(id => {
      const c = PRACTICE_CONCEPTS.find(x => x.id === id)
      return c ? [c] : []
    }))
    setDraftRestored(true)
    setSavedDrafts(prev => ({ ...prev, [type]: draft }))
    return true
  }

  function loadSavedPracticeDraft(type: MissionType) {
    const raw = localStorage.getItem(practiceDraftKey(user.uid, type))
    if (!raw) return false
    try {
      const draft = JSON.parse(raw) as PracticeDraft
      if (draft.version !== PRACTICE_DRAFT_VERSION) return false
      return restorePracticeDraft({ ...draft, missionType: draft.missionType ?? type })
    } catch {
      clearPracticeDraft(type)
      return false
    }
  }

  // Read every local draft slot (migrating the legacy single slot → gapscan) so
  // the hub can show a resume card per in-progress mission.
  function loadAllDraftSlots(): Partial<Record<MissionType, PracticeDraft>> {
    const legacy = localStorage.getItem(legacyPracticeDraftKey(user.uid))
    if (legacy) {
      try {
        const d = JSON.parse(legacy) as PracticeDraft
        localStorage.setItem(
          practiceDraftKey(user.uid, 'gapscan'),
          JSON.stringify({ ...d, missionType: 'gapscan' }),
        )
      } catch { /* ignore */ }
      localStorage.removeItem(legacyPracticeDraftKey(user.uid))
    }
    const found: Partial<Record<MissionType, PracticeDraft>> = {}
    for (const t of MISSION_TYPES) {
      const raw = localStorage.getItem(practiceDraftKey(user.uid, t))
      if (!raw) continue
      try {
        const d = JSON.parse(raw) as PracticeDraft
        if (d.version === PRACTICE_DRAFT_VERSION) found[t] = { ...d, missionType: t }
      } catch { /* ignore */ }
    }
    return found
  }

  function showPracticeHome() {
    setMode('practice')
    setPPhase('path')
    setSelected(null)
    setChecked(false)
    setHintsShown(0)
  }

  useEffect(() => {
    getUserRole(user.uid).then(role => setIsAdmin(role === 'admin'))
  }, [user.uid])

  useEffect(() => {
    if (draftHydratedRef.current) return
    const state = location.state as {
      problemText?: string
      examHelp?: boolean
      homeworkHelp?: boolean
      conceptId?: string
      missionType?: 'weakness' | 'learn'
      resumeMission?: 'weakness' | 'learn'
      showPath?: boolean
    } | null
    const slots = loadAllDraftSlots()
    setSavedDrafts(slots)
    setMode('practice')
    // Retake / first-time gap scan: always restart exam pick + confidence flow.
    if (state?.examHelp) {
      beginGapScan()
    } else if (!state?.conceptId && !state?.resumeMission && !state?.showPath) {
      setAssessConcepts([])
      setPPhase('path')
    }
    draftHydratedRef.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(pathMasteredStorageKey(user.uid))
      if (raw) setMasteredPathIds(new Set(JSON.parse(raw) as string[]))
    } catch { /* ignore corrupt storage */ }
  }, [user.uid])

  function markPathMastered(conceptId: string) {
    setMasteredPathIds(prev => {
      if (prev.has(conceptId)) return prev
      const next = new Set(prev).add(conceptId)
      localStorage.setItem(pathMasteredStorageKey(user.uid), JSON.stringify([...next]))
      notifyPracticePathUpdated()
      return next
    })
  }

  function isPathMastered(conceptId: string) {
    return masteredPathIds.has(conceptId)
  }

  // Restore gap-scan ratings + exam track so path ordering and level picks persist.
  useEffect(() => {
    if (skipDiagnosticRestoreRef.current) {
      setDiagnosticHydrated(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const diagnostic = await loadDiagnostic(user.uid)
        if (cancelled || !diagnostic) return
        setExam(diagnostic.exam ?? '')
        setConfidenceMap(diagnostic.confidenceMap as Record<string, Confidence>)
        if (!diagnostic.exam) return
        const ids = await fetchExamConceptIds(diagnostic.exam)
        const source = ids.length > 0 ? ids : getExamConceptIds(diagnostic.exam)
        setAssessConcepts(source.flatMap(id => {
          const c = PRACTICE_CONCEPTS.find(c => c.id === id)
          return c ? [c] : []
        }))
      } finally {
        if (!cancelled) setDiagnosticHydrated(true)
      }
    })()
    return () => { cancelled = true }
  }, [user.uid])

  // Cross-device restore: if no local slots, pull the saved drafts from Firestore
  // (e.g. the student switched devices) and surface them on the hub.
  useEffect(() => {
    if (MISSION_TYPES.some(t => localStorage.getItem(practiceDraftKey(user.uid, t)))) return
    let cancelled = false
    loadPracticeDraftsRemote(user.uid).then(map => {
      if (cancelled) return
      const found: Partial<Record<MissionType, PracticeDraft>> = {}
      for (const [t, d] of Object.entries(map)) {
        if (!MISSION_TYPES.includes(t as MissionType)) continue
        const draft = d as PracticeDraft
        if (draft?.version !== PRACTICE_DRAFT_VERSION) continue
        const typed = { ...draft, missionType: t as MissionType }
        found[t as MissionType] = typed
        localStorage.setItem(practiceDraftKey(user.uid, t as MissionType), JSON.stringify(typed))
      }
      if (Object.keys(found).length) setSavedDrafts(prev => ({ ...found, ...prev }))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid])

  useEffect(() => {
    const pathOn = mode === 'practice' && pPhase === 'path'
    const matteOn = mode === 'practice' && ['explore', 'level', 'checkin', 'session', 'complete'].includes(pPhase)
    document.body.classList.toggle('mc-path-backdrop', pathOn)
    document.body.classList.toggle('mc-matte-backdrop', matteOn)
    return () => {
      document.body.classList.remove('mc-path-backdrop')
      document.body.classList.remove('mc-matte-backdrop')
    }
  }, [mode, pPhase])

  useEffect(() => {
    if (!draftHydratedRef.current) return
    if (mode !== 'practice') return
    if (!missionType) return            // no active mission → nothing to save
    if (pPhase === 'onboard' || pPhase === 'path') return
    // Only persist once there's something resumable: gap-scan needs assessment
    // concepts; weakness/learn need a target concept.
    const resumable = missionType === 'gapscan'
      ? (!!exam && assessConcepts.length > 0)
      : !!concept
    if (!resumable) return

    const savedPhase: PracticePhase = pPhase === 'building' ? 'confidence' : pPhase
    const draft: PracticeDraft = {
      version: PRACTICE_DRAFT_VERSION,
      name: MISSION_LABEL[missionType],
      savedAt: Date.now(),
      missionType,
      exam,
      assessConceptIds: assessConcepts.map(c => c.id),
      confidenceStep,
      confidenceMap,
      pPhase: savedPhase,
      concept,
      level,
      questions,
      qIndex,
      selected,
      checked,
      hintsShown,
      results,
      xp,
      requeuedIds,
      initialQCount,
      sessionBridge,
      hideCorrectness,
      confidenceQueueIds: confidenceQueue.map(c => c.id),
    }

    localStorage.setItem(practiceDraftKey(user.uid, missionType), JSON.stringify(draft))
    setSavedDrafts(prev => ({ ...prev, [missionType]: draft }))
    // Mirror to Firestore (debounced) so progress is durable + cross-device.
    if (remoteSaveTimer.current) window.clearTimeout(remoteSaveTimer.current)
    remoteSaveTimer.current = window.setTimeout(() => {
      void savePracticeDraftRemote(user.uid, missionType, draft)
    }, 2000)
  }, [
    user.uid,
    mode,
    missionType,
    exam,
    assessConcepts,
    confidenceStep,
    confidenceMap,
    pPhase,
    concept,
    level,
    questions,
    qIndex,
    selected,
    checked,
    hintsShown,
    results,
    xp,
    requeuedIds,
    initialQCount,
    sessionBridge,
    hideCorrectness,
    confidenceQueue,
  ])

  // Auto-submit if navigated from dashboard with problemText; open the requested flow otherwise.
  useEffect(() => {
    const state = location.state as {
      problemText?: string
      examHelp?: boolean
      homeworkHelp?: boolean
      conceptId?: string
      missionType?: 'weakness' | 'learn'
      formatId?: FormatId
      resumeMission?: 'weakness' | 'learn'
      showPath?: boolean
    } | null
    if (state?.problemText) {
      setMode('solver')
      setProblem(state.problemText)
      submitProblem(state.problemText)
      window.history.replaceState({}, '')
    } else if (state?.conceptId) {
      void launchMissionDirect(state.conceptId, state.missionType ?? 'weakness', state.formatId)
      window.history.replaceState({}, '')
    } else if (state?.resumeMission) {
      loadSavedPracticeDraft(state.resumeMission)
      window.history.replaceState({}, '')
    } else if (state?.showPath) {
      setMode('practice')
      setAssessConcepts([])
      setPPhase('path')
      window.history.replaceState({}, '')
    } else if (state?.homeworkHelp) {
      setMode('solver')
      setSPhase('input')
      window.history.replaceState({}, '')
    } else if (state?.examHelp) {
      beginGapScan()
      window.history.replaceState({}, '')
    } else if (searchParams.get('homeworkHelp') === '1') {
      setMode('solver')
      setSPhase('input')
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('learnNext') === '1') {
      setSearchParams({}, { replace: true })
      void fetchPracticeHubRecommendations(user.uid).then(rec => {
        const target = rec.learn
        navigate(
          target
            ? `/dashboard?view=gps&concept=${encodeURIComponent(target.conceptId)}`
            : '/dashboard?view=gps&learnNext=1',
          { replace: true },
        )
      })
    } else if (searchParams.get('mode') === 'practice') {
      setMode('practice')
      setAssessConcepts([])
      setPPhase('path')
      setSearchParams({}, { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Onboarding handlers ───────────────────────────────────────────────────

  function pickExam(e: string) {
    setExam(e)
    void (async () => {
      const ids = await fetchExamConceptIds(e)
      const source = ids.length > 0 ? ids : getExamConceptIds(e)
      const filtered = source.flatMap(id => {
        const c = PRACTICE_CONCEPTS.find(c => c.id === id)
        return c ? [c] : []
      })
      setAssessConcepts(filtered)
      setConfidenceStep(0)
      setConfidenceMap({})
      const playable = filtered.filter(c =>
        ([1, 2, 3] as const).some(l => questionCount(c.id, l) > 0),
      )
      const notPlayable = filtered.filter(c => !playable.some(p => p.id === c.id))
      setConfidenceQueue(notPlayable)
      if (playable.length > 0) {
        startGapQuestionDiagnostic(playable, e)
      } else {
        setPPhase('confidence')
      }
    })()
  }

  function finishGapScan(updated: Record<string, Confidence>) {
    void seedAssessment(user.uid, updated)
    invalidateKnowledgeGraph(user.uid)
    void markDiagnosticComplete(user.uid, { exam, confidenceMap: updated })
    notifyPracticePathUpdated()
    setHideCorrectness(false)
    setConfidenceQueue([])
    setPPhase('building')
    setTimeout(() => {
      clearPracticeDraft('gapscan')
      navigate('/dashboard', { replace: true })
    }, 2200)
  }

  function startGapQuestionDiagnostic(playable: typeof PRACTICE_CONCEPTS, examTrack: string) {
    setHideCorrectness(true)
    setMissionType('gapscan')
    setPPhase('building')
    const examType = (EXAMS.includes(examTrack as ExamType) ? examTrack : FALLBACK_EXAM) as ExamType
    const qs: Question[] = []
    for (const c of playable) {
      const lv = ([1, 2, 3] as const).find(l => questionCount(c.id, l) > 0) ?? 2
      const batch = getQuestions(c.id, lv, 1, [], examType)
      if (batch[0]) qs.push(batch[0])
    }
    setSessionFormat(null)
    setConcept(null)
    setQuestions(qs)
    setQIndex(0)
    setSelected(null)
    setTypedAnswer('')
    setChecked(false)
    setHintsShown(0)
    setResults([])
    setXp(0)
    setRequeuedIds([])
    setInitialQCount(qs.length)
    setLevel(2)
    setPPhase('session')
  }

  async function completeGapQuestionDiagnostic(resultsSnapshot: boolean[]) {
    const fromQuestions: Record<string, Confidence> = {}
    questions.forEach((q, i) => {
      fromQuestions[toOntologyId(q.conceptId)] = resultsSnapshot[i] ? 'easy' : 'hard'
    })
    const merged = { ...fromQuestions, ...confidenceMap }
    setConfidenceMap(merged)

    const perQuestion = resultsSnapshot.map((correct, i) => ({
      conceptId: toOntologyId(questions[i].conceptId),
      score: correct ? 1 : 0,
      level: questions[i].level,
      questionId: questions[i].id,
      formatId: questionFormat(questions[i]),
    }))
    void recordOutcomes(user.uid, perQuestion)
    invalidateKnowledgeGraph(user.uid)

    setHideCorrectness(false)
    setQuestions([])
    setQIndex(0)
    setResults([])
    setSelected(null)
    setChecked(false)

    if (confidenceQueue.length > 0) {
      setConfidenceStep(0)
      setPPhase('confidence')
      return
    }
    finishGapScan(merged)
  }

  function pickConfidence(conf: Confidence) {
    const ratingList = confidenceQueue.length > 0 ? confidenceQueue : assessConcepts
    const current = ratingList[confidenceStep]
    const updated = { ...confidenceMap, [current.id]: conf }
    setConfidenceMap(updated)
    if (confidenceStep + 1 >= ratingList.length) {
      finishGapScan(updated)
    } else {
      setConfidenceStep(i => i + 1)
    }
  }

  // Returns recommended level based on self-reported confidence
  function getRecommendedLevel(conceptId: string): 1|2|3 {
    const conf = confidenceMap[conceptId]
    return levelFromConfidence(conf)
  }

  function missionLevel(mission: 'weakness' | 'learn', conf: Confidence | undefined): 1|2|3 {
    if (mission === 'learn' && !conf) return 1
    return levelFromConfidence(conf)
  }

  async function launchMissionDirect(
    conceptId: string,
    mission: 'weakness' | 'learn',
    formatId?: FormatId,
  ) {
    setMode('practice')
    setMissionType(mission)
    setSessionFormat(formatId ?? null)
    const diagnostic = await loadDiagnostic(user.uid)
    const conf = (diagnostic?.confidenceMap[conceptId] ?? confidenceMap[conceptId]) as Confidence | undefined
    const lv = missionLevel(mission, conf)
    await startSession(conceptId, lv, undefined, formatId)
  }

  // ── Mission hub launchers ─────────────────────────────────────────────────
  function launchConceptPractice(conceptId: string, mission?: 'weakness' | 'learn') {
    const m = mission ?? (missionType === 'learn' ? 'learn' : 'weakness')
    void launchMissionDirect(conceptId, m)
  }

  function enterMission(type: 'weakness' | 'learn', conceptId: string) {
    void launchMissionDirect(conceptId, type)
  }

  async function startWeaknessMission() {
    setMissionLoading('weakness')
    try {
      const next = await fetchNextConcept(user.uid)
      if (next) void launchMissionDirect(next.conceptId, 'weakness', next.formatId)
      else { setMissionType('gapscan'); clearPracticeDraft('gapscan'); setPPhase('exam-pick') }
    } finally { setMissionLoading(null) }
  }

  async function startLearnMission() {
    setMissionLoading('learn')
    try {
      const next = await fetchNextNewConcept(user.uid)
      if (next) enterMission('learn', next.conceptId)
      else { setAssessConcepts([]); setPPhase('path') }
    } finally { setMissionLoading(null) }
  }

  // ── Gap analysis helpers ──────────────────────────────────────────────────

  const hardConcepts  = assessConcepts.filter(c => confidenceMap[c.id] === 'hard')
  const kindaConcepts = assessConcepts.filter(c => confidenceMap[c.id] === 'kinda')
  const easyConcepts  = assessConcepts.filter(c => confidenceMap[c.id] === 'easy')
  // The single best concept to start with (hardest first, then kinda)
  const topPriority = hardConcepts[0] ?? kindaConcepts[0] ?? easyConcepts[0] ?? assessConcepts[0]

  // ── Practice helpers ──────────────────────────────────────────────────────

  function pickConcept(conceptId: string) {
    setConcept(conceptId)
    setPPhase('explore')
  }

  function showCheckin(conceptId: string, lv: 1|2|3, bridge?: BridgeRecommendation) {
    checkinPendingRef.current = { conceptId, lv, bridge }
    setCheckinText('')
    setPPhase('checkin')
  }

  async function submitCheckin() {
    const pending = checkinPendingRef.current
    if (!pending) return
    if (checkinText.trim()) {
      setCheckinLoading(true)
      // Fire-and-forget — result stored in Firestore; /recommend reads it next call
      await agentCheckIn(user.uid, checkinText.trim())
      setCheckinLoading(false)
    }
    await startSession(pending.conceptId, pending.lv, pending.bridge)
  }

  async function startSession(
    conceptId: string,
    lv: 1|2|3,
    bridge?: BridgeRecommendation,
    formatId?: FormatId,
  ) {
    // Show building screen while we fetch dynamic questions
    setPPhase('building')
    setConcept(conceptId)
    setLevel(lv)
    setSessionBridge(bridge ?? null)
    const fmt = formatId ?? sessionFormat ?? undefined

    const examType = (EXAMS.includes(exam as ExamType) ? exam : FALLBACK_EXAM) as ExamType

    // Fresh draw every session — sessionStorage cache otherwise replays the same set.
    evictQuestionCache(conceptId, lv, examType)
    if (missionType) clearPracticeDraft(missionType)

    // Fetch a full dynamic session first. Static questions remain backup only,
    // because exam tracks should feel ACT/SAT/IB/AP-native whenever the agent is available.
    const [dynamic, staticQs] = await Promise.all([
      generateQuestions(conceptId, lv, examType, SESSION_LENGTH, bridge?.fromId),
      Promise.resolve(getQuestions(conceptId, lv, SESSION_LENGTH, [], examType, fmt)),
    ])

    // Deduplicate by id. Dynamic takes priority; static only fills outages/shortfalls.
    const dynamicIds = new Set(dynamic.map(q => q.id))
    const merged = shuffle([
      ...dynamic,
      ...staticQs.filter(q => !dynamicIds.has(q.id)),
    ]).slice(0, SESSION_LENGTH)

    const qs = merged.length > 0 ? merged : staticQs
    if (qs.length === 0) {
      setContentGapMessage(buildNoContentMessage(conceptId, lv, dynamic.length === 0))
      setPPhase('no-content')
      return
    }

    setQuestions(qs)
    setQIndex(0)
    setSelected(null)
    setChecked(false)
    setHintsShown(0)
    setResults([])
    setXp(0)
    setRequeuedIds([])
    setInitialQCount(qs.length)
    setPPhase('session')
  }

  function normalizeAnswerText(v: string) {
    return v.trim().toLowerCase().replace(/\s+/g, ' ').replace(/,/g, '')
  }

  function matchTypedAnswer(q: Question, input: string): number | null {
    const t = normalizeAnswerText(input)
    if (!t) return null
    if (/^[a-d]$/.test(t)) return t.charCodeAt(0) - 97
    const exact = q.choices.findIndex(c => normalizeAnswerText(c) === t)
    if (exact >= 0) return exact
    const stripNum = (raw: string) => {
      const n = parseFloat(raw.replace(/[^0-9.\-+]/g, ''))
      return Number.isNaN(n) ? null : n
    }
    const typedNum = stripNum(t)
    if (typedNum !== null) {
      for (let i = 0; i < q.choices.length; i++) {
        const cn = stripNum(q.choices[i])
        if (cn !== null && Math.abs(cn - typedNum) < 0.001) return i
      }
    }
    return null
  }

  function advanceQuestion(resultsSnapshot: boolean[]) {
    const currentQ = questions[qIndex]
    const isLast = qIndex + 1 >= questions.length

    if (hideCorrectness && missionType === 'gapscan') {
      if (isLast) {
        void completeGapQuestionDiagnostic(resultsSnapshot)
        return
      }
      setQIndex(i => i + 1)
      setSelected(null)
      setTypedAnswer('')
      setShowCalc(false)
      setChecked(false)
      setHintsShown(0)
      return
    }

    const wasCorrect = resultsSnapshot[qIndex]
    const shouldRequeue = !wasCorrect
      && !requeuedIds.includes(currentQ.id)
      && questions.length < MAX_SESSION
      && !hideCorrectness

    if (shouldRequeue) {
      setQuestions(prev => [...prev, currentQ])
      setRequeuedIds(prev => [...prev, currentQ.id])
    }

    if (isLast && !shouldRequeue) {
      const passRate = resultsSnapshot.filter(Boolean).length / resultsSnapshot.length
      if (concept && passRate >= 0.8) {
        evictQuestionCache(concept, level, exam || 'General')
        markPathMastered(concept)
      }
      if (concept) {
        const conceptId = toOntologyId(concept)
        const perQuestion = resultsSnapshot.map((correct, i) => ({
          conceptId,
          score: correct ? 1 : 0,
          level,
          questionId: questions[i]?.id,
          formatId: questions[i] ? questionFormat(questions[i]) : undefined,
        }))
        void recordOutcomes(user.uid, perQuestion)
        invalidateKnowledgeGraph(user.uid)
      }
      setPPhase('complete')
    } else {
      setQIndex(i => i + 1)
      setSelected(null)
      setTypedAnswer('')
      setShowCalc(false)
      setChecked(false)
      setHintsShown(0)
    }
  }

  function checkAnswer() {
    let sel = selected
    if (sel === null && typedAnswer.trim()) {
      const matched = matchTypedAnswer(questions[qIndex], typedAnswer)
      if (matched !== null) {
        sel = matched
        setSelected(matched)
      }
    }
    if (sel === null) return
    const correct = sel === questions[qIndex].correctIndex
    const nextResults = [...results, correct]
    if (!hideCorrectness) {
      setChecked(true)
      if (correct) setXp(x => x + LEVEL_META[level].xp)
    }
    setResults(nextResults)
    if (hideCorrectness) {
      window.setTimeout(() => advanceQuestion(nextResults), 400)
    }
  }

  function nextQuestion() {
    advanceQuestion(results)
  }

  function returnToPath() {
    if (missionType) clearPracticeDraft(missionType)
    setDraftRestored(false)
    setMissionType(null)
    setMode('practice')
    setPPhase('path')
    setConcept(null)
    setSelected(null)
    setChecked(false)
    setHintsShown(0)
    setResults([])
    setXp(0)
    setRequeuedIds([])
    setInitialQCount(0)
    setSessionBridge(null)
    setQuestions([])
    setQIndex(0)
    setLevel(1)
    setContentGapMessage(null)
  }

  // ── Solver helpers ────────────────────────────────────────────────────────

  async function submitProblem(problemText: string, file?: File | null) {
    if (!problemText.trim() && !file) return
    setSPhase('loading')
    setError('')
    setSession(null)
    setSlowLoad(false)

    try {
      let data: HomeworkSession

      if (file) {
        const slowTimer = setTimeout(() => setSlowLoad(true), 7000)
        const form = new FormData()
        form.append('student_id', user.uid)
        form.append('problem_text', problemText)
        form.append('subject', 'algebra')
        form.append('file', file)
        const res = await fetch(`${HOMEWORK_API}/submit-with-file`, { method: 'POST', body: form })
        clearTimeout(slowTimer)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { detail?: string }).detail ?? `Server error ${res.status}`)
        }
        data = await res.json()
      } else {
        data = await solveWithGemini(problemText, exam || 'General')
      }

      setSession(data)
      setSPhase('cards')
    } catch (err: unknown) {
      // LLM solver failed (e.g. Anthropic credits exhausted) — fall back to the
      // deterministic ingredient pipeline when we have problem text to classify.
      if (problemText.trim()) {
        const ing = await getIngredientCards(user.uid, problemText, 4)
        if (ing && ing.cards.length > 0) {
          setSession(ingredientResultToSession(ing, problemText))
          setSlowLoad(false)
          setSPhase('cards')
          return
        }
      }
      setSlowLoad(false)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSPhase('input')
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const currentQ    = questions[qIndex]
  const conceptMeta = PRACTICE_CONCEPTS.find(c => c.id === concept)
  const sessionConceptId = concept ?? currentQ?.conceptId ?? ''
  const sessionLabel = hideCorrectness
    ? mlIdToLabel(currentQ?.conceptId ?? '')
    : (conceptMeta?.label ?? mlIdToLabel(sessionConceptId))
  const lvMeta      = LEVEL_META[level]
  const correctCount = results.filter(Boolean).length
  void correctCount
  const pct          = questions.length ? Math.round((qIndex / questions.length) * 100) : 0
  const lvBannerGradient = level === 1
    ? 'linear-gradient(135deg,#58CC02,#3CAD00)'
    : level === 2
    ? 'linear-gradient(135deg,#F97316,#EA580C)'
    : 'linear-gradient(135deg,#7C3AED,#5B21B6)'

  const firstAttemptResults  = results.slice(0, initialQCount)
  const firstCorrect         = firstAttemptResults.filter(Boolean).length
  const firstAccuracy        = initialQCount > 0 ? firstCorrect / initialQCount : 0
  const mastered             = firstAccuracy >= 0.80

  const pathQueue = diagnosticHydrated && assessConcepts.length > 0
    ? [...assessConcepts].sort((a, b) => {
        const order: Record<Confidence, number> = { hard: 0, kinda: 1, easy: 2 }
        return order[confidenceMap[a.id] ?? 'kinda'] - order[confidenceMap[b.id] ?? 'kinda']
      })
    : []

  const activePathQueue = pathQueue.filter(c => !isPathMastered(c.id))
  const pathConcepts = activePathQueue.slice(0, PATH_SLOT_COUNT)
  const exploreConcepts = activePathQueue.slice(PATH_SLOT_COUNT, PATH_SLOT_COUNT + 8)
  const completedOnPath = pathQueue.filter(c => isPathMastered(c.id)).length
  const pathProgressPct = pathQueue.length
    ? Math.round((completedOnPath / pathQueue.length) * 100)
    : 0

  const remainingConcepts = exploreConcepts

  // Concepts from homework that the student struggled with (outcome === 0)
  const weakHomeworkConcepts: Array<{ label: string; conceptId: string | null }> =
    sResults
      .filter(r => r.outcome === 0)
      .map(r => ({ label: r.concept_chip, conceptId: chipToConceptId(r.concept_chip) }))

  function savedDraftStatus(draft: PracticeDraft) {
    const conceptLabel = draft.concept
      ? (PRACTICE_CONCEPTS.find(c => c.id === draft.concept)?.label ?? bridgeLabel(draft.concept))
      : ''
    const prefix = MISSION_LABEL[draft.missionType ?? 'gapscan']
    if (draft.pPhase === 'session' && draft.questions.length > 0) {
      return `${prefix} • ${conceptLabel} • Question ${Math.min(draft.qIndex + 1, draft.questions.length)} of ${draft.questions.length}`
    }
    if (draft.pPhase === 'level' && conceptLabel) {
      return `${prefix} • ${conceptLabel} • Pick a level`
    }
    if (draft.pPhase === 'confidence') {
      return `${prefix} • Gap scan ${Math.min(draft.confidenceStep + 1, draft.assessConceptIds.length)} of ${draft.assessConceptIds.length}`
    }
    return `${prefix} • ${conceptLabel || 'Ready'}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isPathView = pPhase === 'path' && mode === 'practice'
  const isMatteFlow = mode === 'practice' && ['explore', 'level', 'checkin', 'session', 'complete', 'no-content'].includes(pPhase)
  const isLessonPage = isMatteFlow
  const hideTopBar = mode === 'practice' && ['exam-pick', 'confidence', 'building'].includes(pPhase)

  return (
    <div className={`${s.shell}${isPathView ? ` ${s.pathShell}` : ''}${isMatteFlow ? ` ${s.matteShell}` : ''}`}>
      <Sidebar />

      <main className={`${s.page}${isPathView ? ` ${s.pathPage}` : ''}${isLessonPage ? ` ${s.lessonPage}` : ''}`}>

        {!hideTopBar && (
          <AppTabBar active={mode === 'solver' ? 'solver' : 'practice'} isAdmin={isAdmin} />
        )}

        {/* ═══════ PRACTICE MODE ═══════ */}
        {mode === 'practice' && (
          <>

            {/* ── Exam pick ── */}
            {pPhase === 'exam-pick' && (
              <div className={s.examPickScreen}>
                <div className={s.examIntroCopy}>
                  <span className={s.examEyebrow}>Craft's exam router</span>
                  <h1 className={s.examPickTitle}>Choose your track.</h1>
                  <p className={s.examPickSub}>
                    I’ll tune the gap scan to the pacing, traps, and question style
                    that matter for that exam.
                  </p>
                </div>

                <div className={s.examCards}>
                  {EXAMS.map(e => (
                    <button
                      key={e}
                      className={s.examCard}
                      style={{ ['--exam-accent' as string]: EXAM_CARD_META[e].accent }}
                      onClick={() => pickExam(e)}
                    >
                      <span className={s.examCardTop}>
                        <span className={s.examCardIcon}>{EXAM_CARD_META[e].icon}</span>
                        <span className={s.examCardArrow}>→</span>
                      </span>
                      <span className={s.examCardLabel}>{e}</span>
                      <span className={s.examCardDesc}>{EXAM_DESCRIPTIONS[e]}</span>
                      <span className={s.examCardMicro}>{EXAM_CARD_META[e].micro}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Confidence: one concept at a time ── */}
            {pPhase === 'confidence' && (confidenceQueue.length > 0 || assessConcepts.length > 0) && (() => {
              const ratingList = confidenceQueue.length > 0 ? confidenceQueue : assessConcepts
              const current = ratingList[confidenceStep]
              const selectedExam = (EXAMS.includes(exam as ExamType) ? exam : FALLBACK_EXAM) as ExamType
              const examMeta = EXAM_CARD_META[selectedExam]
              const confOptions = CONFIDENCE_OPTIONS[selectedExam]
              return (
                <div
                  className={s.confidenceScreen}
                  style={{ ['--exam-accent' as string]: examMeta.accent }}
                >
                  <div className={s.confProgressRow}>
                    {ratingList.map((_, i) => (
                      <div
                        key={i}
                        className={`${s.confDot} ${i < confidenceStep ? s.confDotDone : i === confidenceStep ? s.confDotActive : ''}`}
                      />
                    ))}
                  </div>
                  <div className={s.processInlineBar}>
                    <span>Process 1 is saved automatically</span>
                    <div>
                      <button onClick={showPracticeHome}>Back to processes</button>
                      <button onClick={() => navigate('/dashboard')}>Dashboard</button>
                    </div>
                  </div>

                  <div className={s.confLayout}>
                    <div className={s.confPrompt}>
                      <div className={s.confMascotFloat}>
                        <PixelCraft size="sm" />
                      </div>
                      <div className={s.processBadgeRow}>
                        <span className={s.confExamBadge}>{selectedExam} gap scan</span>
                        <span className={s.processBadge}>{draftRestored ? 'Process 1 resumed' : 'Process 1 saved'}</span>
                      </div>
                      <h1 className={s.confTitle}>
                        How strong is <span>{current.label}</span>?
                      </h1>
                      <p className={s.confSub}>{CONFIDENCE_COPY[selectedExam]}</p>
                      <div className={s.conceptPreview}>
                        <span className={s.conceptPreviewEmoji}>{current.emoji}</span>
                        <div>
                          <span className={s.conceptPreviewName}>{current.label}</span>
                          <span className={s.conceptPreviewMeta}>
                            {confidenceStep + 1} of {ratingList.length} skills
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={s.confBtns}>
                      <button className={`${s.confBtn} ${s.confBtnEasy}`} onClick={() => pickConfidence('easy')}>
                        <span className={s.confBtnIcon}>3</span>
                        <div className={s.confBtnText}>
                          <span className={s.confBtnLabel}>{confOptions.easy.label}</span>
                          <span className={s.confBtnDesc}>{confOptions.easy.desc}</span>
                        </div>
                      </button>
                      <button className={`${s.confBtn} ${s.confBtnKinda}`} onClick={() => pickConfidence('kinda')}>
                        <span className={s.confBtnIcon}>2</span>
                        <div className={s.confBtnText}>
                          <span className={s.confBtnLabel}>{confOptions.kinda.label}</span>
                          <span className={s.confBtnDesc}>{confOptions.kinda.desc}</span>
                        </div>
                      </button>
                      <button className={`${s.confBtn} ${s.confBtnHard}`} onClick={() => pickConfidence('hard')}>
                        <span className={s.confBtnIcon}>1</span>
                        <div className={s.confBtnText}>
                          <span className={s.confBtnLabel}>{confOptions.hard.label}</span>
                          <span className={s.confBtnDesc}>{confOptions.hard.desc}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── Building: animated loading ── */}
            {pPhase === 'building' && (
              <div className={s.buildingScreen}>
                <PixelCraft size="lg" />
                <h2 className={s.buildingTitle}>Scanning your gaps…</h2>
                <p className={s.buildingSub}>Mapping concepts → identifying priority order → setting difficulty</p>
                <div className={s.buildingDots}>
                  <span /><span /><span />
                </div>
              </div>
            )}

            {pPhase === 'path' && !diagnosticHydrated && (
              <div className={s.buildingScreen}>
                <PixelCraft size="lg" />
                <h2 className={s.buildingTitle}>Loading your path…</h2>
              </div>
            )}

            {/* ── Path: premium full-page learning path ── */}
            {pPhase === 'path' && diagnosticHydrated && (() => {
              const estMinutesFor = (id: string, i: number) => {
                const table: Record<string, number> = {
                  linear_equations: 12, linear_inequalities: 10, absolute_value: 14,
                  systems_of_linear_equations: 16, exponent_rules: 11, radical_expressions: 13,
                }
                return table[id] ?? [12, 10, 14, 16, 11, 13][i % 6]
              }
              const STEP = 138
              const SPINE = 320
              const flowHeight = Math.max(pathConcepts.length, 1) * STEP + 32
              const estMinutes = pathConcepts.reduce((sum, c, i) => sum + estMinutesFor(c.id, i), 0)
              const nodeY = (i: number) => i * STEP + STEP * 0.52

              return (
              <div className={s.pathScreen}>
                <div className={s.pathLayout}>
                  <section className={s.pathMainCol}>
                    <h1 className={s.pathHeroTitle}>
                      Your <span className={s.pathHeroAccent}>Learning Path</span>
                    </h1>

                    {pathConcepts.length === 0 ? (
                      <p className={s.pathEmpty}>
                        {assessConcepts.length === 0
                          ? 'Complete the gap scan from your dashboard to build your learning path.'
                          : 'You cleared this path — explore more topics on the right →'}
                      </p>
                    ) : (
                      <div className={s.pathFlowMap} style={{ height: `${flowHeight}px` }}>
                        <svg
                          className={s.pathFlowSvg}
                          viewBox={`0 0 640 ${flowHeight}`}
                          preserveAspectRatio="xMidYMid meet"
                          aria-hidden="true"
                        >
                          <defs>
                            <linearGradient id="pathCurveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="rgba(196,245,71,0.55)" />
                              <stop offset="100%" stopColor="rgba(84,185,72,0.25)" />
                            </linearGradient>
                          </defs>
                          {pathConcepts.slice(0, -1).map((_, i) => {
                            const y1 = nodeY(i)
                            const y2 = nodeY(i + 1)
                            const bulge = i % 2 === 0 ? 88 : -88
                            return (
                              <path
                                key={i}
                                d={`M ${SPINE} ${y1} C ${SPINE + bulge} ${y1 + STEP * 0.22}, ${SPINE - bulge} ${y2 - STEP * 0.22}, ${SPINE} ${y2}`}
                                stroke="url(#pathCurveGrad)"
                                strokeWidth="3"
                                fill="none"
                                strokeLinecap="round"
                              />
                            )
                          })}
                          {pathConcepts.map((_, i) => {
                            const cy = nodeY(i)
                            return (
                              <g key={i}>
                                <circle cx={SPINE} cy={cy} r="19" fill="rgba(8,18,14,0.96)" stroke="rgba(196,245,71,0.55)" strokeWidth="2" />
                                <text x={SPINE} y={cy + 5} textAnchor="middle" fill="#c4f547" fontSize="12" fontWeight="800" fontFamily="system-ui,sans-serif">{i + 1}</text>
                              </g>
                            )
                          })}
                        </svg>

                        {pathConcepts.map((c, i) => {
                          const isLeft = i % 2 === 0
                          const isTop = c.id === topPriority?.id && assessConcepts.length > 0
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className={`${s.pathFlowCard} ${isLeft ? s.pathFlowCardLeft : s.pathFlowCardRight} ${isTop ? s.pathFlowCardActive : ''}`}
                              style={{ top: `${i * STEP + 10}px` }}
                              onClick={() => pickConcept(c.id)}
                            >
                              <div className={s.pathFlowIcon}>
                                <ConceptPathIcon conceptId={c.id} size={32} />
                              </div>
                              <div className={s.pathFlowBody}>
                                <span className={s.pathFlowTitle}>{c.label}</span>
                                <span className={s.pathFlowMeta}>Practice · {estMinutesFor(c.id, i)} min</span>
                              </div>
                              <span className={s.pathFlowStatus}>→</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  <aside className={s.pathSideColumn}>
                    <div className={s.pathProgressCard}>
                      <div
                        className={s.pathProgressRing}
                        style={{ background: `conic-gradient(#c4f547 ${pathProgressPct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
                      >
                        <span className={s.pathProgressRingInner}>{pathProgressPct}%</span>
                      </div>
                      <div className={s.pathProgressStats}>
                        <span className={s.pathProgressBig}>
                          {completedOnPath} / {pathQueue.length} Topics Completed
                        </span>
                        <span className={s.pathProgressSub}>On your full path</span>
                      </div>
                      <div className={s.pathProgressTime}>
                        <span className={s.pathProgressBig}>
                          {estMinutes >= 60
                            ? `${Math.floor(estMinutes / 60)}h ${estMinutes % 60}m`
                            : `${estMinutes || 0}m`}
                        </span>
                        <span className={s.pathProgressSub}>Est. on screen</span>
                      </div>
                    </div>

                    <div className={s.pathStreakCard}>
                      <span className={s.pathStreakFire} aria-hidden="true">🔥</span>
                      <div>
                        <p className={s.pathStreakCount}>{streak || 0} day{streak === 1 ? '' : 's'}</p>
                        <p className={s.pathStreakLabel}>Keep it up!</p>
                      </div>
                    </div>

                    {exploreConcepts.length > 0 && (
                      <div className={s.pathExploreSection}>
                        <h3 className={s.pathExploreTitle}>Topics to explore</h3>
                        <div className={s.pathExploreGrid}>
                          {exploreConcepts.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className={s.pathExploreBox}
                              onClick={() => pickConcept(c.id)}
                            >
                              <span className={s.pathExploreBoxIcon}>
                                <ConceptPathIcon conceptId={c.id} size={28} />
                              </span>
                              <span className={s.pathExploreBoxName}>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </aside>
                </div>
              </div>
              )
            })()}

            {/* ── Explore: concept content card ── */}
            {pPhase === 'explore' && conceptMeta && (() => {
              const content = getConceptContent(conceptMeta.id)
              return (
                <div className={s.exploreScreen}>
                  <button className={s.backLink} onClick={() => setPPhase('path')}>
                    ← Back to path
                  </button>

                  <div className={s.exploreCard}>
                    <div className={s.exploreHead}>
                      <span className={s.exploreIconWrap}>
                        <ConceptPathIcon conceptId={conceptMeta.id} size={44} />
                      </span>
                      <div>
                        <h2 className={s.exploreName}>{conceptMeta.label}</h2>
                        {content && <p className={s.exploreTagline}>{content.tagline}</p>}
                        {content?.examWeight && (
                          <span className={s.examWeightBadge}>{content.examWeight}</span>
                        )}
                        {/* Show recommended level if this concept was assessed */}
                        {confidenceMap[conceptMeta.id] && (
                          <span className={s.confLevelHint}>
                            Craft recommends: Level {getRecommendedLevel(conceptMeta.id)} based on your self-assessment
                          </span>
                        )}
                      </div>
                    </div>

                    {content && (
                      <>
                        {content.formula && (
                          <div className={s.exploreFormula}>{content.formula}</div>
                        )}

                        <div className={s.exploreGrid}>
                          <div className={s.exploreSection}>
                            <div className={s.exploreSectionTitle}>📋 Key Rules</div>
                            <ul className={s.exploreList}>
                              {content.keyRules.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          </div>
                          <div className={s.exploreSection}>
                            <div className={s.exploreSectionTitle}>💡 Pro Tips</div>
                            <ul className={s.exploreList}>
                              {content.tips.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                          </div>
                        </div>

                        <div className={s.exploreSection}>
                          <div className={s.exploreSectionTitle}>⚠️ Watch Out</div>
                          <ul className={`${s.exploreList} ${s.watchOutList}`}>
                            {content.watchOut.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>

                        <div className={s.exploreSection}>
                          <div className={s.exploreSectionTitle}>🔍 Worked Examples</div>
                          <div className={s.exploreExamples}>
                            {content.examples.map((ex, i) => (
                              <div key={i} className={s.exploreExample}>
                                <div className={s.exampleQ}>{ex.problem}</div>
                                <div className={s.exampleA}>{ex.solution}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <button className={s.startPracticeBtn} onClick={() => setPPhase('level')}>
                      Start Practice →
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* ── No static / dynamic questions (content gap) ── */}
            {pPhase === 'no-content' && contentGapMessage && (
              <div className={s.levelScreen}>
                <button type="button" className={s.backLink} onClick={() => setPPhase('path')}>
                  ← Back to path
                </button>
                <div className={s.levelHeader}>
                  <div>
                    <h2 className={s.levelConceptName}>Question bank gap</h2>
                    <p className={s.levelConceptSub}>Share this with whoever is authoring static questions</p>
                  </div>
                </div>
                <div style={{ padding: '0 1.5rem 2rem', maxWidth: 640 }}>
                  <pre style={{
                    margin: 0,
                    padding: '1rem 1.25rem',
                    borderRadius: 12,
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(245,158,11,0.35)',
                    color: 'rgba(255,255,255,0.92)',
                    fontSize: '0.82rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}>
                    {contentGapMessage}
                  </pre>
                  <button
                    type="button"
                    className={s.startPracticeBtn}
                    style={{ marginTop: '1.25rem' }}
                    onClick={() => {
                      void navigator.clipboard.writeText(contentGapMessage)
                    }}
                  >
                    Copy message for co-founder
                  </button>
                </div>
              </div>
            )}

            {/* ── Level selector ── */}
            {pPhase === 'level' && conceptMeta && (
              <div className={s.levelScreen}>
                <button className={s.backLink} onClick={() => setPPhase('explore')}>
                  ← {conceptMeta.label}
                </button>
                <div className={s.levelHeader}>
                  <span className={s.levelConceptIcon}>
                    <ConceptPathIcon conceptId={conceptMeta.id} size={40} />
                  </span>
                  <div>
                    <h2 className={s.levelConceptName}>{conceptMeta.label}</h2>
                    <p className={s.levelConceptSub}>Choose your difficulty</p>
                  </div>
                </div>

                <div className={s.levelCards}>
                  {([1, 2, 3] as const)
                    .filter(lv => allowedLevels(confidenceMap[conceptMeta.id]).includes(lv))
                    .map(lv => {
                    const m   = LEVEL_META[lv]
                    const cnt = questionCount(conceptMeta.id, lv)
                    const recommended = confidenceMap[conceptMeta.id]
                      ? getRecommendedLevel(conceptMeta.id) === lv
                      : false
                    return (
                      <button
                        key={lv}
                        className={`${s.levelCard} ${recommended ? s.levelCardRec : ''}`}
                        style={{ '--lv-color': m.color, '--lv-soft': m.colorSoft } as React.CSSProperties}
                        onClick={() => showCheckin(conceptMeta.id, lv)}
                      >
                        {recommended && (
                          <span className={s.levelRecBadge}>Recommended</span>
                        )}
                        <div className={s.levelColorStripe} style={{ background: m.color }} />
                        <div className={s.levelStars}>
                          {Array.from({ length: 3 }).map((_, i) => (
                            <span key={i} className={i < m.stars ? s.starOn : s.starOff}>★</span>
                          ))}
                        </div>
                        <div className={s.levelNum}>Level {lv}</div>
                        <div className={s.levelName}>{m.label}</div>
                        <div className={s.levelDesc}>{m.sub}</div>
                        <div className={s.levelXp}>+{m.xp} XP / question</div>
                        <div className={s.levelCount}>{cnt > 0 ? `${cnt} bank questions` : 'AI-generated'}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Pre-session check-in ── */}
            {pPhase === 'checkin' && (
              <div className={s.levelScreen}>
                <button className={s.backLink} onClick={() => setPPhase('level')}>
                  ← Back
                </button>
                <div className={s.levelHeader}>
                  <span className={s.levelConceptIcon}>
                    <ConceptPathIcon conceptId={conceptMeta?.id ?? ''} size={40} />
                  </span>
                  <div>
                    <h2 className={s.levelConceptName}>Quick check-in</h2>
                    <p className={s.levelConceptSub}>Optional — skip if you'd rather just start</p>
                  </div>
                </div>

                <div style={{ padding: '0 1.5rem 2rem', maxWidth: 520 }}>
                  <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    How are you feeling about today's practice? Anything feeling tricky lately?
                    I'll adjust the path based on what you share.
                  </p>
                  <textarea
                    rows={4}
                    value={checkinText}
                    onChange={e => setCheckinText(e.target.value)}
                    placeholder="e.g. I'm a bit stressed, quadratic equations have been confusing me lately…"
                    style={{
                      width: '100%', boxSizing: 'border-box', resize: 'vertical',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
                      borderRadius: 10, color: '#fff', padding: '0.75rem 1rem',
                      fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
                    }}
                    maxLength={1000}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      className={s.gapStartBtn}
                      onClick={submitCheckin}
                      disabled={checkinLoading}
                      style={{ flex: 1 }}
                    >
                      {checkinLoading ? 'Reading…' : checkinText.trim() ? 'Share and start →' : 'Start →'}
                    </button>
                    <button
                      className={s.gapViewAll}
                      onClick={() => {
                        checkinPendingRef.current && startSession(
                          checkinPendingRef.current.conceptId,
                          checkinPendingRef.current.lv,
                          checkinPendingRef.current.bridge,
                        )
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Active session ── */}
            {pPhase === 'session' && currentQ && (
              <div className={s.sessionWrap}>
                <div className={s.sessionCenter}>
                  <div className={s.progressStrip}>
                    <button
                      type="button"
                      className={s.backDashBtn}
                      onClick={() => navigate('/dashboard')}
                    >
                      ← Dashboard
                    </button>
                    <div className={s.stripLeft}>
                      <span className={s.stripConcept}>
                        <ConceptPathIcon conceptId={sessionConceptId} size={18} />
                        {hideCorrectness ? 'Gap scan' : sessionLabel}
                      </span>
                      {sessionBridge && !hideCorrectness && (
                        <span className={s.stripBridge}>
                          Bridge: {bridgeLabel(sessionBridge.fromId)} → {bridgeLabel(sessionBridge.toId)}
                        </span>
                      )}
                      <span className={s.stripLevel} style={{ color: lvMeta.color }}>
                        {hideCorrectness
                          ? sessionLabel
                          : `${'★'.repeat(level)}${'☆'.repeat(3 - level)} L${level}`}
                      </span>
                    </div>
                    <div className={s.stripCenter}>
                      <div className={s.progressBar}>
                        <div className={s.progressFill} style={{ width: `${pct}%`, background: lvMeta.color }} />
                      </div>
                      <span className={s.progressLabel}>{qIndex + 1} / {questions.length}</span>
                    </div>
                    <div className={s.stripRight}>
                      {!hideCorrectness && <span className={s.xpBadge}>⚡ {xp} XP</span>}
                    </div>
                  </div>

                  <div className={s.questionCard}>
                    <div className={s.questionBanner} style={{ background: lvBannerGradient }}>
                      {currentQ.examTag && (
                        <span className={s.examTagLight}>{currentQ.examTag} Style</span>
                      )}
                      <p className={s.questionText}>{currentQ.question}</p>
                    </div>
                    <div className={s.questionBody}>
                      {safeQuestionSvg(currentQ) && (
                        <div
                          className={s.questionVisual}
                          dangerouslySetInnerHTML={{ __html: safeQuestionSvg(currentQ) }}
                        />
                      )}
                      <div className={s.choices}>
                        {currentQ.choices.map((choice, i) => {
                          let cls = s.choice
                          if (checked && !hideCorrectness) {
                            if (i === currentQ.correctIndex) cls = s.choiceCorrect
                            else if (i === selected)         cls = s.choiceWrong
                          } else if (i === selected) {
                            cls = s.choiceSelected
                          }
                          return (
                            <button key={i} className={cls} onClick={() => !checked && setSelected(i)} disabled={checked}>
                              <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                              <span className={s.choiceText}>{choice}</span>
                              {!hideCorrectness && checked && i === currentQ.correctIndex && <span className={s.choiceTick}>✓</span>}
                              {!hideCorrectness && checked && i === selected && i !== currentQ.correctIndex && <span className={s.choiceCross}>✗</span>}
                            </button>
                          )
                        })}
                      </div>

                      {!checked && !hideCorrectness && (
                        <div className={s.hintCardInline}>
                          <div className={s.hintCardHeader}>
                            <span>💡</span>
                            <span className={s.hintCardTitle}>Need a hint?</span>
                          </div>
                          {hintsShown === 0 ? (
                            <button type="button" className={s.hintTrigger} onClick={() => setHintsShown(1)}>
                              Show hint 1 →
                            </button>
                          ) : (
                            <div className={s.hintsBox}>
                              {currentQ.hints.slice(0, hintsShown).map((h, i) => (
                                <div key={i} className={s.hintLine}>
                                  <span className={s.hintNum}>{i + 1}</span> {h}
                                </div>
                              ))}
                              {hintsShown < 3 && (
                                <button
                                  type="button"
                                  className={s.hintTrigger}
                                  onClick={() => setHintsShown(h => Math.min(h + 1, 3))}
                                  style={{ borderTop: '1px solid #F1F5F9' }}
                                >
                                  Hint {hintsShown + 1} →
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {!checked && (
                        <div className={s.answerRow}>
                          <div className={s.answerInputWrap}>
                            <input
                              ref={answerInputRef}
                              className={s.answerInput}
                              type="text"
                              placeholder="Type your answer here"
                              value={typedAnswer}
                              onChange={e => setTypedAnswer(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !checked) checkAnswer()
                              }}
                              disabled={checked}
                            />
                            <ScientificCalcToggle
                              active={showCalc}
                              onToggle={() => setShowCalc(v => !v)}
                              disabled={checked}
                            />
                            <button
                              type="button"
                              className={s.answerSubmit}
                              onClick={checkAnswer}
                              disabled={checked || (selected === null && !typedAnswer.trim())}
                              aria-label={hideCorrectness ? 'Continue' : 'Submit answer'}
                            >
                              {hideCorrectness ? '→' : '↑'}
                            </button>
                          </div>
                          <ScientificCalcPanel
                            open={showCalc}
                            value={typedAnswer}
                            onChange={setTypedAnswer}
                            onSubmit={checkAnswer}
                            inputRef={answerInputRef}
                          />
                        </div>
                      )}
                    </div>

                    {checked && !hideCorrectness && (
                      <div className={selected === currentQ.correctIndex ? s.feedbackCorrect : s.feedbackWrong}>
                        <div className={selected === currentQ.correctIndex ? s.feedbackBannerCorrect : s.feedbackBannerWrong}>
                          <span className={s.feedbackIcon}>
                            {selected === currentQ.correctIndex ? '✨' : '💡'}
                          </span>
                          <span className={s.feedbackTitle}>
                            {selected === currentQ.correctIndex
                              ? `Correct! +${lvMeta.xp} XP`
                              : "Not quite — here's why:"}
                          </span>
                        </div>
                        <div className={s.feedbackBody}>
                          <div className={s.feedbackExplanation}>{currentQ.explanation}</div>
                        </div>
                      </div>
                    )}

                    {checked && !hideCorrectness && (
                      <div className={s.actionRow}>
                        <button className={s.nextBtn} onClick={nextQuestion}>
                          {qIndex + 1 < questions.length ? 'Next Question →' : 'See Results →'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Session complete ── */}
            {pPhase === 'complete' && (
              <div className={s.completeWrap}>
                <div className={s.completeStars}>
                  {mastered ? '🌟🌟🌟' : firstAccuracy >= 0.60 ? '🌟🌟' : '🌟'}
                </div>
                <h2 className={s.completeTitle}>
                  {mastered ? `Level ${level} Mastered!` : 'Session Complete!'}
                </h2>
                <div className={s.completeStats}>
                  <div className={s.completeStat}>
                    <span className={s.completeStatNum} style={{ color: lvMeta.color }}>{xp}</span>
                    <span className={s.completeStatLabel}>XP Earned</span>
                  </div>
                  <div className={s.completeStat}>
                    <span className={s.completeStatNum}>{firstCorrect}/{initialQCount}</span>
                    <span className={s.completeStatLabel}>First-try correct</span>
                  </div>
                  <div className={s.completeStat}>
                    <span className={s.completeStatNum}>{Math.round(firstAccuracy * 100)}%</span>
                    <span className={s.completeStatLabel}>Accuracy</span>
                  </div>
                </div>
                <div className={s.completeInsight}>
                  {mastered
                    ? `${firstCorrect}/${initialQCount} on first attempt — you've got ${conceptMeta?.label}. Ready for Level ${Math.min(level + 1, 3)}!`
                    : firstAccuracy >= 0.60
                    ? `${firstCorrect}/${initialQCount} first-try — nearly there. One more round and you'll lock it in.`
                    : `${firstCorrect}/${initialQCount} on first attempt. ${conceptMeta?.label} needs more practice — re-queued your misses for extra reps.`}
                </div>
                <div className={s.completeActions}>
                  <button className={s.btnSecondary} onClick={returnToPath}>
                    New Mission
                  </button>
                  <button
                    className={s.btnPrimary}
                    onClick={() => startSession(concept!, mastered ? Math.min(level + 1, 3) as 1|2|3 : level)}
                  >
                    {mastered
                      ? level < 3 ? `Level ${level + 1} →` : 'Practice Again →'
                      : `Retry Level ${level} →`}
                  </button>
                </div>
                {/* Next gap concept suggestion */}
                {mastered && assessConcepts.length > 0 && (() => {
                  const nextGap = pathConcepts.find(c =>
                    c.id !== concept && (confidenceMap[c.id] === 'hard' || confidenceMap[c.id] === 'kinda')
                  )
                  if (!nextGap) return null
                  return (
                    <div className={s.nextGapSuggestion}>
                      <span className={s.nextGapLabel}>Next gap to close:</span>
                      <button
                        className={s.nextGapBtn}
                        onClick={() => startSession(nextGap.id, getRecommendedLevel(nextGap.id))}
                      >
                        {nextGap.emoji} {nextGap.label} → Level {getRecommendedLevel(nextGap.id)}
                      </button>
                    </div>
                  )
                })()}
              </div>
            )}
          </>
        )}

        {/* ═══════ SOLVER MODE ═══════ */}
        {mode === 'solver' && (
          <div className={s.solverWrap}>
            {sPhase === 'input' && (
              <div className={s.solverPanel}>
                <div className={s.solverCopy}>
                  <span className={s.solverEyebrow}>Homework Help</span>
                  <h2 className={s.solverTitle}>Turn a stuck problem into visual intuition.</h2>
                  <p className={s.solverSub}>
                    Paste the problem or upload a photo. Craft builds Socratic hint cards, concept tags, and a visual step when the math needs a graph.
                  </p>
                  <div className={s.solverFeatureGrid}>
                    <span>Step-by-step hints</span>
                    <span>Concept map logging</span>
                    <span>Manim or SVG visuals</span>
                  </div>
                </div>

                <div className={s.solverInputCard}>
                  {solverFile ? (
                    <div className={s.fileStrip}>
                      <span>{solverFile.type === 'application/pdf' ? '📄' : '🖼️'} {solverFile.name}</span>
                      <button onClick={() => setSolverFile(null)}>✕</button>
                    </div>
                  ) : (
                    <button className={s.uploadBtn} onClick={() => fileRef.current?.click()}>
                      ⬆ Upload image or PDF
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,.pdf"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) setSolverFile(f) }}
                      />
                    </button>
                  )}
                  <textarea
                    className={s.solverTextarea}
                    placeholder="Paste your problem here... e.g. Solve x² - 5x + 6 = 0"
                    value={problem}
                    onChange={e => setProblem(e.target.value)}
                    rows={5}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitProblem(problem, solverFile) }}
                  />
                  <button
                    className={s.solverBtn}
                    onClick={() => submitProblem(problem, solverFile)}
                    disabled={!problem.trim() && !solverFile}
                  >
                    Build my hint path →
                  </button>
                  {error && (
                    <div className={s.errorMsg}>
                      {error}
                      <button onClick={() => setError('')}>✕</button>
                    </div>
                  )}
                  <div className={s.solverMiniVisual} aria-hidden>
                    <span />
                    <svg viewBox="0 0 260 120" fill="none">
                      <path d="M18 92 H242 M36 104 V18" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
                      <path d="M38 88 C82 74 95 28 130 34 C166 40 171 89 222 28" stroke="#C4F547" strokeWidth="4" strokeLinecap="round" />
                      <circle cx="130" cy="34" r="5" fill="#4ECDC4" />
                      <circle cx="222" cy="28" r="5" fill="#FF6B6B" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {sPhase === 'loading' && (
              <div className={s.solverLoading}>
                <PixelCraft size="md" className={s.solverMascot} />
                <p className={s.solverLoadingText}>Analyzing your problem…</p>
                <div className={s.buildingDots}>
                  <span /><span /><span />
                </div>
                {slowLoad && <p className={s.slowMsg}>First load can take 30–60 s — Cloud Run warming up. Hang tight!</p>}
              </div>
            )}

            {sPhase === 'cards' && session && (
              <HomeworkCards
                session={session}
                studentId={user.uid}
                apiBase={HOMEWORK_API}
                fetchClue={(content, concept, num) => clueWithGemini(content, concept, num, exam || 'General')}
                onComplete={r => {
                  setSResults(r); setSPhase('done')
                  // Feed homework outcomes into the student graph (concept_chip
                  // -> concept id; outcome 1 = solved). Unknown ids skip server-side.
                  const outs = r.map(rec => ({
                    // chipToConceptId handles LLM label chips; the ?? passes through
                    // ontology ids from the ingredient fallback. Backend skips invalid.
                    conceptId: toOntologyId(chipToConceptId(rec.concept_chip) ?? rec.concept_chip),
                    succeeded: rec.outcome === 1,
                  }))
                  void recordOutcomes(user.uid, outs)
                  invalidateKnowledgeGraph(user.uid)
                }}
                onNewProblem={() => { setProblem(''); setSession(null); setSPhase('input') }}
              />
            )}

            {sPhase === 'done' && (
              <div className={s.completeWrap}>
                <div className={s.completeStars}>✦</div>
                <h2 className={s.completeTitle}>Session complete</h2>
                <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
                  {sResults.filter(r => r.outcome === 1).length} of {sResults.length} concepts solid
                </p>

                {/* ── Homework → practice bridge ── */}
                {weakHomeworkConcepts.length > 0 && (
                  <div className={s.weakConceptsBlock}>
                    <div className={s.weakConceptsTitle}>
                      🎯 Concepts to practice from this problem:
                    </div>
                    <div className={s.weakConceptsList}>
                      {weakHomeworkConcepts.map((wc, i) => (
                        <div key={i} className={s.weakConceptRow}>
                          <span className={s.weakConceptChip}>{wc.label}</span>
                          {wc.conceptId ? (
                            <button
                              className={s.weakPracticeBtn}
                              onClick={() => {
                                setMode('practice')
                                setExam(exam || 'General')
                                setPPhase('level')
                                setConcept(wc.conceptId!)
                              }}
                            >
                              Practice →
                            </button>
                          ) : (
                            <button
                              className={s.weakPracticeBtn}
                              onClick={() => setMode('practice')}
                            >
                              Browse topics →
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className={s.weakConceptsHint}>
                      These concepts came up in your problem and need more work.
                      Practice them now to lock in the understanding.
                    </p>
                  </div>
                )}

                <div className={s.completeActions}>
                  <button className={s.btnSecondary} onClick={() => { setProblem(''); setSPhase('input') }}>
                    Try another problem
                  </button>
                  <button className={s.btnPrimary} onClick={() => navigate('/knowledge-graph')}>
                    View Knowledge Graph →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
