import { SessionSummary } from '../hooks/useStudentData'
import s from './Card.module.css'

interface Props { count: number; session: SessionSummary | null }

export default function PracticeReady({ count, session }: Props) {
  return (
    <div className={s.card}>
      <p className={s.label}>Practice Ready</p>
      {count > 0 ? (
        <>
          <div className={s.practiceNum}>{count} <span>questions</span></div>
          <p className={s.practiceSub}>
            {session ? `Based on last session — ${session.title}` : 'Ready when you are'}
          </p>
          <button className={s.btnGreen}>Start Practice →</button>
        </>
      ) : (
        <div className={s.empty}>
          <span>No practice ready yet</span>
          <p>Practice problems will appear here after your first session.</p>
        </div>
      )}
    </div>
  )
}
