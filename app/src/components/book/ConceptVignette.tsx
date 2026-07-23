/**
 * ConceptVignette  -  small animated line-art for a math concept, drawn in the
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
  | 'derivatives'
  | 'integrals'
  | 'functions_basics'
  | 'exponential_functions'
  | 'systems_of_linear_equations'
  | 'right_triangle_geometry'
  | 'circles_geometry'
  | 'linear_inequalities'
  | 'factoring_polynomials'
  | 'matrices'
  | 'sequences_series'
  | 'geometric_transformations'
  | 'vectors'
  | 'complex_numbers'
  | 'conic_sections'
  | 'area_volume'
  | 'exponent_rules'
  | 'rational_expressions'

const STROKE = 'rgba(255,255,255,0.82)'
const FAINT = 'rgba(255,255,255,0.28)'
const MID = 'rgba(255,255,255,0.5)'

function Axes() {
  return (
    <>
      <line x1="10" y1="66" x2="110" y2="66" stroke={FAINT} strokeWidth="1" />
      <line x1="18" y1="8" x2="18" y2="72" stroke={FAINT} strokeWidth="1" />
    </>
  )
}

function CenteredAxes() {
  return (
    <>
      <line x1="10" y1="40" x2="110" y2="40" stroke={FAINT} strokeWidth="1" />
      <line x1="60" y1="6" x2="60" y2="74" stroke={FAINT} strokeWidth="1" />
    </>
  )
}

export default function ConceptVignette({ id }: { id: string }) {
  switch (id) {
    // ── Original 6 ──────────────────────────────────────────────────────
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
          <circle r="3" fill={STROKE}>
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

    // ── New: Calculus ────────────────────────────────────────────────────
    case 'derivatives':
      return (
        // Curve with a glowing tangent line kissing it at one point
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <CenteredAxes />
          {/* curve */}
          <path
            className={s.draw}
            d="M14 72 Q30 70 52 36 Q72 6 106 10"
            stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round"
          />
          {/* tangent line at ~(52,36) */}
          <line x1="28" y1="62" x2="78" y2="14" stroke={MID} strokeWidth="1.2" strokeDasharray="4 3" />
          <circle className={s.pulse} cx="52" cy="36" r="3.5" fill={STROKE} />
        </svg>
      )
    case 'integrals':
      return (
        // Integral sign with filled area under a curve
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <Axes />
          {/* filled region */}
          <path
            d="M30 66 Q50 20 90 66 Z"
            fill={FAINT}
          />
          {/* curve on top */}
          <path
            className={s.draw}
            d="M30 66 Q50 20 90 66"
            stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round"
          />
          {/* integral sign */}
          <text x="96" y="42" fontSize="28" fontFamily="serif" fill={MID} aria-hidden="true">∫</text>
        </svg>
      )
    case 'applications_of_derivatives':
    case 'applications_of_integrals':
      // Reuse calculus motifs with minor variation
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <CenteredAxes />
          <path className={s.draw} d="M14 58 Q38 8 60 38 Q82 68 106 22"
            stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle className={s.pulse} cx="60" cy="38" r="3" fill={STROKE} />
          <circle className={s.pulse} cx="38" cy="38" r="2" fill={MID} />
        </svg>
      )

    // ── New: Functions ───────────────────────────────────────────────────
    case 'functions_basics':
      return (
        // Arrow from domain dot → range dot, hinting at mapping
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <circle cx="28" cy="28" r="5" stroke={STROKE} strokeWidth="1.6" fill="none" />
            <circle cx="28" cy="52" r="5" stroke={STROKE} strokeWidth="1.6" fill="none" />
          </g>
          <g className={s.floatFast}>
            <circle cx="92" cy="40" r="5" stroke={MID} strokeWidth="1.6" fill="none" />
          </g>
          {/* mapping arrows */}
          <path className={s.draw} d="M36 28 Q60 28 84 40" stroke={STROKE} strokeWidth="1.6"
            fill="none" strokeLinecap="round" markerEnd="url(#arr)" />
          <path className={s.draw} d="M36 52 Q60 52 84 40" stroke={MID} strokeWidth="1.6"
            fill="none" strokeLinecap="round" />
          <defs>
            <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6" fill="none" stroke={STROKE} strokeWidth="1.2" />
            </marker>
          </defs>
        </svg>
      )
    case 'exponential_functions':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <Axes />
          <path
            className={s.draw}
            d="M16 68 Q28 64 42 54 Q60 36 80 16 Q90 8 106 4"
            stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round"
          />
          {/* doubling markers */}
          <circle className={s.pulse} cx="42" cy="54" r="2.5" fill={MID} />
          <circle className={s.pulse} cx="64" cy="30" r="2.5" fill={STROKE} />
        </svg>
      )
    case 'function_transformations':
      return (
        // Original curve (faint) and shifted curve (bright)
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <CenteredAxes />
          <path d="M18 52 Q60 -12 102 52" stroke={FAINT} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path className={s.draw} d="M28 68 Q70 4 112 68" stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      )

    // ── New: Algebra ─────────────────────────────────────────────────────
    case 'systems_of_linear_equations':
      return (
        // Two lines crossing at a point
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <CenteredAxes />
          <path className={s.draw} d="M12 16 L108 68" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
          <path className={s.draw} d="M12 68 L108 20" stroke={MID} strokeWidth="2" strokeLinecap="round" />
          <circle className={s.pulse} cx="60" cy="42" r="4" fill={STROKE} />
        </svg>
      )
    case 'linear_inequalities':
      return (
        // A line with shaded half-plane below it
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <CenteredAxes />
          <path d="M10 28 L110 56 L110 74 L10 74 Z" fill={FAINT} />
          <path className={s.draw} d="M10 28 L110 56" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
          <text x="72" y="70" fontSize="11" fill={MID} fontFamily="monospace">≤</text>
        </svg>
      )
    case 'factoring_polynomials':
      return (
        // Parabola with two visible roots
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <CenteredAxes />
          <path
            className={s.draw}
            d="M20 10 Q60 110 100 10"
            stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round"
          />
          <circle className={s.pulse} cx="31" cy="40" r="3.5" fill={STROKE} />
          <circle className={s.pulse} cx="89" cy="40" r="3.5" fill={STROKE} />
        </svg>
      )
    case 'algebraic_manipulation':
    case 'rational_expressions':
      return (
        // Balance scale  -  two pans in equilibrium
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            {/* beam */}
            <line x1="20" y1="36" x2="100" y2="36" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
            {/* pivot */}
            <polygon points="60,36 54,58 66,58" fill={FAINT} />
            {/* left pan */}
            <path d="M20 36 L14 52 L26 52 Z" fill="none" stroke={MID} strokeWidth="1.2" />
            {/* right pan */}
            <path d="M100 36 L94 52 L106 52 Z" fill="none" stroke={MID} strokeWidth="1.2" />
          </g>
        </svg>
      )
    case 'exponent_rules':
      return (
        // x^n with pulsing superscript feel
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <text x="18" y="62" fontSize="38" fontFamily="Georgia, serif" fill={STROKE} opacity="0.9">x</text>
            <text x="52" y="36" fontSize="22" fontFamily="Georgia, serif" fill={MID}>n</text>
          </g>
          {/* multiplication dots hinting repeated multiplication */}
          <circle className={s.pulse} cx="86" cy="42" r="3" fill={FAINT} />
          <circle className={s.pulse} cx="98" cy="42" r="3" fill={FAINT} />
          <circle className={s.pulse} cx="110" cy="42" r="3" fill={FAINT} />
        </svg>
      )
    case 'radical_expressions':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            {/* √ symbol */}
            <path d="M24 52 L34 62 L44 22 L100 22" stroke={STROKE} strokeWidth="2.2"
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x="52" y="46" fontSize="20" fontFamily="Georgia, serif" fill={MID}>x</text>
          </g>
        </svg>
      )
    case 'polynomials':
    case 'polynomial_operations':
      return (
        // Cubic curve  -  more interesting than a parabola
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <CenteredAxes />
          <path
            className={s.draw}
            d="M14 64 Q28 68 42 40 Q56 12 70 40 Q84 68 106 18"
            stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round"
          />
        </svg>
      )

    // ── New: Geometry ────────────────────────────────────────────────────
    case 'right_triangle_geometry':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <polygon
              points="20,68 96,68 96,16"
              stroke={STROKE} strokeWidth="1.8" fill="none"
            />
            {/* right angle marker */}
            <path d="M88 68 L88 60 L96 60" stroke={MID} strokeWidth="1.2" fill="none" />
            {/* hypotenuse label arc */}
            <path d="M24 62 Q58 34 90 20" stroke={FAINT} strokeWidth="1" strokeDasharray="3 3" fill="none" />
          </g>
        </svg>
      )
    case 'circles_geometry':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <circle cx="60" cy="40" r="28" stroke={STROKE} strokeWidth="1.8" fill="none" />
            {/* radius line */}
            <line x1="60" y1="40" x2="88" y2="40" stroke={MID} strokeWidth="1.4" />
            <circle cx="60" cy="40" r="2.5" fill={STROKE} />
            {/* arc label */}
            <text x="70" y="36" fontSize="9" fill={FAINT} fontFamily="monospace">r</text>
          </g>
        </svg>
      )
    case 'triangles_congruence':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <polygon points="28,68 68,14 68,68" stroke={STROKE} strokeWidth="1.8" fill="none" />
          </g>
          <g className={s.floatFast}>
            <polygon points="72,68 112,14 112,68" stroke={MID} strokeWidth="1.4" fill="none" />
          </g>
          {/* ≅ symbol */}
          <text x="44" y="44" fontSize="14" fill={FAINT} fontFamily="monospace">≅</text>
        </svg>
      )
    case 'geometric_transformations':
      return (
        // Shape echoes suggest translation/rotation
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <polygon points="14,62 30,22 46,62" stroke={FAINT} strokeWidth="1.4" fill="none" />
          <polygon
            className={s.draw}
            points="52,56 68,16 84,56"
            stroke={MID} strokeWidth="1.6" fill="none"
          />
          <polygon
            className={s.draw}
            points="84,52 96,22 108,52"
            stroke={STROKE} strokeWidth="1.8" fill="none"
          />
          {/* arrow of motion */}
          <path d="M50 36 L82 28" stroke={FAINT} strokeWidth="1" strokeDasharray="3 2" strokeLinecap="round" />
        </svg>
      )
    case 'area_volume':
      return (
        // Simple 3D box with perspective lines
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            {/* front face */}
            <rect x="22" y="36" width="50" height="36" stroke={STROKE} strokeWidth="1.6" fill="none" />
            {/* top face */}
            <path d="M22 36 L38 18 L88 18 L72 36 Z" stroke={STROKE} strokeWidth="1.6" fill="none" />
            {/* right face */}
            <path d="M72 36 L88 18 L88 54 L72 72 Z" stroke={MID} strokeWidth="1.4" fill="none" />
          </g>
        </svg>
      )
    case 'lines_angles':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            {/* two intersecting lines */}
            <line x1="14" y1="68" x2="106" y2="14" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
            <line x1="20" y1="14" x2="100" y2="68" stroke={MID} strokeWidth="1.6" strokeLinecap="round" />
            {/* angle arc */}
            <path d="M66 42 Q72 36 70 50" stroke={FAINT} strokeWidth="1.2" fill="none" />
            <text x="68" y="50" fontSize="9" fill={FAINT} fontFamily="monospace">θ</text>
          </g>
        </svg>
      )
    case 'conic_sections':
      return (
        // Ellipse with foci dots
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <ellipse cx="60" cy="40" rx="46" ry="28" stroke={STROKE} strokeWidth="1.8" fill="none" />
            <circle cx="38" cy="40" r="2.5" fill={MID} />
            <circle cx="82" cy="40" r="2.5" fill={MID} />
            <line x1="38" y1="40" x2="60" y2="14" stroke={FAINT} strokeWidth="1" strokeDasharray="3 2" />
            <line x1="82" y1="40" x2="60" y2="14" stroke={FAINT} strokeWidth="1" strokeDasharray="3 2" />
          </g>
        </svg>
      )

    // ── New: Number / Discrete ───────────────────────────────────────────
    case 'matrices':
      return (
        // 2×2 matrix bracket notation
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            {/* brackets */}
            <path d="M24 18 L18 18 L18 62 L24 62" stroke={STROKE} strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M96 18 L102 18 L102 62 L96 62" stroke={STROKE} strokeWidth="1.8" fill="none" strokeLinecap="round" />
            {/* entries */}
            <text x="32" y="38" fontSize="12" fill={STROKE} fontFamily="monospace">a</text>
            <text x="60" y="38" fontSize="12" fill={MID} fontFamily="monospace">b</text>
            <text x="32" y="58" fontSize="12" fill={MID} fontFamily="monospace">c</text>
            <text x="60" y="58" fontSize="12" fill={STROKE} fontFamily="monospace">d</text>
          </g>
        </svg>
      )
    case 'sequences_series':
      return (
        // Dots connected by arrows, growing
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          {[14, 34, 58, 86, 108].map((cx, i) => (
            <circle
              key={cx}
              className={s.pulse}
              cx={cx} cy={40} r={3 + i * 1.5}
              stroke={STROKE} strokeWidth="1.4" fill="none"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
          <path d="M18 40 L30 40 M38 40 L54 40 M62 40 L82 40 M90 40 L104 40"
            stroke={FAINT} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    case 'number_properties':
      return (
        // Number line with factor marks
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <line x1="12" y1="40" x2="108" y2="40" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
          {[12, 28, 44, 60, 76, 92, 108].map((x, i) => (
            <line key={x} x1={x} y1="34" x2={x} y2="46"
              stroke={i % 2 === 0 ? STROKE : FAINT} strokeWidth="1.4" />
          ))}
          <circle className={s.pulse} cx="44" cy="40" r="4" fill="none" stroke={MID} strokeWidth="1.4" />
          <circle className={s.pulse} cx="76" cy="40" r="4" fill="none" stroke={MID} strokeWidth="1.4" />
        </svg>
      )
    case 'complex_numbers':
      return (
        // Complex plane: one point at (a,b) with dotted lines to axes
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <CenteredAxes />
          {/* point */}
          <line x1="60" y1="24" x2="84" y2="24" stroke={FAINT} strokeWidth="1" strokeDasharray="3 2" />
          <line x1="84" y1="24" x2="84" y2="40" stroke={FAINT} strokeWidth="1" strokeDasharray="3 2" />
          <path className={s.draw} d="M60 40 L84 24" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
          <circle className={s.pulse} cx="84" cy="24" r="3.5" fill={STROKE} />
          <text x="86" y="22" fontSize="8" fill={MID} fontFamily="monospace">a+bi</text>
        </svg>
      )
    case 'vectors':
      return (
        // Two vectors showing addition (tip-to-tail)
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <defs>
              <marker id="vArr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0 0 L6 3 L0 6" fill="none" stroke={STROKE} strokeWidth="1.2" />
              </marker>
              <marker id="vArrMid" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0 0 L6 3 L0 6" fill="none" stroke={MID} strokeWidth="1.2" />
              </marker>
            </defs>
            <path d="M22 60 L58 24" stroke={STROKE} strokeWidth="1.8" markerEnd="url(#vArr)" />
            <path d="M58 24 L96 48" stroke={MID} strokeWidth="1.6" markerEnd="url(#vArrMid)" />
            <path d="M22 60 L96 48" stroke={FAINT} strokeWidth="1.2" strokeDasharray="4 3" />
          </g>
        </svg>
      )

    // ── New: Ratios / Data ───────────────────────────────────────────────
    case 'ratios_proportions':
    case 'percent_ratio':
      return (
        // Simple bar split into ratio
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <rect x="16" y="30" width="88" height="20" rx="4" stroke={FAINT} strokeWidth="1.2" fill="none" />
            <rect x="16" y="30" width="55" height="20" rx="4" fill={FAINT} />
            <line x1="71" y1="28" x2="71" y2="52" stroke={STROKE} strokeWidth="1.6" />
            <text x="28" y="44" fontSize="10" fill={STROKE} fontFamily="monospace">3</text>
            <text x="80" y="44" fontSize="10" fill={MID} fontFamily="monospace">2</text>
          </g>
        </svg>
      )
    case 'fractions_decimals':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <text x="38" y="36" fontSize="20" fontFamily="Georgia, serif" fill={STROKE}>3</text>
            <line x1="28" y1="44" x2="68" y2="44" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" />
            <text x="38" y="62" fontSize="20" fontFamily="Georgia, serif" fill={MID}>4</text>
            <text x="76" y="50" fontSize="20" fontFamily="Georgia, serif" fill={FAINT}>=</text>
            <text x="92" y="50" fontSize="14" fontFamily="monospace" fill={FAINT}>0.75</text>
          </g>
        </svg>
      )
    case 'order_of_operations':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            {/* PEMDAS hint: parentheses enclosing sub-expression */}
            <text x="8" y="52" fontSize="28" fontFamily="monospace" fill={STROKE}>(</text>
            <text x="24" y="48" fontSize="14" fontFamily="monospace" fill={MID}>2+3</text>
            <text x="66" y="52" fontSize="28" fontFamily="monospace" fill={STROKE}>)</text>
            <text x="78" y="44" fontSize="14" fontFamily="monospace" fill={FAINT}>×4</text>
          </g>
        </svg>
      )
    case 'measurement_units':
      return (
        // Ruler with unit marks
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <rect x="12" y="34" width="96" height="18" rx="3" stroke={STROKE} strokeWidth="1.4" fill="none" />
            {[12, 24, 36, 48, 60, 72, 84, 96, 108].map(x => (
              <line key={x} x1={x} y1="34" x2={x} y2={x % 48 === 12 ? "28" : "38"}
                stroke={x % 48 === 12 ? STROKE : FAINT} strokeWidth="1.2" />
            ))}
          </g>
        </svg>
      )
    case 'basic_equations':
      return (
        <svg className={s.vignette} viewBox="0 0 120 80" aria-hidden="true">
          <g className={s.floatSlow}>
            <text x="18" y="52" fontSize="24" fontFamily="Georgia, serif" fill={STROKE}>x</text>
            <text x="42" y="48" fontSize="16" fontFamily="monospace" fill={MID}>=</text>
            <text x="62" y="52" fontSize="24" fontFamily="Georgia, serif" fill={MID}>7</text>
          </g>
          <circle className={s.pulse} cx="26" cy="44" r="18" stroke={FAINT} strokeWidth="1" fill="none" />
        </svg>
      )

    default:
      return null
  }
}
