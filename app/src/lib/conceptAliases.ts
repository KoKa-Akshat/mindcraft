/**
 * Canonical concept ID alias map.
 *
 * Maps legacy / alternate IDs used in the static bank or old annotation
 * rounds to the canonical snake_case IDs in the v2.6+ standardized ontology.
 *
 * Rules:
 *  - Never create a duplicate concept for an alias — always normalize to the canonical.
 *  - Add new entries here when old bank IDs diverge from ontology IDs.
 *  - Cross-cutting meta-tags (act_strategy, representation_translation) are valid
 *    secondaryConceptIds but should NOT be primary practice buckets.
 *  - Advanced/non-ACT topics (limits_continuity, derivatives, integrals, vectors,
 *    applications_of_*) are excluded from ACT exam mode at the pathfinder layer —
 *    alias mapping here is for ID normalization only.
 */
export const CONCEPT_ID_ALIASES: Record<string, string> = {
  // Legacy static bank IDs → canonical ontology IDs
  percent_ratio:               'ratios_proportions',
  coordinate_geometry:         'linear_equations',
  data_interpretation:         'descriptive_statistics',
  statistics_graphs:           'descriptive_statistics',
  word_problems:               'representation_translation',
  absolute_value:              'linear_inequalities',
  function_transformations:    'functions_basics',
  trigonometric_identities:    'trigonometry_basics',
  polynomials:                 'polynomial_operations',

  // v3.0 / annotation-round legacy IDs → canonical
  polynomial_operations:       'polynomial_operations',   // identity — canonical in v3.0
  systems_linear_equations:    'systems_of_linear_equations',
  basics_of_functions:         'functions_basics',
  basic_one_variable_equations:'basic_equations',
  geometry_circles:            'circles_geometry',
  geometry_of_circles:         'circles_geometry',
  lines_and_angles:            'lines_angles',
  area_and_volume:             'area_volume',
  sequences_and_series:        'sequences_series',
  triangles_and_congruence:    'triangles_congruence',
  number_properties_factors_divisibility: 'number_properties',
  units_measurement_dimensional_reasoning: 'measurement_units',
  algebraic_structure_symbolic_manipulation: 'algebraic_manipulation',
  representation_translation_mathematical_modeling: 'representation_translation',
  act_mathematical_strategy_test_taking_heuristics: 'act_strategy',
}

/** Normalize any concept ID to its canonical form. Returns the input unchanged
 *  if no alias exists (safe to call on already-canonical IDs). */
export function canonicalConceptId(id: string): string {
  return CONCEPT_ID_ALIASES[id] ?? id
}

/**
 * Cross-cutting concept IDs that should appear as secondary/meta tags on
 * questions, not as standalone practice drill buckets.
 */
export const CROSS_CUTTING_CONCEPT_IDS = new Set([
  'act_strategy',
  'representation_translation',
])

/**
 * Advanced / non-ACT concept IDs excluded from ACT exam mode.
 * They are valid ontology nodes (for IB/AP paths) but the ACT pathfinder
 * must not surface them as exam targets.
 */
export const NON_ACT_CONCEPT_IDS = new Set([
  'limits_continuity',
  'derivatives',
  'applications_of_derivatives',
  'integrals',
  'applications_of_integrals',
  'vectors',
  'inferential_statistics',
  'probability_distributions',
])

/**
 * Foundational concepts: valid as both direct practice drills AND as ingredients
 * inside harder multi-step questions. The pathfinder may surface these as
 * prerequisites even when a student's primary weakness is in a core concept.
 */
export const FOUNDATIONAL_CONCEPT_IDS = new Set([
  'algebraic_manipulation',
  'basic_equations',
  'fractions_decimals',
  'measurement_units',
  'order_of_operations',
  'number_properties',
])
