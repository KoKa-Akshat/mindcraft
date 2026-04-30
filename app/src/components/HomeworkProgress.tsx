import { useNavigate } from 'react-router-dom'
import { HomeworkAssignment } from '../hooks/useStudentData'
import s from './HomeworkProgress.module.css'

interface Props { homework: HomeworkAssignment | null }

export default function HomeworkProgress({ homework }: Props) {
  const navigate = useNavigate()

  if (!homework || homework.problems.length === 0) {
    return (
      <div className={s.card}>
        <div className={s.header}>
          <span className={s.headerIcon}>📋</span>
          <span className={s.headerTitle}>This Week's Problems</span>
          <span className={s.headerBadge}>0 assigned</span>
        </div>
        <div className={s.empty}>
          <p className={s.emptyText}>Your tutor hasn't assigned problems yet.</p>
          <p className={s.emptyHint}>Problems will appear here after your next session.</p>
        </div>
      </div>
    )
  }

  const done  = homework.problems.filter(p => p.done).length
  const total = homework.problems.length
  const pct   = Math.round((done / total) * 100)
  const left  = total - done

  return (
    <div className={s.card}>
      {/* Header */}
      <div className={s.header}>
        <span className={s.headerIcon}>📋</span>
        <span className={s.headerTitle}>This Week's Problems</span>
        {homework.subject && <span className={s.subject}>{homework.subject}</span>}
        <span className={s.headerBadge}>{done}/{total} done</span>
      </div>

      {/* Progress bar */}
      <div className={s.progressWrap}>
        <div className={s.progressTrack}>
          <div className={s.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <div className={s.progressStats}>
          <span className={s.statDone}>✓ {done} done</span>
          <span className={s.statLeft}>{left} to go</span>
          <span className={s.statPct}>{pct}%</span>
        </div>
      </div>

      {/* Problem list */}
      <ul className={s.list}>
        {homework.problems.map((p, i) => (
          <li
            key={p.id ?? i}
            className={p.done ? s.itemDone : s.item}
            onClick={() => !p.done && navigate('/practice', { state: { problemText: p.text } })}
            style={{ cursor: p.done ? 'default' : 'pointer' }}
          >
            <span className={p.done ? s.checkDone : s.checkTodo}>
              {p.done ? '✓' : String(i + 1)}
            </span>
            <span className={s.problemText}>{p.text}</span>
            {!p.done && <span className={s.practiceTag}>Practice →</span>}
          </li>
        ))}
      </ul>

      {/* Tutor prompt context */}
      {homework.prompt && (
        <div className={s.promptHint}>
          <span className={s.promptIcon}>💬</span>
          <span className={s.promptText}>"{homework.prompt}"</span>
        </div>
      )}
    </div>
  )
}
