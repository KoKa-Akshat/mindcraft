/**
 * conceptMap.ts
 *
 * Bidirectional mapping between the legacy concept-graph.ts display names
 * (e.g. "Calculus 1", "Quadratic Equations") and the ML ontology snake_case
 * IDs (e.g. "limits_continuity", "quadratic_equations").
 *
 * Used by KnowledgeGraph.tsx to bridge the two systems.
 */

// Legacy display name → ML ontology ID
export const LEGACY_TO_ML: Record<string, string> = {
  // Core algebra
  'Algebra':               'basic_equations',
  'Linear Equations':      'linear_equations',
  'Quadratic Equations':   'quadratic_equations',
  'Polynomials':           'polynomials',
  'Factoring':             'factoring_polynomials',
  'Systems of Equations':  'systems_of_linear_equations',

  // Exponents & logs
  'Exponents':             'exponent_rules',
  'Logarithms':            'logarithmic_functions',
  'Natural Log':           'logarithmic_functions',
  'Log Properties':        'logarithmic_functions',
  'Change of Base':        'logarithmic_functions',
  "Euler's Number":        'exponential_functions',
  'Scientific Notation':   'exponent_rules',

  // Functions
  'Functions':             'functions_basics',

  // Calculus
  'Calculus 1':            'limits_continuity',
  'Limits':                'limits_continuity',
  'Derivatives':           'derivatives',
  'Chain Rule':            'derivatives',
  'Product Rule':          'derivatives',
  'Integrals':             'integrals',
  'Antiderivatives':       'integrals',
  'Area Under Curve':      'applications_of_integrals',
  "L'Hôpital's Rule":     'limits_continuity',
  'Continuity':            'limits_continuity',

  // Geometry & trig
  'Trigonometry':          'trigonometry_basics',
  'Unit Circle':           'trigonometry_basics',

  // Statistics
  'Statistics':            'descriptive_statistics',
  'Probability':           'basic_probability',
  'Normal Distribution':   'probability_distributions',
  'Combinatorics':         'basic_probability',

  // Misc
  'Fractions':             'fractions_decimals',
  'Order of Operations':   'order_of_operations',
  'Ratios':                'ratios_proportions',
}

// ML ontology ID → human-readable label
export const ML_TO_LABEL: Record<string, string> = {
  'arithmetic_operations':         'Arithmetic',
  'fractions_decimals':            'Fractions & Decimals',
  'ratios_proportions':            'Ratios & Proportions',
  'order_of_operations':           'Order of Operations',
  'basic_equations':               'Basic Equations',
  'linear_equations':              'Linear Equations',
  'linear_inequalities':           'Linear Inequalities',
  'exponent_rules':                'Exponents',
  'radical_expressions':           'Radical Expressions',
  'polynomials':                   'Polynomials',
  'factoring_polynomials':         'Factoring',
  'quadratic_equations':           'Quadratic Equations',
  'rational_expressions':          'Rational Expressions',
  'systems_of_linear_equations':   'Systems of Equations',
  'functions_basics':              'Functions',
  'exponential_functions':         'Exponential Functions',
  'logarithmic_functions':         'Logarithms',
  'sequences_series':              'Sequences & Series',
  'matrices':                      'Matrices',
  'vectors':                       'Vectors',
  'lines_angles':                  'Lines & Angles',
  'triangles_congruence':          'Triangles',
  'circles_geometry':              'Circles',
  'area_volume':                   'Area & Volume',
  'geometric_transformations':     'Transformations',
  'coordinate_geometry':           'Coordinate Geometry',
  'right_triangle_geometry':       'Right Triangles',
  'trigonometry_basics':           'Trigonometry',
  'trigonometric_identities':      'Trig Identities',
  'conic_sections':                'Conic Sections',
  'limits_continuity':             'Limits',
  'derivatives':                   'Derivatives',
  'applications_of_derivatives':   'Applied Derivatives',
  'integrals':                     'Integrals',
  'applications_of_integrals':     'Applied Integrals',
  'descriptive_statistics':        'Descriptive Stats',
  'basic_probability':             'Probability',
  'probability_distributions':     'Distributions',
  'inferential_statistics':        'Inferential Stats',
  'circular_trigonometry':         'Circular Trig',
}

/**
 * Convert a legacy display name to an ML ontology ID.
 * Falls back to snake_case conversion if no mapping exists.
 */
export function legacyToMlId(legacyName: string): string {
  return LEGACY_TO_ML[legacyName] ?? legacyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

/**
 * Convert an ML ontology ID to a human-readable label.
 * Falls back to title-casing the ID.
 */
export function mlIdToLabel(mlId: string): string {
  return ML_TO_LABEL[mlId] ?? mlId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Given any concept identifier (legacy name or ML ID), return the ML ID.
 */
export function resolveConceptId(input: string): string {
  // Check if it's already an ML ID
  if (ML_TO_LABEL[input]) return input
  // Try legacy mapping
  if (LEGACY_TO_ML[input]) return LEGACY_TO_ML[input]
  // Fallback: snake_case it
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
}