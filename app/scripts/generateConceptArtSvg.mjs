#!/usr/bin/env node
/**
 * generateConceptArtSvg.mjs  -  hand-authored SVG concept-art pipeline.
 *
 * Sibling to generateConceptArt.mjs (the Higgsfield photoreal pipeline), for
 * the concepts that pipeline can't afford: Higgsfield is credit-limited (1
 * remaining generation was spent on fractions_decimals / Simon Stevin), so
 * Fable 5 hand-authored the rest as real vector illustrations instead of
 * faking photoreal generation. No image-generation model runs here  -  every
 * path below was composed by hand from each concept's LOCKED protagonist +
 * setting (questionContextFrames.json) and its historical scene
 * (conceptStories.json), the same source data generateConceptArt.mjs reads.
 *
 * Style system (documented reasoning, see ACTIVE_TASK.md 2026-07-21 entry):
 * a warm parchment / ink-line "field notebook sketch" style  -  cream-to-amber
 * background, warm ink-brown linework (not flat black), one signature deep
 * navy accent per figure and warm gold for props. Those three colors were
 * sampled directly from the one existing photoreal plate (story-
 * fractions_decimals.jpg: cream walls, Stevin's navy coat, golden wheat/
 * light) so the 26 line-art plates and the 1 photoreal plate read as pages
 * of the SAME notebook  -  one page happened to get a full watercolor
 * treatment, the rest are pen-and-wash sketches. Navy (#1d3a8a) is also
 * literally MindCraft's own brand "Depth" color (BRAND_BOOK.md section 9),
 * so the bridge is deliberate on both counts, not just a color-match
 * coincidence.
 *
 * Every scene = one shared "cloaked scholar" figure archetype (recolored/
 * reposed per protagonist, same idea as generateConceptArt.mjs reusing one
 * fixed STYLE_FORMULA across every photoreal generation) + hand-drawn
 * background props for that setting + ONE bespoke hand-drawn metaphor prop
 * per concept's actual math (the genuine per-scene craft  -  a balance scale
 * for an equation, a rope-stretched triangle for right-triangle geometry, a
 * doubling grain count for exponent rules, and so on).
 *
 * Output: app/src/assets/canvas/generated/story-{conceptId}.svg.
 * storyArt.ts auto-discovers these via import.meta.glob, same as the jpgs.
 *
 * Usage:
 *   node app/scripts/generateConceptArtSvg.mjs --list     # show coverage
 *   node app/scripts/generateConceptArtSvg.mjs            # (re)generate all 26
 *   node app/scripts/generateConceptArtSvg.mjs linear_equations   # just one
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(__dirname, '..')
const GENERATED_DIR = resolve(APP_ROOT, 'src/assets/canvas/generated')

// ── shared palette (sampled from story-fractions_decimals.jpg) ──────────
const INK = '#33230f'      // warm ink-brown line color (not flat black)
const PARCH_A = '#fbf3e2'  // cream
const PARCH_B = '#eddab3'  // warm amber-parchment
const PARCH_C = '#e2c793'  // deeper amber shadow
const NAVY = '#1d3a8a'     // MindCraft "Depth"  -  also Stevin's coat
const NAVY_DK = '#142a63'
const GOLD = '#c99a3a'     // warm prop accent (echoes the wheat bowl)
const GOLD_LT = '#e7c877'

function svgHeader() {
  return `<svg viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">`
}

function defs() {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PARCH_A}"/>
      <stop offset="0.62" stop-color="${PARCH_B}"/>
      <stop offset="1" stop-color="${PARCH_C}"/>
    </linearGradient>
    <radialGradient id="vign" cx="50%" cy="42%" r="70%">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#3a2410" stop-opacity="0.16"/>
    </radialGradient>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
      <path d="M0 0 L8 4 L0 8 Z" fill="${INK}"/>
    </marker>
  </defs>`
}

function bg() {
  return `<rect x="0" y="0" width="800" height="800" fill="url(#bg)"/>`
}
function vignette() {
  return `<rect x="0" y="0" width="800" height="800" fill="url(#vign)"/>`
}

// ── shared background primitives ─────────────────────────────────────────
function sun(cx, cy, r, color = GOLD_LT) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.55"/>`
}
function stars(pts) {
  return pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r ?? 2.4}" fill="${INK}" opacity="0.4"/>`).join('')
}
function mountains(baseY, amp = 60, color = PARCH_C, opacity = 0.55) {
  return `<path d="M0 ${baseY} L100 ${baseY - amp} L220 ${baseY - amp * 0.5} L340 ${baseY - amp * 1.1} L460 ${baseY - amp * 0.4} L600 ${baseY - amp * 0.9} L800 ${baseY - amp * 0.3} L800 800 L0 800 Z" fill="${color}" opacity="${opacity}"/>`
}
function water(baseY, color = NAVY, opacity = 0.28) {
  return `<path d="M0 ${baseY} Q100 ${baseY - 14} 200 ${baseY} T400 ${baseY} T600 ${baseY} T800 ${baseY} L800 800 L0 800 Z" fill="${color}" opacity="${opacity}"/>`
}
function groundLine(y) {
  return `<line x1="0" y1="${y}" x2="800" y2="${y}" stroke="${INK}" stroke-width="3" opacity="0.28"/>`
}
function pyramidShape(cx, baseY, w, h, color = PARCH_C) {
  return `<path d="M${cx} ${baseY - h} L${cx + w / 2} ${baseY} L${cx - w / 2} ${baseY} Z" fill="${color}" stroke="${INK}" stroke-width="4" opacity="0.9"/>
    <path d="M${cx} ${baseY - h} L${cx} ${baseY} " stroke="${INK}" stroke-width="2.5" opacity="0.4"/>`
}
function scrollProp(x, y, w = 90, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <rect x="0" y="0" width="${w}" height="26" rx="8" fill="${PARCH_A}" stroke="${INK}" stroke-width="3"/>
    <circle cx="4" cy="13" r="7" fill="${PARCH_B}" stroke="${INK}" stroke-width="3"/>
    <circle cx="${w - 4}" cy="13" r="7" fill="${PARCH_B}" stroke="${INK}" stroke-width="3"/>
  </g>`
}
function tableProp(x, y, w) {
  return `<rect x="${x}" y="${y}" width="${w}" height="14" rx="3" fill="${PARCH_C}" stroke="${INK}" stroke-width="4"/>
    <line x1="${x + 14}" y1="${y + 14}" x2="${x + 14}" y2="${y + 70}" stroke="${INK}" stroke-width="6"/>
    <line x1="${x + w - 14}" y1="${y + 14}" x2="${x + w - 14}" y2="${y + 70}" stroke="${INK}" stroke-width="6"/>`
}
function windowArch(x, y, w, h) {
  return `<path d="M${x} ${y + h} L${x} ${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} L${x + w} ${y + h} Z" fill="${PARCH_A}" stroke="${INK}" stroke-width="4" opacity="0.9"/>
    <line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${INK}" stroke-width="2.5" opacity="0.55"/>`
}
function libraryShelves(x, y, w, h) {
  const rows = 3
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PARCH_B}" stroke="${INK}" stroke-width="4" opacity="0.85"/>`
  for (let r = 1; r < rows; r++) {
    const ry = y + (h / rows) * r
    out += `<line x1="${x}" y1="${ry}" x2="${x + w}" y2="${ry}" stroke="${INK}" stroke-width="2.5" opacity="0.5"/>`
  }
  for (let c = 0; c < 7; c++) {
    const cx = x + 8 + c * (w - 16) / 6
    out += `<rect x="${cx}" y="${y + 5}" width="6" height="${h / rows - 10}" fill="${c % 2 ? NAVY : GOLD}" opacity="0.55"/>`
  }
  return out
}
function tentShape(x, y, w, h, color = PARCH_C) {
  return `<path d="M${x} ${y + h} L${x + w / 2} ${y} L${x + w} ${y + h} Z" fill="${color}" stroke="${INK}" stroke-width="4" opacity="0.85"/>`
}
function shipHull(x, y, w) {
  return `<path d="M${x} ${y} Q${x + w / 2} ${y + 34} ${x + w} ${y} L${x + w - 20} ${y - 20} L${x + 20} ${y - 20} Z" fill="${PARCH_C}" stroke="${INK}" stroke-width="4"/>
    <line x1="${x + w / 2}" y1="${y - 20}" x2="${x + w / 2}" y2="${y - 110}" stroke="${INK}" stroke-width="5"/>
    <path d="M${x + w / 2} ${y - 108} L${x + w / 2 + 60} ${y - 60} L${x + w / 2} ${y - 40} Z" fill="${PARCH_A}" stroke="${INK}" stroke-width="3.5"/>`
}

// ── the shared "cloaked scholar" figure archetype ─────────────────────────
// Recolored + reposed per protagonist. Same principle as
// generateConceptArt.mjs's single fixed STYLE_FORMULA reused for every
// generation  -  one consistent rig, so the 26 plates read as one family.
function figure({
  cx = 400, cy = 560, scale = 1, flip = false,
  robe = NAVY, skin = '#e0b083', hair = '#3a2717',
  hat = null, // 'peak' | 'turban' | 'cap' | 'bonnet' | null
  arm = 'point', // 'point' | 'down' | 'raise' | 'hold'
  holdProp = '',
} = {}) {
  const s = scale
  const fx = flip ? -1 : 1
  return `<g transform="translate(${cx} ${cy}) scale(${fx * s} ${s})">
    <!-- robe -->
    <path d="M-70 190 Q-90 60 -46 -30 Q0 -58 46 -30 Q90 60 70 190 Z" fill="${robe}" stroke="${INK}" stroke-width="5"/>
    <path d="M-46 -30 Q0 10 46 -30" fill="none" stroke="${INK}" stroke-width="3.5" opacity="0.6"/>
    <path d="M-20 190 L-14 40 M20 190 L14 40" stroke="${INK}" stroke-width="2.5" opacity="0.35"/>
    <!-- arm -->
    ${arm === 'point' ? `<path d="M40 -10 Q92 -34 132 -70" fill="none" stroke="${robe}" stroke-width="16" stroke-linecap="round"/>
      <path d="M40 -10 Q92 -34 132 -70" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
      <circle cx="136" cy="-73" r="9" fill="${skin}" stroke="${INK}" stroke-width="3"/>` : ''}
    ${arm === 'raise' ? `<path d="M36 -20 Q70 -90 60 -140" fill="none" stroke="${robe}" stroke-width="16" stroke-linecap="round"/>
      <path d="M36 -20 Q70 -90 60 -140" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
      <circle cx="58" cy="-144" r="9" fill="${skin}" stroke="${INK}" stroke-width="3"/>` : ''}
    ${arm === 'hold' ? `<path d="M40 10 Q86 6 108 34" fill="none" stroke="${robe}" stroke-width="16" stroke-linecap="round"/>
      <path d="M40 10 Q86 6 108 34" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
      <circle cx="112" cy="36" r="9" fill="${skin}" stroke="${INK}" stroke-width="3"/>
      ${holdProp}` : ''}
    <path d="M-40 -10 Q-70 30 -66 78" fill="none" stroke="${robe}" stroke-width="16" stroke-linecap="round"/>
    <path d="M-40 -10 Q-70 30 -66 78" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
    <circle cx="-67" cy="82" r="9" fill="${skin}" stroke="${INK}" stroke-width="3"/>
    <!-- head -->
    <circle cx="0" cy="-72" r="44" fill="${skin}" stroke="${INK}" stroke-width="5"/>
    <path d="M-40 -84 Q0 -122 40 -84 Q42 -104 0 -116 Q-42 -104 -40 -84 Z" fill="${hair}" stroke="${INK}" stroke-width="4"/>
    <path d="M-16 -68 q6 -8 12 0 M8 -68 q6 -8 12 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M-6 -50 q6 4 12 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${hat === 'peak' ? `<path d="M-38 -96 L0 -168 L38 -96 Z" fill="${robe}" stroke="${INK}" stroke-width="4"/>` : ''}
    ${hat === 'turban' ? `<path d="M-42 -92 Q0 -150 42 -92 Q30 -76 0 -78 Q-30 -76 -42 -92 Z" fill="${PARCH_A}" stroke="${INK}" stroke-width="4"/>` : ''}
    ${hat === 'cap' ? `<path d="M-40 -92 Q0 -120 40 -92 Z" fill="${GOLD}" stroke="${INK}" stroke-width="4"/>` : ''}
    ${hat === 'bonnet' ? `<path d="M-40 -96 Q-30 -140 0 -140 Q30 -140 40 -96 Z" fill="${PARCH_A}" stroke="${INK}" stroke-width="4"/>` : ''}
  </g>`
}

function wrap(inner) {
  return `${svgHeader()}${defs()}${bg()}${inner}${vignette()}</svg>\n`
}

// ── per-concept scenes ────────────────────────────────────────────────────
// Each entry: bespoke background + figure pose/palette + ONE hand-drawn
// metaphor prop for that concept's actual math. Protagonist/setting locked
// from questionContextFrames.json; metaphor invented fresh per concept.
const SCENES = {

  ratios_proportions: () => wrap(`
    ${sun(650, 130, 90)}
    ${mountains(560, 30, PARCH_C, 0.4)}
    ${pyramidShape(560, 660, 340, 300)}
    ${pyramidShape(280, 660, 200, 160, PARCH_B)}
    ${groundLine(660)}
    <!-- Thales' shadow-stick proportion: stick, its shadow, and the pyramid's shadow in the same ratio -->
    <line x1="150" y1="660" x2="150" y2="560" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
    <line x1="150" y1="660" x2="210" y2="660" stroke="${GOLD}" stroke-width="6" stroke-dasharray="2 10" stroke-linecap="round"/>
    <line x1="560" y1="660" x2="900" y2="660" stroke="${GOLD}" stroke-width="6" stroke-dasharray="2 10" stroke-linecap="round" opacity="0.7"/>
    ${figure({ cx: 300, cy: 610, scale: 0.9, robe: NAVY, arm: 'point' })}
  `),

  order_of_operations: () => wrap(`
    ${windowArch(70, 90, 220, 340)}
    <line x1="70" y1="430" x2="290" y2="430" stroke="${INK}" stroke-width="4" opacity="0.4"/>
    ${tableProp(430, 560, 300)}
    <!-- Analytical Engine: a rack of ordered brass gears, biggest to smallest, one path -->
    <g transform="translate(560 470)">
      <circle r="60" fill="none" stroke="${NAVY}" stroke-width="8"/>
      <circle r="60" fill="none" stroke="${INK}" stroke-width="2" opacity="0.5" stroke-dasharray="6 10"/>
      <circle cx="90" cy="34" r="34" fill="none" stroke="${GOLD}" stroke-width="7"/>
      <circle cx="-86" cy="40" r="24" fill="none" stroke="${NAVY}" stroke-width="6"/>
      <circle r="8" fill="${INK}"/>
    </g>
    ${figure({ cx: 380, cy: 610, scale: 0.92, robe: '#5a3a63', hat: 'bonnet', arm: 'hold',
      holdProp: `<rect x="0" y="-8" width="46" height="16" rx="3" fill="${PARCH_A}" stroke="${INK}" stroke-width="3"/>` })}
  `),

  basic_equations: () => wrap(`
    ${libraryShelves(60, 90, 220, 300)}
    ${libraryShelves(520, 90, 220, 300)}
    ${groundLine(660)}
    <!-- a balance scale in equilibrium: the oldest equation metaphor -->
    <g transform="translate(400 470)">
      <line x1="0" y1="-90" x2="0" y2="60" stroke="${INK}" stroke-width="8"/>
      <line x1="-110" y1="-70" x2="110" y2="-70" stroke="${INK}" stroke-width="7"/>
      <line x1="-110" y1="-70" x2="-110" y2="-30" stroke="${INK}" stroke-width="4"/>
      <line x1="110" y1="-70" x2="110" y2="-30" stroke="${INK}" stroke-width="4"/>
      <path d="M-150 -30 Q-110 10 -70 -30 Z" fill="${NAVY}" stroke="${INK}" stroke-width="4"/>
      <path d="M70 -30 Q110 10 150 -30 Z" fill="${GOLD}" stroke="${INK}" stroke-width="4"/>
      <path d="M-40 60 L40 60 L26 100 L-26 100 Z" fill="${PARCH_C}" stroke="${INK}" stroke-width="5"/>
    </g>
    ${figure({ cx: 400, cy: 640, scale: 0.95, robe: '#6b4a2b', hat: null, arm: 'down' })}
  `),

  number_properties: () => wrap(`
    ${water(120, NAVY, 0.14)}
    <rect x="60" y="90" width="220" height="150" rx="6" fill="${PARCH_A}" stroke="${INK}" stroke-width="4" opacity="0.9"/>
    <line x1="80" y1="130" x2="260" y2="130" stroke="${INK}" stroke-width="2.5" opacity="0.4"/>
    <line x1="80" y1="160" x2="260" y2="160" stroke="${INK}" stroke-width="2.5" opacity="0.4"/>
    <line x1="80" y1="190" x2="260" y2="190" stroke="${INK}" stroke-width="2.5" opacity="0.4"/>
    <!-- taxicab numbers: two distinct cube pairs, same sum -->
    <g transform="translate(390 430) scale(1.5)">
      <rect x="0" y="0" width="70" height="70" fill="none" stroke="${NAVY}" stroke-width="7"/>
      <rect x="14" y="-14" width="70" height="70" fill="none" stroke="${NAVY}" stroke-width="4" opacity="0.55"/>
      <rect x="130" y="30" width="40" height="40" fill="none" stroke="${GOLD}" stroke-width="7"/>
      <rect x="140" y="20" width="40" height="40" fill="none" stroke="${GOLD}" stroke-width="4" opacity="0.55"/>
      <path d="M0 130 h210" stroke="${INK}" stroke-width="4" opacity="0.5"/>
    </g>
    ${figure({ cx: 300, cy: 600, scale: 0.9, robe: '#274a63', hat: null, arm: 'point' })}
  `),

  measurement_units: () => wrap(`
    ${windowArch(500, 100, 200, 300)}
    ${tableProp(80, 560, 340)}
    <!-- two rulers side by side that DISAGREE  -  the metric/imperial mismatch -->
    <g transform="translate(120 500)">
      <rect x="0" y="0" width="220" height="26" fill="${PARCH_A}" stroke="${INK}" stroke-width="4"/>
      ${Array.from({ length: 11 }, (_, i) => `<line x1="${i * 20}" y1="0" x2="${i * 20}" y2="${i % 5 === 0 ? 16 : 9}" stroke="${INK}" stroke-width="2"/>`).join('')}
      <rect x="10" y="34" width="176" height="26" fill="${PARCH_B}" stroke="${NAVY}" stroke-width="4"/>
      ${Array.from({ length: 9 }, (_, i) => `<line x1="${10 + i * 22}" y1="34" x2="${10 + i * 22}" y2="${i % 3 === 0 ? 50 : 43}" stroke="${NAVY}" stroke-width="2"/>`).join('')}
    </g>
    ${figure({ cx: 460, cy: 610, scale: 0.94, robe: NAVY, hat: null, arm: 'hold',
      holdProp: `<rect x="0" y="-6" width="60" height="12" fill="${GOLD}" stroke="${INK}" stroke-width="3"/>` })}
  `),

  algebraic_manipulation: () => wrap(`
    ${libraryShelves(600, 80, 160, 340)}
    ${windowArch(60, 90, 200, 320)}
    <!-- al-jabr: two unbalanced piles "restored" to balance -->
    <g transform="translate(380 480)">
      <path d="M-160 60 h140" stroke="${INK}" stroke-width="6"/>
      <rect x="-150" y="0" width="40" height="60" fill="${NAVY}" opacity="0.8"/>
      <rect x="-100" y="20" width="40" height="40" fill="${NAVY}" opacity="0.55"/>
      <path d="M0 30 h60" stroke="${INK}" stroke-width="5" marker-end="url(#arrow)"/>
      <rect x="90" y="0" width="40" height="60" fill="${NAVY}" opacity="0.8"/>
      <rect x="140" y="0" width="40" height="60" fill="${GOLD}" opacity="0.85"/>
    </g>
    ${figure({ cx: 260, cy: 610, scale: 0.95, robe: '#2c5940', hat: 'turban', arm: 'point' })}
  `),

  linear_equations: () => wrap(`
    ${water(560, NAVY, 0.3)}
    ${shipHull(430, 560, 300)}
    ${groundLine(760)}
    <!-- H4 marine chronometer: two dials in sync, longitude solved as a linear relation of time -->
    <g transform="translate(220 470)">
      <circle r="60" fill="${PARCH_A}" stroke="${INK}" stroke-width="6"/>
      <line x1="0" y1="0" x2="0" y2="-42" stroke="${INK}" stroke-width="4"/>
      <line x1="0" y1="0" x2="30" y2="14" stroke="${INK}" stroke-width="3"/>
      <circle r="6" fill="${GOLD}"/>
      <circle r="60" fill="none" stroke="${NAVY}" stroke-width="3" stroke-dasharray="3 8"/>
    </g>
    ${figure({ cx: 300, cy: 600, scale: 0.9, robe: '#4a3320', hat: 'cap', arm: 'hold',
      holdProp: `<circle r="18" fill="${PARCH_A}" stroke="${INK}" stroke-width="4"/><line x1="0" y1="0" x2="0" y2="-10" stroke="${INK}" stroke-width="2.5"/>` })}
  `),

  functions_basics: () => wrap(`
    ${water(600, NAVY, 0.18)}
    ${libraryShelves(540, 100, 220, 300)}
    <!-- a machine: input in one side, output the other  -  the function-as-machine metaphor -->
    <g transform="translate(240 470)">
      <rect x="-30" y="-50" width="160" height="100" rx="16" fill="${PARCH_A}" stroke="${NAVY}" stroke-width="7"/>
      <text x="50" y="10" font-size="1" opacity="0"> </text>
      <path d="M-70 0 h40" stroke="${INK}" stroke-width="6" marker-end="url(#arrow)"/>
      <circle cx="-80" cy="0" r="14" fill="${GOLD}" stroke="${INK}" stroke-width="3"/>
      <path d="M130 0 h40" stroke="${INK}" stroke-width="6" marker-end="url(#arrow)"/>
      <path d="M186 -20 L214 0 L186 20 Z" fill="${GOLD}" stroke="${INK}" stroke-width="3"/>
      <circle cx="20" cy="0" r="26" fill="none" stroke="${INK}" stroke-width="4" opacity="0.5"/>
      <circle cx="20" cy="0" r="10" fill="${NAVY}"/>
    </g>
    ${figure({ cx: 340, cy: 610, scale: 0.92, robe: NAVY, hat: null, arm: 'point' })}
  `),

  right_triangle_geometry: () => wrap(`
    ${water(600, NAVY, 0.32)}
    ${groundLine(600)}
    <!-- the rope-stretchers' 3-4-5 knotted cord, pulled taut into a right angle -->
    <g transform="translate(360 560)">
      <path d="M-160 0 L60 0 L60 -160" fill="none" stroke="${GOLD}" stroke-width="6" stroke-dasharray="1 22" stroke-linecap="round"/>
      <path d="M-160 0 L60 -160" fill="none" stroke="${INK}" stroke-width="3.5" opacity="0.55" stroke-dasharray="6 6"/>
      <rect x="40" y="-20" width="20" height="20" fill="none" stroke="${INK}" stroke-width="3"/>
      <circle cx="-160" cy="0" r="7" fill="${INK}"/>
      <circle cx="60" cy="0" r="7" fill="${INK}"/>
      <circle cx="60" cy="-160" r="7" fill="${INK}"/>
    </g>
    ${figure({ cx: 560, cy: 600, scale: 0.9, skin: '#8a5a35', robe: '#8a5a2a', hat: null, arm: 'hold',
      holdProp: `<circle r="14" fill="none" stroke="${INK}" stroke-width="5"/>` })}
  `),

  trigonometry_basics: () => wrap(`
    ${stars([[80, 90], [140, 60], [560, 70], [640, 120], [340, 50], [720, 200], [220, 140]])}
    ${mountains(600, 40, PARCH_C, 0.5)}
    <!-- an astrolabe/sextant sighting a star's angle -->
    <g transform="translate(560 470)">
      <path d="M-70 60 A70 70 0 0 1 70 60" fill="none" stroke="${NAVY}" stroke-width="7"/>
      <line x1="0" y1="60" x2="0" y2="-70" stroke="${INK}" stroke-width="3" opacity="0.5"/>
      <line x1="0" y1="60" x2="-58" y2="-30" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/>
      <path d="M-30 60 A40 40 0 0 1 -12 26" fill="none" stroke="${INK}" stroke-width="3"/>
      <circle cx="0" cy="60" r="8" fill="${INK}"/>
    </g>
    ${figure({ cx: 280, cy: 600, scale: 0.92, robe: '#2c3e63', hat: null, arm: 'point' })}
  `),

  linear_inequalities: () => wrap(`
    ${stars([[80, 80], [140, 50], [700, 90]])}
    ${mountains(640, 26, PARCH_C, 0.45)}
    <!-- runway with a cargo scale showing the payload must stay AT OR UNDER the line -->
    <g transform="translate(280 560)">
      <path d="M-140 40 L60 40 L110 0 L-90 0 Z" fill="${PARCH_A}" stroke="${INK}" stroke-width="4" opacity="0.9"/>
      <line x1="-30" y1="-10" x2="-30" y2="40" stroke="${INK}" stroke-width="3" stroke-dasharray="6 8" opacity="0.6"/>
    </g>
    <g transform="translate(520 470)">
      <line x1="0" y1="0" x2="0" y2="90" stroke="${INK}" stroke-width="6"/>
      <line x1="-70" y1="0" x2="70" y2="0" stroke="${INK}" stroke-width="6"/>
      <path d="M-30 0 h-60 v70 h60 Z" fill="${NAVY}" opacity="0.8"/>
      <path d="M-30 0 h-60 v40 h60 Z" fill="${GOLD}" opacity="0.75"/>
      <line x1="-90" y1="70" x2="30" y2="70" stroke="${INK}" stroke-width="3" stroke-dasharray="2 8"/>
    </g>
    ${figure({ cx: 640, cy: 610, scale: 0.86, skin: '#e0b083', robe: '#324a3a', hat: 'peak', arm: 'point' })}
  `),

  systems_of_linear_equations: () => wrap(`
    ${tentShape(80, 200, 200, 260, PARCH_B)}
    ${tentShape(600, 220, 180, 240, PARCH_C)}
    ${groundLine(660)}
    <!-- counting rods laid out as a grid  -  the ancient matrix / elimination method -->
    <g transform="translate(330 430) scale(1.9)">
      ${[0, 1, 2].map(r => [0, 1, 2, 3].map(c => `<rect x="${c * 30}" y="${r * 34}" width="8" height="${18 + ((r + c) % 3) * 6}" fill="${(r + c) % 2 ? NAVY : GOLD}" />`).join('')).join('')}
    </g>
    ${figure({ cx: 220, cy: 610, scale: 0.9, skin: '#d9a877', hair: '#161311', robe: '#7a1f1f', hat: 'cap', arm: 'point' })}
  `),

  exponent_rules: () => wrap(`
    ${windowArch(560, 90, 200, 300)}
    <!-- the chessboard doubling grains: 1,2,4,8... compound growth -->
    <g transform="translate(250 420) scale(1.4)">
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${(i % 4) * 46}" y="${Math.floor(i / 4) * 46}" width="42" height="42" fill="${(i % 2) ? PARCH_A : PARCH_C}" stroke="${INK}" stroke-width="2.5"/>`).join('')}
      ${[1, 2, 4, 8, 16, 32].map((n, i) => `<circle cx="${(i % 4) * 46 + 21}" cy="${Math.floor(i / 4) * 46 + 21}" r="${3 + Math.log2(n) * 2.2}" fill="${GOLD}" opacity="0.85"/>`).join('')}
    </g>
    ${figure({ cx: 480, cy: 610, scale: 0.9, robe: '#3a2f63', hat: null, arm: 'point' })}
  `),

  polynomials: () => wrap(`
    ${mountains(600, 34, PARCH_C, 0.4)}
    ${windowArch(80, 110, 190, 280)}
    <!-- stacked terms of different "degree" blocks, tallest at the back -->
    <g transform="translate(420 620)">
      <rect x="-20" y="-220" width="40" height="220" fill="${NAVY}" opacity="0.85"/>
      <rect x="30" y="-150" width="40" height="150" fill="${GOLD}" opacity="0.85"/>
      <rect x="80" y="-90" width="40" height="90" fill="${PARCH_C}" stroke="${INK}" stroke-width="3"/>
      <rect x="130" y="-40" width="40" height="40" fill="${NAVY}" opacity="0.5"/>
      <line x1="-40" y1="0" x2="190" y2="0" stroke="${INK}" stroke-width="4"/>
    </g>
    ${figure({ cx: 260, cy: 610, scale: 0.9, robe: '#5a3a63', hat: 'turban', arm: 'point' })}
  `),

  factoring_polynomials: () => wrap(`
    ${windowArch(560, 100, 200, 300)}
    <!-- factoring as an area model: a rectangle split into (x+a)(x+b) panels -->
    <g transform="translate(260 460)">
      <rect x="0" y="0" width="120" height="90" fill="${NAVY}" opacity="0.85"/>
      <rect x="120" y="0" width="60" height="90" fill="${GOLD}" opacity="0.85"/>
      <rect x="0" y="90" width="120" height="46" fill="${GOLD}" opacity="0.55"/>
      <rect x="120" y="90" width="60" height="46" fill="${PARCH_C}" stroke="${INK}" stroke-width="3"/>
      <rect x="0" y="0" width="180" height="136" fill="none" stroke="${INK}" stroke-width="5"/>
    </g>
    ${figure({ cx: 500, cy: 610, scale: 0.92, robe: '#274a4a', hat: 'cap', arm: 'point' })}
  `),

  radical_expressions: () => wrap(`
    ${water(500, NAVY, 0.4)}
    ${shipHull(300, 500, 280)}
    <!-- Hippasus overboard  -  the irrational number that couldn't be a ratio -->
    <g transform="translate(560 560)">
      <circle cx="0" cy="0" r="16" fill="#e0b083" stroke="${INK}" stroke-width="4"/>
      <path d="M-14 14 Q0 60 14 14" fill="#3a2f63" stroke="${INK}" stroke-width="4"/>
      <path d="M-40 40 q40 30 80 0" fill="none" stroke="${NAVY}" stroke-width="4" opacity="0.6"/>
    </g>
    <path d="M420 640 h4 a90 60 0 0 1 176 0" fill="none" stroke="${INK}" stroke-width="6" opacity="0.7"/>
    <text x="0" y="0" font-size="1" opacity="0"> </text>
    ${figure({ cx: 220, cy: 560, scale: 0.86, robe: '#274a63', hat: null, arm: 'raise' })}
  `),

  quadratic_equations: () => wrap(`
    ${mountains(640, 20, PARCH_C, 0.4)}
    ${groundLine(660)}
    <!-- the cannon's parabolic arc, the classic quadratic path -->
    <path d="M120 660 Q400 260 680 660" fill="none" stroke="${GOLD}" stroke-width="6" stroke-dasharray="2 14" stroke-linecap="round"/>
    <g transform="translate(150 640) rotate(-18)">
      <rect x="0" y="-16" width="80" height="30" rx="10" fill="${INK}"/>
      <circle cx="0" cy="0" r="22" fill="${PARCH_C}" stroke="${INK}" stroke-width="4"/>
    </g>
    <circle cx="680" cy="660" r="14" fill="${INK}" opacity="0.85"/>
    ${figure({ cx: 280, cy: 610, scale: 0.9, robe: '#5a3a2b', hat: 'turban', arm: 'point' })}
  `),

  descriptive_statistics: () => wrap(`
    ${windowArch(560, 100, 200, 300)}
    ${tableProp(80, 600, 300)}
    <!-- the rose diagram / bell shape summarizing scattered data -->
    <g transform="translate(240 460)">
      <path d="M-90 140 Q-90 20 0 0 Q90 20 90 140 Z" fill="none" stroke="${NAVY}" stroke-width="6"/>
      <rect x="-70" y="60" width="24" height="80" fill="${GOLD}" opacity="0.8"/>
      <rect x="-30" y="20" width="24" height="120" fill="${NAVY}" opacity="0.7"/>
      <rect x="10" y="40" width="24" height="100" fill="${GOLD}" opacity="0.8"/>
      <rect x="50" y="80" width="24" height="60" fill="${NAVY}" opacity="0.55"/>
      <line x1="-90" y1="140" x2="90" y2="140" stroke="${INK}" stroke-width="4"/>
    </g>
    ${figure({ cx: 480, cy: 610, scale: 0.92, robe: '#1d3a4a', hat: 'bonnet', arm: 'point' })}
  `),

  basic_probability: () => wrap(`
    ${tableProp(140, 600, 520)}
    <!-- two dice mid-tumble, faces showing -->
    <g transform="translate(320 500) rotate(-10)">
      <rect x="0" y="0" width="70" height="70" rx="10" fill="${PARCH_A}" stroke="${INK}" stroke-width="5"/>
      <circle cx="20" cy="20" r="5" fill="${INK}"/><circle cx="50" cy="20" r="5" fill="${INK}"/>
      <circle cx="35" cy="35" r="5" fill="${INK}"/>
      <circle cx="20" cy="50" r="5" fill="${INK}"/><circle cx="50" cy="50" r="5" fill="${INK}"/>
    </g>
    <g transform="translate(430 540) rotate(14)">
      <rect x="0" y="0" width="70" height="70" rx="10" fill="${NAVY}" stroke="${INK}" stroke-width="5"/>
      <circle cx="35" cy="35" r="6" fill="${GOLD_LT}"/>
    </g>
    ${figure({ cx: 600, cy: 610, scale: 0.9, robe: '#6b2b3a', hat: 'cap', arm: 'point' })}
  `),

  exponential_functions: () => wrap(`
    ${windowArch(80, 100, 200, 300)}
    <!-- the compound-interest / contagion growth curve, bending sharply upward -->
    <g transform="translate(260 640)">
      <path d="M0 0 h500" stroke="${INK}" stroke-width="4" opacity="0.5"/>
      <path d="M0 0 v-320" stroke="${INK}" stroke-width="4" opacity="0.5"/>
      <path d="M0 0 Q160 -10 260 -80 T420 -300" fill="none" stroke="${NAVY}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="420" cy="-300" r="9" fill="${GOLD}"/>
    </g>
    ${figure({ cx: 600, cy: 600, scale: 0.9, robe: '#2c3e2c', hat: 'turban', arm: 'point' })}
  `),

  sequences_series: () => wrap(`
    ${windowArch(560, 100, 200, 300)}
    ${tableProp(80, 600, 300)}
    <!-- Gauss's trick: numbers paired end to end, always summing the same -->
    <g transform="translate(190 500)">
      ${[0, 1, 2, 3, 4].map(i => `<rect x="${i * 34}" y="${(4 - i) * -8}" width="26" height="${20 + i * 16}" fill="${i % 2 ? NAVY : GOLD}" opacity="0.85"/>`).join('')}
      <path d="M0 20 Q80 70 170 20" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="4 6" opacity="0.6"/>
    </g>
    ${figure({ cx: 470, cy: 610, scale: 0.86, robe: '#324a63', hat: null, arm: 'point' })}
  `),

  lines_angles: () => wrap(`
    ${libraryShelves(80, 100, 200, 300)}
    ${sun(640, 120, 46, GOLD)}
    <!-- Eratosthenes: two verticals under the same sun casting different shadow angles -->
    <g transform="translate(420 640)">
      <line x1="0" y1="0" x2="0" y2="-160" stroke="${INK}" stroke-width="7"/>
      <line x1="0" y1="0" x2="70" y2="-10" stroke="${GOLD}" stroke-width="4" stroke-dasharray="2 8"/>
      <path d="M0 0 A40 40 0 0 1 30 -35" fill="none" stroke="${NAVY}" stroke-width="3"/>
      <line x1="220" y1="0" x2="220" y2="-160" stroke="${INK}" stroke-width="7"/>
      <line x1="220" y1="0" x2="220" y2="-10" stroke="${GOLD}" stroke-width="4" stroke-dasharray="2 8"/>
      <line x1="0" y1="0" x2="220" y2="0" stroke="${INK}" stroke-width="3" opacity="0.4"/>
    </g>
    ${figure({ cx: 300, cy: 610, scale: 0.9, robe: '#274a4a', hat: null, arm: 'point' })}
  `),

  triangles_congruence: () => wrap(`
    ${libraryShelves(560, 100, 200, 300)}
    <!-- two triangles, same shape and size, one mirrored  -  congruence -->
    <g transform="translate(260 560)">
      <path d="M0 0 L90 0 L36 -120 Z" fill="none" stroke="${NAVY}" stroke-width="6"/>
      <path d="M150 0 L240 0 L204 -120 Z" fill="none" stroke="${GOLD}" stroke-width="6"/>
      <path d="M45 -20 h60" stroke="${INK}" stroke-width="2.5" stroke-dasharray="3 6" opacity="0.5"/>
    </g>
    ${figure({ cx: 480, cy: 610, scale: 0.9, robe: '#274a4a', hat: null, arm: 'point' })}
  `),

  circles_geometry: () => wrap(`
    ${windowArch(80, 100, 200, 300)}
    <!-- Archimedes' bath overflow, and pi as the circle's own ratio -->
    <g transform="translate(420 580) scale(1.3)">
      <path d="M-120 40 h240 v40 h-240 Z" fill="${PARCH_A}" stroke="${INK}" stroke-width="5"/>
      <path d="M-120 40 q120 -18 240 0" fill="none" stroke="${NAVY}" stroke-width="4" opacity="0.7"/>
      <circle cx="0" cy="-30" r="46" fill="none" stroke="${GOLD}" stroke-width="7"/>
      <line x1="0" y1="-30" x2="46" y2="-30" stroke="${INK}" stroke-width="3"/>
    </g>
    ${figure({ cx: 620, cy: 610, scale: 0.88, robe: NAVY, hat: null, arm: 'raise' })}
  `),

  area_volume: () => wrap(`
    ${windowArch(560, 100, 200, 300)}
    <!-- Archimedes' sphere snug inside a cylinder, 2:3 volume ratio -->
    <g transform="translate(260 560)">
      <rect x="-60" y="-140" width="120" height="140" fill="none" stroke="${INK}" stroke-width="6"/>
      <ellipse cx="0" cy="-140" rx="60" ry="16" fill="none" stroke="${INK}" stroke-width="5"/>
      <ellipse cx="0" cy="0" rx="60" ry="16" fill="none" stroke="${INK}" stroke-width="5"/>
      <circle cx="0" cy="-70" r="58" fill="${NAVY}" opacity="0.55" stroke="${INK}" stroke-width="4"/>
    </g>
    ${figure({ cx: 480, cy: 610, scale: 0.9, robe: '#274a4a', hat: null, arm: 'raise' })}
  `),

  geometric_transformations: () => wrap(`
    <!-- Alhambra tessellation: one tile repeated via reflection/rotation, no gaps -->
    <g transform="translate(230 380)">
      ${[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => {
        const x = c * 84; const y = r * 84; const flip = (r + c) % 2
        return `<g transform="translate(${x} ${y})">
          <path d="M0 0 L84 0 L42 84 Z" fill="${flip ? NAVY : GOLD}" opacity="0.75" transform="${flip ? 'rotate(180 42 42)' : ''}"/>
        </g>`
      }).join('')).join('')}
      <rect x="0" y="0" width="336" height="336" fill="none" stroke="${INK}" stroke-width="4"/>
    </g>
    ${figure({ cx: 560, cy: 610, scale: 0.9, robe: '#4a2740', hat: 'cap', arm: 'point' })}
  `),

}

const CONCEPT_IDS = Object.keys(SCENES)

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--list')) {
    console.log(`${CONCEPT_IDS.length} hand-authored SVG scenes available:\n`)
    CONCEPT_IDS.forEach(id => console.log(' ', id))
    return
  }
  const targets = args.filter(a => !a.startsWith('--'))
  const toRun = targets.length ? targets : CONCEPT_IDS
  await mkdir(GENERATED_DIR, { recursive: true })
  for (const id of toRun) {
    if (!SCENES[id]) {
      console.log(`SKIP ${id}: no hand-authored scene defined`)
      continue
    }
    const svg = SCENES[id]()
    const outPath = resolve(GENERATED_DIR, `story-${id}.svg`)
    await writeFile(outPath, svg)
    console.log(`Wrote ${outPath} (${(svg.length / 1024).toFixed(1)} KB)`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
