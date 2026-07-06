/**
 * GradeOnboard — grade-aware conversational diagnostic.
 *
 * Flow: grade → goals → story intro → 2 calibration questions → seeding → /dashboard
 *
 * Grades 7–11. Each grade gets a curated concept list and a story excerpt from
 * conceptStories.json. Calibration questions are shown without revealing
 * correctness (C4 hide-correctness mode). After 2 questions the engine is
 * seeded with grade-inferred confidence + real probe outcomes.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { getQuestions } from '../lib/questionBank'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import { recordOutcomes, type OutcomeInput } from '../lib/mlApi'
import MathText from '../components/MathText'
import conceptStoriesRaw from '../data/conceptStories.json'
import s from './GradeOnboard.module.css'
import type { Confidence } from '../lib/bridgePractice'

// ---------------------------------------------------------------------------
// Grade → concept scope
// ---------------------------------------------------------------------------

const G7 = ['fractions_decimals','ratios_proportions','percent_ratio','order_of_operations','basic_equations','integer_operations','factors_multiples']
const G8 = [...G7,'linear_equations','exponent_rules','right_triangle_geometry','statistics_basics','probability']
const G9 = [...G8,'linear_inequalities','absolute_value','systems_of_linear_equations','functions_basics','function_notation','coordinate_geometry','triangles_similarity','data_interpretation']
const G10 = [...G9,'polynomial_operations','radical_expressions','quadratic_functions','exponential_functions','circles','transformations','sequences_series','geometric_transformations']
const G11 = [...G10,'complex_numbers','matrices','logarithms','trigonometry_basics','solid_geometry','composite_inverse','rational_expressions','regression','counting_combinatorics']

const GRADE_CONCEPTS: Record<number, string[]> = {
  7: G7, 8: G8, 9: G9, 10: G10, 11: G11,
}

// The story concept shown per grade (pick one they're ready for)
const GRADE_STORY: Record<number, string> = {
  7:  'fractions_decimals',
  8:  'linear_equations',
  9:  'functions_basics',
  10: 'quadratic_functions',
  11: 'linear_equations',  // navigator story — stakes feel right for ACT prep
}

// Calibration concepts per grade (two diverse clusters)
const GRADE_CALIBRATION: Record<number, [string, string]> = {
  7:  ['fractions_decimals',       'basic_equations'],
  8:  ['linear_equations',         'right_triangle_geometry'],
  9:  ['functions_basics',         'systems_of_linear_equations'],
  10: ['quadratic_functions',      'coordinate_geometry'],
  11: ['functions_basics',         'triangles_similarity'],
}

// Default confidence per grade (how well a student typically knows concepts)
// at their grade level: grade concepts start kinda, below-grade start easy
function gradeConfidence(grade: number): Record<string, Confidence> {
  const concepts = GRADE_CONCEPTS[grade] ?? G9
  const conf: Record<string, Confidence> = {}
  for (const c of concepts) {
    const gradeIntro = GRADE_CONCEPTS[grade - 1]?.includes(c)
    conf[c] = gradeIntro ? 'kinda' : 'hard'  // new concepts assumed hard; prior grade = kinda
  }
  return conf
}

// ---------------------------------------------------------------------------
// Goal → exam mapping
// ---------------------------------------------------------------------------

const GOALS = [
  { tag: 'ace_tests',       label: 'Ace my tests',          detail: 'Pass exams, boost my grade' },
  { tag: 'act_prep',        label: 'Crush the ACT/SAT',     detail: '11th grade + college-bound' },
  { tag: 'real_understanding', label: 'Actually understand it', detail: 'Not just memorize steps' },
  { tag: 'get_unstuck',     label: 'Get unstuck fast',      detail: 'Something specific is blocking me' },
]

// ---------------------------------------------------------------------------
// Story data
// ---------------------------------------------------------------------------

type ConceptStory = { conceptId: string; conceptName: string; story: string }
const stories = conceptStoriesRaw as Record<string, ConceptStory>

function storyExcerpt(conceptId: string): { title: string; excerpt: string } {
  const s = stories[conceptId]
  if (!s) return { title: 'Your story', excerpt: 'The map is building.' }
  const paragraphs = s.story.split('\n').filter(Boolean)
  return {
    title: s.conceptName,
    excerpt: paragraphs.slice(0, 2).join('\n'),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Step = 'grade' | 'goals' | 'story' | 'calibrate' | 'seeding' | 'done'

interface CalibResult { conceptId: string; correct: boolean; time: number }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GradeOnboard() {
  const user = useUser()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('grade')
  const [grade, setGrade] = useState<number | null>(null)
  const [goalTags, setGoalTags] = useState<string[]>([])
  const [calibQs, setCalibQs] = useState<ReturnType<typeof getQuestions>>([])
  const [calibIdx, setCalibIdx] = useState(0)
  const [calibResults, setCalibResults] = useState<CalibResult[]>([])
  const [qSelected, setQSelected] = useState<number | null>(null)
  const [qStartTime, setQStartTime] = useState<number>(0)
  const [qSubmitted, setQSubmitted] = useState(false)
  const [seedingMsg, setSeedingMsg] = useState('Reading your map…')

  // When grade is chosen and we reach calibrate, load questions
  useEffect(() => {
    if (step === 'calibrate' && grade && calibQs.length === 0) {
      const [c1, c2] = GRADE_CALIBRATION[grade]
      const q1 = getQuestions(c1, 1, 1)
      const q2 = getQuestions(c2, 1, 1)
      setCalibQs([...q1, ...q2].filter(Boolean).slice(0, 2))
      setQStartTime(Date.now())
    }
  }, [step, grade])

  // Reset per-question state when moving to next question
  useEffect(() => {
    setQSelected(null)
    setQSubmitted(false)
    setQStartTime(Date.now())
  }, [calibIdx])

  // Seeding animation messages
  useEffect(() => {
    if (step !== 'seeding') return
    const msgs = [
      'Reading your map…',
      'Tracing the gaps…',
      'Plotting your starting point…',
      'Almost there…',
    ]
    let i = 0
    const id = setInterval(() => {
      i++
      if (i < msgs.length) setSeedingMsg(msgs[i])
    }, 900)
    return () => clearInterval(id)
  }, [step])

  function toggleGoal(tag: string) {
    setGoalTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  async function finishCalibration(results: CalibResult[]) {
    setStep('seeding')

    const g = grade ?? 9
    const baseConf = gradeConfidence(g)

    // Adjust confidence for calibration concepts based on probe outcome
    for (const r of results) {
      baseConf[r.conceptId] = r.correct ? (baseConf[r.conceptId] === 'hard' ? 'kinda' : 'easy') : 'hard'
    }

    try {
      // 1. Seed the graph
      await applyDiagnosticConfidence(
        user.uid,
        goalTags.includes('act_prep') ? 'ACT' : 'General',
        baseConf,
        { tags: goalTags, text: '' },
        { diagnosticVersion: `grade${g}-v1` },
      )

      // 2. Record calibration probe outcomes
      if (results.length > 0) {
        const probes: OutcomeInput[] = results.map(r => ({
          conceptId: r.conceptId,
          score: r.correct ? 1 : 0,
          succeeded: r.correct,
        }))
        await recordOutcomes(user.uid, probes)
      }
    } catch { /* best-effort, never block navigation */ }

    navigate('/dashboard', { replace: true })
  }

  function submitCalibAnswer() {
    if (qSelected === null) return
    const q = calibQs[calibIdx]
    if (!q) return
    const correct = qSelected === q.correctIndex
    const time = Math.round((Date.now() - qStartTime) / 1000)
    setQSubmitted(true)

    const result: CalibResult = { conceptId: q.conceptId, correct, time }
    const nextResults = [...calibResults, result]
    setCalibResults(nextResults)

    if (calibIdx + 1 < calibQs.length) {
      setTimeout(() => {
        setCalibIdx(i => i + 1)
      }, 600)
    } else {
      setTimeout(() => {
        finishCalibration(nextResults)
      }, 600)
    }
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────

  const currentQ = calibQs[calibIdx]
  const storyData = grade ? storyExcerpt(GRADE_STORY[grade]) : null
  const progressSteps: Step[] = ['grade', 'goals', 'story', 'calibrate', 'seeding']
  const progressPct = Math.round((progressSteps.indexOf(step) / (progressSteps.length - 1)) * 100)

  return (
    <div className={s.desk}>
      {/* Progress line on the desk */}
      {step !== 'seeding' && (
        <div className={s.progressBar}>
          <div className={s.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <div className={`${s.page} ${step === 'seeding' ? s.seedingPage : ''}`}>

        {/* ── GRADE ── */}
        {step === 'grade' && (
          <div className={s.card}>
            <p className={s.kicker}>Let's build your map</p>
            <h1 className={s.title}>What grade are you in?</h1>
            <p className={s.body}>We'll pick the right concepts and build your path from there.</p>
            <div className={s.gradeRow}>
              {[7, 8, 9, 10, 11].map(g => (
                <button
                  key={g}
                  className={`${s.gradeBtn} ${grade === g ? s.gradeBtnActive : ''}`}
                  onClick={() => setGrade(g)}
                >
                  <span className={s.gradeNum}>{g}</span>
                  <span className={s.gradeLabel}>th</span>
                </button>
              ))}
            </div>
            <button
              className={s.primary}
              disabled={grade === null}
              onClick={() => setStep('goals')}
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── GOALS ── */}
        {step === 'goals' && (
          <div className={s.card}>
            <p className={s.kicker}>Grade {grade}</p>
            <h1 className={s.title}>What do you want to feel better at?</h1>
            <p className={s.body}>Pick everything that fits. We'll weight your path toward it.</p>
            <div className={s.goalGrid}>
              {GOALS.map(g => (
                <button
                  key={g.tag}
                  className={`${s.goalCard} ${goalTags.includes(g.tag) ? s.goalCardActive : ''}`}
                  onClick={() => toggleGoal(g.tag)}
                >
                  <span className={s.goalLabel}>{g.label}</span>
                  <span className={s.goalDetail}>{g.detail}</span>
                </button>
              ))}
            </div>
            <button
              className={s.primary}
              disabled={goalTags.length === 0}
              onClick={() => setStep('story')}
            >
              Continue →
            </button>
            <button className={s.back} onClick={() => setStep('grade')}>← back</button>
          </div>
        )}

        {/* ── STORY ── */}
        {step === 'story' && storyData && (
          <div className={`${s.card} ${s.storyCard}`}>
            <p className={s.kicker}>A story from your path</p>
            <h2 className={s.storyTitle}>{storyData.title}</h2>
            <div className={s.storyBody}>
              {storyData.excerpt.split('\n').map((p, i) => (
                <p key={i} className={`${s.storyPara} ${i === 0 ? s.storyParaFirst : ''}`}>{p}</p>
              ))}
            </div>
            <p className={s.storyNote}>This concept is on your map. You'll come back to this story.</p>
            <button className={s.primary} onClick={() => setStep('calibrate')}>
              Two quick questions →
            </button>
          </div>
        )}

        {/* ── CALIBRATE ── */}
        {step === 'calibrate' && currentQ && (
          <div className={s.card}>
            <p className={s.kicker}>
              Question {calibIdx + 1} of {calibQs.length} · no right or wrong yet
            </p>
            <div className={s.questionWrap}>
              <p className={s.questionText}>
                <MathText text={currentQ.question} />
              </p>
              <div className={s.choices}>
                {currentQ.choices.slice(0, 4).map((choice, i) => (
                  <button
                    key={i}
                    className={`${s.choice} ${qSelected === i ? s.choiceSelected : ''} ${qSubmitted ? s.choiceSubmitted : ''}`}
                    onClick={() => !qSubmitted && setQSelected(i)}
                    disabled={qSubmitted}
                  >
                    <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                    <span><MathText text={choice} /></span>
                  </button>
                ))}
              </div>
            </div>
            <button
              className={s.primary}
              disabled={qSelected === null || qSubmitted}
              onClick={submitCalibAnswer}
            >
              {qSubmitted ? '…' : 'Submit'}
            </button>
          </div>
        )}

        {/* ── CALIBRATE — no questions available ── */}
        {step === 'calibrate' && calibQs.length === 0 && (
          <div className={s.card}>
            <p className={s.kicker}>Almost done</p>
            <h2 className={s.title}>Building your map…</h2>
            <button className={s.primary} onClick={() => finishCalibration([])}>
              Go to my dashboard →
            </button>
          </div>
        )}

        {/* ── SEEDING ── */}
        {step === 'seeding' && (
          <div className={s.seedingWrap}>
            <div className={s.seedingMap} aria-hidden>
              <svg viewBox="0 0 200 200" fill="none">
                {/* Animated knowledge map nodes */}
                {[
                  {cx:100,cy:60,r:8, lit:true},
                  {cx:60,cy:100,r:6, lit:false},
                  {cx:140,cy:100,r:6, lit:true},
                  {cx:80,cy:148,r:5, lit:false},
                  {cx:120,cy:148,r:5, lit:false},
                ].map((n,i) => (
                  <g key={i}>
                    <line x1={100} y1={60} x2={n.cx} y2={n.cy} stroke="rgba(196,245,71,0.2)" strokeWidth="1" strokeDasharray="3 4"/>
                    <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.lit ? '#c4f547' : 'none'} stroke={n.lit ? '#c4f547' : 'rgba(196,245,71,0.4)'} strokeWidth="1.5"/>
                    {n.lit && <circle cx={n.cx} cy={n.cy} r={n.r + 4} fill="none" stroke="#c4f547" strokeWidth="0.5" opacity="0.3" className={s.seedPulse}/>}
                  </g>
                ))}
              </svg>
            </div>
            <p className={s.seedingText}>{seedingMsg}</p>
          </div>
        )}

      </div>
    </div>
  )
}
