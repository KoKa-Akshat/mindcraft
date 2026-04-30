import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useUser } from '../App'
import s from './Sidebar.module.css'

const NAV_ITEMS = [
  {
    group: 'Learn',
    links: [
      {
        to: '/sessions', label: 'Session Notes',
        icon: <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
      },
    ],
  },
  {
    group: 'Practice',
    links: [
      {
        to: '/practice', label: 'Homework Help',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>,
      },
      {
        to: '/organize-notes', label: 'Organize Notes',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>,
      },
    ],
  },
]

export default function Sidebar() {
  const loc      = useLocation()
  const navigate = useNavigate()
  const user     = useUser()

  const active = (path: string) =>
    loc.pathname === path || (path !== '/' && loc.pathname.startsWith(path + '/'))
      ? s.active : ''

  return (
    <aside className={s.sidebar}>
      {/* Logo */}
      <Link to="/dashboard" className={s.logo}>
        <span className={s.logoMind}>Mind</span><span className={s.logoCraft}>Craft</span>
        <span className={s.logoRaccoon}>🦝</span>
      </Link>

      {/* Nav groups */}
      <nav className={s.nav}>
        {NAV_ITEMS.map(group => (
          <div key={group.group} className={s.group}>
            <p className={s.groupLabel}>{group.group}</p>
            {group.links.map(({ to, label, icon }) => (
              <Link key={to} to={to} className={`${s.item} ${active(to)}`}>
                <span className={s.icon}>{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom — community + user */}
      <div className={s.bottom}>
        <a
          href="https://join.slack.com/t/mindcraftnetwork/shared_invite/zt-3vnl9tmvm-sTq8wFPky0LcOGWcK_COHg"
          target="_blank"
          rel="noopener"
          className={s.slack}
        >
          <svg className={s.slackIcon} viewBox="0 0 24 24" fill="none">
            <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" fill="#E01E5A"/>
            <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="#E01E5A"/>
            <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" fill="#2EB67D"/>
            <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" fill="#2EB67D"/>
            <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" fill="#ECB22E"/>
            <path d="M14 3.5C14 2.67 14.67 2 15.5 2S17 2.67 17 3.5V5h-1.5C14.67 5 14 4.33 14 3.5z" fill="#ECB22E"/>
            <path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z" fill="#36C5F0"/>
            <path d="M10 20.5c0 .83-.67 1.5-1.5 1.5S7 21.33 7 20.5V19h1.5c.83 0 1.5.67 1.5 1.5z" fill="#36C5F0"/>
          </svg>
          Community
        </a>

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
      </div>
    </aside>
  )
}
