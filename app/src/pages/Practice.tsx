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
import { getConceptContent } from '../lib/conceptContent'
import { getConceptRecommendations } from '../lib/geminiIntake'
import s from './Practice.module.css'

const HOMEWORK_API = import.meta.env.VITE_HOMEWORK_API_URL ?? 'http://localhost:8001'
const SESSION_LENGTH = 5

type PracticePhase = 'intake' | 'mission' | 'explore' | 'level' | 'session' | 'complete'
type SolverPhase   = 'input'  | 'loading' | 'cards'   | 'done'
type Mode          = 'practice' | 'solver'

const EXAMS = ['ACT', 'SAT', 'IB', 'AP', 'General'] as const

export default function Practice() {
  const user     = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const fileRef  = useRef<HTMLInputElement>(null)

  // ── Mode ───────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('practice')

  // ── Intake state ───────────────────────────────────────────────────────────
  const [exam,          setExam]          = useState<string>('')
  const [intakeTopic,   setIntakeTopic]   = useState<string>('')
  const [intakeLoading, setIntakeLoading] = useState(false)
  const [recommended,   setRecommended]   = useState<string[]>([])
  const [intakeMessage, setIntakeMessage] = useState<string>('')

  // ── Practice state ─────────────────────────────────────────────────────────
  const [pPhase,    setPPhase]    = useState<PracticePhase>('intake')
  const [catFilter, setCatFilter] = useState<string>('All')
  const [concept,   setConcept]   = useState<string | null>(null)
  const [level,     setLevel]     = useState<1|2|3>(1)
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex,    setQIndex]    = useState(0)
  const [selected,  setSelected]  = useState<number | null>(null)
  const [checked,   setChecked]   = useState(false)
  const [hintsShown,setHintsShown]= useState(0)
  const [results,   setResults]   = useState<boolean[]>([])
  const [xp,        setXp]        = useState(0)

  // ── Solver state ───────────────────────────────────────────────────────────
  const [sPhase,     setSPhase]     = useState<SolverPhase>('input')
  const [problem,    setProblem]    = useState('')
  const [solverFile, setSolverFile] = useState<File | null>(null)
  const [session,    setSession]    = useState<HomeworkSession | null>(null)
  const [sResults,   setSResults]   = useState<OutcomeRecord[]>([])
  const [error,      setError]      = useState('')
  const [slowLoad,   setSlowLoad]   = useState(false)

  // ── Auto-submit if navigated from dashboard with problemText ──────────────
  useEffect(() => {
    const state = location.state as { problemText?: string } | null
    if (state?.problemText) {
      setMode('solver')
      setProblem(state.problemText)
      submitProblem(state.problemText)
      window.history.replaceState({}, '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Intake handler ──────────────────────────────────────────────────────────
  async function handleIntake() {
    if (!exam && !intakeTopic.trim()) {
      setPPhase('mission')
      return
    }
    setIntakeLoading(true)
    const result = await getConceptRecommendations(
      exam || 'General',
      intakeTopic,
      PRACTICE_CONCEPTS.map(c => c.id),
    )
    setRecommended(result.recommendedConceptIds)
    setIntakeMessage(result.message)
    setIntakeLoading(false)
    setPPhase('mission')
  }

  // ── Practice helpers ────────────────────────────────────────────────────────
  function pickConcept(conceptId: string) {
    setConcept(conceptId)
    setPPhase('explore')
  }

  function startSession(conceptId: string, lv: 1|2|3) {
    const qs = getQuestions(conceptId, lv, SESSION_LENGTH)
    if (qs.length === 0) return
    setConcept(conceptId)
    setLevel(lv)
    setQuestions(qs)
    setQIndex(0)
    setSelected(null)
    setChecked(false)
    setHintsShown(0)
    setResults([])
    setXp(0)
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
    if (qIndex + 1 >= questions.length) {
      setPPhase('complete')
    } else {
      setQIndex(i => i + 1)
      setSelected(null)
      setChecked(false)
      setHintsShown(0)
    }
  }

  function resetPractice() {
    setPPhase('intake')
    setConcept(null)
    setSelected(null)
    setChecked(false)
    setHintsShown(0)
    setResults([])
    setXp(0)
    setRecommended([])
    setIntakeMessage('')
  }

  // ── Solver helpers ──────────────────────────────────────────────────────────
  async function submitProblem(problemText: string, file?: File | null) {
    if (!problemText.trim() && !file) return
    setSPhase('loading')
    setError('')
    setSession(null)
    setSlowLoad(false)

    const slowTimer = setTimeout(() => setSlowLoad(true), 7000)
    try {
      let res: Response
      if (file) {
        const form = new FormData()
        form.append('student_id', user.uid)
        form.append('problem_text', problemText)
        form.append('subject', 'algebra')
        form.append('file', file)
        res = await fetch(`${HOMEWORK_API}/submit-with-file`, { method:'POST', body:form })
      } else {
        res = await fetch(`${HOMEWORK_API}/submit`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ student_id:user.uid, problem_text:problemText, subject:'algebra' }),
        })
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { detail?: string }).detail ?? `Server error ${res.status}`)
      }
      const data: HomeworkSession = await res.json()
      clearTimeout(slowTimer)
      setSlowLoad(false)
      setSession(data)
      setSPhase('cards')
    } catch (err: unknown) {
      clearTimeout(slowTimer)
      setSlowLoad(false)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSPhase('input')
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const currentQ    = questions[qIndex]
  const conceptMeta = PRACTICE_CONCEPTS.find(c => c.id === concept)
  const lvMeta      = LEVEL_META[level]
  const categories  = ['All', ...Array.from(new Set(PRACTICE_CONCEPTS.map(c => c.category)))]
  const filtered    = catFilter === 'All' ? PRACTICE_CONCEPTS : PRACTICE_CONCEPTS.filter(c => c.category === catFilter)
  const correctCount = results.filter(Boolean).length
  const pct          = questions.length ? Math.round((qIndex / questions.length) * 100) : 0

  const recommendedConcepts = recommended.length
    ? PRACTICE_CONCEPTS.filter(c => recommended.includes(c.id))
    : []
  const otherConcepts = filtered.filter(c => !recommended.includes(c.id))

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={s.shell}>
      <Sidebar />

      <main className={s.page}>

        {/* ── Top nav bar ── */}
        <div className={s.topBar}>
          <button className={s.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <div className={s.modeToggle}>
            <button
              className={mode === 'practice' ? s.modeActive : s.modeInactive}
              onClick={() => setMode('practice')}
            >Practice</button>
            <button
              className={mode === 'solver' ? s.modeActive : s.modeInactive}
              onClick={() => setMode('solver')}
            >Problem Solver</button>
          </div>
        </div>

        {/* ════════════════ PRACTICE MODE ════════════════ */}
        {mode === 'practice' && (

          <>
            {/* ── Intake: exam selector + topic ── */}
            {pPhase === 'intake' && (
              <div className={s.intake}>
                <div className={s.intakeHeader}>
                  <h1 className={s.intakeTitle}>Math exam coming up?</h1>
                  <p className={s.intakeSub}>Tell us what you're working towards and we'll build a personalized practice path.</p>
                </div>

                <div className={s.intakeSection}>
                  <div className={s.intakeSectionLabel}>Which exam are you prepping for?</div>
                  <div className={s.examGrid}>
                    {EXAMS.map(e => (
                      <button
                        key={e}
                        className={exam === e ? s.examBtnActive : s.examBtn}
                        onClick={() => setExam(e)}
                      >{e}</button>
                    ))}
                  </div>
                </div>

                <div className={s.intakeSection}>
                  <div className={s.intakeSectionLabel}>What topic or problem do you need help with? <span className={s.intakeOptional}>(optional)</span></div>
                  <textarea
                    className={s.intakeTextarea}
                    placeholder="e.g. I always mess up quadratics, or I have a test on functions next week…"
                    value={intakeTopic}
                    onChange={e => setIntakeTopic(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className={s.intakeActions}>
                  <button
                    className={s.findPathBtn}
                    onClick={handleIntake}
                    disabled={intakeLoading}
                  >
                    {intakeLoading
                      ? <><span className={s.intakeSpinner} /> Building your path…</>
                      : 'Find My Path →'}
                  </button>
                  <button className={s.intakeSkip} onClick={() => setPPhase('mission')}>
                    Browse all concepts
                  </button>
                </div>
              </div>
            )}

            {/* ── Mission: concept selector ── */}
            {pPhase === 'mission' && (
              <div className={s.mission}>

                {/* AI recommendation strip */}
                {intakeMessage && (
                  <div className={s.aiStrip}>
                    <span className={s.aiStripIcon}>✨</span>
                    <span className={s.aiStripText}>{intakeMessage}</span>
                  </div>
                )}

                <div className={s.missionHeader}>
                  <h1 className={s.missionTitle}>
                    {recommended.length > 0 ? 'Your Study Plan' : 'Choose Your Mission'}
                  </h1>
                  <p className={s.missionSub}>Pick a concept to study. Earn XP with each question. Watch your constellation grow.</p>
                </div>

                {/* Recommended concepts at top */}
                {recommendedConcepts.length > 0 && (
                  <div className={s.recommendedSection}>
                    <div className={s.recommendedLabel}>
                      <span className={s.recBadge}>{exam || 'AI'} Picks</span>
                      Start here
                    </div>
                    <div className={s.conceptGrid}>
                      {recommendedConcepts.map(c => (
                        <button key={c.id} className={`${s.conceptCard} ${s.conceptCardRec}`} onClick={() => pickConcept(c.id)}>
                          <span className={s.conceptEmoji}>{c.emoji}</span>
                          <span className={s.conceptLabel}>{c.label}</span>
                          <span className={s.conceptCategory}>{c.category}</span>
                          <div className={s.conceptLevels}>
                            {([1,2,3] as const).map(lv => (
                              <span key={lv} className={questionCount(c.id, lv) > 0 ? s.levelDot : s.levelDotEmpty}
                                style={{ background: questionCount(c.id, lv) > 0 ? LEVEL_META[lv].color : undefined }} />
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category filter + rest of concepts */}
                <div className={s.catTabs}>
                  {categories.map(cat => (
                    <button key={cat} className={catFilter === cat ? s.catActive : s.catTab}
                      onClick={() => setCatFilter(cat)}>{cat}</button>
                  ))}
                </div>

                {recommendedConcepts.length > 0 && otherConcepts.length > 0 && (
                  <div className={s.allConceptsLabel}>All Concepts</div>
                )}

                <div className={s.conceptGrid}>
                  {(recommended.length > 0 ? otherConcepts : filtered).map(c => (
                    <button key={c.id} className={s.conceptCard} onClick={() => pickConcept(c.id)}>
                      <span className={s.conceptEmoji}>{c.emoji}</span>
                      <span className={s.conceptLabel}>{c.label}</span>
                      <span className={s.conceptCategory}>{c.category}</span>
                      <div className={s.conceptLevels}>
                        {([1,2,3] as const).map(lv => (
                          <span key={lv} className={questionCount(c.id, lv) > 0 ? s.levelDot : s.levelDotEmpty}
                            style={{ background: questionCount(c.id, lv) > 0 ? LEVEL_META[lv].color : undefined }} />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Explore: concept content card ── */}
            {pPhase === 'explore' && conceptMeta && (() => {
              const content = getConceptContent(conceptMeta.id)
              return (
                <div className={s.exploreScreen}>
                  <button className={s.backLink} onClick={() => setPPhase('mission')}>
                    ← All Concepts
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
                    <p className={s.levelConceptSub}>Select your difficulty level</p>
                  </div>
                </div>

                <div className={s.levelCards}>
                  {([1,2,3] as const).map(lv => {
                    const m   = LEVEL_META[lv]
                    const cnt = questionCount(conceptMeta.id, lv)
                    return (
                      <button
                        key={lv}
                        className={s.levelCard}
                        style={{ '--lv-color': m.color, '--lv-soft': m.colorSoft } as React.CSSProperties}
                        onClick={() => startSession(conceptMeta.id, lv)}
                        disabled={cnt === 0}
                      >
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
                      <div className={s.progressFill} style={{ width:`${pct}%`, background: lvMeta.color }} />
                    </div>
                    <span className={s.progressLabel}>{qIndex + 1} / {questions.length}</span>
                  </div>
                  <div className={s.stripRight}>
                    <span className={s.xpBadge}>⚡ {xp} XP</span>
                  </div>
                </div>

                <div className={s.questionCard}>
                  {currentQ.examTag && (
                    <span className={s.examTag}>{currentQ.examTag} Style</span>
                  )}
                  <p className={s.questionText}>{currentQ.question}</p>

                  <div className={s.choices}>
                    {currentQ.choices.map((choice, i) => {
                      let cls = s.choice
                      if (checked) {
                        if (i === currentQ.correctIndex)   cls = s.choiceCorrect
                        else if (i === selected)           cls = s.choiceWrong
                      } else if (i === selected) {
                        cls = s.choiceSelected
                      }
                      return (
                        <button key={i} className={cls}
                          onClick={() => !checked && setSelected(i)} disabled={checked}>
                          <span className={s.choiceLetter}>{String.fromCharCode(65+i)}</span>
                          <span className={s.choiceText}>{choice}</span>
                          {checked && i === currentQ.correctIndex && <span className={s.choiceTick}>✓</span>}
                          {checked && i === selected && i !== currentQ.correctIndex && <span className={s.choiceCross}>✗</span>}
                        </button>
                      )
                    })}
                  </div>

                  {!checked && hintsShown < 3 && (
                    <button className={s.hintTrigger}
                      onClick={() => setHintsShown(h => Math.min(h + 1, 3))}>
                      💡 {hintsShown === 0 ? 'Need a hint?' : `Hint ${hintsShown + 1} →`}
                    </button>
                  )}
                  {hintsShown > 0 && !checked && (
                    <div className={s.hintsBox}>
                      {currentQ.hints.slice(0, hintsShown).map((h, i) => (
                        <div key={i} className={s.hintLine}>
                          <span className={s.hintNum}>{i + 1}</span> {h}
                        </div>
                      ))}
                    </div>
                  )}

                  {checked && (
                    <div className={selected === currentQ.correctIndex ? s.feedbackCorrect : s.feedbackWrong}>
                      <div className={s.feedbackIcon}>
                        {selected === currentQ.correctIndex ? '✨' : '💡'}
                      </div>
                      <div className={s.feedbackContent}>
                        <div className={s.feedbackTitle}>
                          {selected === currentQ.correctIndex
                            ? `Correct! +${lvMeta.xp} XP`
                            : 'Not quite — here\'s why:'}
                        </div>
                        <div className={s.feedbackExplanation}>{currentQ.explanation}</div>
                      </div>
                    </div>
                  )}
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
            )}

            {/* ── Session complete ── */}
            {pPhase === 'complete' && (
              <div className={s.completeWrap}>
                <div className={s.completeStars}>
                  {correctCount >= 4 ? '🌟🌟🌟' : correctCount >= 2 ? '🌟🌟' : '🌟'}
                </div>
                <h2 className={s.completeTitle}>Session Complete!</h2>
                <div className={s.completeStats}>
                  <div className={s.completeStat}>
                    <span className={s.completeStatNum} style={{ color: lvMeta.color }}>{xp}</span>
                    <span className={s.completeStatLabel}>XP Earned</span>
                  </div>
                  <div className={s.completeStat}>
                    <span className={s.completeStatNum}>{correctCount}/{questions.length}</span>
                    <span className={s.completeStatLabel}>Correct</span>
                  </div>
                  <div className={s.completeStat}>
                    <span className={s.completeStatNum}>{Math.round((correctCount/questions.length)*100)}%</span>
                    <span className={s.completeStatLabel}>Accuracy</span>
                  </div>
                </div>

                <div className={s.completeInsight}>
                  {correctCount === questions.length
                    ? `Perfect score on ${conceptMeta?.label} Level ${level}! Ready to try Level ${Math.min(level+1,3)}?`
                    : correctCount >= 3
                    ? `Solid work. A bit more practice on ${conceptMeta?.label} will lock it in.`
                    : `${conceptMeta?.label} needs more attention. Try Level ${level} again — you'll get it.`}
                </div>

                <div className={s.completeActions}>
                  <button className={s.btnSecondary} onClick={resetPractice}>
                    New Mission
                  </button>
                  <button
                    className={s.btnPrimary}
                    onClick={() => startSession(concept!, Math.min(level + 1, 3) as 1|2|3)}
                  >
                    {level < 3 ? `Try Level ${level + 1} →` : 'Practice Again →'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════ SOLVER MODE ════════════════ */}
        {mode === 'solver' && (
          <div className={s.solverWrap}>
            <div className={s.solverHeader}>
              <h2 className={s.solverTitle}>Problem Solver</h2>
              <p className={s.solverSub}>Paste any problem and get a step-by-step breakdown.</p>
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
                    <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) setSolverFile(f) }} />
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
                <button className={s.solverBtn}
                  onClick={() => submitProblem(problem, solverFile)}
                  disabled={!problem.trim() && !solverFile}>
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
                <div className={s.spinner} />
                <p>Building your learning path…</p>
                {slowLoad && <p className={s.slowMsg}>First load takes 30–60 s. Hang tight.</p>}
              </div>
            )}

            {sPhase === 'cards' && session && (
              <HomeworkCards
                session={session}
                studentId={user.uid}
                apiBase={HOMEWORK_API}
                onComplete={r => { setSResults(r); setSPhase('done') }}
                onNewProblem={() => { setProblem(''); setSession(null); setSPhase('input') }}
              />
            )}

            {sPhase === 'done' && (
              <div className={s.completeWrap}>
                <div className={s.completeStars}>✦</div>
                <h2 className={s.completeTitle}>Session complete</h2>
                <p style={{ color:'var(--text-2)', fontSize:14 }}>
                  {sResults.filter(r => r.outcome === 1).length} of {sResults.length} concepts solid
                </p>
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
