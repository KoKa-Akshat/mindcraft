import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { isDiagnosticComplete } from '../lib/practiceState'
import { worldUrl } from '../lib/siteUrls'
import HeroBar            from '../components/HeroBar'
import PracticeHubPanel   from '../components/PracticeHubPanel'
import ReinforcePanel     from '../components/ReinforceCard'
import s from './Dashboard.module.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const FADE_UP = (delay = 0) => ({
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0  },
  transition: { type: 'spring' as const, stiffness: 90, damping: 20, delay },
})

/** "3D" leaves for the immersive world (Nox's Kitchen, mindcraft-world1.web.app);
 *  "Web" is this card dashboard. The world has the mirror toggle back here. */
function ViewToggle({ onPick3D, onBooking }: { onPick3D: () => void; onBooking: () => void }) {
  return (
    <div className={s.topActions}>
      <div className={s.viewToggle} aria-label="Dashboard view switcher">
        <button className={s.toggleBtn} onClick={onPick3D}>
          3D
        </button>
        <button className={`${s.toggleBtn} ${s.toggleActive}`} disabled>
          Web
        </button>
      </div>
      <button className={s.bookingBtn} onClick={onBooking}>
        Booking
      </button>
    </div>
  )
}

export default function Dashboard() {
  const user     = useUser()
  const navigate = useNavigate()
  const data     = useStudentData(user)
  const uid      = user?.uid ?? ''

  // "3D" = the immersive world; "Web" = these cards. Remember web as the last
  // in-app choice; the 3D button leaves the app entirely for the world.
  function goTo3DWorld() {
    localStorage.setItem('dashboardView', '3d')
    window.location.href = worldUrl(uid)
  }
  useEffect(() => { localStorage.setItem('dashboardView', 'web') }, [])

  // Diagnostic-first: a student who hasn't done the gap-scan is sent through it
  // before the dashboard. `diagChecked` stays false (showing the loader) until
  // we know, so the dashboard never flashes before a redirect.
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
          showUserControls={false}
        />

        {(!diagChecked || data.loading) ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <>
            <ViewToggle onPick3D={goTo3DWorld} onBooking={() => navigate('/book')} />

            <div className={s.world}>
              {/* Left column */}
              <div className={s.main}>
                <motion.div {...FADE_UP(0.18)} className={s.labRow}>
                  <button
                    type="button"
                    className={s.labSquare}
                    onClick={() => navigate('/constellation-gps-lab')}
                    aria-label="Open Constellation GPS lab experiment"
                  >
                    <span className={s.labSquareBadge}>Lab</span>
                    <span className={s.labSquareIcon}>⌖</span>
                    <span className={s.labSquareTitle}>GPS × Map</span>
                    <span className={s.labSquareSub}>Tap to experiment</span>
                  </button>
                </motion.div>
              </div>

              {/* Right panel */}
              <div className={s.panel}>
                <motion.div {...FADE_UP(0.10)}>
                  <PracticeHubPanel userId={uid} />
                </motion.div>

                <motion.div {...FADE_UP(0.18)}>
                  <div
                    className={s.hwCard}
                    onClick={() => navigate('/practice', { state: { homeworkHelp: true } })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate('/practice', { state: { homeworkHelp: true } })}
                  >
                    <div className={s.hwTop}>
                      <span className={s.hwIcon}>◎</span>
                      <span className={s.hwLabel}>Homework Help</span>
                    </div>
                    <p className={s.hwSub}>
                      Stuck on a problem? Describe it and get Socratic hints — no answers, just the next step.
                    </p>
                    <div className={s.hwRow}>
                      <span className={s.hwCta}>Get a hint →</span>
                    </div>
                  </div>
                </motion.div>

                {/* Recommended Reinforcement (bridge + format gaps) */}
                <motion.div {...FADE_UP(0.26)}>
                  <ReinforcePanel userId={uid} />
                </motion.div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
