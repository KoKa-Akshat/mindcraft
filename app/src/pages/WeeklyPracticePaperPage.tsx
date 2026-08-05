/**
 * Scrollable / printable Weekly Review paper — free-response work surface.
 * Stems from the cached weekly paper; each item gets ScratchPad ink capture
 * (no MCQ gate). Progress writes to users/{uid}.weeklyPaperProgress keyed by
 * weekKey() so tutors can see the same cadence as the dashboard lock.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import MathText from '../components/MathText'
import ScratchPad from '../components/ScratchPad'
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
import s from './WeeklyPracticePaperPage.module.css'

type PaperItem = {
  question: Question
  stem: string
  slotLabel: string
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

export default function WeeklyPracticePaperPage() {
  const user = useUser()
  const navigate = useNavigate()
  const paper = useMemo(() => loadCachedWeeklyPaper(), [])
  const items = useMemo(() => (paper ? resolvePaperItems(paper) : []), [paper])
  const [inked, setInked] = useState<Set<string>>(() => new Set())
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

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

  return (
    <div className={s.shell}>
      <header className={`${s.toolbar} ${s.noPrint}`}>
        <button type="button" className={s.ghost} onClick={() => navigate('/dashboard')}>
          ← Contents
        </button>
        <div className={s.toolbarMeta}>
          <span className={s.week}>{paper.weekKey}</span>
          <span className={s.progress}>
            {inked.size}/{items.length} worked
            {done ? ' · done' : ''}
          </span>
        </div>
        <div className={s.toolbarActions}>
          <button type="button" className={s.ghost} onClick={() => window.print()}>
            Print
          </button>
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

      <article className={s.paper}>
        <div className={s.paperHead}>
          <p className={s.eyebrow}>MindCraft · Weekly Review</p>
          <h1 className={s.title}>{paper.title}</h1>
          <p className={s.sub}>
            Free-response. Work in the pad under each question.
            {paper.mode ? ` Mode: ${paper.mode}.` : ''} Week {paper.weekKey}.
          </p>
        </div>

        {items.map((item, i) => (
          <section key={item.question.id} className={s.item}>
            <div className={s.itemHead}>
              <span className={s.num}>{i + 1}</span>
              <span className={s.topic}>{item.slotLabel}</span>
            </div>
            <div className={s.stem}>
              <MathText text={item.stem} />
            </div>
            <div className={`${s.work} ${s.noPrint}`}>
              <p className={s.workLabel}>Your work</p>
              <ScratchPad
                key={`paper-${paper.weekKey}-${item.question.id}`}
                questionId={`weekly-${paper.weekKey}-${item.question.id}`}
                height={220}
                paperMode
                onChange={(_canvas, data) => {
                  const hasInk = (data.strokes?.length ?? 0) > 0
                  setInked(prev => {
                    const next = new Set(prev)
                    if (hasInk) next.add(item.question.id)
                    else next.delete(item.question.id)
                    return next
                  })
                }}
              />
            </div>
            <div className={`${s.printLines} ${s.printOnly}`} aria-hidden="true">
              {Array.from({ length: 8 }).map((_, line) => (
                <div key={line} className={s.printLine} />
              ))}
            </div>
          </section>
        ))}

        {done && (
          <div className={`${s.doneBanner} ${s.noPrint}`}>
            This week’s paper is marked done. Next unlock follows the Monday cadence
            ({weekKey()} locked until then).
          </div>
        )}
      </article>
    </div>
  )
}
