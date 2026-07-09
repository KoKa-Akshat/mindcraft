/**
 * GradeOnboard — Jesse's Kitchen diagnostic (paper journal format).
 *
 * Flow: welcome → grade → goals (writable) → story → ~10 probe questions → dashboard
 * World "Projects" and Dashboard gate both land here until complete.
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { useUser } from '../App'
import { db } from '../firebase'
import { isDiagnosticComplete, persistDiagnosticDoneLocal } from '../lib/practiceState'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import { recordOutcomes, type OutcomeInput } from '../lib/mlApi'
import {
  curriculumTrackFor,
  examForGoals,
  gradeConfidence,
  GRADE_STORY,
  pickDiagnosticQuestions,
} from '../lib/diagnosticQuestions'
import { questionFormat, resolveChoiceEvidence } from '../lib/questionBank'
import { toOntologyId } from '../lib/conceptMap'
import { fetchStoryModuleForQuestions, ensureStorySkins, storyBridgeLine, type StoryModule } from '../lib/storyModule'
import MathText from '../components/MathText'
import InteractiveWidget from '../components/InteractiveWidget'
import ScratchPad, { exportScratchImage } from '../components/ScratchPad'
import type { ScratchStrokeData } from '../types'
import ScratchTranscriptionPane, { type ScratchInkState } from '../components/ScratchTranscriptionPane'
import HighlightedStem from '../components/HighlightedStem'
import JarvisGuide from '../components/JarvisGuide'
import { useJournalGuide } from '../hooks/useJournalGuide'
import { insightsForSide } from '../lib/journalGuide'
import { useStoryQuestion } from '../hooks/useStoryQuestion'
import { resolveStoryScene } from '../lib/storyDisplay'
import { resolveStudyPathConfig, DEFAULT_STUDY_PATH, type StudyPathConfig } from '../lib/studyPathConfig'
import {
  initBelief, applyProbeOutcome, type BeliefState,
} from '../lib/adaptiveDiagnostic'
import { GOAL_EXTRAS } from '../lib/diagnosticQuestions'
import BookShell from '../components/book/BookShell'
import BookPage from '../components/book/BookPage'
import PageFlipTransition from '../components/book/PageFlipTransition'
import conceptStoriesRaw from '../data/conceptStories.json'
import s from './GradeOnboard.module.css'
import type { Question } from '../lib/questionBank'
import { isTestProfileEmail } from '../lib/testProfile'

type Step = 'welcome' | 'grade' | 'goals' | 'probe' | 'seeding'

// GOALS chips removed — users now type/record their goals freely

type ConceptStory = { conceptId: string; conceptName: string; story: string }
const stories = conceptStoriesRaw as Record<string, ConceptStory>

interface ProbeResult {
  conceptId: string
  questionId: string
  selectedIndex: number
  correct: boolean
  time: number
}

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
  const [goalTags] = useState<string[]>([])    // kept for API compatibility but no longer shown
  const [goalText, setGoalText] = useState('')
  const [voiceRecording, setVoiceRecording] = useState(false)
  const [voiceRecorded, setVoiceRecorded] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [probeQs, setProbeQs] = useState<Question[]>([])
  const [probeIdx, setProbeIdx] = useState(0)
  const [probeResults, setProbeResults] = useState<ProbeResult[]>([])
  const [qSelected, setQSelected] = useState<number | null>(null)
  const [qStartTime, setQStartTime] = useState(0)
  const [qSubmitted, setQSubmitted] = useState(false)
  const [storyMod, setStoryMod] = useState<StoryModule | null>(null)
  const [seedingMsg, setSeedingMsg] = useState('Reading your map…')
  const [finishing, setFinishing] = useState(false)
  const [probeScratchImage, setProbeScratchImage] = useState('')
  const [probeStrokes, setProbeStrokes] = useState<ScratchStrokeData | null>(null)
  const [probeInk, setProbeInk] = useState<ScratchInkState | null>(null)
  const [probeScratchRev, setProbeScratchRev] = useState(0)
  const [belief, setBelief] = useState<BeliefState>({})
  const [usedProbeIds, setUsedProbeIds] = useState<Set<string>>(() => new Set())
  const [bridgeLine, setBridgeLine] = useState<string | null>(null)
  const [pathConfig, setPathConfig] = useState<StudyPathConfig>(DEFAULT_STUDY_PATH)
  const [tutorFocus, setTutorFocus] = useState<string[]>([])

  const storyData = grade ? storyExcerpt(GRADE_STORY[grade]) : null
  const progressSteps: Step[] = ['welcome', 'grade', 'goals', 'probe', 'seeding']
  const progressPct = Math.round((progressSteps.indexOf(step) / (progressSteps.length - 1)) * 100)

  const currentQ = probeQs[probeIdx]
  const storyItem = currentQ ? storyMod?.[currentQ.id] : undefined
  const { display: storyDisplay, stemText } = useStoryQuestion(currentQ, storyItem?.storyStem)
  const sceneLine = currentQ && storyDisplay ? resolveStoryScene(currentQ, storyDisplay) : currentQ?.storyContext

  const probeTheme = useMemo(() => ({
    accent: '#1d3a8a',
    ink: '#1c1a17',
    bg: '#f7f3ee',
    dim: '#6f6a61',
  }), [])

  useEffect(() => {
    void getDoc(doc(db, 'users', user.uid)).then(snap => {
      const data = snap.data()
      setPathConfig(resolveStudyPathConfig(data?.studyPathConfig))
      setTutorFocus(Array.isArray(data?.tutorFocusConcepts) ? data.tutorFocusConcepts : [])
    })
  }, [user.uid])

  useEffect(() => {
    if (isTestProfileEmail(user.email)) return
    let cancelled = false
    void (async () => {
      const done = await isDiagnosticComplete(user.uid)
      if (!cancelled && done) navigate('/dashboard', { replace: true })
    })()
    return () => { cancelled = true }
  }, [user.uid, user.email, navigate])

  useEffect(() => {
    if (step !== 'probe') return
    setBridgeLine(null)
    setQSelected(null)
    setQSubmitted(false)
    setQStartTime(Date.now())
    setProbeScratchImage('')
    setProbeStrokes(null)
    setProbeInk(null)
  }, [step, probeIdx])

  const probeTranscribing = Boolean(
    (probeStrokes?.strokes?.length ?? 0) > 0
    && !(probeInk?.workLines?.some(l => l.text.trim() || l.latex.trim())),
  )

  const journalGuide = useJournalGuide({
    conceptId: currentQ?.conceptId ?? '',
    questionText: stemText,
    strokeData: probeStrokes,
    inkState: probeInk,
    transcribing: probeTranscribing,
    answerSelected: qSelected != null,
    questionStartedAt: qStartTime || Date.now(),
    enableCoach: false,
  })

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

  async function startVoiceRecording() {
    if (voiceRecording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        setVoiceRecording(false)

        // Try SpeechRecognition transcription first
        type SRCtor = new () => { start(): void; stop(): void }
        const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
        const SR = w.SpeechRecognition || w.webkitSpeechRecognition
        if (SR && chunks.length > 0) {
          // SpeechRecognition works on live audio, so we note voice was captured
          setVoiceRecorded(true)
          if (!goalText.trim()) setGoalText('[voice recorded]')
        } else {
          setVoiceRecorded(true)
          if (!goalText.trim()) setGoalText('[voice recorded]')
        }
      }

      mr.start()
      setVoiceRecording(true)
      setVoiceRecorded(false)

      // Auto-stop after 60 seconds
      voiceTimerRef.current = setTimeout(() => {
        if (mr.state === 'recording') mr.stop()
      }, 60_000)
    } catch { /* mic denied or unavailable */ }
  }

  function stopVoiceRecording() {
    if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  function beginProbes() {
    if (!grade) return
    const goalBoost = goalTags.flatMap(t => GOAL_EXTRAS[t] ?? [])
    const qs = pickDiagnosticQuestions(
      grade,
      goalTags,
      pathConfig.diagnosticProbeCount,
      2,
    )
    setProbeQs(qs)
    setProbeIdx(0)
    setProbeResults([])
    setBelief(initBelief(qs.map(q => q.conceptId)))
    setUsedProbeIds(new Set(qs.map(q => q.id)))
    setStep('probe')

    if (qs.length === 0) return
    const skinCtx = {
      goals: { tags: goalTags, text: goalText.trim() },
      tutorFocusConcepts: tutorFocus,
      sessionKind: 'diagnostic' as const,
    }
    void fetchStoryModuleForQuestions(qs, skinCtx).then(mod => { if (mod) setStoryMod(mod) })
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
        const probes: OutcomeInput[] = results.map((r, i) => {
          const q = probeQs[i]
          const base: OutcomeInput = {
            conceptId: toOntologyId(r.conceptId),
            score: r.correct ? 1 : 0,
            succeeded: r.correct,
            level: q?.level ?? 2,
            questionId: r.questionId,
            formatId: q ? questionFormat(q) : undefined,
          }
          if (!q) return base
          const evidence = resolveChoiceEvidence(q, r.selectedIndex)
          return {
            ...base,
            selectedChoiceIndex: evidence.selectedChoiceIndex,
            misconceptionId: evidence.misconceptionId,
            errorType: evidence.errorType,
          }
        })
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

    const prevItem = storyMod?.[currentQ.id]
    setBridgeLine(storyBridgeLine(prevItem, correct))

    const result: ProbeResult = {
      conceptId: currentQ.conceptId,
      questionId: currentQ.id,
      selectedIndex: qSelected,
      correct,
      time,
    }
    const nextResults = [...probeResults, result]

    const goalBoost = goalTags.flatMap(t => GOAL_EXTRAS[t] ?? [])
    const adapted = applyProbeOutcome(
      probeQs,
      probeIdx,
      { conceptId: currentQ.conceptId, questionId: currentQ.id, correct },
      belief,
      {
        followUps: pathConfig.diagnosticFollowUps,
        tutorFocus,
        goalBoost,
        usedIds: usedProbeIds,
      },
    )
    setProbeQs(adapted.queue)
    setBelief(adapted.belief)

    const skinCtx = {
      goals: { tags: goalTags, text: goalText.trim() },
      tutorFocusConcepts: tutorFocus,
      priorOutcomes: nextResults.map(r => ({
        conceptId: r.conceptId,
        questionId: r.questionId,
        correct: r.correct,
      })),
      sessionKind: 'diagnostic' as const,
    }
    void ensureStorySkins(storyMod, adapted.queue, skinCtx).then(merged => {
      setStoryMod(prev => ({ ...(prev ?? {}), ...merged }))
    })

    if (probeIdx + 1 < adapted.queue.length) {
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
            wordmark="MindCraft"
            left={(
              <BookPage
                side="left"
                runningHead={`question ${probeIdx + 1} of ${probeQs.length}`}
                folio={<span>page {probeIdx + 1}</span>}
              >
                <PageFlipTransition viewKey={`probe-${probeIdx}-L`}>
                  <div className={s.guideRow}>
                    <div className={s.guideBody}>
                      <div className={s.probePanel}>
                        {bridgeLine && probeIdx > 0 && (
                          <p className={s.probeBridgeLine} style={{ color: probeTheme.accent, opacity: 0.85, fontSize: 13 }}>
                            <MathText text={bridgeLine} />
                          </p>
                        )}
                        {currentQ?.storyIntro && (
                          <p className={s.storyIntroBlock}>{currentQ.storyIntro}</p>
                        )}
                        {storyItem?.socratic?.[0] && (
                          <p className={s.probeStoryLine} style={{ opacity: 0.72, fontSize: 13 }}>
                            <MathText text={storyItem.socratic[0]} />
                          </p>
                        )}
                        {sceneLine && (
                          <p className={s.probeStoryLine}><MathText text={sceneLine} /></p>
                        )}
                        <HighlightedStem
                          text={stemText}
                          ink={probeTheme.ink}
                          accent={probeTheme.accent}
                          highlights={journalGuide.highlights}
                          className={s.questionText}
                        />
                        <InteractiveWidget
                          conceptId={currentQ.conceptId}
                          questionText={storyDisplay?.stem ?? currentQ.question}
                          format={questionFormat(currentQ)}
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
                    </div>
                    {/* JarvisGuide intentionally omitted from the question (left) page — right side only */}
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
                  <div className={s.guideRow}>
                    <div className={s.guideBody}>
                      <div className={s.probeScratch}>
                        <ScratchPad
                          key={`probe-${probeIdx}-${probeScratchRev}`}
                          paperMode
                          questionId={`diagnostic-${probeIdx}`}
                          evalLines={probeInk?.workLines?.map(l => ({ bbox: l.bbox, text: l.text, latex: l.latex }))}
                          onChange={(_canvas, strokeData) => {
                            setProbeStrokes(strokeData)
                            setProbeScratchImage(
                              strokeData.strokes.length
                                ? exportScratchImage(strokeData.strokes, strokeData.width, strokeData.height, 1)
                                : '',
                            )
                          }}
                        />
                        <ScratchTranscriptionPane
                          imageDataUrl={probeScratchImage}
                          strokeData={probeStrokes}
                          resetKey={`probe-${probeIdx}-${probeScratchRev}`}
                          onChange={state => setProbeInk(state)}
                        />
                      </div>
                    </div>
                    <JarvisGuide
                      insights={insightsForSide(journalGuide.insights, 'work')}
                      thinking={journalGuide.thinking}
                      side="work"
                    />
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
              <p className={s.kicker}>MindCraft</p>
              <h1 className={s.title}>Let&apos;s map your skills</h1>
              <p className={s.body}>
                Two quick questions — grade and goals — then a short set of math problems.
                No scores shown. Just your personal map.
              </p>
              <button className={s.primary} onClick={() => setStep('grade')}>Start →</button>
            </div>
          )}

          {step === 'grade' && (
            <div className={s.card}>
              <p className={s.kicker}>Step 1</p>
              <h1 className={s.title}>What grade are you in?</h1>
              <div className={s.gradeRow}>
                {[7, 8, 9, 10, 11].map(g => (
                  <button
                    key={g}
                    type="button"
                    className={`${s.gradeBtn} ${grade === g ? s.gradeBtnActive : ''}`}
                    onClick={() => { setGrade(g); setStep('goals') }}
                  >
                    <span className={s.gradeNum}>{g}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'goals' && (
            <div className={s.card}>
              <p className={s.kicker}>Step 2 · grade {grade}</p>
              <h1 className={s.title}>What do you want out of this?</h1>
              <div className={s.goalInputRow}>
                <input
                  type="text"
                  className={s.goalInput}
                  placeholder="Type what you want..."
                  value={voiceRecording || goalText === '[voice recorded]' ? goalText : goalText}
                  onChange={e => setGoalText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && goalText.trim()) beginProbes()
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className={`${s.voiceBtn} ${voiceRecording ? s.voiceBtnActive : ''} ${voiceRecorded ? s.voiceBtnDone : ''}`}
                  onClick={voiceRecording ? stopVoiceRecording : startVoiceRecording}
                  title={voiceRecording ? 'Stop recording' : 'Record your answer'}
                  aria-label={voiceRecording ? 'Stop recording' : 'Record voice'}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <rect x="5" y="1" width="6" height="9" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M2.5 8C2.5 11.038 5.686 13.5 8 13.5C10.314 13.5 13.5 11.038 13.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="8" y1="13.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              {voiceRecording && <p className={s.voiceHint}>Recording — speak now (max 60s)</p>}
              {voiceRecorded && !voiceRecording && <p className={s.voiceHint}>Voice captured</p>}
              <div className={s.goalActions}>
                <button
                  className={s.primary}
                  disabled={!goalText.trim() && !voiceRecorded}
                  onClick={() => beginProbes()}
                >
                  Continue →
                </button>
                <button type="button" className={s.back} onClick={() => setStep('grade')}>← back</button>
              </div>
            </div>
          )}


        </div>
      </div>
      )}
    </div>
  )
}
