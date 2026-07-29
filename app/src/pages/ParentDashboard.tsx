/**
 * ParentDashboard — retired.
 *
 * Parents get progress updates by email from their tutor.
 * This route stays so role:'parent' logins don't 404.
 */

import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useUser } from '../App'
import { MARKETING_BASE } from '../lib/siteUrls'
import s from './ParentDashboard.module.css'

export default function ParentDashboard() {
  const user = useUser()

  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <a href={MARKETING_BASE} className={s.logo}>
          <img src="/brand/logo-mark.png" alt="" className={s.logoMark} />
          <span>MindCraft</span>
        </a>
        <div className={s.topRight}>
          <span className={s.userChip}>{user.email}</span>
          <button type="button" className={s.signOut} onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </header>

      <main className={s.retired}>
        <h1>Parent updates come by email</h1>
        <p>
          Your tutor will email you with progress updates for your student.
          There is no separate parent dashboard to check.
        </p>
        <p className={s.retiredHint}>
          If you need an update sooner, reply to your tutor’s last email or
          reach out to them directly.
        </p>
      </main>
    </div>
  )
}
