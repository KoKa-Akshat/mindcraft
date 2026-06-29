import type { ReactNode } from 'react'

/** Simple path icons — green stroke on dark tile, one per concept id. */
export function ConceptPathIcon({ conceptId, size = 40 }: { conceptId: string; size?: number }) {
  const s = size
  const stroke = '#54b948'
  const fill = 'rgba(84, 185, 72, 0.15)'

  const icons: Record<string, ReactNode> = {
    linear_equations: (
      <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
        <rect x="4" y="28" width="32" height="2" rx="1" fill={stroke} opacity="0.4" />
        <path d="M6 32 L34 8" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="28" cy="12" r="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
      </svg>
    ),
    linear_inequalities: (
      <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
        <path d="M8 20 L32 20" stroke={stroke} strokeWidth="2" />
        <path d="M22 14 L28 20 L22 26" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <path d="M12 14 L18 20 L12 26" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    absolute_value: (
      <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
        <path d="M10 28 L20 10 L30 28" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    ),
    systems_of_linear_equations: (
      <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
        <path d="M12 10 L12 30 M28 10 L28 30" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <path d="M8 16 L32 16 M8 24 L32 24" stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      </svg>
    ),
    exponent_rules: (
      <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
        <text x="8" y="26" fill={stroke} fontSize="16" fontWeight="800" fontFamily="system-ui">a</text>
        <text x="22" y="18" fill="#c4f547" fontSize="11" fontWeight="800" fontFamily="system-ui">x</text>
      </svg>
    ),
    radical_expressions: (
      <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
        <path d="M10 26 L14 26 L18 12 L22 28 L26 20 L30 20" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    ),
  }

  return (
    <span className="concept-path-icon">
      {icons[conceptId] ?? (
        <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="12" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <text x="20" y="25" textAnchor="middle" fill={stroke} fontSize="14" fontWeight="700">?</text>
        </svg>
      )}
    </span>
  )
}
