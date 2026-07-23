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

// ── per-concept icons  -  ONE re-simplified detail from that concept's own
// hand-authored scene metaphor, not a scaled-down copy of the whole scene ──
const ICONS = {

  fractions_decimals: () => badge(`
    <!-- Simon Stevin's ledger: a tally-marked account card + one gold coin -->
    <rect x="-15" y="-13" width="30" height="26" rx="2" fill="${PARCH_B}" stroke="${INK}" stroke-width="2.2"/>
    <line x1="-10" y1="-6" x2="7" y2="-6" stroke="${INK}" stroke-width="1.6" opacity="0.6"/>
    <line x1="-10" y1="0" x2="7" y2="0" stroke="${INK}" stroke-width="1.6" opacity="0.6"/>
    <line x1="-10" y1="6" x2="2" y2="6" stroke="${INK}" stroke-width="1.6" opacity="0.6"/>
    <circle cx="14" cy="10" r="7" fill="${GOLD}" stroke="${INK}" stroke-width="2"/>
    <path d="M11 10 h6 M14 7 v6" stroke="${INK}" stroke-width="1.3" opacity="0.7"/>
  `),

  ratios_proportions: () => badge(`
    <!-- Thales' shadow-stick: a stick, its short shadow, the pyramid's long one, same ratio -->
    <line x1="-16" y1="14" x2="-16" y2="-10" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <line x1="-16" y1="14" x2="-6" y2="14" stroke="${GOLD}" stroke-width="2.4" stroke-dasharray="1 4" stroke-linecap="round"/>
    <path d="M2 14 L16 -12 L20 14 Z" fill="${PARCH_B}" stroke="${INK}" stroke-width="2"/>
    <line x1="2" y1="14" x2="20" y2="14" stroke="${GOLD}" stroke-width="2.4" stroke-dasharray="1 4" stroke-linecap="round" opacity="0.85"/>
  `),

  order_of_operations: () => badge(`
    <!-- Analytical Engine: two meshed gears, biggest first -->
    <circle cx="-6" cy="2" r="13" fill="none" stroke="${NAVY}" stroke-width="3"/>
    <circle cx="-6" cy="2" r="13" fill="none" stroke="${INK}" stroke-width="1" opacity="0.5" stroke-dasharray="2 4"/>
    <circle cx="12" cy="-8" r="7" fill="none" stroke="${GOLD}" stroke-width="2.6"/>
    <circle cx="-6" cy="2" r="2.4" fill="${INK}"/>
    <circle cx="12" cy="-8" r="1.6" fill="${INK}"/>
  `),

  basic_equations: () => badge(`
    <!-- a balance scale in equilibrium -->
    <line x1="0" y1="-15" x2="0" y2="8" stroke="${INK}" stroke-width="2.6"/>
    <line x1="-17" y1="-11" x2="17" y2="-11" stroke="${INK}" stroke-width="2.4"/>
    <path d="M-22 -11 Q-17 3 -12 -11 Z" fill="${NAVY}" stroke="${INK}" stroke-width="1.6"/>
    <path d="M12 -11 Q17 3 22 -11 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.6"/>
    <path d="M-7 8 L7 8 L4 15 L-4 15 Z" fill="${PARCH_B}" stroke="${INK}" stroke-width="1.8"/>
  `),

  number_properties: () => badge(`
    <!-- taxicab numbers: two distinct cube pairs, same sum -->
    <rect x="-16" y="-10" width="16" height="16" fill="none" stroke="${NAVY}" stroke-width="2.4"/>
    <rect x="-12" y="-16" width="16" height="16" fill="none" stroke="${NAVY}" stroke-width="1.6" opacity="0.55"/>
    <rect x="6" y="2" width="10" height="10" fill="none" stroke="${GOLD}" stroke-width="2.4"/>
    <rect x="9" y="-2" width="10" height="10" fill="none" stroke="${GOLD}" stroke-width="1.6" opacity="0.6"/>
  `),

  measurement_units: () => badge(`
    <!-- two rulers stacked that disagree -->
    <rect x="-18" y="-8" width="36" height="8" fill="${PARCH_B}" stroke="${INK}" stroke-width="1.8"/>
    ${Array.from({ length: 7 }, (_, i) => `<line x1="${-18 + i * 6}" y1="-8" x2="${-18 + i * 6}" y2="${i % 3 === 0 ? -2 : -4.5}" stroke="${INK}" stroke-width="1"/>`).join('')}
    <rect x="-15" y="3" width="30" height="8" fill="${GOLD_LT}" stroke="${NAVY}" stroke-width="1.8"/>
    ${Array.from({ length: 6 }, (_, i) => `<line x1="${-15 + i * 6}" y1="3" x2="${-15 + i * 6}" y2="${i % 2 === 0 ? 9 : 6.5}" stroke="${NAVY}" stroke-width="1"/>`).join('')}
  `),

  algebraic_manipulation: () => badge(`
    <!-- al-jabr: unbalanced piles restored, an arrow between them -->
    <rect x="-20" y="-6" width="8" height="14" fill="${NAVY}" opacity="0.85"/>
    <rect x="-10" y="0" width="8" height="8" fill="${NAVY}" opacity="0.5"/>
    <path d="M2 0 h8" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M8 -3 L14 0 L8 3 Z" fill="${INK}"/>
    <rect x="14" y="-6" width="8" height="14" fill="${GOLD}" opacity="0.9"/>
  `),

  linear_equations: () => badge(`
    <!-- H4 chronometer: two dials in sync -->
    <circle r="15" fill="${PARCH_B}" stroke="${INK}" stroke-width="2.4"/>
    <line x1="0" y1="0" x2="0" y2="-10" stroke="${INK}" stroke-width="1.8"/>
    <line x1="0" y1="0" x2="7" y2="4" stroke="${INK}" stroke-width="1.5"/>
    <circle r="1.8" fill="${GOLD}"/>
    <circle r="15" fill="none" stroke="${NAVY}" stroke-width="1.4" stroke-dasharray="1.5 3.5"/>
  `),

  functions_basics: () => badge(`
    <!-- function machine: in one side, out the other -->
    <rect x="-11" y="-11" width="22" height="22" rx="4" fill="${PARCH_B}" stroke="${NAVY}" stroke-width="2.4"/>
    <path d="M-22 0 h8" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="-24" cy="0" r="3.4" fill="${GOLD}" stroke="${INK}" stroke-width="1.2"/>
    <path d="M13 0 h8" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M23 -4 L29 0 L23 4 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.2"/>
    <circle r="4" fill="${NAVY}"/>
  `),

  right_triangle_geometry: () => badge(`
    <!-- rope-stretchers' 3-4-5 cord, taut into a right angle -->
    <path d="M-16 12 L14 12 L14 -14" fill="none" stroke="${GOLD}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M-16 12 L14 -14" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.55" stroke-dasharray="2.5 2.5"/>
    <rect x="7" y="4" width="7" height="7" fill="none" stroke="${INK}" stroke-width="1.4"/>
  `),

  trigonometry_basics: () => badge(`
    <!-- astrolabe sighting a star's angle -->
    <path d="M-13 10 A13 13 0 0 1 13 10" fill="none" stroke="${NAVY}" stroke-width="2.6"/>
    <line x1="0" y1="10" x2="0" y2="-12" stroke="${INK}" stroke-width="1.4" opacity="0.5"/>
    <line x1="0" y1="10" x2="-10" y2="-5" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="0" cy="10" r="1.8" fill="${INK}"/>
  `),

  linear_inequalities: () => badge(`
    <!-- payload boundary: shaded region strictly on one side of the line -->
    <line x1="0" y1="-16" x2="0" y2="16" stroke="${INK}" stroke-width="2" stroke-dasharray="1 3.5"/>
    <path d="M0 -16 L18 -16 L18 16 L0 16 Z" fill="${NAVY}" opacity="0.4"/>
    <path d="M2 4 L10 4 L10 -2 L16 6 L10 14 L10 8 L2 8 Z" fill="${GOLD}" opacity="0.9"/>
  `),

  systems_of_linear_equations: () => badge(`
    <!-- counting-rod grid: the ancient elimination method -->
    <g transform="translate(-14 -10) scale(1.05)">
      ${[0, 1].map(r => [0, 1, 2].map(c => `<rect x="${c * 10}" y="${r * 12}" width="4" height="${8 + ((r + c) % 2) * 4}" fill="${(r + c) % 2 ? NAVY : GOLD}"/>`).join('')).join('')}
    </g>
  `),

  exponent_rules: () => badge(`
    <!-- chessboard doubling grains: 1,2,4,8 -->
    <g transform="translate(-14 -14)">
      ${[0, 1, 2, 3].map(i => `<rect x="${(i % 2) * 14} " y="${Math.floor(i / 2) * 14}" width="12" height="12" fill="${(i % 2) ? PARCH_B : PARCH_A}" stroke="${INK}" stroke-width="1"/>`).join('')}
      ${[1, 2, 4, 8].map((n, i) => `<circle cx="${(i % 2) * 14 + 6}" cy="${Math.floor(i / 2) * 14 + 6}" r="${1.4 + Math.log2(n) * 1.1}" fill="${GOLD}" opacity="0.85"/>`).join('')}
    </g>
  `),

  polynomials: () => badge(`
    <!-- stacked terms, tallest degree at the back -->
    <rect x="-16" y="-14" width="7" height="26" fill="${NAVY}" opacity="0.85"/>
    <rect x="-6" y="-6" width="7" height="18" fill="${GOLD}" opacity="0.85"/>
    <rect x="4" y="0" width="7" height="12" fill="${PARCH_B}" stroke="${INK}" stroke-width="1.4"/>
    <line x1="-18" y1="12" x2="14" y2="12" stroke="${INK}" stroke-width="1.8"/>
  `),

  factoring_polynomials: () => badge(`
    <!-- area model: (x+a)(x+b) as four panels -->
    <rect x="-16" y="-14" width="18" height="14" fill="${NAVY}" opacity="0.85"/>
    <rect x="2" y="-14" width="10" height="14" fill="${GOLD}" opacity="0.85"/>
    <rect x="-16" y="0" width="18" height="8" fill="${GOLD}" opacity="0.5"/>
    <rect x="2" y="0" width="10" height="8" fill="${PARCH_B}" stroke="${INK}" stroke-width="1.2"/>
    <rect x="-16" y="-14" width="28" height="22" fill="none" stroke="${INK}" stroke-width="1.8"/>
  `),

  radical_expressions: () => badge(`
    <!-- the radical sign, a ripple beneath it (Hippasus overboard) -->
    <path d="M-16 -2 L-11 5 L-4 -14 L14 -14" fill="none" stroke="${NAVY}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-14 12 q7 6 14 0 q7 -6 14 0" fill="none" stroke="${GOLD}" stroke-width="2" opacity="0.75"/>
  `),

  quadratic_equations: () => badge(`
    <!-- the cannon's parabolic arc -->
    <path d="M-18 12 Q0 -16 18 12" fill="none" stroke="${GOLD}" stroke-width="2.6" stroke-dasharray="1 4.5" stroke-linecap="round"/>
    <circle cx="-18" cy="12" r="2.6" fill="${INK}"/>
    <circle cx="18" cy="12" r="2.6" fill="${INK}" opacity="0.85"/>
  `),

  descriptive_statistics: () => badge(`
    <!-- bell curve over a small histogram -->
    <path d="M-16 12 Q-16 -10 0 -12 Q16 -10 16 12" fill="none" stroke="${NAVY}" stroke-width="2.2"/>
    <rect x="-13" y="0" width="5" height="12" fill="${GOLD}" opacity="0.8"/>
    <rect x="-4" y="-6" width="5" height="18" fill="${NAVY}" opacity="0.7"/>
    <rect x="5" y="2" width="5" height="10" fill="${GOLD}" opacity="0.8"/>
    <line x1="-16" y1="12" x2="16" y2="12" stroke="${INK}" stroke-width="1.8"/>
  `),

  basic_probability: () => badge(`
    <!-- two dice mid-tumble -->
    <g transform="rotate(-10)">
      <rect x="-14" y="-10" width="16" height="16" rx="2.5" fill="${PARCH_B}" stroke="${INK}" stroke-width="2"/>
      <circle cx="-9" cy="-5" r="1.4" fill="${INK}"/><circle cx="-1" cy="-5" r="1.4" fill="${INK}"/>
      <circle cx="-5" cy="2" r="1.4" fill="${INK}"/>
    </g>
    <g transform="translate(8 6) rotate(12)">
      <rect x="-8" y="-8" width="16" height="16" rx="2.5" fill="${NAVY}" stroke="${INK}" stroke-width="2"/>
      <circle cx="0" cy="0" r="1.6" fill="${GOLD_LT}"/>
    </g>
  `),

  exponential_functions: () => badge(`
    <!-- the sharply upward compound-growth curve -->
    <path d="M-16 14 h30" stroke="${INK}" stroke-width="1.6" opacity="0.5"/>
    <path d="M-16 14 v-28" stroke="${INK}" stroke-width="1.6" opacity="0.5"/>
    <path d="M-16 14 Q-2 10 4 -4 T16 -16" fill="none" stroke="${NAVY}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="16" cy="-16" r="2" fill="${GOLD}"/>
  `),

  sequences_series: () => badge(`
    <!-- Gauss's trick: numbers paired end to end, always the same sum -->
    <g transform="translate(-15 6)">
      ${[0, 1, 2, 3].map(i => `<rect x="${i * 8}" y="${(3 - i) * -2}" width="6" height="${6 + i * 4}" fill="${i % 2 ? NAVY : GOLD}" opacity="0.85"/>`).join('')}
    </g>
    <path d="M-15 -4 Q-1 -16 17 -4" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="1.5 3" opacity="0.6"/>
  `),

  lines_angles: () => badge(`
    <!-- Eratosthenes: two verticals, same sun, different shadow angles -->
    <line x1="-11" y1="14" x2="-11" y2="-10" stroke="${INK}" stroke-width="2.4"/>
    <line x1="-11" y1="14" x2="-1" y2="12" stroke="${GOLD}" stroke-width="1.8" stroke-dasharray="1 3"/>
    <path d="M-11 14 A8 8 0 0 1 -5 8" fill="none" stroke="${NAVY}" stroke-width="1.6"/>
    <line x1="11" y1="14" x2="11" y2="-10" stroke="${INK}" stroke-width="2.4"/>
    <line x1="11" y1="14" x2="11" y2="4" stroke="${GOLD}" stroke-width="1.8" stroke-dasharray="1 3"/>
  `),

  triangles_congruence: () => badge(`
    <!-- two triangles, same shape and size, one mirrored -->
    <path d="M-16 10 L-2 10 L-9 -12 Z" fill="none" stroke="${NAVY}" stroke-width="2.2"/>
    <path d="M4 10 L18 10 L11 -12 Z" fill="none" stroke="${GOLD}" stroke-width="2.2"/>
    <path d="M-8 3 h4" stroke="${INK}" stroke-width="1.2" opacity="0.6"/>
  `),

  circles_geometry: () => badge(`
    <!-- Archimedes' bath overflow, pi as the circle's own ratio -->
    <path d="M-16 10 h32 v6 h-32 Z" fill="${PARCH_B}" stroke="${INK}" stroke-width="1.8"/>
    <path d="M-16 10 q16 -3 32 0" fill="none" stroke="${NAVY}" stroke-width="1.6" opacity="0.7"/>
    <circle cx="0" cy="-6" r="10" fill="none" stroke="${GOLD}" stroke-width="2.4"/>
    <line x1="0" y1="-6" x2="10" y2="-6" stroke="${INK}" stroke-width="1.2"/>
  `),

  area_volume: () => badge(`
    <!-- sphere snug inside a cylinder, Archimedes' favorite ratio -->
    <rect x="-11" y="-14" width="22" height="26" fill="none" stroke="${INK}" stroke-width="2"/>
    <ellipse cx="0" cy="-14" rx="11" ry="3.5" fill="none" stroke="${INK}" stroke-width="1.6"/>
    <ellipse cx="0" cy="12" rx="11" ry="3.5" fill="none" stroke="${INK}" stroke-width="1.6"/>
    <circle cx="0" cy="-1" r="10.5" fill="${NAVY}" opacity="0.55" stroke="${INK}" stroke-width="1.4"/>
  `),

  geometric_transformations: () => badge(`
    <!-- Alhambra tessellation: one tile repeated by reflection, no gaps -->
    <g transform="translate(-14 -14)">
      ${[0, 1].map(r => [0, 1].map(c => {
        const x = c * 14; const y = r * 14; const flip = (r + c) % 2
        return `<path d="M${x} ${y} L${x + 14} ${y} L${x + 7} ${y + 14} Z" fill="${flip ? NAVY : GOLD}" opacity="0.8" transform="${flip ? `rotate(180 ${x + 7} ${y + 7})` : ''}"/>`
      }).join('')).join('')}
    </g>
  `),

  // ── Two Layer-1 cross-cutting tags with no locked concept story
  // (actToc.ts excludes both from the TOC/Map today  -  "no playable bank
  // questions yet")  -  bespoke anyway, same palette, so this isn't a silent
  // fallback if either ever surfaces in the UI. ─────────────────────────────
  act_strategy: () => badge(`
    <!-- test-day compass/target -->
    <circle r="15" fill="none" stroke="${NAVY}" stroke-width="2"/>
    <circle r="9" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.6"/>
    <circle r="3" fill="${GOLD}"/>
    <path d="M-15 0 h-4 M19 0 h-4 M0 -15 v-4 M0 19 v-4" stroke="${INK}" stroke-width="1.6"/>
  `),

  representation_translation: () => badge(`
    <!-- two linked frames, an arrow translating between them -->
    <rect x="-18" y="-10" width="13" height="16" rx="2" fill="none" stroke="${NAVY}" stroke-width="2"/>
    <rect x="5" y="-10" width="13" height="16" rx="2" fill="none" stroke="${GOLD}" stroke-width="2"/>
    <path d="M-4 -2 h6" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M0 -5 L4 -2 L0 1 Z" fill="${INK}"/>
  `),

  // Generic safety net  -  never hit by the current TOC (every rendered
  // concept has a bespoke entry above), kept for any future/unlisted id
  // instead of silently falling through to an emoji again.
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
