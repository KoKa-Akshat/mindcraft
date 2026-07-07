/**
 * GradeOnboard — Jesse's Kitchen diagnostic (paper journal format).
 *
 * Flow: welcome → grade → goals (writable) → story → ~10 probe questions → dashboard
 * World "Projects" and Dashboard gate both land here until complete.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { doc, setDoc } from 'firebase/firestore'
import { useUser } from '../App'
import { db } from '../firebase'
import { isDiagnosticComplete, persistDiagnosticDoneLocal } from '../lib/practiceState'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import { recordOutcomes, type OutcomeInput } from '../lib/mlApi'
import {
  conceptsForGradeAndGoals,
  curriculumTrackFor,
  examForGoals,
  gradeConfidence,
  GRADE_STORY,
  pickDiagnosticQuestions,
} from '../lib/diagnosticQuestions'
import { fetchStoryModule, type StoryModule } from '../lib/storyModule'
import MathText from '../components/MathText'
import InteractiveWidget from '../components/InteractiveWidget'
import ScratchPad from '../components/ScratchPad'
import BookShell from '../components/book/BookShell'
import BookPage from '../components/book/BookPage'
import PageFlipTransition from '../components/book/PageFlipTransition'
import conceptStoriesRaw from '../data/conceptStories.json'
import s from './GradeOnboard.module.css'
import type { Question } from '../lib/questionBank'

type Step = 'welcome' | 'grade' | 'goals' | 'story' | 'probe' | 'seeding'

const GOALS = [
  { tag: 'ace_tests', label: 'Ace my tests', detail: 'Pass exams, boost my grade' },
  { tag: 'act_prep', label: 'Crush the ACT/SAT', detail: 'College-bound exam prep' },
  { tag: 'real_understanding', label: 'Actually understand it', detail: 'Not just memorize steps' },
  { tag: 'get_unstuck', label: 'Get unstuck fast', detail: 'Something specific is blocking me' },
]

type ConceptStory = { conceptId: string; conceptName: string; story: string }
const stories = conceptStoriesRaw as Record<string, ConceptStory>

interface ProbeResult { conceptId: string; correct: boolean; time: number }

function storyExcerpt(conceptId: string): { title: string; excerpt: string; story: string } {
  const entry = stories[conceptId]
  if (!entry) return { title: 'Your map', excerpt: 'Jesse is lining up your first chapter.', story: '' }
  const paragraphs = entry.story.split('\n').filter(Boolean)
  return {
    title: entry.conceptName,
    excerpt: paragraphs.slice(0, 2).join('\n'),
    story: entry.story,
  }
}

export default function GradeOnboard() {
  const user = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState<Step>(() => (
    searchParams.get('entry') === '1' ? 'grade' : 'welcome'
  ))
  const [grade, setGrade] = useState<number | null>(null)
  const [goalTags, setGoalTags] = useState<string[]>([])
  const [goalText, setGoalText] = useState('')
  const [probeQs, setProbeQs] = useState<Question[]>([])
  const [probeIdx, setProbeIdx] = useState(0)
  const [probeResults, setProbeResults] = useState<ProbeResult[]>([])
  const [qSelected, setQSelected] = useState<number | null>(null)
  const [qStartTime, setQStartTime] = useState(0)
  const [qSubmitted, setQSubmitted] = useState(false)
  const [storyMod, setStoryMod] = useState<StoryModule | null>(null)
  const [seedingMsg, setSeedingMsg] = useState('Reading your map…')
  const [finishing, setFinishing] = useState(false)

  const storyData = grade ? storyExcerpt(GRADE_STORY[grade]) : null
  const progressSteps: Step[] = ['welcome', 'grade', 'goals', 'story', 'probe', 'seeding']
  const progressPct = Math.round((progressSteps.indexOf(step) / (progressSteps.length - 1)) * 100)

  const currentQ = probeQs[probeIdx]
  const storyItem = currentQ ? storyMod?.[currentQ.id] : undefined
  const stemText = storyItem?.storyStem ?? currentQ?.question ?? ''

  const probeTheme = useMemo(() => ({
    accent: '#1d3a8a',
    ink: '#1c1a17',
    bg: '#f7f3ee',
    dim: '#6f6a61',
  }), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const done = await isDiagnosticComplete(user.uid)
      if (!cancelled && done) navigate('/dashboard', { replace: true })
    })()
    return () => { cancelled = true }
  }, [user.uid, navigate])

  useEffect(() => {
    if (step !== 'probe') return
    setQSelected(null)
    setQSubmitted(false)
    setQStartTime(Date.now())
  }, [step, probeIdx])

  useEffect(() => {
    if (step !== 'seeding') return
    const msgs = ['Reading your map…', 'Tracing the gaps…', 'Plotting your route…', 'Opening your journal…']
    let i = 0
    const id = setInterval(() => {
      i++
      if (i < msgs.length) setSeedingMsg(msgs[i])
    }, 900)
    return () => clearInterval(id)
  }, [step])

  function toggleGoal(tag: string) {
    setGoalTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  function beginProbes() {
    if (!grade) return
    const qs = pickDiagnosticQuestions(grade, goalTags, 10)
    setProbeQs(qs)
    setProbeIdx(0)
    setProbeResults([])
    setStep('probe')

    if (qs.length === 0 || !storyData?.story) return
    void fetchStoryModule(
      GRADE_STORY[grade],
      storyData.title,
      storyData.story,
      qs,
    ).then(mod => { if (mod) setStoryMod(mod) })
  }

  async function finishDiagnostic(results: ProbeResult[]) {
    if (finishing) return
    setFinishing(true)
    sessionStorage.setItem('mc-diag-just-completed', '1')
    setStep('seeding')

    const g = grade ?? 9
    const baseConf = gradeConfidence(g, goalTags)
    for (const r of results) {
      baseConf[r.conceptId] = r.correct
        ? (baseConf[r.conceptId] === 'hard' ? 'kinda' : 'easy')
        : 'hard'
    }

    const track = curriculumTrackFor(g, goalTags)
    const exam = examForGoals(goalTags)
    const goalsPayload = { tags: goalTags, text: goalText.trim() }

    try {
      await applyDiagnosticConfidence(user.uid, exam, baseConf, goalsPayload, {
        diagnosticVersion: `jesse-grade${g}-v2`,
      })

      if (results.length > 0) {
        const probes: OutcomeInput[] = results.map(r => ({
          conceptId: r.conceptId,
          score: r.correct ? 1 : 0,
          succeeded: r.correct,
        }))
        await recordOutcomes(user.uid, probes)
      }

      await setDoc(doc(db, 'users', user.uid), {
        grade: g,
        curriculumTrack: track,
        goals: goalsPayload,
      }, { merge: true })
    } catch { /* best-effort */ }

    persistDiagnosticDoneLocal()
    window.setTimeout(() => {
      navigate('/dashboard', { replace: true })
    }, 2200)
  }

  function submitProbeAnswer() {
    if (qSelected === null || !currentQ) return
    const correct = qSelected === currentQ.correctIndex
    const time = Math.round((Date.now() - qStartTime) / 1000)
    setQSubmitted(true)

    const result: ProbeResult = { conceptId: currentQ.conceptId, correct, time }
    const nextResults = [...probeResults, result]

    if (probeIdx + 1 < probeQs.length) {
      window.setTimeout(() => {
        setProbeResults(nextResults)
        setProbeIdx(i => i + 1)
      }, 450)
    } else {
      window.setTimeout(() => void finishDiagnostic(nextResults), 450)
    }
  }

  return (
    <div className={s.desk}>
      {step !== 'seeding' && (
        <div className={s.progressBar}>
          <div className={s.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {step === 'probe' && currentQ ? (
        <div className={s.probeBook}>
          <BookShell
            wordmark="Jesse's kitchen"
            left={(
              <BookPage
                side="left"
                runningHead={`question ${probeIdx + 1} of ${probeQs.length}`}
                folio={<span>page {probeIdx + 1}</span>}
              >
                <PageFlipTransition viewKey={`probe-${probeIdx}-L`}>
                  <div className={s.probePanel}>
                    {storyItem?.storyStem && (
                      <p className={s.probeStoryLine}><MathText text={storyItem.storyStem.split(/[.!?]/)[0] + '.'} /></p>
                    )}
                    <p className={s.questionText}><MathText text={stemText} /></p>
                    <InteractiveWidget
                      conceptId={currentQ.conceptId}
                      questionText={currentQ.question}
                      theme={probeTheme}
                    />
                    <div className={s.choices}>
                      {currentQ.choices.slice(0, 4).map((choice, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`${s.choice} ${qSelected === i ? s.choiceSelected : ''} ${qSubmitted ? s.choiceSubmitted : ''}`}
                          onClick={() => !qSubmitted && setQSelected(i)}
                          disabled={qSubmitted}
                        >
                          <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
                          <span><MathText text={choice} /></span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={s.primary}
                      disabled={qSelected === null || qSubmitted}
                      onClick={submitProbeAnswer}
                    >
                      {qSubmitted ? '…' : 'submit'}
                    </button>
                  </div>
                </PageFlipTransition>
              </BookPage>
            )}
            right={(
              <BookPage
                side="right"
                ribbon={probeIdx === 0}
                runningHead="your work"
                folio={<span>page {probeIdx + 2}</span>}
              >
                <PageFlipTransition viewKey={`probe-${probeIdx}-R`}>
                  <div className={s.probeScratch}>
                    <ScratchPad paperMode height={420} />
                  </div>
                </PageFlipTransition>
              </BookPage>
            )}
          />
        </div>
      ) : step === 'probe' && probeQs.length === 0 ? (
        <div className={`${s.page} ${s.seedingPage}`}>
          <div className={s.card}>
            <p className={s.kicker}>Almost done</p>
            <h2 className={s.title}>Building your map…</h2>
            <button type="button" className={s.primary} onClick={() => void finishDiagnostic([])}>
              Open my journal →
            </button>
          </div>
        </div>
      ) : step === 'seeding' ? (
        <div className={`${s.page} ${s.seedingPage}`}>
          <div className={s.seedingWrap}>
            <div className={s.seedingMap} aria-hidden>
              <svg viewBox="0 0 200 200" fill="none">
                {[
                  { cx: 100, cy: 60, r: 8, lit: true },
                  { cx: 60, cy: 100, r: 6, lit: false },
                  { cx: 140, cy: 100, r: 6, lit: true },
                  { cx: 80, cy: 148, r: 5, lit: false },
                  { cx: 120, cy: 148, r: 5, lit: false },
                ].map((n, i) => (
                  <g key={i}>
                    <line x1={100} y1={60} x2={n.cx} y2={n.cy} stroke="rgba(196,245,71,0.2)" strokeWidth="1" strokeDasharray="3 4" />
                    <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.lit ? '#c4f547' : 'none'} stroke={n.lit ? '#c4f547' : 'rgba(196,245,71,0.4)'} strokeWidth="1.5" />
                  </g>
                ))}
              </svg>
            </div>
            <p className={s.seedingText}>{seedingMsg}</p>
          </div>
        </div>
      ) : (
      <div className={s.page}>
        <div className={s.journalPage}>

          {step === 'welcome' && (
            <div className={s.card}>
              <p className={s.kicker}>Jesse&apos;s kitchen</p>
              <h1 className={s.title}>Before the map opens</h1>
              <p className={s.body}>
                Jesse needs a few honest answers: your grade, what you want to feel better at,
                and a short set of story questions on paper. No grades shown. Just your route.
              </p>
              <button className={s.primary} onClick={() => setStep('grade')}>Start →</button>
            </div>
          )}

          {step === 'grade' && (
            <div className={s.card}>
              <p className={s.kicker}>Step 1</p>
              <h1 className={s.title}>What grade are you in?</h1>
              <p className={s.body}>We tune the story and question level to where you actually are.</p>
              <div className={s.gradeRow}>
                {[7, 8, 9, 10, 11].map(g => (
                  <button
                    key={g}
                    type="button"
                    className={`${s.gradeBtn} ${grade === g ? s.gradeBtnActive : ''}`}
                    onClick={() => setGrade(g)}
                  >
                    <span className={s.gradeNum}>{g}</span>
                    <span className={s.gradeLabel}>th</span>
                  </button>
                ))}
              </div>
              <button className={s.primary} disabled={grade === null} onClick={() => setStep('goals')}>
                Continue →
              </button>
            </div>
          )}

          {step === 'goals' && (
            <div className={s.card}>
              <p className={s.kicker}>Step 2 · grade {grade}</p>
              <h1 className={s.title}>What do you want to feel better at?</h1>
              <p className={s.body}>Pick what fits, then tell Jesse in your own words. He reads this when writing your story.</p>
              <div className={s.goalGrid}>
                {GOALS.map(g => (
                  <button
                    key={g.tag}
                    type="button"
                    className={`${s.goalCard} ${goalTags.includes(g.tag) ? s.goalCardActive : ''}`}
                    onClick={() => toggleGoal(g.tag)}
                  >
                    <span className={s.goalLabel}>{g.label}</span>
                    <span className={s.goalDetail}>{g.detail}</span>
                  </button>
                ))}
              </div>
              <textarea
                className={s.goalTextarea}
                placeholder="e.g. fractions on tests, word problems, confidence before exams…"
                value={goalText}
                onChange={e => setGoalText(e.target.value)}
                rows={4}
              />
              <button
                className={s.primary}
                disabled={goalTags.length === 0 && !goalText.trim()}
                onClick={() => setStep('story')}
              >
                Continue →
              </button>
              <button type="button" className={s.back} onClick={() => setStep('grade')}>← back</button>
            </div>
          )}

          {step === 'story' && storyData && (
            <div className={`${s.card} ${s.storyCard}`}>
              <p className={s.kicker}>Step 3 · your world</p>
              <h2 className={s.storyTitle}>{storyData.title}</h2>
              <div className={s.storyBody}>
                {storyData.excerpt.split('\n').map((p, i) => (
                  <p key={i} className={`${s.storyPara} ${i === 0 ? s.storyParaFirst : ''}`}>{p}</p>
                ))}
              </div>
              <p className={s.storyNote}>
                Next: about {Math.min(10, conceptsForGradeAndGoals(grade ?? 9, goalTags).length)} short questions,
                woven into this world. Write on the paper. No right or wrong shown yet.
              </p>
              <button className={s.primary} onClick={beginProbes}>Begin story questions →</button>
            </div>
          )}

        </div>
      </div>
      )}
    </div>
  )
}
