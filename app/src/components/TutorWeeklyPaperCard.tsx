/**
 * Tutor-facing Weekly Review progress for the focused student.
 * Reads users/{studentId}.weeklyPaperProgress + weeklyPaperCompletedWeek,
 * keyed on the same weekKey() the student dashboard lock uses.
 */
import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import {
  loadWeeklyPaperProgress,
  type WeeklyPaperProgress,
} from '../lib/practiceState'
import { nextUnlockLabel, weekKey } from '../lib/weeklyPracticePaper'
import s from './TutorWeeklyPaperCard.module.css'

type Props = {
  studentId: string
  studentName: string
}

export default function TutorWeeklyPaperCard({ studentId, studentName }: Props) {
  const thisWeek = useMemo(() => weekKey(), [])
  const [progress, setProgress] = useState<WeeklyPaperProgress | null>(null)
  const [completedWeek, setCompletedWeek] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [prog, snap] = await Promise.all([
          loadWeeklyPaperProgress(studentId),
          getDoc(doc(db, 'users', studentId)),
        ])
        if (cancelled) return
        setProgress(prog && prog.weekKey === thisWeek ? prog : null)
        const raw = snap.data()?.weeklyPaperCompletedWeek
        setCompletedWeek(typeof raw === 'string' ? raw : null)
      } catch {
        if (!cancelled) {
          setProgress(null)
          setCompletedWeek(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [studentId, thisWeek])

  const done = completedWeek === thisWeek || !!progress?.completed
  const inked = progress?.inkedQuestionIds.length ?? 0
  const total = progress?.totalQuestions ?? 0
  const first = studentName.trim().split(/\s+/)[0] || 'Student'

  return (
    <div className={s.card}>
      <div className={s.head}>
        <span className={s.label}>Weekly Review</span>
        <span className={s.week}>{thisWeek}</span>
      </div>
      {loading ? (
        <p className={s.muted}>Checking this week’s paper…</p>
      ) : done ? (
        <div className={s.statusRow}>
          <span className={`${s.badge} ${s.badgeDone}`}>Done</span>
          <p className={s.copy}>
            {first} finished this week’s paper.
            {total > 0 ? ` Worked ${inked}/${total} questions.` : ''}
            {' '}{nextUnlockLabel()}.
          </p>
        </div>
      ) : progress && total > 0 ? (
        <div className={s.statusRow}>
          <span className={`${s.badge} ${s.badgeLive}`}>In progress</span>
          <p className={s.copy}>
            {first} has ink on {inked} of {total} questions.
          </p>
          <div className={s.bar} aria-hidden="true">
            <span style={{ width: `${Math.round((inked / Math.max(1, total)) * 100)}%` }} />
          </div>
        </div>
      ) : (
        <div className={s.statusRow}>
          <span className={`${s.badge} ${s.badgeIdle}`}>Not started</span>
          <p className={s.copy}>
            No ink yet for {thisWeek}. They open it from Weekly Review on Contents.
          </p>
        </div>
      )}
    </div>
  )
}
