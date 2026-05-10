import { motion } from 'framer-motion'
import s from './Globe3D.module.css'

export default function Globe3D() {
  return (
    <div className={s.wrap}>
      {/* Spinning colored sphere */}
      <motion.div
        className={s.sphere}
        animate={{ rotate: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
      >
        <div className={s.glass} />
        <div className={s.shadowInner} />
        {/* Latitude lines overlay */}
        <svg className={s.lines} viewBox="0 0 200 200" fill="none">
          {[40, 80, 100, 120, 160].map(y => (
            <line key={y} x1="0" y1={y} x2="200" y2={y}
              stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          ))}
          {[40, 80, 120, 160].map(x => (
            <line key={x} x1={x} y1="0" x2={x} y2="200"
              stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          ))}
        </svg>
      </motion.div>

      {/* Orbital ring 1 — lime, tilted */}
      <motion.svg
        className={s.orbit1}
        viewBox="0 0 340 110"
        fill="none"
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      >
        <ellipse cx="170" cy="55" rx="165" ry="48"
          stroke="rgba(196,245,71,0.38)" strokeWidth="1.4" strokeDasharray="6 4" />
      </motion.svg>

      {/* Orbital ring 2 — white, opposite tilt */}
      <motion.svg
        className={s.orbit2}
        viewBox="0 0 300 120"
        fill="none"
        animate={{ rotate: -360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <ellipse cx="150" cy="60" rx="140" ry="54"
          stroke="rgba(255,255,255,0.14)" strokeWidth="0.9" strokeDasharray="4 5" />
      </motion.svg>

      {/* Math badge */}
      <motion.div
        className={s.apiBadge}
        animate={{ boxShadow: ['0 4px 16px rgba(196,245,71,0.35)', '0 6px 28px rgba(196,245,71,0.72)', '0 4px 16px rgba(196,245,71,0.35)'] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        <motion.div
          className={s.apiRing}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        <span className={s.apiText}>Maths</span>
      </motion.div>
    </div>
  )
}
