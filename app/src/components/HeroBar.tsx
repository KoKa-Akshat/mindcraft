import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useUser } from '../App'
import s from './HeroBar.module.css'

interface Props {
  greeting:    string
  name:        string
  nextSession: { subject: string; time: string; tutor: string; meetingUrl?: string | null; scheduledAt?: number } | null
  tutorId?:    string | null
}

const NAV = [
  { to: '/dashboard',      label: 'Dashboard'     },
  { to: '/sessions',       label: 'Session Notes' },
  { to: '/practice',       label: 'Practice'      },
]

const FIFTEEN_MIN = 15 * 60 * 1000

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function HeroBar({ greeting, name, nextSession, tutorId }: Props) {
  const loc      = useLocation()
  const navigate = useNavigate()
  const user     = useUser()
  const now      = Date.now()

  const sessionMs   = nextSession?.scheduledAt ?? 0
  const sessionLive = sessionMs > 0
    && now >= sessionMs - FIFTEEN_MIN
    && now <= sessionMs + 90 * 60 * 1000
  const canJoin = sessionLive && !!nextSession?.meetingUrl

  const active = (path: string) =>
    loc.pathname === path || loc.pathname.startsWith(path + '/')
      ? s.navActive : ''

  return (
    <div className={s.strip}>
      {user && (
        <div className={s.userRow}>
          <div className={s.avatar}>
            {(user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
          </div>
          <button
            className={s.signOutBtn}
            onClick={() => signOut(auth).then(() => navigate('/login', { replace: true }))}
            title="Sign out"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      )}

      <div className={s.bottomRow}>
        <div className={s.greetingBlock}>
          <Link to="/dashboard" className={s.brand}>
            <span className={s.brandText}>Mind<span>Craft</span></span>
          </Link>
          <p className={s.kicker}>{todayLabel()}</p>
          <h1 className={s.greeting}>
            {greeting}, <em>{name}</em>
          </h1>
        </div>

        <nav className={s.nav} aria-label="Dashboard navigation">
          {NAV.map(({ to, label }) => (
            <Link key={to} to={to} className={`${s.navLink} ${active(to)}`}>
              {label}
            </Link>
          ))}
          <a
            href="https://join.slack.com/t/mindcraftnetwork/shared_invite/zt-3vnl9tmvm-sTq8wFPky0LcOGWcK_COHg"
            target="_blank"
            rel="noopener"
            className={s.navLink}
          >
            Community
          </a>
        </nav>

        <div className={s.sessionPanel}>
          <span className={s.sessionLabel}>{canJoin ? 'Session is live' : 'Next up'}</span>
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
              <span className={`${s.pillDot} ${s.pillDotIdle}`} />
              <span className={s.pillText}>No session scheduled</span>
            </div>
          )}
        </div>

        <div className={s.btns}>
          {canJoin ? (
            <a
              href={nextSession!.meetingUrl!}
              target="_blank"
              rel="noopener"
              className={`${s.btn} ${s.btnLive}`}
            >
              Join Session
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
