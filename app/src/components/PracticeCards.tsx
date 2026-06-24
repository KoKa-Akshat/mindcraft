import { useState, useEffect, useRef, useCallback } from 'react'
import type { Gap, ExamType } from '../pages/Prep'
import s from './PracticeCards.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────

interface GeneratedQuestion {
  id:              string
  conceptId:       string
  level:           1 | 2 | 3
  question:        string
  choices:         string[]
  correctIndex:    number
  explanation:     string
  hints:           [string, string]
  microLesson:     string
  trapChoiceIndex?: number
  trapReasoning?:  string
  examTag?:        'ACT' | 'SAT' | 'IB' | 'AP' | null
  questionFormat?: 'multiple_choice' | 'grid_in'
  methodMarks?:    string
  visual_type?:    'svg' | 'none'
  visual_data?:    string
}

interface Props {
  gap:             Gap
  examType:        ExamType
  sessionId:       string
  studentId:       string
  mode:            'triage' | 'foundation'
  allGaps:         Gap[]
  onMasteryUpdate: (conceptId: string, newScore: number) => void
  onComplete:      (result: { conceptId: string; attempted: number; correct: number; finalScore: number }) => void
  onBackToMap:     () => void
}

const IDLE_MS = 45_000
const API_BASE     = import.meta.env.VITE_WEBHOOK_URL ?? 'https://mindcraft-webhook.vercel.app'

const EXAM_TAG: Record<ExamType, 'ACT' | 'SAT' | 'IB' | 'AP'> = {
  SAT_MATH:   'SAT',
  ACT_MATH:   'ACT',
  IB_MATH_AA: 'IB',
  IB_MATH_AI: 'IB',
  AP_CALC_AB: 'AP',
}

const URGENCY_DOT: Record<Gap['urgency'], string> = {
  critical: '#FF5C5C',
  moderate: '#F5A623',
  stable:   '#58CC02',
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PracticeCards({
  gap, examType, sessionId, studentId, mode,
  allGaps, onMasteryUpdate, onComplete, onBackToMap,
}: Props) {
  const [questions,     setQuestions]     = useState<GeneratedQuestion[]>([])
  const [loading,       setLoading]       = useState(true)
  const [loadError,     setLoadError]     = useState('')
  const [qIdx,          setQIdx]          = useState(0)
  // 'trap' = identify the trap choice first; 'solve' = answer the question
  const [practiceStage, setPracticeStage] = useState<'trap' | 'solve'>('trap')
  const [trapGuessed,   setTrapGuessed]   = useState<number | null>(null)
  const [trapRevealed,  setTrapRevealed]  = useState(false)
  const [selected,      setSelected]      = useState<number | null>(null)
  const [revealed,      setRevealed]      = useState(false)
  const [hintsShown,    setHintsShown]    = useState(0)
  const [consecutive,   setConsecutive]   = useState(0)
  const [comebacks,     setComebacks]     = useState(0)
  const [correctCount,  setCorrectCount]  = useState(0)
  const [attempted,     setAttempted]     = useState(0)
  const [idle,          setIdle]          = useState(false)
  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [finished,      setFinished]      = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load questions ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const res = await fetch(`${API_BASE}/api/generate-questions`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conceptId:   gap.conceptId,
            level:       gap.urgency === 'critical' ? 1 : gap.urgency === 'moderate' ? 2 : 3,
            examType:    EXAM_TAG[examType],
            count:       gap.practiceCount,
            bridgeFrom:  gap.bridgeConcept?.toLowerCase().replace(/\s+/g, '_'),
          }),
        })
        if (!res.ok) throw new Error('Could not load questions')
        const data = await res.json()
        setQuestions(data.questions ?? [])
      } catch {
        setLoadError('Could not load practice questions. Try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [gap.conceptId])

  // ── Idle detection ───────────────────────────────────────────────────────────
  const resetIdle = useCallback(() => {
    setIdle(false)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS)
  }, [])

  useEffect(() => {
    resetIdle()
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [qIdx, resetIdle])

  // ── Session complete — fire with result data ──────────────────────────────
  useEffect(() => {
    if (!finished && questions.length > 0 && qIdx >= questions.length) {
      setFinished(true)
      const finalScore = Math.min(gap.studentScore + 0.35, 0.95)
      onMasteryUpdate(gap.conceptId, finalScore)
      onComplete({ conceptId: gap.conceptId, attempted, correct: correctCount, finalScore })
    }
  }, [qIdx, questions.length, finished, gap.conceptId, gap.studentScore,
      attempted, correctCount, onMasteryUpdate, onComplete])

  if (loading) return <LoadingState conceptName={gap.conceptName} />
  if (loadError) return <ErrorState error={loadError} onBack={onBackToMap} />
  if (questions.length === 0) return <ErrorState error="No questions generated — go back and try a different gap." onBack={onBackToMap} />

  if (finished || qIdx >= questions.length) return null

  const q = questions[qIdx]

  function handleSelect(idx: number) {
    if (revealed) return
    setSelected(idx)
    resetIdle()
  }

  function handleTrapGuess(idx: number) {
    if (trapRevealed) return
    setTrapGuessed(idx)
    setTrapRevealed(true)
    resetIdle()
  }

  function advanceToSolve() {
    setPracticeStage('solve')
    resetIdle()
  }

  function handleConfirm() {
    if (selected === null) return
    setRevealed(true)
    resetIdle()
    setAttempted(a => a + 1)

    const isCorrect = selected === q.correctIndex
    if (isCorrect) {
      setCorrectCount(c => c + 1)
      const newConsec = consecutive + 1
      setConsecutive(newConsec)
      if (newConsec >= 3) {
        const bump = Math.min(gap.studentScore + 0.18, 0.95)
        onMasteryUpdate(gap.conceptId, bump)
        setConsecutive(0)
      }
    } else {
      setComebacks(c => c + 1)
      setConsecutive(0)
    }
  }

  function handleNext() {
    setSelected(null)
    setRevealed(false)
    setHintsShown(0)
    setPracticeStage('trap')
    setTrapGuessed(null)
    setTrapRevealed(false)
    setQIdx(i => i + 1)
  }

  function showHint() {
    if (hintsShown < 2) setHintsShown(h => h + 1)
    resetIdle()
  }

  const correct = revealed && selected === q.correctIndex

  return (
    <div className={s.shell} onPointerMove={resetIdle} onKeyDown={resetIdle}>

      {/* Header */}
      <div className={s.topBar}>
        <button className={s.backBtn} onClick={onBackToMap} type="button">← Map</button>
        <div className={s.topMeta}>
          <span className={s.conceptLabel}>{gap.conceptName}</span>
          <span className={s.progress}>{qIdx + 1} / {questions.length}</span>
        </div>
        <button className={s.sidebarToggle} onClick={() => setSidebarOpen(v => !v)} type="button">
          ☰
        </button>
      </div>

      <div className={s.layout}>

        {/* Main card */}
        <div className={s.main}>

          {idle && !revealed && (
            <div className={s.idleBanner}>
              Still here? You're closer than you think.
              <button className={s.idleDismiss} onClick={resetIdle} type="button">Keep going →</button>
            </div>
          )}

          {/* Progress bar */}
          <div className={s.progressBar}>
            <div className={s.progressFill} style={{ width: `${((qIdx + 1) / questions.length) * 100}%` }} />
          </div>

          {/* Question */}
          <div className={s.qCard}>
            <p className={s.question}>{q.question}</p>

            {/* Visual */}
            {q.visual_type === 'svg' && q.visual_data && (
              <div className={s.visual} dangerouslySetInnerHTML={{ __html: q.visual_data }} />
            )}

            {/* ── Stage 1: Trap identification ────────────────────────────── */}
            {practiceStage === 'trap' && q.trapChoiceIndex != null && (
              <div className={s.trapStage}>
                {!trapRevealed ? (
                  <>
                    <p className={s.trapPrompt}>
                      Before you solve — which choice is the trap?
                    </p>
                    <div className={s.choices}>
                      {q.choices.map((choice, i) => (
                        <button
                          key={i}
                          className={`${s.choice} ${trapGuessed === i ? s.choiceSelected : ''}`}
                          onClick={() => handleTrapGuess(i)}
                          type="button"
                        >
                          <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                          <span className={s.choiceText}>{choice}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={s.trapReveal}>
                    <div className={trapGuessed === q.trapChoiceIndex ? s.feedbackCorrect : s.feedbackWrong}>
                      {trapGuessed === q.trapChoiceIndex
                        ? 'Right. You spotted it.'
                        : `The trap is ${String.fromCharCode(65 + q.trapChoiceIndex)}.`}
                    </div>
                    {q.trapReasoning && (
                      <p className={s.trapReasoning}>{q.trapReasoning}</p>
                    )}
                    <button className={s.solveBtn} onClick={advanceToSolve} type="button">
                      Now solve it →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Skip trap stage if no trapChoiceIndex and still in trap stage */}
            {practiceStage === 'trap' && q.trapChoiceIndex == null && (
              <div className={s.choices}>
                {q.choices.map((choice, i) => (
                  <button
                    key={i}
                    className={[
                      s.choice,
                      selected === i && !revealed ? s.choiceSelected : '',
                      revealed && i === q.correctIndex ? s.choiceCorrect : '',
                      revealed && selected === i && i !== q.correctIndex ? s.choiceWrong : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleSelect(i)}
                    type="button"
                    disabled={revealed}
                  >
                    <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                    <span className={s.choiceText}>{choice}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Stage 2: Solve ──────────────────────────────────────────── */}
            {practiceStage === 'solve' && (
              <>
                {/* Hint strip (only visible in solve stage) */}
                {hintsShown > 0 && !revealed && (
                  <div className={s.hints}>
                    {q.hints.slice(0, hintsShown).map((h, i) => (
                      <div key={i} className={s.hint}>
                        <span className={s.hintNum}>Hint {i + 1}</span>
                        <span className={s.hintText}>{h}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className={s.choices}>
                  {q.choices.map((choice, i) => (
                    <button
                      key={i}
                      className={[
                        s.choice,
                        selected === i && !revealed ? s.choiceSelected : '',
                        revealed && i === q.correctIndex ? s.choiceCorrect : '',
                        revealed && selected === i && i !== q.correctIndex ? s.choiceWrong : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleSelect(i)}
                      type="button"
                      disabled={revealed}
                    >
                      <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                      <span className={s.choiceText}>{choice}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Action row — only shown in solve stage (or trap stage with no trap data) */}
            {(practiceStage === 'solve' || (practiceStage === 'trap' && q.trapChoiceIndex == null)) && (
              !revealed ? (
                <div className={s.actionRow}>
                  <button
                    className={s.confirmBtn}
                    onClick={handleConfirm}
                    disabled={selected === null}
                    type="button"
                  >
                    Check answer
                  </button>
                  {hintsShown < 2 && (
                    <button className={s.hintBtn} onClick={showHint} type="button">
                      {hintsShown === 0 ? 'Need a hint?' : 'Another hint'}
                    </button>
                  )}
                </div>
              ) : (
                <div className={s.feedback}>
                  <div className={correct ? s.feedbackCorrect : s.feedbackWrong}>
                    {correct
                      ? 'Exactly.'
                      : 'Good. We found the real gap.'}
                  </div>
                  <p className={s.explanation}>{q.explanation}</p>
                  {!correct && (
                    <div className={s.microLesson}>
                      <span className={s.microLabel}>Build from here:</span>
                      <p className={s.microText}>{q.microLesson}</p>
                    </div>
                  )}
                  {q.methodMarks && (
                    <div className={s.methodMarks}>
                      <span className={s.methodLabel}>IB mark scheme:</span>
                      <p>{q.methodMarks}</p>
                    </div>
                  )}
                  <button className={s.nextBtn} onClick={handleNext} type="button">
                    {qIdx + 1 < questions.length ? 'Next →' : 'Finish gap →'}
                  </button>
                </div>
              )
            )}
          </div>

          {/* Comeback counter — grit signal */}
          {comebacks > 0 && (
            <p className={s.comebacks}>
              {comebacks} gap{comebacks !== 1 ? 's' : ''} found and named. That's the work.
            </p>
          )}
        </div>

        {/* Gap sidebar */}
        {sidebarOpen && (
          <div className={s.sidebar}>
            <p className={s.sidebarTitle}>Your gaps</p>
            {allGaps.map(g => (
              <div key={g.conceptId} className={`${s.sidebarGap} ${g.conceptId === gap.conceptId ? s.sidebarGapActive : ''}`}>
                <span className={s.urgencyDot} style={{ background: URGENCY_DOT[g.urgency] }} />
                <span className={s.sidebarGapName}>{g.conceptName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadingState({ conceptName }: { conceptName: string }) {
  return (
    <div className={s.centeredState}>
      <div className={s.spinner} />
      <p className={s.stateLabel}>Building your {conceptName} practice…</p>
    </div>
  )
}

function ErrorState({ error, onBack }: { error: string; onBack: () => void }) {
  return (
    <div className={s.centeredState}>
      <p className={s.stateError}>{error}</p>
      <button className={s.backBtn} onClick={onBack} type="button">← Back to map</button>
    </div>
  )
}

