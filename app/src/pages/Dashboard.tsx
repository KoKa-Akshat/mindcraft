import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { isDiagnosticComplete } from '../lib/practiceState'
import { worldUrl } from '../lib/siteUrls'
import HeroBar            from '../components/HeroBar'
import ConstellationCard  from '../components/ConstellationCard'
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
function ViewToggle({ onPick3D }: { onPick3D: () => void }) {
  const base = {
    fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8,
    border: 'none',
  } as const
  return (
    <div style={{
      display: 'flex', gap: 4, alignSelf: 'flex-end', margin: '0 0 12px',
      padding: 4, borderRadius: 10, background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.08)', width: 'fit-content',
    }}>
      <button onClick={onPick3D}
        style={{ ...base, background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
        3D
      </button>
      <button disabled
        style={{ ...base, background: '#C4F547', color: '#10231a', cursor: 'default' }}>
        Web
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
        />

        {(!diagChecked || data.loading) ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <>
            <ViewToggle onPick3D={goTo3DWorld} />

            <div className={s.world}>
              {/* Left column */}
              <div className={s.main}>
                <motion.div {...FADE_UP(0.18)}>
                  <ConstellationCard userId={uid} />
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

                <motion.div {...FADE_UP(0.34)}>
                  <div
                    className={s.hwCard}
                    onClick={() => navigate('/knowledge-graph')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate('/knowledge-graph')}
                  >
                    <div className={s.hwTop}>
                      <span className={s.hwIcon}>◈</span>
                      <span className={s.hwLabel}>Knowledge Graph</span>
                    </div>
                    <p className={s.hwSub}>
                      See how every concept connects — mastery and strength across your whole map.
                    </p>
                    <div className={s.hwRow}>
                      <span className={s.hwCta}>Open graph →</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
