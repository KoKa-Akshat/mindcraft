import { useNavigate } from 'react-router-dom'
import { SessionSummary } from '../hooks/useStudentData'
import s from './Card.module.css'

interface Props { session: SessionSummary | null }

function buildPrompt(session: SessionSummary): string {
  const focus = session.bullets.slice(0, 2).join('; ').toLowerCase()
  return `Review from your ${session.subject} session on ${session.date}: ${focus}. Work through the assigned problems focusing on accuracy before speed.`
}

export default function LastSession({ session }: Props) {
  const navigate = useNavigate()
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

      <div className={s.divider} />

      <div className={s.promptBox}>
        <p className={s.promptLabel}>Practice Prompt</p>
        <p className={s.promptText}>{buildPrompt(session)}</p>
        <button className={s.btnGreen} style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>
          Start Practice Session →
        </button>
      </div>

      <div className={s.divider} />
      <button className={s.btnOutline} onClick={() => session.id && !session.id.startsWith('seed') && navigate(`/tutor/session/${session.id}`)}>View Full Summary</button>
    </div>
  )
}
