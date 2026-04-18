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
import Jarvis from '../components/Jarvis'
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
          right={
            <Jarvis
              heroMode
              wakeWordEnabled={true}
              userName={data.displayName}
              tutorId={data.tutorId}
              userId={user.uid}
              context={`Last session: ${data.lastSession ? `${data.lastSession.subject} on ${data.lastSession.date}` : 'none'}. Practice problems ready: ${data.practiceCount}. Next session: ${data.nextSession ? `${data.nextSession.subject} at ${data.nextSession.time}` : 'none scheduled'}.`}
            />
          }
        />
        {data.loading ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <div className={s.grid}>
            <LastSession session={data.lastSession} />
            <div className={s.placeholder} />
            <PracticeReady count={data.practiceCount} session={data.lastSession} />
            <div className={s.exploreWrap}>
              <ExploreClasses />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
