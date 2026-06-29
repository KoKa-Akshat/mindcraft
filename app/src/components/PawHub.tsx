import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchPracticeHubRecommendations, type NextConcept } from '../lib/recommendNextConcept'
import s from './PawHub.module.css'

// ── Icons ──────────────────────────────────────────────────────────────────

function WheelIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={s.iconSvg}>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <line key={deg}
          x1={16 + 2.4 * Math.cos((deg * Math.PI) / 180)}
          y1={16 + 2.4 * Math.sin((deg * Math.PI) / 180)}
          x2={16 + 11 * Math.cos((deg * Math.PI) / 180)}
          y2={16 + 11 * Math.sin((deg * Math.PI) / 180)}
          stroke="currentColor" strokeWidth="1.3"
        />
      ))}
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={s.iconSvg}>
      <path d="M8 24 L22 10 L24 12 L10 26 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M20 8 L24 12" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 24 L12 24 L8 28 Z" fill="currentColor" />
    </svg>
  )
}

function RevisionIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={s.iconSvg}>
      <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 7 V9 M16 23 V25 M7 16 H9 M23 16 H25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function GpsNotesIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={s.iconSvg}>
      <rect x="9" y="6" width="14" height="18" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12 H20 M12 16 H20 M12 20 H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="22" cy="22" r="4.5" fill="rgba(196,245,71,0.18)" stroke="rgba(196,245,71,0.7)" strokeWidth="1.2" />
      <circle cx="22" cy="22" r="1.5" fill="rgba(196,245,71,0.9)" />
    </svg>
  )
}

// ── Star backdrop ────────────────────────────────────────────────────────────

const STARS = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  cx: Math.round(10 + Math.random() * 80),
  cy: Math.round(5  + Math.random() * 90),
  r: Math.random() < 0.2 ? 1.4 : 0.7,
  op: 0.15 + Math.random() * 0.45,
}))

// ── Toe config ───────────────────────────────────────────────────────────────

interface Toe {
  id: string
  label: string
  sub: string
  icon: ReactNode
  accent: string      // CSS hex / rgba for glow
  // position as % of stage (center of toe bubble)
  x: string
  y: string
  onClick: () => void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PawHub({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [weakness, setWeakness] = useState<NextConcept | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  // Main pad center in % — used to draw SVG connector lines
  const PAD_CX = 50   // % from left
  const PAD_CY = 67   // % from top

  useEffect(() => {
    let cancelled = false
    void fetchPracticeHubRecommendations(userId).then(rec => {
      if (!cancelled) setWeakness(rec.weakness ?? rec.learn)
    })
    return () => { cancelled = true }
  }, [userId])

  const toes: Toe[] = [
    {
      id: 'homework',
      label: 'Homework Help',
      sub: 'Socratic hints',
      accent: '#38bdf8',
      x: '22%', y: '20%',
      icon: <PencilIcon />,
      onClick: () => navigate('/practice', { state: { homeworkHelp: true } }),
    },
    {
      id: 'revision',
      label: 'Revision',
      sub: weakness?.label ?? 'Weak spot',
      accent: '#a78bfa',
      x: '50%', y: '10%',
      icon: <RevisionIcon />,
      onClick: () => weakness
        ? navigate('/practice', { state: { conceptId: weakness.conceptId, missionType: 'weakness' } })
        : navigate('/practice'),
    },
    {
      id: 'gps-notes',
      label: 'GPS Notes',
      sub: 'Knowledge map',
      accent: '#c4f547',
      x: '78%', y: '20%',
      icon: <GpsNotesIcon />,
      onClick: () => navigate('/constellation-gps-lab'),
    },
  ]

  return (
    <div className={s.stage} ref={stageRef}>

      {/* Star backdrop */}
      <svg className={s.stars} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {STARS.map(st => (
          <circle key={st.id} cx={st.cx} cy={st.cy} r={st.r / 10} fill="white" fillOpacity={st.op} />
        ))}
      </svg>

      {/* Connector lines: toe → main pad center */}
      <svg className={s.connectors} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {toes.map(toe => (
          <line
            key={toe.id}
            x1={parseFloat(toe.x)} y1={parseFloat(toe.y) + 4}
            x2={PAD_CX} y2={PAD_CY - 12}
            stroke="rgba(196,245,71,0.12)"
            strokeWidth="0.35"
            strokeDasharray="1.2 1.8"
          />
        ))}
      </svg>

      {/* Toes */}
      {toes.map((toe, i) => (
        <motion.button
          key={toe.id}
          type="button"
          className={s.toe}
          style={{ left: toe.x, top: toe.y } as React.CSSProperties}
          onClick={toe.onClick}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.12 + i * 0.07 }}
          whileHover={{ y: -5, scale: 1.06 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className={s.toeIcon} style={{ color: toe.accent }}>{toe.icon}</span>
          <span className={s.toeLabel}>{toe.label}</span>
          <span className={s.toeSub}>{toe.sub}</span>
          {/* accent glow ring */}
          <span className={s.toeRing} style={{ boxShadow: `0 0 0 1.5px ${toe.accent}44, 0 0 22px ${toe.accent}22` }} />
        </motion.button>
      ))}

      {/* Main practice pad */}
      <motion.button
        type="button"
        className={s.mainPad}
        style={{ left: `${PAD_CX}%`, top: `${PAD_CY}%` } as React.CSSProperties}
        onClick={() => navigate('/practice')}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 24, delay: 0.05 }}
        whileHover={{ scale: 1.025 }}
        whileTap={{ scale: 0.975 }}
      >
        {/* glow layers */}
        <span className={s.mainGlow1} aria-hidden="true" />
        <span className={s.mainGlow2} aria-hidden="true" />

        <span className={s.mainIcon}><WheelIcon /></span>
        <span className={s.mainLabel}>Practice</span>

        {/* crosshair decoration bottom-right */}
        <svg className={s.crosshair} viewBox="0 0 20 20" aria-hidden="true">
          <line x1="10" y1="2" x2="10" y2="18" stroke="rgba(15,35,24,0.35)" strokeWidth="1.2" />
          <line x1="2"  y1="10" x2="18" y2="10" stroke="rgba(15,35,24,0.35)" strokeWidth="1.2" />
          <circle cx="10" cy="10" r="3" fill="none" stroke="rgba(15,35,24,0.35)" strokeWidth="1.2" />
        </svg>
      </motion.button>

      {/* outer orbit ring */}
      <div className={s.orbit} style={{ left: `${PAD_CX}%`, top: `${PAD_CY}%` }} aria-hidden="true" />
    </div>
  )
}
