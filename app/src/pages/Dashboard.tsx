import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { isDiagnosticComplete } from '../lib/practiceState'
import { worldUrl } from '../lib/siteUrls'
import HeroBar from '../components/HeroBar'
import PawHub from '../components/PawHub'
import s from './Dashboard.module.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/** "3D" leaves for the immersive world; "Web" is this paw dashboard. */
function ViewToggle({ onPick3D }: { onPick3D: () => void }) {
  return (
    <div className={s.topActions}>
      <div className={s.viewToggle} aria-label="Dashboard view switcher">
        <button className={s.toggleBtn} onClick={onPick3D}>3D</button>
        <button className={`${s.toggleBtn} ${s.toggleActive}`} disabled>Web</button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user     = useUser()
  const navigate = useNavigate()
  const data     = useStudentData(user)
  const uid      = user?.uid ?? ''

  function goTo3DWorld() {
    localStorage.setItem('dashboardView', '3d')
    window.location.href = worldUrl(uid)
  }
  useEffect(() => { localStorage.setItem('dashboardView', 'web') }, [])

  const [diagChecked, setDiagChecked] = useState(false)
  useEffect(() => {
    let cancelled = false
    isDiagnosticComplete(user.uid).then(done => {
      if (cancelled) return
      if (!done) navigate('/practice', { state: { examHelp: true } })
      else setDiagChecked(true)
    })
    return () => { cancelled = true }
  }, [user.uid, navigate])

  return (
    <div className={s.shell}>
      <main className={s.page}>
        <HeroBar
          greeting={greeting()}
          name={data.displayName}
          nextSession={data.nextSession}
          tutorId={data.tutorId}
          showUserControls
          minimal
          showBooking
          onBooking={() => navigate('/book')}
        />

        {(!diagChecked || data.loading) ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <>
            <ViewToggle onPick3D={goTo3DWorld} />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.08 }}
            >
              <PawHub userId={uid} />
            </motion.div>
          </>
        )}
      </main>
    </div>
  )
}
