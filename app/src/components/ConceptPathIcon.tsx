import type { ReactNode } from 'react'

const STROKE = '#54b948'
const FILL = 'rgba(84, 185, 72, 0.15)'

function Svg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {children}
    </svg>
  )
}

/** Simple path icons — green stroke on dark tile, one per concept id. */
export function ConceptPathIcon({ conceptId, size = 40 }: { conceptId: string; size?: number }) {
  const icons: Record<string, ReactNode> = {
    linear_equations: (
      <Svg size={size}>
        <rect x="4" y="28" width="32" height="2" rx="1" fill={STROKE} opacity="0.4" />
        <path d="M6 32 L34 8" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="28" cy="12" r="3" fill={FILL} stroke={STROKE} strokeWidth="1.5" />
      </Svg>
    ),
    linear_inequalities: (
      <Svg size={size}>
        <path d="M8 20 L32 20" stroke={STROKE} strokeWidth="2" />
        <path d="M22 14 L28 20 L22 26" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
        <path d="M12 14 L18 20 L12 26" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    absolute_value: (
      <Svg size={size}>
        <path d="M10 28 L20 10 L30 28" fill="none" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      </Svg>
    ),
    systems_of_linear_equations: (
      <Svg size={size}>
        <path d="M12 10 L12 30 M28 10 L28 30" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
        <path d="M8 16 L32 16 M8 24 L32 24" stroke={STROKE} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      </Svg>
    ),
    exponent_rules: (
      <Svg size={size}>
        <text x="8" y="26" fill={STROKE} fontSize="16" fontWeight="800" fontFamily="system-ui">a</text>
        <text x="22" y="18" fill="#c4f547" fontSize="11" fontWeight="800" fontFamily="system-ui">x</text>
      </Svg>
    ),
    radical_expressions: (
      <Svg size={size}>
        <path d="M10 26 L14 26 L18 12 L22 28 L26 20 L30 20" fill="none" stroke={STROKE} strokeWidth="2.2" strokeLinejoin="round" />
      </Svg>
    ),
    polynomials: (
      <Svg size={size}>
        <path d="M6 24 C12 8, 18 32, 24 16 S36 28, 34 12" fill="none" stroke={STROKE} strokeWidth="2.2" strokeLinecap="round" />
      </Svg>
    ),
    factoring_polynomials: (
      <Svg size={size}>
        <path d="M10 20 L16 20 M24 20 L30 20" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
        <path d="M13 14 L13 26 M27 14 L27 26" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    quadratic_equations: (
      <Svg size={size}>
        <path d="M8 28 Q20 6 32 28" fill="none" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="8" y1="28" x2="32" y2="28" stroke={STROKE} strokeWidth="1.5" opacity="0.35" />
      </Svg>
    ),
    complex_numbers: (
      <Svg size={size}>
        <circle cx="20" cy="20" r="11" fill={FILL} stroke={STROKE} strokeWidth="1.5" />
        <text x="20" y="25" textAnchor="middle" fill={STROKE} fontSize="14" fontWeight="800" fontFamily="system-ui">i</text>
      </Svg>
    ),
    rational_expressions: (
      <Svg size={size}>
        <rect x="10" y="12" width="20" height="8" rx="2" fill="none" stroke={STROKE} strokeWidth="1.8" />
        <rect x="10" y="22" width="20" height="8" rx="2" fill="none" stroke={STROKE} strokeWidth="1.8" />
        <line x1="10" y1="20" x2="30" y2="20" stroke={STROKE} strokeWidth="2" />
      </Svg>
    ),
    sequences_series: (
      <Svg size={size}>
        <text x="10" y="26" fill={STROKE} fontSize="18" fontWeight="800" fontFamily="system-ui">Σ</text>
        <path d="M24 28 L28 16 L32 28" fill="none" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    ),
    functions_basics: (
      <Svg size={size}>
        <text x="6" y="24" fill={STROKE} fontSize="13" fontWeight="800" fontFamily="system-ui">f(x)</text>
        <path d="M26 28 L26 12 L34 12" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    function_transformations: (
      <Svg size={size}>
        <rect x="8" y="14" width="10" height="10" rx="2" fill={FILL} stroke={STROKE} strokeWidth="1.5" />
        <path d="M20 19 L26 19" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
        <path d="M24 16 L28 19 L24 22" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
        <rect x="28" y="10" width="10" height="10" rx="2" fill="none" stroke={STROKE} strokeWidth="1.5" />
      </Svg>
    ),
    exponential_functions: (
      <Svg size={size}>
        <path d="M8 28 C10 28, 12 12, 32 10" fill="none" stroke={STROKE} strokeWidth="2.2" strokeLinecap="round" />
      </Svg>
    ),
    logarithmic_functions: (
      <Svg size={size}>
        <text x="7" y="26" fill={STROKE} fontSize="12" fontWeight="800" fontFamily="system-ui">log</text>
        <path d="M24 28 C26 20, 28 14, 34 10" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    lines_angles: (
      <Svg size={size}>
        <path d="M8 28 L32 28" stroke={STROKE} strokeWidth="2" />
        <path d="M8 28 L24 12" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
        <path d="M8 28 A16 16 0 0 1 24 12" fill="none" stroke={STROKE} strokeWidth="1.5" opacity="0.6" />
      </Svg>
    ),
    triangles_congruence: (
      <Svg size={size}>
        <path d="M20 8 L34 30 L6 30 Z" fill={FILL} stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
      </Svg>
    ),
    right_triangle_geometry: (
      <Svg size={size}>
        <path d="M10 30 L10 12 L32 30 Z" fill={FILL} stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
        <rect x="10" y="22" width="8" height="8" fill="none" stroke={STROKE} strokeWidth="1.2" />
      </Svg>
    ),
    coordinate_geometry: (
      <Svg size={size}>
        <path d="M8 32 L32 32 M20 8 L20 32" stroke={STROKE} strokeWidth="1.8" />
        <circle cx="26" cy="16" r="3" fill={FILL} stroke={STROKE} strokeWidth="1.5" />
      </Svg>
    ),
    circles_geometry: (
      <Svg size={size}>
        <circle cx="20" cy="20" r="12" fill={FILL} stroke={STROKE} strokeWidth="2" />
        <line x1="20" y1="20" x2="20" y2="8" stroke={STROKE} strokeWidth="1.5" />
        <line x1="20" y1="20" x2="30" y2="24" stroke={STROKE} strokeWidth="1.5" />
      </Svg>
    ),
    area_volume: (
      <Svg size={size}>
        <path d="M12 26 L20 10 L28 26 Z" fill="none" stroke={STROKE} strokeWidth="1.8" />
        <rect x="14" y="18" width="12" height="10" fill={FILL} stroke={STROKE} strokeWidth="1.8" />
      </Svg>
    ),
    geometric_transformations: (
      <Svg size={size}>
        <path d="M12 20 A8 8 0 1 1 20 12" fill="none" stroke={STROKE} strokeWidth="2" />
        <path d="M18 10 L22 12 L18 14" fill="none" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    ),
    trigonometry_basics: (
      <Svg size={size}>
        <path d="M6 24 C12 10, 18 30, 34 14" fill="none" stroke={STROKE} strokeWidth="2.2" strokeLinecap="round" />
      </Svg>
    ),
    trigonometric_identities: (
      <Svg size={size}>
        <text x="6" y="18" fill={STROKE} fontSize="10" fontWeight="800" fontFamily="system-ui">sin</text>
        <text x="6" y="30" fill={STROKE} fontSize="10" fontWeight="800" fontFamily="system-ui">cos</text>
        <path d="M24 14 L34 14 M24 26 L34 26" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    vectors: (
      <Svg size={size}>
        <path d="M10 28 L28 12" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M22 12 L28 12 L28 18" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    number_properties: (
      <Svg size={size}>
        <text x="20" y="26" textAnchor="middle" fill={STROKE} fontSize="16" fontWeight="800" fontFamily="system-ui">#</text>
      </Svg>
    ),
    word_problems: (
      <Svg size={size}>
        <path d="M10 12 H30 V28 H10 Z" fill={FILL} stroke={STROKE} strokeWidth="1.8" />
        <path d="M14 18 H26 M14 22 H22" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    ),
    percent_ratio: (
      <Svg size={size}>
        <text x="20" y="26" textAnchor="middle" fill={STROKE} fontSize="18" fontWeight="800" fontFamily="system-ui">%</text>
      </Svg>
    ),
    descriptive_statistics: (
      <Svg size={size}>
        <rect x="10" y="22" width="5" height="8" fill={STROKE} opacity="0.5" />
        <rect x="18" y="16" width="5" height="14" fill={STROKE} opacity="0.7" />
        <rect x="26" y="10" width="5" height="20" fill={STROKE} />
      </Svg>
    ),
    statistics_graphs: (
      <Svg size={size}>
        <path d="M8 28 L14 18 L20 24 L26 12 L32 20" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    data_interpretation: (
      <Svg size={size}>
        <rect x="10" y="10" width="20" height="20" rx="2" fill={FILL} stroke={STROKE} strokeWidth="1.5" />
        <path d="M14 16 H26 M14 20 H26 M14 24 H22" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    ),
    basic_probability: (
      <Svg size={size}>
        <rect x="10" y="10" width="20" height="20" rx="4" fill={FILL} stroke={STROKE} strokeWidth="1.8" />
        <circle cx="15" cy="15" r="1.5" fill={STROKE} />
        <circle cx="25" cy="25" r="1.5" fill={STROKE} />
        <circle cx="25" cy="15" r="1.5" fill={STROKE} />
        <circle cx="15" cy="25" r="1.5" fill={STROKE} />
      </Svg>
    ),
    limits_continuity: (
      <Svg size={size}>
        <text x="6" y="18" fill={STROKE} fontSize="10" fontWeight="800" fontFamily="system-ui">lim</text>
        <path d="M8 26 C14 26, 18 14, 32 14" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
        <circle cx="18" cy="20" r="2" fill="none" stroke={STROKE} strokeWidth="1.5" />
      </Svg>
    ),
    derivatives: (
      <Svg size={size}>
        <text x="8" y="24" fill={STROKE} fontSize="14" fontWeight="800" fontFamily="system-ui">f′</text>
        <path d="M24 26 C26 14, 30 12, 34 22" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    applications_of_derivatives: (
      <Svg size={size}>
        <path d="M8 26 C14 10, 20 10, 26 26" fill="none" stroke={STROKE} strokeWidth="2.2" />
        <circle cx="20" cy="14" r="2.5" fill="#c4f547" stroke={STROKE} strokeWidth="1.2" />
      </Svg>
    ),
    integrals: (
      <Svg size={size}>
        <text x="10" y="28" fill={STROKE} fontSize="22" fontWeight="600" fontFamily="Georgia, serif">∫</text>
        <path d="M22 26 C24 12, 30 12, 32 26" fill={FILL} stroke={STROKE} strokeWidth="1.5" />
      </Svg>
    ),
    applications_of_integrals: (
      <Svg size={size}>
        <path d="M10 26 C14 14, 26 14, 30 26 Z" fill={FILL} stroke={STROKE} strokeWidth="1.8" />
        <text x="12" y="24" fill={STROKE} fontSize="16" fontWeight="600" fontFamily="Georgia, serif">∫</text>
      </Svg>
    ),
  }

  return (
    <span className="concept-path-icon">
      {icons[conceptId] ?? (
        <Svg size={size}>
          <circle cx="20" cy="20" r="12" fill={FILL} stroke={STROKE} strokeWidth="1.5" />
          <text x="20" y="25" textAnchor="middle" fill={STROKE} fontSize="12" fontWeight="700" fontFamily="system-ui">?</text>
        </Svg>
      )}
    </span>
  )
}
