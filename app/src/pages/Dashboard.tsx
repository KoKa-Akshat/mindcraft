import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import HeroBar from '../components/HeroBar'
import Globe3D from '../components/Globe3D'
import s from './Dashboard.module.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const PARTICLES = [
  { x: 4,  y: 18, r: 2,   d: 0.0 }, { x: 14, y: 72, r: 1.5, d: 0.9 },
  { x: 27, y: 41, r: 1,   d: 1.7 }, { x: 44, y: 88, r: 2,   d: 2.5 },
  { x: 58, y: 12, r: 1.5, d: 0.4 }, { x: 71, y: 58, r: 1,   d: 3.3 },
  { x: 86, y: 28, r: 2,   d: 1.1 }, { x: 93, y: 82, r: 1,   d: 2.1 },
  { x: 11, y: 55, r: 1.5, d: 3.7 }, { x: 22, y: 93, r: 2,   d: 0.6 },
  { x: 38, y: 34, r: 1,   d: 2.8 }, { x: 53, y: 67, r: 1.5, d: 1.4 },
  { x: 68, y: 8,  r: 2,   d: 3.1 }, { x: 79, y: 49, r: 1,   d: 0.2 },
  { x: 97, y: 43, r: 1.5, d: 2.6 }, { x: 7,  y: 85, r: 1,   d: 1.9 },
  { x: 33, y: 10, r: 2,   d: 3.4 }, { x: 49, y: 96, r: 1.5, d: 1.0 },
  { x: 62, y: 37, r: 1,   d: 2.2 }, { x: 89, y: 20, r: 2,   d: 1.6 },
]

export default function Dashboard() {
  const user     = useUser()
  const navigate = useNavigate()
  const data     = useStudentData(user)

  const hwDone  = data.homework?.problems.filter(p => p.done).length ?? 0
  const hwTotal = data.homework?.problems.length ?? 0

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
          <div className={s.scene}>
            <div className={s.particles} aria-hidden>
              {PARTICLES.map((p, i) => (
                <motion.div
                  key={i}
                  className={s.dot}
                  style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.r, height: p.r }}
                  animate={{ opacity: [0.08, 0.55, 0.08], scale: [1, 1.6, 1] }}
                  transition={{ duration: 3.5 + p.d, repeat: Infinity, ease: 'easeInOut', delay: p.d }}
                />
              ))}
            </div>

            <motion.div
              className={s.hero}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.08 }}
            >
              <div className={s.heroText}>
                <div className={s.heroBrand}>
                  <span className={s.brandStar}>✦</span>
                  <span className={s.brandLabel}>exam help</span>
                </div>

                <h1 className={s.heroTitle}>Tell us what<br />feels messy.</h1>
                <p className={s.heroSub}>We turn it into one clear practice plan.</p>

                <motion.button
                  className={s.heroBtn}
                  onClick={() => navigate('/practice', { state: { examHelp: true } })}
                  whileHover={{ scale: 1.05, boxShadow: '0 12px 40px rgba(196,245,71,0.68)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  Exam Help
                </motion.button>

                <p className={s.heroMeta}>Adaptive AI · Personalised for your exam</p>
              </div>

              <Globe3D />
            </motion.div>

            <div className={s.floatStack}>
              <div className={s.floatAOuter}>
                <motion.div
                  className={s.floatA}
                  initial={{ opacity: 0, y: 36 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 75, damping: 16, delay: 0.22 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => navigate('/practice', { state: { homeworkHelp: true } })}
                >
                  <div className={s.floatDot} />
                  <h2 className={s.floatTitle}>Homework<br />Help.</h2>
                  <p className={s.floatSub}>Step-by-step problem support</p>
                  <div className={s.floatFooter}>
                    <span className={s.aiTagSm}>Turn questions into clear next moves</span>
                  </div>
                </motion.div>
              </div>

              <div className={s.floatBOuter}>
                <motion.div
                  className={`${s.floatB} ${s.floatDisabled}`}
                  initial={{ opacity: 0, y: 36 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 75, damping: 16, delay: 0.38 }}
                >
                  <div className={s.floatDot} />
                  <h2 className={s.floatTitle}>This Week's<br />Problems</h2>
                  {hwTotal > 0 && (
                    <p className={s.floatSub}>{hwDone}/{hwTotal} complete</p>
                  )}
                  <div className={s.floatBottom}>
                    <motion.div
                      className={s.heartBtn}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.88 }}
                    >♡</motion.div>
                    <span className={s.xpTag}>① {data.practiceCount ?? 0}</span>
                  </div>
                </motion.div>
              </div>
            </div>

            <svg className={s.connector} viewBox="0 0 150 480" fill="none" aria-hidden>
              <path d="M8 12 C 75 120, 55 360, 142 468"
                stroke="rgba(255,255,255,0.055)" strokeWidth="1.2" strokeDasharray="5 5" />
            </svg>
          </div>
        )}
      </main>
    </div>
  )
}
