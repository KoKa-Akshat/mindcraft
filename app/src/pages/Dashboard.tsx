import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import HeroBar from '../components/HeroBar'
import LastSession from '../components/LastSession'
import PracticeReady from '../components/PracticeReady'
import ExploreClasses from '../components/ExploreClasses'
import Messages from '../components/Messages'
import s from './Dashboard.module.css'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      if (!u) navigate('/login', { replace: true })
      else setUser(u)
    })
  }, [navigate])

  if (!user) return null

  const displayName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'there'

  function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className={s.shell}>
      <Navbar user={user} onSignOut={() => signOut(auth).then(() => navigate('/login', { replace: true }))} />
      <Sidebar />
      <main className={s.page}>
        <HeroBar greeting={getGreeting()} name={displayName} />
        <div className={s.grid}>
          <div className={s.col}>
            <LastSession />
            <PracticeReady />
            <div className={s.placeholder}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <span>Coming soon</span>
            </div>
          </div>
          <div className={s.col}>
            <ExploreClasses />
            <Messages />
          </div>
        </div>
      </main>
    </div>
  )
}
