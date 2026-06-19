import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import HeroBar            from '../components/HeroBar'
import AgentBrief         from '../components/AgentBrief'
import ConstellationCard  from '../components/ConstellationCard'
import LastSession        from '../components/LastSession'
import LearningGPS        from '../components/LearningGPS'
import s from './Dashboard.module.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const FADE_UP = (delay = 0) => ({
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0  },
  transition: { type: 'spring', stiffness: 90, damping: 20, delay },
})

export default function Dashboard() {
  const user     = useUser()
  const navigate = useNavigate()
  const data     = useStudentData(user)
  const uid      = user?.uid ?? ''

  return (
    <div className={s.shell}>
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
          <div className={s.world}>

            {/* ── Left column ── */}
            <div className={s.main}>

              <motion.div {...FADE_UP(0.05)}>
                <AgentBrief userId={uid} />
              </motion.div>

              <motion.div {...FADE_UP(0.18)}>
                <ConstellationCard userId={uid} />
              </motion.div>

              {data.lastSession && (
                <motion.div {...FADE_UP(0.28)}>
                  <LastSession session={data.lastSession} />
                </motion.div>
              )}
            </div>

            {/* ── Right sticky panel ── */}
            <div className={s.panel}>

              {/* Exam Help */}
              <motion.div {...FADE_UP(0.10)}>
                <div
                  className={s.examCard}
                  onClick={() => navigate('/prep')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate('/prep')}
                >
                  <div className={s.examTop}>
                    <span className={s.examBadge}>EXAM HELP</span>
                  </div>
                  <h3 className={s.examTitle}>
                    Let's find your gaps<br />before the exam does.
                  </h3>
                  <p className={s.examSub}>
                    Diagnosis → gap map → targeted practice → readiness score.
                  </p>
                  <button className={s.examBtn}>Start prep session →</button>
                </div>
              </motion.div>

              {/* Homework Help */}
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

              {/* Learning GPS */}
              <motion.div {...FADE_UP(0.26)}>
                <LearningGPS userId={uid} />
              </motion.div>

            </div>
          </div>
        )}
      </main>
    </div>
  )
}
