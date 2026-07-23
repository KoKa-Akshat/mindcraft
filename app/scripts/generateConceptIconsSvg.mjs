#!/usr/bin/env node
/**
 * generateConceptIconsSvg.mjs  -  icon-scale companion to generateConceptArtSvg.mjs.
 *
 * WHY THIS EXISTS: Akshat's complaint, verbatim  -  "why does fractions and
 * decimals have a pizza slice lmao" (`app/src/lib/actTopicEmojis.ts` hardcoded
 * one generic platform emoji per concept, e.g. a pizza pun for
 * fractions_decimals, unrelated to that concept's real story protagonist).
 * The dashboard TOC list and the Map both used those emoji as the ONLY visual
 * per concept, right next to real concept-locked art everywhere else in the
 * app  -  a jarring "one page in a different, silly notebook" moment.
 *
 * Fix: every icon here is NOT a mechanical scale-down of the full scene (a
 * full 800x800 scene has gradients/vignettes/multiple layers that turn to mud
 * at 24-34px). Each is a genuinely re-simplified small drawing of that SAME
 * concept's ONE bespoke metaphor prop from generateConceptArtSvg.mjs (the
 * balance scale for basic_equations, the rope-stretched 3-4-5 cord for
 * right_triangle_geometry, the chessboard doubling grains for exponent_rules,
 * Hippasus overboard for radical_expressions, the Alhambra tile repeat for
 * geometric_transformations, and so on)  -  reduced to its two or three most
 * legible strokes, sat on a small parchment badge, same ink/navy/gold palette.
 * fractions_decimals (no hand-authored SVG scene  -  it has the one real
 * Higgsfield photo instead) gets a NEW small icon invented for this pass:
 * Simon Stevin's ledger (a tally-marked ledger card + one gold coin), the
 * exact "pizza ≠ Stevin ledger" example Akshat used.
 *
 * Two bonus icons (act_strategy, representation_translation) cover the two
 * ACT_TOPIC_EMOJI entries that have no locked concept story at all (both are
 * cross-cutting Layer-1 tags with no TOC/Map appearance today per
 * actToc.ts's own comment  -  "no playable bank questions yet"  -  kept anyway so
 * the icon set is complete if that ever changes). Plus one generic `fallback`
 * badge (a compass rose) for any truly unlisted id  -  never hit by the current
 * TOC, a disclosed safety net rather than a silent mechanical one.
 *
 * Output: app/src/assets/canvas/generated/icon-{conceptId}.svg (64x64
 * viewBox). storyArt-style auto-discovery: `lib/conceptIcon.ts` picks these up
 * via import.meta.glob, same pattern as storyArt.ts.
 *
 * Usage:
 *   node app/scripts/generateConceptIconsSvg.mjs --list
 *   node app/scripts/generateConceptIconsSvg.mjs            # (re)generate all
 *   node app/scripts/generateConceptIconsSvg.mjs linear_equations
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(__dirname, '..')
const GENERATED_DIR = resolve(APP_ROOT, 'src/assets/canvas/generated')

// Same three-color family as generateConceptArtSvg.mjs (sampled from the one
// photoreal plate) so the tiny icons and the full chapter art read as the
// same notebook at any zoom level, not two competing systems.
const INK = '#33230f'
const PARCH_A = '#fbf3e2'
const PARCH_B = '#eddab3'
const NAVY = '#1d3a8a'
const GOLD = '#c99a3a'
const GOLD_LT = '#e7c877'

function badge(inner) {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="${PARCH_A}" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="30" fill="none" stroke="${PARCH_B}" stroke-width="1" opacity="0.6"/>
    <g transform="translate(32 32)">${inner}</g>
  </svg>\n`
}

// ── per-concept icons ─────────────────────────────────────────────────────
// Still parchment badges in the ink/navy/gold notebook palette, but each
// glyph must read as the MATH TOPIC at ~28–34px (Akshat: keep aesthetic +
// niche, make them more intuitive). Prefer classic textbook marks with one
// small craft flourish over opaque historical metaphors.
const ICONS = {

  fractions_decimals: () => badge(`
    <!-- classic fraction 3/4 with a decimal point flourish -->
    <text x="0" y="-6" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="700" fill="${NAVY}">3</text>
    <line x1="-10" y1="1" x2="10" y2="1" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    <text x="0" y="14" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="700" fill="${INK}">4</text>
    <circle cx="14" cy="-12" r="2.2" fill="${GOLD}"/>
  `),

  ratios_proportions: () => badge(`
    <!-- a : b ratio with a tiny balance cue -->
    <text x="-10" y="5" text-anchor="middle" font-family="Georgia, serif" font-size="16" font-weight="700" fill="${NAVY}">2</text>
    <circle cx="0" cy="-1" r="2.2" fill="${GOLD}"/>
    <circle cx="0" cy="6" r="2.2" fill="${GOLD}"/>
    <text x="11" y="5" text-anchor="middle" font-family="Georgia, serif" font-size="16" font-weight="700" fill="${INK}">5</text>
  `),

  order_of_operations: () => badge(`
    <!-- nested parentheses around × ÷ -->
    <text x="0" y="6" text-anchor="middle" font-family="Georgia, serif" font-size="20" font-weight="700" fill="${NAVY}">( )</text>
    <text x="0" y="2" text-anchor="middle" font-family="Georgia, serif" font-size="11" font-weight="700" fill="${GOLD}">×÷</text>
  `),

  basic_equations: () => badge(`
    <!-- balance scale = both sides equal -->
    <line x1="0" y1="-14" x2="0" y2="7" stroke="${INK}" stroke-width="2.4"/>
    <line x1="-16" y1="-10" x2="16" y2="-10" stroke="${INK}" stroke-width="2.2"/>
    <path d="M-21 -10 Q-16 2 -11 -10 Z" fill="${NAVY}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M11 -10 Q16 2 21 -10 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M-6 7 L6 7 L3 14 L-3 14 Z" fill="${PARCH_B}" stroke="${INK}" stroke-width="1.6"/>
    <text x="0" y="-14" text-anchor="middle" font-family="Georgia, serif" font-size="9" font-weight="700" fill="${INK}">=</text>
  `),

  number_properties: () => badge(`
    <!-- ± and a prime-ish 7 — number facts at a glance -->
    <text x="-8" y="4" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${NAVY}">±</text>
    <text x="10" y="6" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${GOLD}">7</text>
  `),

  measurement_units: () => badge(`
    <!-- clear ruler with tick marks -->
    <rect x="-18" y="-6" width="36" height="12" rx="2" fill="${PARCH_B}" stroke="${INK}" stroke-width="2"/>
    ${Array.from({ length: 7 }, (_, i) => `<line x1="${-15 + i * 5}" y1="-6" x2="${-15 + i * 5}" y2="${i % 2 === 0 ? 2 : -1}" stroke="${i === 3 ? NAVY : INK}" stroke-width="${i === 3 ? 2 : 1.3}"/>`).join('')}
    <text x="0" y="18" text-anchor="middle" font-family="Georgia, serif" font-size="8" font-weight="700" fill="${GOLD}">cm</text>
  `),

  algebraic_manipulation: () => badge(`
    <!-- x → y rearrange -->
    <text x="-12" y="5" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${NAVY}">x</text>
    <path d="M-4 0 h10" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M4 -4 L10 0 L4 4 Z" fill="${GOLD}"/>
    <text x="16" y="5" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${INK}">y</text>
  `),

  linear_equations: () => badge(`
    <!-- line on axes (y = mx + b), not a clock -->
    <path d="M-16 14 h30 M-14 14 v-28" fill="none" stroke="${INK}" stroke-width="1.7" opacity="0.55"/>
    <line x1="-14" y1="10" x2="16" y2="-12" stroke="${NAVY}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="4" cy="-2" r="2.4" fill="${GOLD}" stroke="${INK}" stroke-width="1"/>
  `),

  functions_basics: () => badge(`
    <!-- f(x) with a small in→out cue -->
    <text x="0" y="6" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="700" fill="${NAVY}">f(x)</text>
    <path d="M-18 -12 h8" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M-12 -15 L-8 -12 L-12 -9 Z" fill="${GOLD}"/>
  `),

  right_triangle_geometry: () => badge(`
    <!-- right triangle with square corner + hypotenuse -->
    <path d="M-15 12 L13 12 L13 -12 Z" fill="none" stroke="${NAVY}" stroke-width="2.4" stroke-linejoin="round"/>
    <rect x="6" y="5" width="7" height="7" fill="none" stroke="${GOLD}" stroke-width="1.6"/>
    <line x1="-15" y1="12" x2="13" y2="-12" stroke="${INK}" stroke-width="1.4" opacity="0.35"/>
  `),

  trigonometry_basics: () => badge(`
    <!-- right triangle + marked angle + opposite side -->
    <path d="M-14 12 L14 12 L14 -10 Z" fill="none" stroke="${INK}" stroke-width="2.2"/>
    <path d="M14 12 A8 8 0 0 0 8 5" fill="none" stroke="${GOLD}" stroke-width="2"/>
    <line x1="-14" y1="12" x2="14" y2="-10" stroke="${NAVY}" stroke-width="2" stroke-linecap="round"/>
  `),

  linear_inequalities: () => badge(`
    <!-- number line with open circle + ray -->
    <line x1="-18" y1="0" x2="18" y2="0" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="-4" cy="0" r="4" fill="${PARCH_A}" stroke="${NAVY}" stroke-width="2.2"/>
    <path d="M0 0 h14" stroke="${GOLD}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M12 -4 L18 0 L12 4 Z" fill="${GOLD}"/>
  `),

  systems_of_linear_equations: () => badge(`
    <!-- two crossing lines = one solution -->
    <path d="M-16 14 h30 M-14 14 v-28" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.4"/>
    <line x1="-14" y1="10" x2="14" y2="-10" stroke="${NAVY}" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="-14" y1="-8" x2="14" y2="12" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="0" cy="1" r="2.8" fill="${PARCH_A}" stroke="${INK}" stroke-width="1.6"/>
  `),

  exponent_rules: () => badge(`
    <!-- x² power notation -->
    <text x="-2" y="8" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700" fill="${NAVY}">x</text>
    <text x="12" y="-4" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-weight="700" fill="${GOLD}">2</text>
  `),

  polynomials: () => badge(`
    <!-- descending powers as bars + xⁿ cue -->
    <rect x="-14" y="-12" width="6" height="24" rx="1" fill="${NAVY}" opacity="0.9"/>
    <rect x="-4" y="-4" width="6" height="16" rx="1" fill="${GOLD}" opacity="0.9"/>
    <rect x="6" y="2" width="6" height="10" rx="1" fill="${PARCH_B}" stroke="${INK}" stroke-width="1.3"/>
    <line x1="-16" y1="12" x2="14" y2="12" stroke="${INK}" stroke-width="1.6"/>
  `),

  factoring_polynomials: () => badge(`
    <!-- (x+a)(x+b) area model, four clear panels -->
    <rect x="-15" y="-13" width="16" height="14" fill="${NAVY}" opacity="0.85"/>
    <rect x="3" y="-13" width="10" height="14" fill="${GOLD}" opacity="0.85"/>
    <rect x="-15" y="3" width="16" height="8" fill="${GOLD}" opacity="0.45"/>
    <rect x="3" y="3" width="10" height="8" fill="${PARCH_B}" stroke="${INK}" stroke-width="1.2"/>
    <rect x="-15" y="-13" width="28" height="24" fill="none" stroke="${INK}" stroke-width="1.8"/>
  `),

  radical_expressions: () => badge(`
    <!-- clean √x -->
    <path d="M-14 2 L-9 10 L-2 -12 L16 -12" fill="none" stroke="${NAVY}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="6" y="6" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-weight="700" fill="${GOLD}">x</text>
  `),

  quadratic_equations: () => badge(`
    <!-- upward parabola with vertex + roots -->
    <path d="M-16 14 h30 M-14 14 v-28" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.4"/>
    <path d="M-16 12 Q0 -16 16 12" fill="none" stroke="${NAVY}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="0" cy="-10" r="2.4" fill="${GOLD}"/>
    <circle cx="-12" cy="8" r="2" fill="${INK}"/><circle cx="12" cy="8" r="2" fill="${INK}"/>
  `),

  descriptive_statistics: () => badge(`
    <!-- bell curve over a histogram -->
    <path d="M-16 12 Q-16 -10 0 -12 Q16 -10 16 12" fill="none" stroke="${NAVY}" stroke-width="2.2"/>
    <rect x="-12" y="2" width="5" height="10" fill="${GOLD}" opacity="0.85"/>
    <rect x="-3" y="-4" width="5" height="16" fill="${NAVY}" opacity="0.75"/>
    <rect x="6" y="4" width="5" height="8" fill="${GOLD}" opacity="0.85"/>
    <line x1="-16" y1="12" x2="16" y2="12" stroke="${INK}" stroke-width="1.6"/>
  `),

  basic_probability: () => badge(`
    <!-- single clear die (chance) -->
    <rect x="-12" y="-12" width="24" height="24" rx="4" fill="${PARCH_B}" stroke="${INK}" stroke-width="2.2"/>
    <circle cx="-5" cy="-5" r="2" fill="${INK}"/>
    <circle cx="5" cy="-5" r="2" fill="${INK}"/>
    <circle cx="0" cy="0" r="2" fill="${GOLD}"/>
    <circle cx="-5" cy="5" r="2" fill="${INK}"/>
    <circle cx="5" cy="5" r="2" fill="${INK}"/>
  `),

  exponential_functions: () => badge(`
    <!-- sharp growth curve on axes -->
    <path d="M-16 14 h30 M-14 14 v-28" fill="none" stroke="${INK}" stroke-width="1.5" opacity="0.45"/>
    <path d="M-14 12 Q-2 10 4 -2 T16 -16" fill="none" stroke="${NAVY}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="16" cy="-16" r="2.4" fill="${GOLD}"/>
  `),

  sequences_series: () => badge(`
    <!-- 1 · 2 · 3 · … -->
    <text x="-12" y="5" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="700" fill="${NAVY}">1</text>
    <circle cx="-4" cy="1" r="1.4" fill="${GOLD}"/>
    <text x="2" y="5" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="700" fill="${INK}">2</text>
    <circle cx="9" cy="1" r="1.4" fill="${GOLD}"/>
    <text x="16" y="5" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="700" fill="${NAVY}">…</text>
  `),

  lines_angles: () => badge(`
    <!-- angle mark ∠ -->
    <line x1="-14" y1="12" x2="16" y2="12" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="-14" y1="12" x2="8" y2="-12" stroke="${NAVY}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-4 12 A12 12 0 0 1 0 2" fill="none" stroke="${GOLD}" stroke-width="2.2"/>
  `),

  triangles_congruence: () => badge(`
    <!-- two congruent triangles with tick marks -->
    <path d="M-16 10 L-2 10 L-9 -12 Z" fill="none" stroke="${NAVY}" stroke-width="2.2"/>
    <path d="M4 10 L18 10 L11 -12 Z" fill="none" stroke="${GOLD}" stroke-width="2.2"/>
    <line x1="-12" y1="4" x2="-9" y2="0" stroke="${INK}" stroke-width="1.6"/>
    <line x1="8" y1="4" x2="11" y2="0" stroke="${INK}" stroke-width="1.6"/>
  `),

  circles_geometry: () => badge(`
    <!-- circle with radius and π -->
    <circle r="14" fill="none" stroke="${NAVY}" stroke-width="2.4"/>
    <line x1="0" y1="0" x2="14" y2="0" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>
    <circle r="2" fill="${INK}"/>
    <text x="-4" y="6" text-anchor="middle" font-family="Georgia, serif" font-size="10" font-weight="700" fill="${INK}">π</text>
  `),

  area_volume: () => badge(`
    <!-- 3D box (volume) with a face tint (area) -->
    <path d="M-12 4 L0 -8 L14 -2 L2 10 Z" fill="${PARCH_B}" stroke="${INK}" stroke-width="1.6"/>
    <path d="M-12 4 L-12 14 L2 20 L2 10 Z" fill="${NAVY}" opacity="0.35" stroke="${INK}" stroke-width="1.6"/>
    <path d="M2 10 L2 20 L14 14 L14 -2 Z" fill="${GOLD}" opacity="0.45" stroke="${INK}" stroke-width="1.6"/>
  `),

  geometric_transformations: () => badge(`
    <!-- shape + rotate arrow (move / flip / turn) -->
    <path d="M-14 6 L-4 6 L-9 -10 Z" fill="none" stroke="${NAVY}" stroke-width="2.2"/>
    <path d="M4 8 L16 8 L10 -8 Z" fill="none" stroke="${GOLD}" stroke-width="2.2" transform="rotate(28 10 2)"/>
    <path d="M-2 -14 A16 16 0 0 1 14 -2" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="2 2"/>
    <path d="M12 -6 L14 -2 L10 -1 Z" fill="${INK}"/>
  `),

  act_strategy: () => badge(`
    <!-- test-day target -->
    <circle r="15" fill="none" stroke="${NAVY}" stroke-width="2"/>
    <circle r="9" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.6"/>
    <circle r="3" fill="${GOLD}"/>
    <path d="M-15 0 h-4 M19 0 h-4 M0 -15 v-4 M0 19 v-4" stroke="${INK}" stroke-width="1.6"/>
  `),

  representation_translation: () => badge(`
    <!-- table ↔ graph frames -->
    <rect x="-18" y="-10" width="13" height="16" rx="2" fill="none" stroke="${NAVY}" stroke-width="2"/>
    <line x1="-15" y1="-4" x2="-8" y2="-4" stroke="${NAVY}" stroke-width="1.2"/>
    <line x1="-15" y1="1" x2="-8" y2="1" stroke="${NAVY}" stroke-width="1.2"/>
    <rect x="5" y="-10" width="13" height="16" rx="2" fill="none" stroke="${GOLD}" stroke-width="2"/>
    <path d="M8 4 L14 -4" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M-3 -2 h5" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M0 -5 L4 -2 L0 1 Z" fill="${INK}"/>
  `),

  fallback: () => badge(`
    <circle r="13" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.5"/>
    <path d="M0 -13 L3 -3 L13 0 L3 3 L0 13 L-3 3 L-13 0 L-3 -3 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.4"/>
  `),
}

const CONCEPT_IDS = Object.keys(ICONS)

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--list')) {
    console.log(`${CONCEPT_IDS.length} hand-authored icon badges available:\n`)
    CONCEPT_IDS.forEach(id => console.log(' ', id))
    return
  }
  const targets = args.filter(a => !a.startsWith('--'))
  const toRun = targets.length ? targets : CONCEPT_IDS
  await mkdir(GENERATED_DIR, { recursive: true })
  for (const id of toRun) {
    if (!ICONS[id]) {
      console.log(`SKIP ${id}: no hand-authored icon defined`)
      continue
    }
    const svg = ICONS[id]()
    const outPath = resolve(GENERATED_DIR, `icon-${id}.svg`)
    await writeFile(outPath, svg)
    console.log(`Wrote ${outPath} (${(svg.length / 1024).toFixed(2)} KB)`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
