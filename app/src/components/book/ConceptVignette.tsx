/**
 * ConceptVignette — small animated line-art for a math concept, drawn in the
 * same gentle floating style as the login page art. Pure SVG + CSS, no deps.
 * Used on the dashboard explore cards; degrades to a static drawing when the
 * user prefers reduced motion (handled in CSS).
 */
import s from './ConceptVignette.module.css'

export type VignetteId =
  | 'quadratic_equations'
  | 'trigonometry_basics'
  | 'descriptive_statistics'
  | 'linear_equations'
  | 'logarithmic_functions'
  | 'basic_probability'

const STROKE = 'rgba(255,255,255,0.82)'
const FAINT = 'rgba(255,255,255,0.28)'

function Axes() {
  return (
    <>
      <line x1="10" y1="66" x2="110" y2="66" stroke={FAINT} strokeWidth="1" />
      <line x1="18" y1="8" x2="18" y2="72" stroke={FAINT} strokeWidth="1" />
    </>
  )
}

export default function ConceptVignette({ id }: { id: string }) {
  switch (id as VignetteId) {
    case 'quadratic_equations':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <Axes />
          <path
            className={s.draw}
            d="M24 18 Q60 118 96 14"
            stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round"
          />
          <circle className={s.pulse} cx="60" cy="67" r="3" fill={STROKE} />
        </svg>
      )
    case 'trigonometry_basics':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <line x1="10" y1="40" x2="110" y2="40" stroke={FAINT} strokeWidth="1" />
          <path
            className={s.draw}
            d="M12 40 Q24 8 36 40 T60 40 T84 40 T108 40"
            stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round"
          />
          <circle className={s.rider} cx="0" cy="0" r="3" fill={STROKE}>
            <animateMotion
              dur="5s" repeatCount="indefinite"
              path="M12 40 Q24 8 36 40 T60 40 T84 40 T108 40"
            />
          </circle>
        </svg>
      )
    case 'descriptive_statistics':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <Axes />
          <rect className={`${s.bar} ${s.bar1}`} x="30" y="48" width="10" height="18" rx="2" fill={FAINT} />
          <rect className={`${s.bar} ${s.bar2}`} x="46" y="34" width="10" height="32" rx="2" fill={FAINT} />
          <rect className={`${s.bar} ${s.bar3}`} x="62" y="24" width="10" height="42" rx="2" fill={FAINT} />
          <rect className={`${s.bar} ${s.bar4}`} x="78" y="42" width="10" height="24" rx="2" fill={FAINT} />
          <path
            className={s.draw}
            d="M24 62 Q45 60 60 26 Q75 60 100 62"
            stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round"
          />
        </svg>
      )
    case 'linear_equations':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <line x1="10" y1="52" x2="110" y2="52" stroke={FAINT} strokeWidth="1" />
          <line x1="40" y1="8" x2="40" y2="72" stroke={FAINT} strokeWidth="1" />
          <path
            className={s.draw}
            d="M16 70 L104 14"
            stroke={STROKE} strokeWidth="2" strokeLinecap="round"
          />
          <circle className={s.pulse} cx="40" cy="55" r="3" fill={STROKE} />
        </svg>
      )
    case 'logarithmic_functions':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <Axes />
          <path
            className={s.draw}
            d="M22 74 Q26 30 44 22 Q70 12 106 10"
            stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round"
          />
        </svg>
      )
    case 'basic_probability':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <rect x="26" y="22" width="30" height="30" rx="7" stroke={STROKE} strokeWidth="1.6" fill="none" />
            <circle cx="35" cy="31" r="2.6" fill={STROKE} />
            <circle cx="47" cy="43" r="2.6" fill={STROKE} />
          </g>
          <g className={s.floatFast}>
            <rect x="66" y="30" width="30" height="30" rx="7" stroke={STROKE} strokeWidth="1.6" fill="none" />
            <circle cx="75" cy="39" r="2.6" fill={STROKE} />
            <circle cx="81" cy="45" r="2.6" fill={STROKE} />
            <circle cx="87" cy="51" r="2.6" fill={STROKE} />
          </g>
        </svg>
      )
    default:
      return null
  }
}
