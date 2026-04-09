import { useNavigate } from 'react-router-dom'
import s from './HeroBar.module.css'

interface Props {
  greeting:    string
  name:        string
  nextSession: { subject: string; time: string; tutor: string; meetingUrl?: string | null; scheduledAt?: number } | null
  tutorId?:    string | null
  right?:      React.ReactNode   // class cards strip rendered in the empty hero space
}

const FIFTEEN_MIN = 15 * 60 * 1000

export default function HeroBar({ greeting, name, nextSession, tutorId, right }: Props) {
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="17"/>
                <line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/>
              </svg>
              Message Tutor
            </button>
          )}
        </div>
      </div>

      {/* Right slot — class cards horizontal strip fills the empty hero space */}
      {right && <div className={s.right}>{right}</div>}
    </div>
  )
}
