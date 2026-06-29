import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { usePracticePathQueue } from '../lib/practicePathQueue'
import { isDiagnosticComplete } from '../lib/practiceState'
import { worldUrl } from '../lib/siteUrls'
import HeroBar from '../components/HeroBar'
import PawHub from '../components/PawHub'
import PracticeLearningPathMini from '../components/PracticeLearningPathMini'
import s from './Dashboard.module.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

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
  const user = useUser()
  const navigate = useNavigate()
  const data = useStudentData(user)
  const uid = user?.uid ?? ''
  const path = usePracticePathQueue(uid)

  const [diagChecked, setDiagChecked] = useState(false)

  function goTo3DWorld() {
    localStorage.setItem('dashboardView', '3d')
    const base = worldUrl(uid)
    window.location.href = diagChecked ? `${base}&diagDone=1` : base
  }

  useEffect(() => { localStorage.setItem('dashboardView', 'web') }, [])

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
          showBooking={diagChecked}
          onBooking={() => navigate('/book')}
        />

        {(!diagChecked || data.loading) ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <>
            <ViewToggle onPick3D={goTo3DWorld} />

            <div className={s.stage}>
              <div className={s.pawCol}>
                <motion.div
                  className={s.pawWrap}
                  initial={{ opacity: 0, x: -32 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 70, damping: 16 }}
                >
                  <PawHub userId={uid} layout="side" compact />
                </motion.div>
              </div>

              <div className={s.pathCol}>
                <PracticeLearningPathMini
                  concepts={path.pathConcepts}
                  activeConceptId={path.activeConceptId}
                  progressPct={path.progressPct}
                  completedCount={path.completedOnPath}
                  totalCount={path.pathQueue.length}
                  exam={path.exam}
                  loading={path.loading}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
