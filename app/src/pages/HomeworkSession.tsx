/**
 * HomeworkSession.tsx
 *
 * One page per question extracted from an uploaded homework PDF/photo.
 * Same work surface as SessionWork.tsx (ScratchPad + ScratchTranscriptionPane)
 * plus the scientific calculator, a hint path through the ingredient-pipeline
 * fallback, and a quiet "ask your tutor" affordance. Progress and the final
 * summary persist to the homework_sessions collection, which the dashboard
 * Notes panel reads back as a journal entry.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import ScratchPad, { exportScratchImage } from '../components/ScratchPad'
import ScratchTranscriptionPane, { type ScratchInkState } from '../components/ScratchTranscriptionPane'
import { ScientificCalcPanel, ScientificCalcToggle } from '../components/ScientificCalculator'
import MathText from '../components/MathText'
import { getIngredientCards, type IngredientRecommendResult } from '../lib/mlApi'
import { saveQuestionWork } from '../lib/studentWork'
import { loadHomeworkSession, updateHomeworkProgress, completeHomeworkSession } from '../lib/homework'
import type { ScratchStrokeData, HomeworkSessionDoc } from '../types'
import s from './HomeworkSession.module.css'

const HOMEWORK_CONCEPT_ID = 'homework_upload'

export default function HomeworkSession() {
  const { homeworkId } = useParams<{ homeworkId: string }>()
  const user = useUser()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<HomeworkSessionDoc | null>(null)
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [workedIds, setWorkedIds] = useState<Set<string>>(new Set())

  const [scratchImage, setScratchImage] = useState('')
  const [scratchStrokes, setScratchStrokes] = useState<ScratchStrokeData | null>(null)
  const [scratchInk, setScratchInk] = useState<ScratchInkState | null>(null)
  const [showCalc, setShowCalc] = useState(false)
  const [calcValue, setCalcValue] = useState('')

  const [hints, setHints] = useState<IngredientRecommendResult | null>(null)
  const [hintsLoading, setHintsLoading] = useState(false)
  const [hintsOpen, setHintsOpen] = useState(false)

  const [tutorId, setTutorId] = useState<string | null>(null)
  const [tutorMeetUrl, setTutorMeetUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!homeworkId || !user?.uid) return
    let cancelled = false

    async function load() {
      const doc_ = await loadHomeworkSession(homeworkId!)
      if (!doc_ || doc_.studentId !== user.uid) {
        if (!cancelled) navigate('/dashboard?view=worksheet', { replace: true })
        return
      }
      if (!cancelled) {
        setSession(doc_)
        setIndex(doc_.status === 'completed' ? 0 : doc_.currentIndex)
        setDone(doc_.status === 'completed')
        setLoading(false)
      }
    }

    load().catch(() => {
      if (!cancelled) navigate('/dashboard?view=worksheet', { replace: true })
    })

    return () => { cancelled = true }
  }, [homeworkId, user?.uid, navigate])

  // Tutor link — the student's own user doc carries tutorId once linked via
  // a classroom join; read their permanent Meet room for the "ask your
  // tutor" affordance. Hidden entirely when no tutor is linked.
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    void getDoc(doc(db, 'users', user.uid)).then(async snap => {
      const linkedTutorId = snap.data()?.tutorId
      if (typeof linkedTutorId !== 'string' || !linkedTutorId) return
      if (cancelled) return
      setTutorId(linkedTutorId)
      const tutorSnap = await getDoc(doc(db, 'users', linkedTutorId))
      if (cancelled) return
      const url = tutorSnap.data()?.googleMeetUrl
      setTutorMeetUrl(typeof url === 'string' && url ? url : null)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user?.uid])

  function resetWorkSurface() {
    setScratchImage('')
    setScratchStrokes(null)
    setScratchInk(null)
    setShowCalc(false)
    setCalcValue('')
    setHints(null)
    setHintsOpen(false)
  }

  async function persistCurrentWork(currentIdx: number) {
    if (!session || !user?.uid) return
    const q = session.questions[currentIdx]
    if (!q) return
    const hasWork = Boolean(scratchStrokes?.strokes.length)
    if (hasWork) {
      setWorkedIds(prev => new Set(prev).add(q.id))
    }
    void saveQuestionWork(user.uid, {
      questionId: `hw_${session.id}_${q.id}`,
      conceptId: HOMEWORK_CONCEPT_ID,
      source: 'homework',
      sessionId: session.id,
      prompt: q.text,
      scratchImage,
      scratchStrokes: scratchStrokes ?? { strokes: [], width: 0, height: 0 },
      workLines: scratchInk?.workLines ?? [],
      scratchTranscription: scratchInk?.transcription ?? { text: '', latex: '', editedByStudent: false },
    })
  }

  async function goNext() {
    if (!session) return
    await persistCurrentWork(index)
    const nextIndex = index + 1
    if (nextIndex >= session.questions.length) {
      const finalWorked = scratchStrokes?.strokes.length
        ? new Set(workedIds).add(session.questions[index].id)
        : workedIds
      await completeHomeworkSession(session.id, session.questions, finalWorked)
      setDone(true)
      return
    }
    void updateHomeworkProgress(session.id, nextIndex)
    setIndex(nextIndex)
    resetWorkSurface()
  }

  function goPrev() {
    if (index === 0) return
    const prevIndex = index - 1
    void updateHomeworkProgress(session!.id, prevIndex)
    setIndex(prevIndex)
    resetWorkSurface()
  }

  async function fetchHints() {
    if (!session || !user?.uid) return
    const q = session.questions[index]
    setHintsOpen(true)
    if (hints || hintsLoading) return
    setHintsLoading(true)
    try {
      const result = await getIngredientCards(user.uid, q.text, 4)
      setHints(result)
    } finally {
      setHintsLoading(false)
    }
  }

  if (loading) {
    return <div className={s.loadWrap}><div className={s.spinner} /></div>
  }

  if (!session) return null

  const q = session.questions[index]
  const total = session.questions.length

  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <Link to="/dashboard?view=worksheet" className={s.logo}>Mind<span>Craft</span></Link>
        <Link to="/dashboard?view=worksheet" className={s.back}>← Homework</Link>
      </nav>

      <main className={s.page}>
        {done ? (
          <div className={`${s.card} ${s.doneCard}`}>
            <div className={s.doneIcon}>✓</div>
            <h1 className={s.doneTitle}>That's the run.</h1>
            <p className={s.doneSub}>It's in your journal now.</p>
            <div className={s.doneActions}>
              <Link to="/dashboard?view=notes" className={s.submitBtn} style={{ textDecoration: 'none' }}>
                Open your journal
              </Link>
              <Link to="/dashboard?view=worksheet" className={s.doneSecondary} style={{ textDecoration: 'none' }}>
                Back to homework
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className={s.progress}>
              {session.title} · Question {index + 1} of {total}
            </div>

            <div className={s.card}>
              <div className={s.questionHead}>
                {q.number && <span className={s.questionNumber}>{q.number}</span>}
                {q.ambiguous && (
                  <span className={s.ambiguousBadge}>
                    We may have split this one oddly. Read it before you start.
                  </span>
                )}
              </div>

              <div className={s.questionBox}>
                <MathText text={q.text} />
              </div>

              {q.choices && q.choices.length > 0 && (
                <ul className={s.choiceList}>
                  {q.choices.map((choice, i) => (
                    <li key={i} className={s.choiceItem}>
                      <MathText text={choice} />
                    </li>
                  ))}
                </ul>
              )}

              {q.figureNote && (
                <p className={s.figureNote}>The sheet shows: {q.figureNote}</p>
              )}

              <ScratchPad
                key={`${session.id}-${index}`}
                height={280}
                onChange={(_canvas, strokeData) => {
                  setScratchStrokes(strokeData)
                  setScratchImage(
                    strokeData.strokes.length
                      ? exportScratchImage(strokeData.strokes, strokeData.width, strokeData.height, 1)
                      : '',
                  )
                }}
              />
              <ScratchTranscriptionPane
                imageDataUrl={scratchImage}
                strokeData={scratchStrokes}
                resetKey={`${session.id}-${index}`}
                onChange={setScratchInk}
              />

              <div className={s.toolRow}>
                <ScientificCalcToggle active={showCalc} onToggle={() => setShowCalc(v => !v)} />
                <button type="button" className={s.hintBtn} onClick={() => void fetchHints()}>
                  Get a hint
                </button>
                {tutorId && (
                  <div className={s.tutorAsk}>
                    {tutorMeetUrl && (
                      <a
                        className={s.tutorLink}
                        href={tutorMeetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ask your tutor
                      </a>
                    )}
                    <Link className={s.tutorLink} to={`/chat/${tutorId}`}>
                      Message your tutor
                    </Link>
                  </div>
                )}
              </div>

              <ScientificCalcPanel
                open={showCalc}
                value={calcValue}
                onChange={setCalcValue}
                onSubmit={() => {}}
                inputRef={{ current: null }}
              />

              {hintsOpen && (
                <div className={s.hintPane}>
                  {hintsLoading ? (
                    <p className={s.hintLoading}>Building your hint path…</p>
                  ) : hints && hints.cards.length > 0 ? (
                    <div className={s.hintCards}>
                      {hints.cards.map((card, i) => (
                        <div key={i} className={s.hintCard}>
                          <span className={s.hintCardTitle}>{card.title}</span>
                          <div className={s.hintCardBody}><MathText text={card.body} /></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={s.hintEmpty}>
                      No hint path for this one yet. Your tutor can walk it with you.
                    </p>
                  )}
                </div>
              )}

              <div className={s.navRow}>
                <button type="button" className={s.prevBtn} onClick={goPrev} disabled={index === 0}>
                  ← back
                </button>
                <button type="button" className={s.submitBtn} onClick={() => void goNext()}>
                  {index + 1 >= total ? 'Finish & save' : 'Next question →'}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
