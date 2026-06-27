import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { isDiagnosticComplete } from '../lib/practiceState'
import { worldUrl } from '../lib/siteUrls'
import HeroBar            from '../components/HeroBar'
import Globe3D            from '../components/Globe3D'
import ConstellationCard  from '../components/ConstellationCard'
import LearningGPS        from '../components/LearningGPS'
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

type DashView = '3d' | 'web'

/** Segmented toggle between the immersive 3D dashboard and the plain web/card
 *  dashboard. Choice persists across visits. */
function ViewToggle({ view, onChange }: { view: DashView; onChange: (v: DashView) => void }) {
  const btn = (v: DashView, label: string) => (
    <button
      onClick={() => onChange(v)}
      style={{
        fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: 'none',
        cursor: 'pointer',
        background: view === v ? '#C4F547' : 'transparent',
        color: view === v ? '#10231a' : 'rgba(255,255,255,0.7)',
      }}
    >{label}</button>
  )
  return (
    <div style={{
      display: 'flex', gap: 4, alignSelf: 'flex-end', margin: '0 0 12px',
      padding: 4, borderRadius: 10, background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.08)', width: 'fit-content',
    }}>
      {btn('3d', '3D')}
      {btn('web', 'Web')}
    </div>
  )
}

export default function Dashboard() {
  const user     = useUser()
  const navigate = useNavigate()
  const data     = useStudentData(user)
  const uid      = user?.uid ?? ''

  const [view, setView] = useState<DashView>(
    () => (localStorage.getItem('dashboardView') as DashView) || '3d',
  )
  function chooseView(v: DashView) {
    setView(v)
    localStorage.setItem('dashboardView', v)
  }

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

  // ── Immersive 3D layout (Globe3D hero + floating cards) ──
  const view3D = (
    <>
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
          transition={{ type: 'spring' as const, stiffness: 80, damping: 18, delay: 0.08 }}
        >
          <div className={s.heroText}>
            <div className={s.heroBrand}>
              <span className={s.brandStar}>✦</span>
              <span className={s.brandLabel}>exam help</span>
            </div>

            <h1 className={s.heroTitle}>Let's ace<br />this exam.</h1>
            <p className={s.heroSub}>Smart practice for the topics that matter next.</p>

            <motion.button
              className={s.heroBtn}
              onClick={() => { window.location.href = worldUrl(uid) }}
              whileHover={{ scale: 1.05, boxShadow: '0 12px 40px rgba(196,245,71,0.68)' }}
              whileTap={{ scale: 0.97 }}
            >
              Enter Nox's Kitchen
            </motion.button>
            <motion.button
              className={s.heroBtnSecondary}
              onClick={() => navigate('/prep')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Practice mode
            </motion.button>
          </div>

          <Globe3D />
        </motion.div>

        <div className={s.floatStack}>
          <div className={s.floatAOuter}>
            <motion.div
              className={s.floatA}
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring' as const, stiffness: 75, damping: 16, delay: 0.22 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/practice', { state: { homeworkHelp: true } })}
            >
              <div className={s.floatDot} />
              <h2 className={s.floatTitle}>Homework<br />Help.</h2>
              <p className={s.floatSub}>You can totally do it.</p>
            </motion.div>
          </div>

          <div className={s.floatBOuter}>
            <motion.div
              className={s.floatB}
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring' as const, stiffness: 75, damping: 16, delay: 0.38 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/knowledge-graph')}
            >
              <div className={s.floatDot} />
              <h2 className={s.floatTitle}>Learning<br />GPS</h2>
              <p className={s.floatSub}>We navigate rough equations for you.</p>
              <div className={s.floatBottom}>
                <motion.div
                  className={s.heartBtn}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.88 }}
                >⌖</motion.div>
                <span className={s.xpTag}>Open</span>
              </div>
            </motion.div>
          </div>
        </div>

        <svg className={s.connector} viewBox="0 0 150 480" fill="none" aria-hidden>
          <path d="M8 12 C 75 120, 55 360, 142 468"
            stroke="rgba(255,255,255,0.055)" strokeWidth="1.2" strokeDasharray="5 5" />
        </svg>
      </div>

      <div className={s.bottomRow}>
        <ConstellationCard userId={uid} />
        <LearningGPS userId={uid} />
      </div>
    </>
  )

  // ── Plain web/card layout (left feed + right action panel) ──
  const viewWeb = (
    <div className={s.world}>
      {/* Left column */}
      <div className={s.main}>
        <motion.div {...FADE_UP(0.18)}>
          <ConstellationCard userId={uid} />
        </motion.div>
      </div>

      {/* Right sticky panel */}
      <div className={s.panel}>
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

        <motion.div {...FADE_UP(0.26)}>
          <LearningGPS userId={uid} />
        </motion.div>

        {/* Recommended Reinforcement (bridge + format gaps) */}
        <motion.div {...FADE_UP(0.30)}>
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
  )

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
            <ViewToggle view={view} onChange={chooseView} />
            {view === '3d' ? view3D : viewWeb}
          </>
        )}
      </main>
    </div>
  )
}
