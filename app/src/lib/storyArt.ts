/**
 * Cozy study-desk plates for chapter / practice canvases.
 * Always returns a real photo — never an empty box.
 *
 * Concept-accurate art pipeline: `app/scripts/generateConceptArt.mjs` drops
 * generated plates into `assets/canvas/generated/story-{conceptId}.jpg`. This
 * file auto-discovers them via import.meta.glob — no code edit needed to
 * register a newly generated concept, so re-running the script for more
 * concepts (once Higgsfield credits allow) is truly rerunnable, not a
 * one-off. GENERATED wins over the hand-picked ART map, which wins over the
 * theme fallback.
 *
 * Second source, same GENERATED map: `app/scripts/generateConceptArtSvg.mjs`
 * — hand-authored SVG illustrations for concepts Higgsfield credits don't
 * cover, dropped at `assets/canvas/generated/story-{conceptId}.svg` and
 * discovered by a parallel glob below. Same lookup path, same precedence
 * rule (jpg or svg, whichever exists, both win over ART/theme fallback) —
 * storyArtFor() stays the single function every caller uses either way.
 */
import fractions from '../assets/canvas/story-fractions.jpg'
import quadratics from '../assets/canvas/story-quadratics.jpg'
import probability from '../assets/canvas/story-probability.jpg'
import cover from '../assets/canvas/mindcraft-cover-hero.jpg'
import intro from '../assets/canvas/mindcraft-intro-banner.jpg'

const generatedPhotoModules = import.meta.glob<{ default: string }>(
  '../assets/canvas/generated/story-*.jpg',
  { eager: true },
)
const generatedSvgModules = import.meta.glob<{ default: string }>(
  '../assets/canvas/generated/story-*.svg',
  { eager: true },
)

/** conceptId -> generated plate url, keyed off the filename. Photo plates
 * take precedence over hand-authored SVGs when (hypothetically) both exist
 * for the same concept — same "most concept-accurate wins" precedence as
 * GENERATED already has over the hand-picked ART map. */
const GENERATED: Record<string, string> = {}
for (const [path, mod] of Object.entries(generatedSvgModules)) {
  const match = path.match(/story-([a-z0-9_]+)\.svg$/)
  if (match) GENERATED[match[1]] = mod.default
}
for (const [path, mod] of Object.entries(generatedPhotoModules)) {
  const match = path.match(/story-([a-z0-9_]+)\.jpg$/)
  if (match) GENERATED[match[1]] = mod.default
}

const ART: Record<string, string> = {
  fractions_decimals: fractions,
  ratios_proportions: fractions,
  order_of_operations: fractions,
  basic_equations: fractions,
  linear_equations: fractions,
  linear_inequalities: fractions,
  systems_of_linear_equations: fractions,
  measurement_units: fractions,
  percent_ratio: fractions,

  quadratic_equations: quadratics,
  polynomials: quadratics,
  factoring_polynomials: quadratics,
  radical_expressions: quadratics,
  exponent_rules: quadratics,
  exponential_functions: quadratics,
  functions_basics: quadratics,
  sequences_series: quadratics,
  trigonometry_basics: quadratics,
  coordinate_geometry: quadratics,

  basic_probability: probability,
  descriptive_statistics: probability,

  // Geometry — warm desk plates (we only ship a few photos for now)
  right_triangle_geometry: intro,
  circles_geometry: cover,
  area_volume: fractions,
  angle_relationships: intro,
  geometric_transformations: cover,
  lines_angles: intro,
  triangles_similarity: intro,
  solid_geometry: fractions,
}

/** Theme fallback so every concept gets a photo. */
function themeFallback(conceptId: string): string {
  if (/probabil|stat|combinator|matrix|complex/.test(conceptId)) return probability
  if (/quadrat|poly|exponent|function|log|sequence|trig|conic/.test(conceptId)) return quadratics
  if (/circle|triangle|angle|area|volume|geo|line/.test(conceptId)) return cover
  return fractions
}

export function storyArtFor(conceptId: string): string {
  return GENERATED[conceptId] ?? ART[conceptId] ?? themeFallback(conceptId)
}

/** True when this concept has real, concept-accurate generated art (not a
 * hand-picked shared photo or the theme fallback). Used for coverage
 * reporting only. */
export function hasConceptAccurateArt(conceptId: string): boolean {
  return conceptId in GENERATED
}

/** Deterministic “random” tilt in degrees for organic polaroid placement. */
export function storyArtTilt(seed: string, salt = 0): number {
  let h = salt * 17
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0
  return (h % 13) - 6 // −6° … +6°
}
