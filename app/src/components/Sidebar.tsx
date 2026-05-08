import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useUser } from '../App'
import logo from '../assets/logo.png'
import raccoon from '../assets/raccoon.jpg'
import s from './Sidebar.module.css'

const NAV = [
  { to: '/sessions',       label: 'Session Notes' },
  { to: '/practice',       label: 'Practice'      },
  { to: '/organize-notes', label: 'Organize'      },
]

export default function Sidebar() {
  const loc      = useLocation()
  const navigate = useNavigate()
  const user     = useUser()

  const active = (path: string) =>
    loc.pathname === path || (path !== '/dashboard' && loc.pathname.startsWith(path))
      ? s.active : ''

  return (
    <>
      <nav className={s.topNav}>
        <Link to="/dashboard" className={s.logo}>
          <div className={s.logoPill}>
            <img src={logo} alt="MindCraft" className={s.logoImg} />
            <img src={raccoon} alt="" className={s.logoRaccoon} />
          </div>
        </Link>

        <div className={s.links}>
          {NAV.map(({ to, label }) => (
            <Link key={to} to={to} className={`${s.link} ${active(to)}`}>
              {label}
            </Link>
          ))}
          <a
            href="https://join.slack.com/t/mindcraftnetwork/shared_invite/zt-3vnl9tmvm-sTq8wFPky0LcOGWcK_COHg"
            target="_blank"
            rel="noopener"
            className={s.link}
          >
            Community
          </a>
        </div>

        {user && (
          <div className={s.userRow}>
            <div className={s.avatar}>
              {(user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
            </div>
            <span className={s.userName}>
              {user.displayName ? user.displayName.split(' ')[0] : user.email?.split('@')[0]}
            </span>
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
      </nav>
      <div className={s.spacer} aria-hidden />
    </>
  )
}
