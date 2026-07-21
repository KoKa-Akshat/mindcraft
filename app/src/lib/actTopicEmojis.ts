/** Cute hand-picked emoji per ACT concept — not AI-generated icons. */
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
