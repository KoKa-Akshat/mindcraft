import { User } from 'firebase/auth'
import s from './Navbar.module.css'

interface Props {
  user: User
  onSignOut: () => void
}

export default function Navbar({ user, onSignOut }: Props) {
  const initial = (user.displayName?.[0] || user.email?.[0] || 'A').toUpperCase()
  return (
    <nav className={s.nav}>
      <a href="/" className={s.logo}>Mind<span>Craft</span></a>
      <div className={s.right}>
        <div className={s.notif}>
          <svg viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <div className={s.notifDot} />
        </div>
        <div className={s.avatar} onClick={onSignOut} title="Sign out">{initial}</div>
      </div>
    </nav>
  )
}
