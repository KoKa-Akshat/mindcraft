import { SessionSummary } from '../hooks/useStudentData'
import s from './Card.module.css'

interface Props { session: SessionSummary | null }

export default function LastSession({ session }: Props) {
  if (!session) {
    return (
      <div className={s.card}>
        <p className={s.label}>Last Session</p>
        <div className={s.empty}>
          <span>No sessions yet</span>
          <p>Your session summary will appear here after your first session.</p>
        </div>
      </div>
    )
  }
  return (
    <div className={s.card}>
      <p className={s.label}>Last Session</p>
      <div className={s.summaryHeader}>
        <span className={s.tag}>{session.subject}</span>
        <span className={s.date}>{session.date} · {session.duration}</span>
      </div>
      <div className={s.title}>{session.title}</div>
      <ul className={s.list}>
        {session.bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      <button className={s.btnOutline}>View Full Summary</button>
    </div>
  )
}
