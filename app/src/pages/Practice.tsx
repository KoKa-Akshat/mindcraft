import { useNavigate, useLocation } from 'react-router-dom'
import { useUser } from '../App'
import { useRef, useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import HomeworkCards, { type HomeworkSession, type OutcomeRecord } from '../components/HomeworkCards'
import {
  type Question,
  PRACTICE_CONCEPTS,
  LEVEL_META,
  getQuestions,
  questionCount,
} from '../lib/questionBank'
import { generateQuestions, evictQuestionCache } from '../lib/questionAgent'
import { getConceptContent } from '../lib/conceptContent'
import { mlIdToLabel } from '../lib/conceptMap'
import { type BridgeRecommendation, buildBridgeRecommendations } from '../lib/bridgePractice'
import { solveWithGemini, clueWithGemini } from '../lib/geminiHomework'
import s from './Practice.module.css'

const HOMEWORK_API = import.meta.env.VITE_HOMEWORK_API_URL ?? 'http://localhost:8001'
const SESSION_LENGTH = 10   // Bloom's mastery: min 10 trials for 80% threshold
const MAX_SESSION    = 14   // hard cap when re-queuing wrong answers
const PRACTICE_DRAFT_VERSION = 1

type PracticePhase =
  | 'onboard' | 'exam-pick' | 'confidence' | 'building'
  | 'gap-analysis' | 'path' | 'explore' | 'level' | 'session' | 'complete'
type SolverPhase   = 'input' | 'loading' | 'cards' | 'done'
type Mode          = 'practice' | 'solver'
type Confidence    = 'easy' | 'kinda' | 'hard'

type PracticeDraft = {
  version: number
  name: string
  savedAt: number
  exam: string
  assessConceptIds: string[]
  confidenceStep: number
  confidenceMap: Record<string, Confidence>
  pPhase: PracticePhase
  concept: string | null
  level: 1 | 2 | 3
  questions: Question[]
  qIndex: number
  results: boolean[]
  xp: number
  requeuedIds: string[]
  initialQCount: number
  sessionBridge: BridgeRecommendation | null
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
    'factoring_polynomials',
    'quadratic_equations',
    'rational_expressions',
    'functions_basics',
    'function_transformations',
    'word_problems',
    'lines_angles',
    'triangles_congruence',
    'right_triangle_geometry',
    'coordinate_geometry',
    'circles_geometry',
    'area_volume',
    'geometric_transformations',
    'trigonometry_basics',
    'descriptive_statistics',
    'data_interpretation',
    'basic_probability',
  ],
  SAT: [
    'linear_equations',
    'linear_inequalities',
    'systems_of_linear_equations',
    'absolute_value',
    'quadratic_equations',
    'polynomials',
    'factoring_polynomials',
    'rational_expressions',
    'radical_expressions',
    'exponent_rules',
    'exponential_functions',
    'functions_basics',
    'function_transformations',
    'word_problems',
    'percent_ratio',
    'descriptive_statistics',
    'statistics_graphs',
    'data_interpretation',
    'basic_probability',
    'coordinate_geometry',
    'lines_angles',
    'triangles_congruence',
    'right_triangle_geometry',
    'circles_geometry',
    'area_volume',
    'trigonometry_basics',
  ],
  IB: [
    'number_properties',
    'percent_ratio',
    'linear_equations',
    'linear_inequalities',
    'systems_of_linear_equations',
    'exponent_rules',
    'quadratic_equations',
    'sequences_series',
    'functions_basics',
    'function_transformations',
    'exponential_functions',
    'logarithmic_functions',
    'word_problems',
    'lines_angles',
    'triangles_congruence',
    'coordinate_geometry',
    'right_triangle_geometry',
    'trigonometry_basics',
    'circles_geometry',
    'area_volume',
    'descriptive_statistics',
    'statistics_graphs',
    'data_interpretation',
    'basic_probability',
    'integrals',
    'applications_of_integrals',
    'limits_continuity',
    'derivatives',
    'applications_of_derivatives',
  ],
  AP: [
    'functions_basics',
    'function_transformations',
    'exponential_functions',
    'logarithmic_functions',
    'trigonometry_basics',
    'trigonometric_identities',
    'polynomials',
    'factoring_polynomials',
    'rational_expressions',
    'limits_continuity',
    'derivatives',
    'applications_of_derivatives',
    'integrals',
    'applications_of_integrals',
    'descriptive_statistics',
    'statistics_graphs',
    'data_interpretation',
    'basic_probability',
    'word_problems',
  ],
  General: [
    'number_properties',
    'percent_ratio',
    'linear_equations',
    'linear_inequalities',
    'absolute_value',
    'systems_of_linear_equations',
    'exponent_rules',
    'radical_expressions',
    'polynomials',
    'factoring_polynomials',
    'quadratic_equations',
    'rational_expressions',
    'functions_basics',
    'function_transformations',
    'coordinate_geometry',
    'lines_angles',
    'triangles_congruence',
    'right_triangle_geometry',
    'circles_geometry',
    'area_volume',
    'trigonometry_basics',
    'descriptive_statistics',
    'data_interpretation',
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

function practiceDraftKey(uid: string) {
  return `mindcraft:exam-help:${uid}:process-1`
}

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

function CastleMark({ index, active }: { index: number; active: boolean }) {
  const hue = index % 3 === 0 ? '#C4F547' : index % 3 === 1 ? '#4ECDC4' : '#FF8A8A'
  return (
    <svg className={s.castleMark} viewBox="0 0 150 150" aria-hidden="true">
      <defs>
        <linearGradient id={`castleWall-${index}`} x1="28" y1="36" x2="128" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor={active ? '#F8FFDF' : '#F2F7F3'} />
          <stop offset="1" stopColor={active ? '#96B29D' : '#7FA0A3'} />
        </linearGradient>
        <linearGradient id={`castleLand-${index}`} x1="14" y1="102" x2="134" y2="132" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5D8B76" />
          <stop offset="1" stopColor="#174C55" />
        </linearGradient>
        <filter id={`castleGlow-${index}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <ellipse cx="76" cy="127" rx="54" ry="11" fill="rgba(0,0,0,.20)" />
      <path
        d="M20 103 C34 87 51 95 61 82 C72 68 89 70 99 84 C111 98 127 91 136 107 C123 125 42 130 20 103Z"
        fill={`url(#castleLand-${index})`}
        stroke="rgba(196,245,71,.28)"
        strokeWidth="2"
      />
      <path d="M37 60 H113 V104 H37Z" fill={`url(#castleWall-${index})`} stroke="#153A42" strokeWidth="4" />
      <path d="M49 40 H68 V104 H49Z" fill={`url(#castleWall-${index})`} stroke="#153A42" strokeWidth="4" />
      <path d="M82 36 H104 V104 H82Z" fill={`url(#castleWall-${index})`} stroke="#153A42" strokeWidth="4" />
      <path d="M48 39 L58 24 L69 39Z" fill={hue} stroke="#153A42" strokeWidth="4" />
      <path d="M81 35 L93 17 L105 35Z" fill={hue} stroke="#153A42" strokeWidth="4" />
      <path d="M36 60 L48 46 L60 60Z" fill={hue} stroke="#153A42" strokeWidth="4" />
      <path d="M99 60 L112 46 L125 60Z" fill={hue} stroke="#153A42" strokeWidth="4" />
      <path d="M102 60 H125 V104 H102Z" fill={`url(#castleWall-${index})`} stroke="#153A42" strokeWidth="4" />
      <path d="M67 82 C67 72 83 72 83 82 V104 H67Z" fill="#12333B" />
      <rect x="53" y="67" width="10" height="12" rx="3" fill="#12333B" />
      <rect x="89" y="64" width="10" height="12" rx="3" fill="#12333B" />
      <circle cx="122" cy="31" r="7" fill={hue} filter={`url(#castleGlow-${index})`} opacity={active ? 1 : .74} />
    </svg>
  )
}

export default function Practice() {
  const user     = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const fileRef  = useRef<HTMLInputElement>(null)
  const draftHydratedRef = useRef(false)

  const [mode, setMode] = useState<Mode>('practice')

  // ── Onboarding state ──────────────────────────────────────────────────────
  const [exam,           setExam]           = useState<string>('')
  const [assessConcepts, setAssessConcepts] = useState<typeof PRACTICE_CONCEPTS>([])
  const [confidenceStep, setConfidenceStep] = useState(0)
  const [confidenceMap,  setConfidenceMap]  = useState<Record<string, Confidence>>({})

  // ── Practice state ────────────────────────────────────────────────────────
  const [pPhase,     setPPhase]     = useState<PracticePhase>('onboard')
  const [concept,    setConcept]    = useState<string | null>(null)
  const [level,      setLevel]      = useState<1|2|3>(1)
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [qIndex,     setQIndex]     = useState(0)
  const [selected,   setSelected]   = useState<number | null>(null)
  const [checked,    setChecked]    = useState(false)
  const [hintsShown, setHintsShown] = useState(0)
  const [results,      setResults]      = useState<boolean[]>([])
  const [xp,           setXp]           = useState(0)
  const [requeuedIds,  setRequeuedIds]  = useState<string[]>([])
  const [initialQCount,setInitialQCount]= useState(0)
  const [sessionBridge,setSessionBridge]= useState<BridgeRecommendation | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)

  // ── Solver state ──────────────────────────────────────────────────────────
  const [sPhase,     setSPhase]     = useState<SolverPhase>('input')
  const [problem,    setProblem]    = useState('')
  const [solverFile, setSolverFile] = useState<File | null>(null)
  const [session,    setSession]    = useState<HomeworkSession | null>(null)
  const [sResults,   setSResults]   = useState<OutcomeRecord[]>([])
  const [error,      setError]      = useState('')
  const [slowLoad,   setSlowLoad]   = useState(false)

  function clearPracticeDraft() {
    localStorage.removeItem(practiceDraftKey(user.uid))
  }

  function restorePracticeDraft(draft: PracticeDraft) {
    const restoredConcepts = conceptsFromIds(draft.assessConceptIds)
    if (restoredConcepts.length === 0) return false

    setMode('practice')
    setExam(draft.exam)
    setAssessConcepts(restoredConcepts)
    setConfidenceStep(Math.min(draft.confidenceStep, Math.max(restoredConcepts.length - 1, 0)))
    setConfidenceMap(draft.confidenceMap ?? {})
    const restoredPhase = draft.pPhase === 'session' && !draft.questions?.length
      ? 'path'
      : draft.pPhase === 'building'
      ? 'gap-analysis'
      : draft.pPhase
    setPPhase(restoredPhase)
    setConcept(draft.concept)
    setLevel(draft.level ?? 1)
    setQuestions(Array.isArray(draft.questions) ? draft.questions : [])
    setQIndex(draft.qIndex ?? 0)
    setSelected(null)
    setChecked(false)
    setHintsShown(0)
    setResults(Array.isArray(draft.results) ? draft.results : [])
    setXp(draft.xp ?? 0)
    setRequeuedIds(Array.isArray(draft.requeuedIds) ? draft.requeuedIds : [])
    setInitialQCount(draft.initialQCount ?? 0)
    setSessionBridge(draft.sessionBridge ?? null)
    setDraftRestored(true)
    return true
  }

  useEffect(() => {
    if (draftHydratedRef.current) return
    const raw = localStorage.getItem(practiceDraftKey(user.uid))
    if (raw) {
      try {
        const draft = JSON.parse(raw) as PracticeDraft
        if (draft.version === PRACTICE_DRAFT_VERSION && draft.assessConceptIds?.length) {
          restorePracticeDraft(draft)
        }
      } catch {
        localStorage.removeItem(practiceDraftKey(user.uid))
      }
    }
    draftHydratedRef.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid])

  useEffect(() => {
    if (!draftHydratedRef.current) return
    if (mode !== 'practice') return
    if (!exam || assessConcepts.length === 0) return

    const savedPhase: PracticePhase = pPhase === 'building' ? 'gap-analysis' : pPhase
    const draft: PracticeDraft = {
      version: PRACTICE_DRAFT_VERSION,
      name: 'Process 1',
      savedAt: Date.now(),
      exam,
      assessConceptIds: assessConcepts.map(c => c.id),
      confidenceStep,
      confidenceMap,
      pPhase: savedPhase,
      concept,
      level,
      questions,
      qIndex,
      results,
      xp,
      requeuedIds,
      initialQCount,
      sessionBridge,
    }

    localStorage.setItem(practiceDraftKey(user.uid), JSON.stringify(draft))
  }, [
    user.uid,
    mode,
    exam,
    assessConcepts,
    confidenceStep,
    confidenceMap,
    pPhase,
    concept,
    level,
    questions,
    qIndex,
    results,
    xp,
    requeuedIds,
    initialQCount,
    sessionBridge,
  ])

  // Auto-submit if navigated from dashboard with problemText; open the requested flow otherwise.
  useEffect(() => {
    const state = location.state as { problemText?: string; examHelp?: boolean; homeworkHelp?: boolean } | null
    if (state?.problemText) {
      setMode('solver')
      setProblem(state.problemText)
      submitProblem(state.problemText)
      window.history.replaceState({}, '')
    } else if (state?.homeworkHelp) {
      setMode('solver')
      setSPhase('input')
      window.history.replaceState({}, '')
    } else if (state?.examHelp) {
      setMode('practice')
      if (!localStorage.getItem(practiceDraftKey(user.uid))) setPPhase('exam-pick')
      window.history.replaceState({}, '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Onboarding handlers ───────────────────────────────────────────────────

  function pickExam(e: string) {
    setExam(e)
    const ids = EXAM_CONCEPT_IDS[e as ExamType] ?? EXAM_CONCEPT_IDS.General
    const filtered = ids.flatMap(id => {
      const c = PRACTICE_CONCEPTS.find(c => c.id === id)
      return c ? [c] : []
    })
    setAssessConcepts(filtered)
    setConfidenceStep(0)
    setConfidenceMap({})
    setPPhase('confidence')
  }

  function pickConfidence(conf: Confidence) {
    const current = assessConcepts[confidenceStep]
    const updated = { ...confidenceMap, [current.id]: conf }
    setConfidenceMap(updated)
    if (confidenceStep + 1 >= assessConcepts.length) {
      setPPhase('building')
      setTimeout(() => setPPhase('gap-analysis'), 2200)
    } else {
      setConfidenceStep(i => i + 1)
    }
  }

  // Returns recommended level based on self-reported confidence
  function getRecommendedLevel(conceptId: string): 1|2|3 {
    const conf = confidenceMap[conceptId]
    if (conf === 'hard')  return 1
    if (conf === 'kinda') return 2
    return 3
  }

  // ── Gap analysis helpers ──────────────────────────────────────────────────

  const hardConcepts  = assessConcepts.filter(c => confidenceMap[c.id] === 'hard')
  const kindaConcepts = assessConcepts.filter(c => confidenceMap[c.id] === 'kinda')
  const easyConcepts  = assessConcepts.filter(c => confidenceMap[c.id] === 'easy')
  const bridgeRecommendations = buildBridgeRecommendations(confidenceMap, 2)

  // The single best concept to start with (hardest first, then kinda)
  const topPriority = hardConcepts[0] ?? kindaConcepts[0] ?? easyConcepts[0] ?? assessConcepts[0]

  function getRoadmapSummary(): string {
    if (hardConcepts.length >= 3)
      return `The first islands rebuild the rough spots. After that, the path moves into exam-speed practice.`
    if (hardConcepts.length > 0)
      return `Start with the trickiest skill, then follow the path into the topics that are nearly there.`
    if (kindaConcepts.length > 0)
      return `You have a solid base. This path sharpens the few skills that still need polish.`
    return `You're in great shape. This route keeps you warm and pushes into challenge practice.`
  }

  function getRoadmapTone(conceptId: string): string {
    const conf = confidenceMap[conceptId]
    if (conf === 'hard') return 'Foundation'
    if (conf === 'kinda') return 'Sharpen'
    return 'Stretch'
  }

  // ── Practice helpers ──────────────────────────────────────────────────────

  function pickConcept(conceptId: string) {
    setConcept(conceptId)
    setPPhase('explore')
  }

  async function startSession(conceptId: string, lv: 1|2|3, bridge?: BridgeRecommendation) {
    // Show building screen while we fetch dynamic questions
    setPPhase('building')
    setConcept(conceptId)
    setLevel(lv)
    setSessionBridge(bridge ?? null)

    const examType = (EXAMS.includes(exam as ExamType) ? exam : FALLBACK_EXAM) as ExamType

    // Fetch a full dynamic session first. Static questions remain backup only,
    // because exam tracks should feel ACT/SAT/IB/AP-native whenever the agent is available.
    const [dynamic, staticQs] = await Promise.all([
      generateQuestions(conceptId, lv, examType, SESSION_LENGTH, bridge?.fromId),
      Promise.resolve(getQuestions(conceptId, lv, SESSION_LENGTH, [], examType)),
    ])

    // Deduplicate by id. Dynamic takes priority; static only fills outages/shortfalls.
    const dynamicIds = new Set(dynamic.map(q => q.id))
    const merged = [
      ...dynamic,
      ...staticQs.filter(q => !dynamicIds.has(q.id)),
    ].slice(0, SESSION_LENGTH)

    const qs = merged.length > 0 ? merged : staticQs
    if (qs.length === 0) { setPPhase('path'); return }

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

  function checkAnswer() {
    if (selected === null) return
    setChecked(true)
    const correct = selected === questions[qIndex].correctIndex
    if (correct) setXp(x => x + LEVEL_META[level].xp)
    setResults(r => [...r, correct])
  }

  function nextQuestion() {
    const wasCorrect   = results[qIndex]
    const currentQ     = questions[qIndex]
    const isLast       = qIndex + 1 >= questions.length

    const shouldRequeue = !wasCorrect
      && !requeuedIds.includes(currentQ.id)
      && questions.length < MAX_SESSION

    if (shouldRequeue) {
      setQuestions(prev => [...prev, currentQ])
      setRequeuedIds(prev => [...prev, currentQ.id])
    }

    if (isLast && !shouldRequeue) {
      // If mastered, evict sessionStorage cache so next session gets fresh questions
      if (concept && results.filter(Boolean).length / results.length >= 0.8) {
        evictQuestionCache(concept, level, exam || 'General')
      }
      setPPhase('complete')
    } else {
      setQIndex(i => i + 1)
      setSelected(null)
      setChecked(false)
      setHintsShown(0)
    }
  }

  function resetPractice() {
    clearPracticeDraft()
    setDraftRestored(false)
    setPPhase('onboard')
    setConcept(null)
    setSelected(null)
    setChecked(false)
    setHintsShown(0)
    setResults([])
    setXp(0)
    setRequeuedIds([])
    setInitialQCount(0)
    setSessionBridge(null)
    setConfidenceMap({})
    setConfidenceStep(0)
    setAssessConcepts([])
    setExam('')
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
      setSlowLoad(false)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSPhase('input')
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const currentQ    = questions[qIndex]
  const conceptMeta = PRACTICE_CONCEPTS.find(c => c.id === concept)
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

  const pathConcepts = assessConcepts.length > 0
    ? [...assessConcepts].sort((a, b) => {
        const order: Record<Confidence, number> = { hard: 0, kinda: 1, easy: 2 }
        return order[confidenceMap[a.id] ?? 'kinda'] - order[confidenceMap[b.id] ?? 'kinda']
      })
    : PRACTICE_CONCEPTS.slice(0, 6)

  const remainingConcepts = PRACTICE_CONCEPTS.filter(c => !assessConcepts.find(a => a.id === c.id))

  // Concepts from homework that the student struggled with (outcome === 0)
  const weakHomeworkConcepts: Array<{ label: string; conceptId: string | null }> =
    sResults
      .filter(r => r.outcome === 0)
      .map(r => ({ label: r.concept_chip, conceptId: chipToConceptId(r.concept_chip) }))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={s.shell}>
      <Sidebar />

      <main className={s.page}>

        {/* Mode toggle */}
        <div className={s.topBar}>
          <div className={s.modeToggle}>
            <button className={mode === 'practice' ? s.modeActive : s.modeInactive} onClick={() => setMode('practice')}>Practice</button>
            <button className={mode === 'solver'   ? s.modeActive : s.modeInactive} onClick={() => setMode('solver')}>Problem Solver</button>
          </div>
        </div>

        {/* ═══════ PRACTICE MODE ═══════ */}
        {mode === 'practice' && (
          <>

            {/* ── Onboard: mascot greeting ── */}
            {pPhase === 'onboard' && (
              <div className={s.onboard}>
                <div className={s.onboardMascot}>
                  <PixelCraft size="lg" />
                  <div className={s.speechBubbleTop}>
                    Hi! I'm <strong>Craft</strong> 🦝<br />
                    I'll scan your gaps and build a study path<br />in about 60 seconds.
                  </div>
                </div>
                <h1 className={s.onboardTitle}>Exam coming up?</h1>
                <p className={s.onboardSub}>Tell me what you're prepping for and I'll pinpoint exactly what to focus on.</p>
                <button className={s.onboardBtn} onClick={() => setPPhase('exam-pick')}>
                  Find my gaps →
                </button>
                <button className={s.skipBtn} onClick={() => { setAssessConcepts([]); setPPhase('path') }}>
                  Skip — just show me all topics
                </button>
              </div>
            )}

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
            {pPhase === 'confidence' && assessConcepts.length > 0 && (() => {
              const current = assessConcepts[confidenceStep]
              const selectedExam = (EXAMS.includes(exam as ExamType) ? exam : FALLBACK_EXAM) as ExamType
              const examMeta = EXAM_CARD_META[selectedExam]
              const confOptions = CONFIDENCE_OPTIONS[selectedExam]
              return (
                <div
                  className={s.confidenceScreen}
                  style={{ ['--exam-accent' as string]: examMeta.accent }}
                >
                  <div className={s.confProgressRow}>
                    {assessConcepts.map((_, i) => (
                      <div
                        key={i}
                        className={`${s.confDot} ${i < confidenceStep ? s.confDotDone : i === confidenceStep ? s.confDotActive : ''}`}
                      />
                    ))}
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
                            {confidenceStep + 1} of {assessConcepts.length} skills
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

            {/* ── Gap analysis: student-facing roadmap ── */}
            {pPhase === 'gap-analysis' && assessConcepts.length > 0 && (() => {
              const roadmap = pathConcepts
              const bridgeByTarget = new Map(bridgeRecommendations.map(bridge => [bridge.toId, bridge]))
              const roadmapHeight = roadmap.length * 190 + 80

              return (
                <div className={s.gapAnalysisScreen}>
                  <div className={s.roadmapHeader}>
                    <div className={s.mascotRow}>
                      <PixelCraft size="sm" />
                      <div className={s.speechBubble}>
                        Your route is ready. Start at the first island.
                      </div>
                    </div>
                    <div className={s.pathMeta}>
                      {exam && <span className={s.pathExamBadge}>{exam} Roadmap</span>}
                      <span className={s.processBadge}>{draftRestored ? 'Process 1 resumed' : 'Process 1 saved'}</span>
                    </div>
                  </div>

                  <div className={s.roadmapIntro}>
                    <h2>Your study path</h2>
                    <p>{getRoadmapSummary()} Follow the islands in order.</p>
                  </div>

                  <div className={s.roadmapStage} style={{ height: `${roadmapHeight}px` }}>
                    <svg
                      className={s.roadmapSvg}
                      viewBox={`0 0 760 ${roadmapHeight}`}
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <defs>
                        <filter id="roadmapGlow">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>
                      {roadmap.slice(0, -1).map((c, i) => {
                        const sx = i % 2 === 0 ? 170 : 590
                        const sy = i * 190 + 128
                        const ex = i % 2 === 0 ? 590 : 170
                        const ey = (i + 1) * 190 + 72
                        const cy = (sy + ey) / 2
                        return (
                          <path
                            key={c.id}
                            d={`M${sx},${sy} C${sx},${cy} ${ex},${cy} ${ex},${ey}`}
                            stroke="rgba(196,245,71,0.24)"
                            strokeWidth="5"
                            strokeLinecap="round"
                            fill="none"
                            filter="url(#roadmapGlow)"
                          />
                        )
                      })}
                    </svg>

                    {roadmap.map((c, i) => {
                      const bridge = bridgeByTarget.get(c.id)
                      const isLeft = i % 2 === 0
                      const isStart = c.id === topPriority?.id
                      return (
                        <button
                          key={c.id}
                          className={`${s.roadmapIsland} ${isStart ? s.roadmapIslandStart : ''}`}
                          style={{
                            top: `${i * 190 + 16}px`,
                            ...(isLeft ? { left: '48px' } : { right: '48px' }),
                            ['--float-delay' as string]: `${i * 0.24}s`,
                          }}
                          onClick={() => startSession(c.id, bridge?.level ?? getRecommendedLevel(c.id), bridge)}
                        >
                          <span className={s.roadmapStep}>{i + 1}</span>
                          <CastleMark index={i} active={isStart} />
                          <span className={s.roadmapBody}>
                            <span className={s.roadmapName}>{c.label}</span>
                            <span className={s.roadmapMeta}>
                              {bridge
                                ? `Use ${bridgeLabel(bridge.fromId)} here`
                                : `${getRoadmapTone(c.id)} practice`}
                            </span>
                          </span>
                          {isStart && <span className={s.roadmapStartBadge}>Start here</span>}
                        </button>
                      )
                    })}
                  </div>

                  {topPriority && (
                    <div className={s.roadmapActions}>
                      <button
                        className={s.gapStartBtn}
                        onClick={() => {
                          const bridge = bridgeByTarget.get(topPriority.id)
                          startSession(topPriority.id, bridge?.level ?? getRecommendedLevel(topPriority.id), bridge)
                        }}
                      >
                        Start roadmap →
                      </button>
                      <button className={s.gapViewAll} onClick={() => setPPhase('path')}>
                        See whole map →
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ── Path: Duolingo-style concept map ── */}
            {pPhase === 'path' && (
              <div className={s.pathScreen}>
                <div className={s.pathHeader}>
                  <div className={s.mascotRow}>
                    <PixelCraft size="sm" />
                    <div className={s.speechBubble}>
                      {assessConcepts.length > 0 ? getRoadmapSummary() : 'What do you want to practice today?'}
                    </div>
                  </div>
                  <div className={s.pathMeta}>
                    {exam && <span className={s.pathExamBadge}>{exam} Path</span>}
                    {assessConcepts.length > 0 && <span className={s.processBadge}>Process 1 saved</span>}
                    <button className={s.pathResetBtn} onClick={resetPractice}>← Change exam</button>
                  </div>
                </div>

                {/* Recommended start banner (only when gap scan was done) */}
                {assessConcepts.length > 0 && topPriority && (
                  <div className={s.pathRecommendBanner}>
                    <span className={s.pathRecommendIcon}>🎯</span>
                    <div className={s.pathRecommendText}>
                      <strong>Start here:</strong> {topPriority.emoji} {topPriority.label} — Level {getRecommendedLevel(topPriority.id)}
                    </div>
                    <button
                      className={s.pathRecommendBtn}
                      onClick={() => startSession(topPriority.id, getRecommendedLevel(topPriority.id))}
                    >
                      Go →
                    </button>
                  </div>
                )}

                {/* Floating island map */}
                <div
                  className={s.islandMap}
                  style={{ height: `${pathConcepts.length * 140 + 40}px` }}
                >
                  <svg
                    className={s.islandSvg}
                    viewBox={`0 0 560 ${pathConcepts.length * 140 + 40}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                    </defs>
                    {pathConcepts.slice(0, -1).map((c, i) => {
                      const sx = i % 2 === 0 ? 140 : 420
                      const sy = i * 140 + 90
                      const ex = i % 2 === 0 ? 420 : 140
                      const ey = (i + 1) * 140 + 50
                      const my = (sy + ey) / 2
                      const conf = confidenceMap[c.id]
                      const stroke = conf === 'hard'  ? 'rgba(255,107,107,0.40)'
                        : conf === 'kinda' ? 'rgba(244,162,97,0.35)'
                        : conf === 'easy'  ? 'rgba(168,224,99,0.28)'
                        : 'rgba(196,245,71,0.20)'
                      return (
                        <path
                          key={i}
                          d={`M${sx},${sy} C${sx},${my} ${ex},${my} ${ex},${ey}`}
                          stroke={stroke}
                          strokeWidth="2.5"
                          fill="none"
                          strokeDasharray="6 4"
                          strokeLinecap="round"
                          filter="url(#glow)"
                        />
                      )
                    })}
                  </svg>

                  {pathConcepts.map((c, i) => {
                    const conf = confidenceMap[c.id]
                    const isLeft = i % 2 === 0
                    const isTop  = c.id === topPriority?.id && assessConcepts.length > 0
                    return (
                      <button
                        key={c.id}
                        className={`${s.island} ${
                          conf === 'hard'  ? s.islandHard  :
                          conf === 'kinda' ? s.islandKinda :
                          conf === 'easy'  ? s.islandEasy  : s.islandNeutral
                        } ${isTop ? s.islandTop : ''}`}
                        style={{
                          top: `${i * 140 + 20}px`,
                          ...(isLeft ? { left: '2%' } : { right: '2%' }),
                          ['--float-delay' as string]: `${i * 0.45}s`,
                        }}
                        onClick={() => pickConcept(c.id)}
                      >
                        {isTop && <span className={s.islandTopPin}>🎯</span>}
                        <span className={s.islandStep}>{i + 1}</span>
                        <span className={s.islandEmoji}>{c.emoji}</span>
                        <div className={s.islandBody}>
                          <span className={s.islandName}>{c.label}</span>
                          <span className={`${s.islandBadge} ${
                            conf === 'hard'  ? s.badgeHard  :
                            conf === 'kinda' ? s.badgeKinda :
                            conf === 'easy'  ? s.badgeEasy  : ''
                          }`}>
                            {conf === 'hard'  ? '! Focus here'   :
                             conf === 'kinda' ? '~ Almost there' :
                             conf === 'easy'  ? '✓ Confident'    : 'Practice →'}
                          </span>
                          {assessConcepts.length > 0 && (
                            <span className={s.islandLevelHint}>
                              Start: L{getRecommendedLevel(c.id)}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {remainingConcepts.length > 0 && (
                  <>
                    <div className={s.moreConceptsLabel}>More topics</div>
                    <div className={s.conceptGrid}>
                      {remainingConcepts.map(c => (
                        <button key={c.id} className={s.conceptCard} onClick={() => pickConcept(c.id)}>
                          <span className={s.conceptEmoji}>{c.emoji}</span>
                          <span className={s.conceptLabel}>{c.label}</span>
                          <span className={s.conceptCategory}>{c.category}</span>
                          <div className={s.conceptLevels}>
                            {([1, 2, 3] as const).map(lv => (
                              <span
                                key={lv}
                                className={questionCount(c.id, lv) > 0 ? s.levelDot : s.levelDotEmpty}
                                style={{ background: questionCount(c.id, lv) > 0 ? LEVEL_META[lv].color : undefined }}
                              />
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

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
                      <span className={s.exploreEmoji}>{conceptMeta.emoji}</span>
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

            {/* ── Level selector ── */}
            {pPhase === 'level' && conceptMeta && (
              <div className={s.levelScreen}>
                <button className={s.backLink} onClick={() => setPPhase('explore')}>
                  ← {conceptMeta.label}
                </button>
                <div className={s.levelHeader}>
                  <span className={s.levelConceptEmoji}>{conceptMeta.emoji}</span>
                  <div>
                    <h2 className={s.levelConceptName}>{conceptMeta.label}</h2>
                    <p className={s.levelConceptSub}>Choose your difficulty</p>
                  </div>
                </div>

                <div className={s.levelCards}>
                  {([1, 2, 3] as const).map(lv => {
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
                        onClick={() => startSession(conceptMeta.id, lv)}
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

            {/* ── Active session ── */}
            {pPhase === 'session' && currentQ && (
              <div className={s.sessionWrap}>
                <div className={s.progressStrip}>
                  <div className={s.stripLeft}>
                    <span className={s.stripConcept}>{conceptMeta?.emoji} {conceptMeta?.label}</span>
                    {sessionBridge && (
                      <span className={s.stripBridge}>
                        Bridge: {bridgeLabel(sessionBridge.fromId)} → {bridgeLabel(sessionBridge.toId)}
                      </span>
                    )}
                    <span className={s.stripLevel} style={{ color: lvMeta.color }}>
                      {'★'.repeat(level)}{'☆'.repeat(3 - level)} L{level}
                    </span>
                  </div>
                  <div className={s.stripCenter}>
                    <div className={s.progressBar}>
                      <div className={s.progressFill} style={{ width: `${pct}%`, background: lvMeta.color }} />
                    </div>
                    <span className={s.progressLabel}>{qIndex + 1} / {questions.length}</span>
                  </div>
                  <div className={s.stripRight}>
                    <span className={s.xpBadge}>⚡ {xp} XP</span>
                  </div>
                </div>

                <div className={s.sessionColumns}>
                  {/* Main question card */}
                  <div className={s.sessionMain}>
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
                            if (checked) {
                              if (i === currentQ.correctIndex) cls = s.choiceCorrect
                              else if (i === selected)         cls = s.choiceWrong
                            } else if (i === selected) {
                              cls = s.choiceSelected
                            }
                            return (
                              <button key={i} className={cls} onClick={() => !checked && setSelected(i)} disabled={checked}>
                                <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                                <span className={s.choiceText}>{choice}</span>
                                {checked && i === currentQ.correctIndex && <span className={s.choiceTick}>✓</span>}
                                {checked && i === selected && i !== currentQ.correctIndex && <span className={s.choiceCross}>✗</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div className={s.actionRow}>
                        {!checked ? (
                          <button className={s.checkBtn} onClick={checkAnswer} disabled={selected === null}>
                            Check Answer →
                          </button>
                        ) : (
                          <button className={s.nextBtn} onClick={nextQuestion}>
                            {qIndex + 1 < questions.length ? 'Next Question →' : 'See Results →'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Side panel — hints and feedback */}
                  <div className={s.sidePanel}>
                    {!checked && (
                      <div className={s.hintCard}>
                        <div className={s.hintCardHeader}>
                          <span>💡</span>
                          <span className={s.hintCardTitle}>Need a Hint?</span>
                        </div>
                        {hintsShown === 0 ? (
                          <button className={s.hintTrigger} onClick={() => setHintsShown(1)}>
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

                    {checked && (
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
                  <button className={s.btnSecondary} onClick={resetPractice}>
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
                onComplete={r => { setSResults(r); setSPhase('done') }}
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
