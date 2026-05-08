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
import { solveWithGemini, clueWithGemini } from '../lib/geminiHomework'
import s from './Practice.module.css'

const HOMEWORK_API = import.meta.env.VITE_HOMEWORK_API_URL ?? 'http://localhost:8001'
const SESSION_LENGTH = 10   // Bloom's mastery: min 10 trials for 80% threshold
const MAX_SESSION    = 14   // hard cap when re-queuing wrong answers

type PracticePhase =
  | 'onboard' | 'exam-pick' | 'confidence' | 'building'
  | 'gap-analysis' | 'path' | 'explore' | 'level' | 'session' | 'complete'
type SolverPhase   = 'input' | 'loading' | 'cards' | 'done'
type Mode          = 'practice' | 'solver'
type Confidence    = 'easy' | 'kinda' | 'hard'

const EXAMS = ['ACT', 'SAT', 'IB', 'AP', 'General'] as const
type ExamType = typeof EXAMS[number]

const FALLBACK_EXAM: ExamType = 'General'

const EXAM_DESCRIPTIONS: Record<ExamType, string> = {
  ACT:     '36-point math — algebra & trig',
  SAT:     '800-point math — algebra & data',
  IB:      'International Baccalaureate math',
  AP:      'Advanced Placement — calculus & stats',
  General: 'General math improvement',
}
const EXAM_CARD_META: Record<ExamType, { icon: string; accent: string; micro: string }> = {
  ACT:     { icon: '36', accent: '#FF6B6B', micro: 'Algebra speed' },
  SAT:     { icon: '800', accent: '#4ECDC4', micro: 'Data + functions' },
  IB:      { icon: 'IB', accent: '#A29BFE', micro: 'Exact reasoning' },
  AP:      { icon: 'AP', accent: '#FFE66D', micro: 'Calc readiness' },
  General: { icon: '+', accent: '#C4F547', micro: 'Custom path' },
}

const CONFIDENCE_COPY: Record<ExamType, string> = {
  ACT:     'ACT rewards speed. Pick the level where you can solve fast without careless misses.',
  SAT:     'SAT questions hide algebra inside context. Pick how steady this skill feels under wording pressure.',
  IB:      'IB needs exact reasoning and multi-step explanation. Pick how confident you are showing the method.',
  AP:      'AP leans on function behavior and notation. Pick the level you can handle under exam-style setup.',
  General: 'Pick the level that matches how this skill feels today.',
}

const EXAM_CONCEPT_IDS: Record<ExamType, string[]> = {
  ACT:     ['linear_equations', 'systems_of_linear_equations', 'quadratic_equations', 'functions_basics', 'word_problems', 'percent_ratio', 'basic_probability', 'descriptive_statistics'],
  SAT:     ['linear_equations', 'functions_basics', 'quadratic_equations', 'rational_expressions', 'percent_ratio', 'descriptive_statistics', 'exponent_rules', 'absolute_value'],
  IB:      ['functions_basics', 'function_transformations', 'quadratic_equations', 'polynomials', 'rational_expressions', 'exponent_rules', 'basic_probability', 'descriptive_statistics'],
  AP:      ['functions_basics', 'function_transformations', 'polynomials', 'rational_expressions', 'exponent_rules', 'quadratic_equations', 'descriptive_statistics', 'linear_equations'],
  General: ['linear_equations', 'quadratic_equations', 'functions_basics', 'linear_inequalities', 'exponent_rules', 'absolute_value'],
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

export default function Practice() {
  const user     = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const fileRef  = useRef<HTMLInputElement>(null)

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

  // ── Solver state ──────────────────────────────────────────────────────────
  const [sPhase,     setSPhase]     = useState<SolverPhase>('input')
  const [problem,    setProblem]    = useState('')
  const [solverFile, setSolverFile] = useState<File | null>(null)
  const [session,    setSession]    = useState<HomeworkSession | null>(null)
  const [sResults,   setSResults]   = useState<OutcomeRecord[]>([])
  const [error,      setError]      = useState('')
  const [slowLoad,   setSlowLoad]   = useState(false)

  // Auto-submit if navigated from dashboard with problemText; skip to exam-pick if examHelp
  useEffect(() => {
    const state = location.state as { problemText?: string; examHelp?: boolean } | null
    if (state?.problemText) {
      setMode('solver')
      setProblem(state.problemText)
      submitProblem(state.problemText)
      window.history.replaceState({}, '')
    } else if (state?.examHelp) {
      setMode('practice')
      setPPhase('exam-pick')
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

  // The single best concept to start with (hardest first, then kinda)
  const topPriority = hardConcepts[0] ?? kindaConcepts[0] ?? easyConcepts[0] ?? assessConcepts[0]

  function getGapInsight(): string {
    if (hardConcepts.length >= 3)
      return `${hardConcepts.length} real gaps found. Focus hard on these — they're the quickest way to boost your ${exam} score.`
    if (hardConcepts.length > 0)
      return `${hardConcepts.length} gap${hardConcepts.length > 1 ? 's' : ''} to close before exam day. ${kindaConcepts.length > 0 ? `${kindaConcepts.length} more to sharpen.` : "You're close!"}`
    if (kindaConcepts.length > 0)
      return `Solid foundation! ${kindaConcepts.length} concept${kindaConcepts.length > 1 ? 's' : ''} need a bit more practice before you're exam-ready.`
    return `You're in great shape — a quick review and you're ready to ace it.`
  }

  // ── Practice helpers ──────────────────────────────────────────────────────

  function pickConcept(conceptId: string) {
    setConcept(conceptId)
    setPPhase('explore')
  }

  async function startSession(conceptId: string, lv: 1|2|3) {
    // Show building screen while we fetch dynamic questions
    setPPhase('building')
    setConcept(conceptId)
    setLevel(lv)

    const examType = (EXAMS.includes(exam as ExamType) ? exam : FALLBACK_EXAM) as ExamType

    // Fetch a full dynamic session first. Static questions remain backup only,
    // because exam tracks should feel ACT/SAT/IB/AP-native whenever the agent is available.
    const [dynamic, staticQs] = await Promise.all([
      generateQuestions(conceptId, lv, examType, SESSION_LENGTH),
      Promise.resolve(getQuestions(conceptId, lv, SESSION_LENGTH)),
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
    setPPhase('onboard')
    setConcept(null)
    setSelected(null)
    setChecked(false)
    setHintsShown(0)
    setResults([])
    setXp(0)
    setRequeuedIds([])
    setInitialQCount(0)
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
                      <span className={s.confExamBadge}>{selectedExam} gap scan</span>
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
                          <span className={s.confBtnLabel}>Confident</span>
                          <span className={s.confBtnDesc}>Exam-ready questions, fewer warmups</span>
                        </div>
                      </button>
                      <button className={`${s.confBtn} ${s.confBtnKinda}`} onClick={() => pickConfidence('kinda')}>
                        <span className={s.confBtnIcon}>2</span>
                        <div className={s.confBtnText}>
                          <span className={s.confBtnLabel}>Shaky</span>
                          <span className={s.confBtnDesc}>Applied practice with traps called out</span>
                        </div>
                      </button>
                      <button className={`${s.confBtn} ${s.confBtnHard}`} onClick={() => pickConfidence('hard')}>
                        <span className={s.confBtnIcon}>1</span>
                        <div className={s.confBtnText}>
                          <span className={s.confBtnLabel}>Needs rebuild</span>
                          <span className={s.confBtnDesc}>Foundation first, then exam style</span>
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

            {/* ── Gap analysis: dedicated breakdown screen ── */}
            {pPhase === 'gap-analysis' && assessConcepts.length > 0 && (
              <div className={s.gapAnalysisScreen}>
                <div className={s.gapAnalysisHeader}>
                  <div className={s.mascotRow}>
                    <PixelCraft size="sm" />
                    <div className={s.speechBubble}>
                      Here's what I found. Let's fix these in the right order.
                    </div>
                  </div>
                  {exam && <span className={s.pathExamBadge}>{exam} Gap Analysis</span>}
                </div>

                <p className={s.gapInsight}>{getGapInsight()}</p>

                {/* Visual gap breakdown */}
                <div className={s.gapBuckets}>
                  {hardConcepts.length > 0 && (
                    <div className={`${s.gapBucket} ${s.gapBucketHard}`}>
                      <div className={s.gapBucketHeader}>
                        <span className={s.gapBucketIcon}>🔴</span>
                        <span className={s.gapBucketTitle}>Needs work</span>
                        <span className={s.gapBucketCount}>{hardConcepts.length}</span>
                      </div>
                      <div className={s.gapBucketConcepts}>
                        {hardConcepts.map(c => (
                          <span key={c.id} className={`${s.gapChip} ${s.gapChipHard}`}>
                            {c.emoji} {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {kindaConcepts.length > 0 && (
                    <div className={`${s.gapBucket} ${s.gapBucketKinda}`}>
                      <div className={s.gapBucketHeader}>
                        <span className={s.gapBucketIcon}>🟡</span>
                        <span className={s.gapBucketTitle}>Almost there</span>
                        <span className={s.gapBucketCount}>{kindaConcepts.length}</span>
                      </div>
                      <div className={s.gapBucketConcepts}>
                        {kindaConcepts.map(c => (
                          <span key={c.id} className={`${s.gapChip} ${s.gapChipKinda}`}>
                            {c.emoji} {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {easyConcepts.length > 0 && (
                    <div className={`${s.gapBucket} ${s.gapBucketEasy}`}>
                      <div className={s.gapBucketHeader}>
                        <span className={s.gapBucketIcon}>🟢</span>
                        <span className={s.gapBucketTitle}>Confident</span>
                        <span className={s.gapBucketCount}>{easyConcepts.length}</span>
                      </div>
                      <div className={s.gapBucketConcepts}>
                        {easyConcepts.map(c => (
                          <span key={c.id} className={`${s.gapChip} ${s.gapChipEasy}`}>
                            {c.emoji} {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recommended first action */}
                {topPriority && (
                  <div className={s.gapRecommend}>
                    <div className={s.gapRecommendLeft}>
                      <span className={s.gapRecommendLabel}>Craft recommends — start here</span>
                      <div className={s.gapRecommendConcept}>
                        <span style={{ fontSize: 28 }}>{topPriority.emoji}</span>
                        <div>
                          <div className={s.gapRecommendName}>{topPriority.label}</div>
                          <div className={s.gapRecommendLevel}>
                            Level {getRecommendedLevel(topPriority.id)} — {
                              getRecommendedLevel(topPriority.id) === 1
                                ? 'Foundation questions, rebuild the core'
                                : getRecommendedLevel(topPriority.id) === 2
                                ? 'Applied questions, sharpen the edge'
                                : 'Challenge questions, exam-ready depth'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      className={s.gapStartBtn}
                      onClick={() => startSession(topPriority.id, getRecommendedLevel(topPriority.id))}
                    >
                      Start now →
                    </button>
                  </div>
                )}

                <button className={s.gapViewAll} onClick={() => setPPhase('path')}>
                  View full study path →
                </button>
              </div>
            )}

            {/* ── Path: Duolingo-style concept map ── */}
            {pPhase === 'path' && (
              <div className={s.pathScreen}>
                <div className={s.pathHeader}>
                  <div className={s.mascotRow}>
                    <PixelCraft size="sm" />
                    <div className={s.speechBubble}>
                      {assessConcepts.length > 0 ? getGapInsight() : 'What do you want to practice today?'}
                    </div>
                  </div>
                  <div className={s.pathMeta}>
                    {exam && <span className={s.pathExamBadge}>{exam} Path</span>}
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
                        disabled={cnt === 0}
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
                        <div className={s.levelCount}>{cnt} questions</div>
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
            <div className={s.solverHeader}>
              <h2 className={s.solverTitle}>Problem Solver</h2>
              <p className={s.solverSub}>
                Paste any problem — Craft breaks it down step by step with Socratic hints.
                {exam && <> Tuned for <strong style={{ color: 'var(--accent)' }}>{exam}</strong>.</>}
              </p>
            </div>

            {sPhase === 'input' && (
              <div className={s.solverInput}>
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
                  placeholder="Paste your problem here… e.g. Solve x² − 5x + 6 = 0"
                  value={problem}
                  onChange={e => setProblem(e.target.value)}
                  rows={4}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitProblem(problem, solverFile) }}
                />
                <button
                  className={s.solverBtn}
                  onClick={() => submitProblem(problem, solverFile)}
                  disabled={!problem.trim() && !solverFile}
                >
                  Break it down →
                </button>
                {error && (
                  <div className={s.errorMsg}>
                    {error}
                    <button onClick={() => setError('')}>✕</button>
                  </div>
                )}
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
