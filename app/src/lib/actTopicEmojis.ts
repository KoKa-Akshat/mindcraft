/**
 * Superseded for VISUAL rendering by `lib/conceptIcon.ts` (2026-07-23)  -  the
 * TOC list and Map now render a hand-authored, concept-locked SVG badge
 * instead of these emoji (Akshat: "why does fractions and decimals have a
 * pizza slice lmao"  -  a generic pun, not a real depiction, next to real
 * per-concept art everywhere else). Kept on disk only as a plain-text/alt
 * fallback if some future caller needs a one-character label instead of an
 * image; do not wire this back into the TOC/Map rendering path.
 */
/** Cute hand-picked emoji per ACT concept  -  not AI-generated icons. */
export const ACT_TOPIC_EMOJI: Record<string, string> = {
  fractions_decimals: '🍕',
  ratios_proportions: '⚖️',
  order_of_operations: '🧮',
  basic_equations: '🔑',
  number_properties: '🔢',
  measurement_units: '📏',
  algebraic_manipulation: '✏️',
  linear_equations: '📈',
  functions_basics: 'ƒ',
  right_triangle_geometry: '📐',
  trigonometry_basics: '🌊',
  linear_inequalities: '≷',
  systems_of_linear_equations: '🔗',
  exponent_rules: '⚡',
  polynomials: '🌿',
  factoring_polynomials: '🧩',
  radical_expressions: '√',
  quadratic_equations: '🏔️',
  descriptive_statistics: '📊',
  basic_probability: '🎲',
  exponential_functions: '🚀',
  sequences_series: '⋯',
  lines_angles: '∠',
  triangles_congruence: '△',
  circles_geometry: '⭕',
  area_volume: '📦',
  geometric_transformations: '🔄',
  representation_translation: '🗺️',
  act_strategy: '🎯',
}

export function topicEmoji(conceptId: string): string {
  return ACT_TOPIC_EMOJI[conceptId] ?? '⭐'
}
