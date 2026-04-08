import { useNavigate } from 'react-router-dom'
import s from './HeroBar.module.css'

interface Props {
  greeting: string
  name: string
  nextSession: { subject: string; time: string; tutor: string; meetingUrl?: string | null; scheduledAt?: number } | null
  tutorId?: string | null
}

const FIFTEEN_MIN = 15 * 60 * 1000

export default function HeroBar({ greeting, name, nextSession, tutorId }: Props) {
  const navigate = useNavigate()
  const now = Date.now()
  const sessionMs = nextSession?.scheduledAt ?? 0
  const sessionLive = sessionMs > 0 && (now >= sessionMs - FIFTEEN_MIN) && (now <= sessionMs + 90 * 60 * 1000)
  const canJoin = sessionLive && !!nextSession?.meetingUrl

  return (
    <div className={s.hero}>
      <div className={s.left}>
        <h1>{greeting}, <em>{name}</em></h1>
        {nextSession ? (
          <div className={s.pill}>
            <div className={s.pillDot} />
            <div className={s.pillText}>
              {nextSession.subject} · {nextSession.time} <span>· with {nextSession.tutor}</span>
            </div>
          </div>
        ) : (
          <div className={s.pill}>
            <div className={s.pillDot} style={{ background: 'var(--bd)', animation: 'none' }} />
            <div className={s.pillText} style={{ color: 'var(--mu)' }}>No session scheduled yet</div>
          </div>
        )}
        <div className={s.btns}>
          {canJoin
            ? <a href={nextSession!.meetingUrl!} target="_blank" rel="noopener" className={`${s.btnPrimary} ${s.btnLive}`}>Join Session →</a>
            : <button className={s.btnPrimary} disabled style={{ opacity: .45, cursor: 'not-allowed', boxShadow: 'none' }}
                title={nextSession ? `Activates 15 min before your session at ${nextSession.time}` : 'No session scheduled'}>
                Join Session →
              </button>
          }
          <button className={s.btnSecondary} onClick={() => navigate('/book')}>Book Session</button>
          {tutorId && (
            <button className={s.btnSecondary} onClick={() => navigate(`/chat/${tutorId}`)}>
              💬 Message Tutor
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
