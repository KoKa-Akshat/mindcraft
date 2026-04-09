import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import HeroBar from '../components/HeroBar'
import LastSession from '../components/LastSession'
import PracticeReady from '../components/PracticeReady'
import ExploreClasses from '../components/ExploreClasses'
import Messages from '../components/Messages'
import s from './Dashboard.module.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const user = useUser()
  const navigate = useNavigate()
  const data = useStudentData(user)

  return (
    <div className={s.shell}>
      <Navbar
        user={user}
        onSignOut={() => signOut(auth).then(() => navigate('/login', { replace: true }))}
      />
      <Sidebar />
      <main className={s.page}>
        <HeroBar
          greeting={greeting()}
          name={data.displayName}
          nextSession={data.nextSession}
          tutorId={data.tutorId}
        />
        {data.loading ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <div className={s.grid}>
            <div className={s.col}>
              <LastSession session={data.lastSession} />
              <PracticeReady count={data.practiceCount} session={data.lastSession} />
              <div className={s.placeholder}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                <span>Coming soon</span>
              </div>
            </div>
            <div className={s.col}>
              <ExploreClasses />
              <Messages messages={data.messages} tutorId={data.tutorId} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
