/**
 * Weekly Review desk — scroll paper (free-response) or playthrough (MC).
 * Two-up question grid (~3/4 width) + sticky calc/graph rail. Play mode
 * shows every paper question at once (not one-at-a-time), with soft-wrong
 * gray-out on misses. Formula notes per topic sit above that topic's batch.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import MathText from '../components/MathText'
import ScratchPad from '../components/ScratchPad'
import GraphBox from '../components/GraphBox'
import { getQuestionById, type Question } from '../lib/questionBank'
import { resolveQuestionStem } from '../lib/questionStem'
import {
  loadWeeklyPaperProgress,
  markWeeklyPaperComplete,
  saveWeeklyPaperProgress,
} from '../lib/practiceState'
import {
  loadCachedWeeklyPaper,
  weekKey,
  type WeeklyPracticePaper,
} from '../lib/weeklyPracticePaper'
import { actConceptLabel } from '../lib/actToc'
import { getConceptContent } from '../lib/conceptContent'
import s from './WeeklyPracticePaperPage.module.css'

type PaperItem = {
  question: Question
  stem: string
  slotLabel: string
}

type TopicBlock = {
  conceptId: string
  label: string
  items: PaperItem[]
}

function resolvePaperItems(paper: WeeklyPracticePaper): PaperItem[] {
  const slotByConcept = new Map(paper.slots.map(slot => [slot.conceptId, slot]))
  const items: PaperItem[] = []
  for (const id of paper.questionIds) {
    const question = getQuestionById(id)
    if (!question) continue
    const slot = slotByConcept.get(question.conceptId)
    items.push({
      question,
      stem: resolveQuestionStem(question),
      slotLabel: slot?.label ?? actConceptLabel(question.conceptId),
    })
  }
  return items
}

function groupByTopic(items: PaperItem[]): TopicBlock[] {
  const order: string[] = []
  const map = new Map<string, TopicBlock>()
  for (const item of items) {
    const id = item.question.conceptId
    if (!map.has(id)) {
      order.push(id)
      map.set(id, { conceptId: id, label: item.slotLabel, items: [] })
    }
    map.get(id)!.items.push(item)
  }
  return order.map(id => map.get(id)!)
}

function MiniCalc() {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState<number | null>(null)
  const [op, setOp] = useState<string | null>(null)
  const [fresh, setFresh] = useState(true)

  const press = (val: string) => {
    if ('0123456789.'.includes(val)) {
      if (val === '.' && display.includes('.')) return
      setDisplay(d => (fresh ? (val === '.' ? '0.' : val) : d === '0' ? val : d + val))
      setFresh(false)
    } else if (val === 'C') {
      setDisplay('0'); setPrev(null); setOp(null); setFresh(true)
    } else if (['+', '−', '×', '÷'].includes(val)) {
      setPrev(parseFloat(display)); setOp(val); setFresh(true)
    } else if (val === '=' && prev !== null && op) {
      const n = parseFloat(display)
      let r = NaN
      if (op === '+') r = prev + n
      else if (op === '−') r = prev - n
      else if (op === '×') r = prev * n
      else if (n !== 0) r = prev / n
      setDisplay(Number.isFinite(r) ? String(parseFloat(r.toFixed(10))) : 'Error')
      setPrev(null); setOp(null); setFresh(true)
    }
  }

  const rows = [
    ['C', '÷', '×', '−'],
    ['7', '8', '9', '+'],
    ['4', '5', '6', '='],
    ['1', '2', '3', '0'],
  ]

  return (
    <div className={s.calcPanel}>
      <div className={s.calcDisplay}>{display}</div>
      {rows.map((row, ri) => (
        <div key={ri} className={s.calcRow}>
          {row.map(btn => (
            <button key={btn} type="button" className={s.calcBtn} onClick={() => press(btn)}>
              {btn}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function WeeklyPracticePaperPage() {
  const user = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const playMode = Boolean((location.state as { weeklyPlay?: boolean } | null)?.weeklyPlay)

  const paper = useMemo(() => loadCachedWeeklyPaper(), [])
  const items = useMemo(() => (paper ? resolvePaperItems(paper) : []), [paper])
  const topics = useMemo(() => groupByTopic(items), [items])

  const [inked, setInked] = useState<Set<string>>(() => new Set())
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [showGraph, setShowGraph] = useState(true)
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({})

  // Playthrough: per-question selection + soft-wrong eliminations
  const [picked, setPicked] = useState<Record<string, number>>({})
  const [eliminated, setEliminated] = useState<Record<string, number[]>>({})
  const [locked, setLocked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!user?.uid || !paper) return
    let cancelled = false
    void loadWeeklyPaperProgress(user.uid).then(prog => {
      if (cancelled || !prog || prog.weekKey !== paper.weekKey) return
      setInked(new Set(prog.inkedQuestionIds))
      setDone(!!prog.completed)
    })
    return () => { cancelled = true }
  }, [user?.uid, paper])

  useEffect(() => {
    if (!user?.uid || !paper || done) return
    const payload = {
      weekKey: paper.weekKey,
      inkedQuestionIds: [...inked],
      totalQuestions: items.length,
      completed: false,
      updatedAt: new Date().toISOString(),
    }
    const t = window.setTimeout(() => {
      void saveWeeklyPaperProgress(user.uid, payload)
    }, 600)
    return () => window.clearTimeout(t)
  }, [inked, user?.uid, paper, items.length, done])

  async function finishPaper() {
    if (!user?.uid || !paper) return
    setSaving(true)
    try {
      await markWeeklyPaperComplete(user.uid, paper.weekKey)
      await saveWeeklyPaperProgress(user.uid, {
        weekKey: paper.weekKey,
        inkedQuestionIds: [...inked],
        totalQuestions: items.length,
        completed: true,
        updatedAt: new Date().toISOString(),
      })
      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  function tryChoice(q: Question, choiceIndex: number) {
    if (locked[q.id] || (eliminated[q.id] ?? []).includes(choiceIndex)) return
    setPicked(prev => ({ ...prev, [q.id]: choiceIndex }))
    if (choiceIndex === q.correctIndex) {
      setLocked(prev => ({ ...prev, [q.id]: true }))
      setInked(prev => {
        const next = new Set(prev)
        next.add(q.id)
        return next
      })
      return
    }
    setEliminated(prev => ({
      ...prev,
      [q.id]: [...new Set([...(prev[q.id] ?? []), choiceIndex])],
    }))
  }

  if (!paper || items.length === 0) {
    return (
      <div className={s.shell}>
        <div className={s.empty}>
          <h1>No paper this week yet</h1>
          <p>Pick topics from Weekly Review on your dashboard first.</p>
          <Link to="/dashboard" className={s.primaryLink}>Back to Contents</Link>
        </div>
      </div>
    )
  }

  let globalIndex = 0

  return (
    <div className={s.shell}>
      <header className={`${s.toolbar} ${s.noPrint}`}>
        <button type="button" className={s.ghost} onClick={() => navigate('/dashboard')}>
          ← Contents
        </button>
        <div className={s.toolbarMeta}>
          <span className={s.week}>{paper.weekKey}</span>
          <span className={s.progress}>
            {inked.size}/{items.length} {playMode ? 'solved' : 'worked'}
            {done ? ' · done' : ''}
          </span>
        </div>
        <div className={s.toolbarActions}>
          {!playMode && (
            <button type="button" className={s.ghost} onClick={() => window.print()}>
              Print
            </button>
          )}
          {!done && (
            <button
              type="button"
              className={s.primary}
              disabled={saving}
              onClick={() => void finishPaper()}
            >
              {saving ? 'Saving…' : 'Mark week done'}
            </button>
          )}
        </div>
      </header>

      <div className={s.desk}>
        <div className={s.mainCol}>
          <header className={s.paperHead}>
            <p className={s.eyebrow}>
              MindCraft · Weekly Review{playMode ? ' · Play through' : ''}
            </p>
            <h1 className={s.title}>{paper.title}</h1>
            <p className={s.sub}>
              {playMode
                ? 'All questions on one desk. Wrong picks gray out so you can try again.'
                : 'Free-response. Write under each question. Calc and graph stay on the right.'}
              {paper.mode ? ` Mode: ${paper.mode}.` : ''} Week {paper.weekKey}.
            </p>
          </header>

          {topics.map(topic => {
            const content = getConceptContent(topic.conceptId)
            const notesOpen = openNotes[topic.conceptId] ?? true
            return (
              <section key={topic.conceptId} className={s.topicBlock}>
                <div className={s.topicHead}>
                  <h2 className={s.topicTitle}>{topic.label}</h2>
                  <span className={s.topicCount}>{topic.items.length} Q</span>
                  {content && (
                    <button
                      type="button"
                      className={s.notesToggle}
                      onClick={() => setOpenNotes(prev => ({
                        ...prev,
                        [topic.conceptId]: !notesOpen,
                      }))}
                    >
                      {notesOpen ? 'Hide notes' : 'Show notes'}
                    </button>
                  )}
                </div>

                {content && notesOpen && (
                  <div className={s.formulaNotes}>
                    {content.formula && (
                      <p className={s.formulaBanner}>{content.formula}</p>
                    )}
                    <div className={s.notesGrid}>
                      <div>
                        <h3>Key rules</h3>
                        <ul>
                          {content.keyRules.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h3>Watch out</h3>
                        <ul>
                          {content.watchOut.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <div className={s.qGrid}>
                  {topic.items.map(item => {
                    globalIndex += 1
                    const n = globalIndex
                    const q = item.question
                    const outs = eliminated[q.id] ?? []
                    const isLocked = !!locked[q.id]
                    const selected = picked[q.id]

                    return (
                      <article key={q.id} className={s.item}>
                        <div className={s.itemHead}>
                          <span className={s.num}>{n}</span>
                          <span className={s.topic}>{item.slotLabel}</span>
                        </div>
                        <div className={s.stem}>
                          <MathText text={item.stem} />
                        </div>

                        {playMode ? (
                          <div className={s.choices}>
                            {q.choices.slice(0, 4).map((choice, i) => {
                              const out = outs.includes(i)
                              const correct = isLocked && i === q.correctIndex
                              const chosen = selected === i
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  className={[
                                    s.choice,
                                    out ? s.choiceOut : '',
                                    correct ? s.choiceCorrect : '',
                                    chosen && !out && !correct ? s.choicePicked : '',
                                  ].filter(Boolean).join(' ')}
                                  disabled={isLocked || out}
                                  onClick={() => tryChoice(q, i)}
                                >
                                  <span className={s.choiceLetter}>
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  <span className={s.choiceText}>
                                    <MathText text={choice} />
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className={`${s.work} ${s.noPrint}`}>
                            <ScratchPad
                              key={`paper-${paper.weekKey}-${q.id}`}
                              questionId={`weekly-${paper.weekKey}-${q.id}`}
                              height={160}
                              paperMode
                              onChange={(_canvas, data) => {
                                const hasInk = (data.strokes?.length ?? 0) > 0
                                setInked(prev => {
                                  const next = new Set(prev)
                                  if (hasInk) next.add(q.id)
                                  else next.delete(q.id)
                                  return next
                                })
                              }}
                            />
                          </div>
                        )}

                        {!playMode && (
                          <div className={`${s.printLines} ${s.printOnly}`} aria-hidden="true">
                            {Array.from({ length: 6 }).map((_, line) => (
                              <div key={line} className={s.printLine} />
                            ))}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {done && (
            <div className={`${s.doneBanner} ${s.noPrint}`}>
              This week’s paper is marked done. Next unlock follows the Monday cadence
              ({weekKey()} locked until then).
            </div>
          )}
        </div>

        <aside className={`${s.toolsRail} ${s.noPrint}`}>
          <div className={s.toolsSticky}>
            <div className={s.toolBtns}>
              <button
                type="button"
                className={`${s.toolBtn} ${showCalc ? s.toolBtnOn : ''}`}
                onClick={() => setShowCalc(c => !c)}
              >
                Calculator
              </button>
              <button
                type="button"
                className={`${s.toolBtn} ${showGraph ? s.toolBtnOn : ''}`}
                onClick={() => setShowGraph(g => !g)}
              >
                Graph
              </button>
            </div>
            {showCalc && <MiniCalc />}
            {showGraph && (
              <div className={s.graphWrap}>
                <GraphBox defaultOpen />
              </div>
            )}
            <p className={s.toolsHint}>
              Tools stay here while you scroll. Questions use about three-quarters of the desk.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
