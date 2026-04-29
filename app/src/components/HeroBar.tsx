import { useNavigate } from 'react-router-dom'
import s from './HeroBar.module.css'

interface Props {
  greeting:    string
  name:        string
  nextSession: { subject: string; time: string; tutor: string; meetingUrl?: string | null; scheduledAt?: number } | null
  tutorId?:    string | null
}

const FIFTEEN_MIN = 15 * 60 * 1000

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function HeroBar({ greeting, name, nextSession, tutorId }: Props) {
  const navigate   = useNavigate()
  const now        = Date.now()
  const sessionMs  = nextSession?.scheduledAt ?? 0
  const sessionLive = sessionMs > 0
    && now >= sessionMs - FIFTEEN_MIN
    && now <= sessionMs + 90 * 60 * 1000
  const canJoin = sessionLive && !!nextSession?.meetingUrl

  return (
    <div className={s.strip}>
      {/* Geometric accents */}
      <span className={s.accentCircle} aria-hidden />
      <span className={s.accentTri}    aria-hidden />

      {/* Left: greeting + session pill */}
      <div className={s.left}>
        <h1 className={s.greeting}>
          {greeting}, <em>{name}</em> 👋
        </h1>

        {nextSession ? (
          <div className={s.pill}>
            <span className={s.pillDot} />
            <span className={s.pillText}>
              {nextSession.subject} · {nextSession.time}
              <span className={s.pillSub}> with {nextSession.tutor}</span>
            </span>
          </div>
        ) : (
          <div className={s.pill}>
            <span className={s.pillDot} style={{ background: 'rgba(255,255,255,0.2)', animation: 'none' }} />
            <span className={s.pillText} style={{ opacity: 0.5 }}>No session scheduled</span>
          </div>
        )}
      </div>

      {/* Right: date + actions */}
      <div className={s.right}>
        <p className={s.date}>{todayLabel()}</p>
        <div className={s.btns}>
          {canJoin ? (
            <a
              href={nextSession!.meetingUrl!}
              target="_blank"
              rel="noopener"
              className={`${s.btn} ${s.btnLive}`}
            >
              Join Session →
            </a>
          ) : (
            <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => navigate('/book')}>
              Book Session
            </button>
          )}
          {tutorId && (
            <button className={`${s.btn} ${s.btnGhost}`} onClick={() => navigate(`/chat/${tutorId}`)}>
              Message Tutor
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
