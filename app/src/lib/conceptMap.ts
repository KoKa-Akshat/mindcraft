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
  'Absolute Value':        'absolute_value',
  'Linear Inequalities':   'linear_inequalities',
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
  'Function Transformations': 'function_transformations',

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
  'Graphs & Statistics':   'statistics_graphs',
  'Data Interpretation':   'data_interpretation',
  'Probability':           'basic_probability',
  'Normal Distribution':   'probability_distributions',
  'Combinatorics':         'basic_probability',

  // Misc
  'Fractions':             'fractions_decimals',
  'Order of Operations':   'order_of_operations',
  'Ratios':                'ratios_proportions',
  'Percents':              'percent_ratio',
  'Number Properties':     'number_properties',
  'Word Problems':         'word_problems',
}

// ML ontology ID → human-readable label
export const ML_TO_LABEL: Record<string, string> = {
  'arithmetic_operations':         'Arithmetic',
  'fractions_decimals':            'Fractions & Decimals',
  'ratios_proportions':            'Ratios & Proportions',
  'percent_ratio':                 'Percents & Ratios',
  'number_properties':             'Number Properties',
  'order_of_operations':           'Order of Operations',
  'basic_equations':               'Basic Equations',
  'linear_equations':              'Linear Equations',
  'absolute_value':                'Absolute Value',
  'linear_inequalities':           'Linear Inequalities',
  'inequalities_graphs':           'Inequalities & Graphs',
  'exponent_rules':                'Exponents',
  'radical_expressions':           'Radical Expressions',
  'polynomials':                   'Polynomials',
  'factoring_polynomials':         'Factoring',
  'quadratic_equations':           'Quadratic Equations',
  'complex_numbers':               'Complex Numbers',
  'rational_expressions':          'Rational Expressions',
  'systems_of_linear_equations':   'Systems of Equations',
  'word_problems':                 'Word Problems',
  'functions_basics':              'Functions',
  'function_transformations':      'Function Transformations',
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
  'statistics_graphs':             'Statistics & Graphs',
  'data_interpretation':           'Data Interpretation',
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
 * Prerequisite graph — each concept maps to the ML IDs it directly requires.
 * Used by the Learning GPS to build personalized mastery paths.
 */
export const PREREQUISITES: Record<string, string[]> = {
  'arithmetic_operations':       [],
  'fractions_decimals':          ['arithmetic_operations'],
  'ratios_proportions':          ['fractions_decimals', 'arithmetic_operations'],
  'percent_ratio':               ['fractions_decimals', 'ratios_proportions'],
  'number_properties':           ['arithmetic_operations'],
  'order_of_operations':         ['arithmetic_operations'],
  'basic_equations':             ['arithmetic_operations', 'order_of_operations'],
  'linear_equations':            ['basic_equations'],
  'absolute_value':              ['linear_equations', 'linear_inequalities'],
  'linear_inequalities':         ['linear_equations'],
  'inequalities_graphs':         ['linear_inequalities', 'coordinate_geometry'],
  'exponent_rules':              ['basic_equations', 'arithmetic_operations'],
  'radical_expressions':         ['exponent_rules'],
  'polynomials':                 ['basic_equations', 'exponent_rules'],
  'factoring_polynomials':       ['polynomials'],
  'quadratic_equations':         ['factoring_polynomials', 'polynomials'],
  'complex_numbers':             ['quadratic_equations'],
  'rational_expressions':        ['polynomials', 'factoring_polynomials'],
  'systems_of_linear_equations': ['linear_equations'],
  'word_problems':               ['linear_equations', 'systems_of_linear_equations'],
  'functions_basics':            ['linear_equations', 'basic_equations'],
  'function_transformations':    ['functions_basics'],
  'exponential_functions':       ['functions_basics', 'exponent_rules'],
  'logarithmic_functions':       ['exponential_functions', 'functions_basics'],
  'sequences_series':            ['functions_basics', 'linear_equations', 'exponent_rules'],
  'matrices':                    ['systems_of_linear_equations', 'linear_equations'],
  'vectors':                     ['matrices', 'coordinate_geometry'],
  'lines_angles':                ['arithmetic_operations'],
  'triangles_congruence':        ['lines_angles'],
  'circles_geometry':            ['lines_angles', 'arithmetic_operations'],
  'area_volume':                 ['triangles_congruence', 'circles_geometry'],
  'geometric_transformations':   ['coordinate_geometry'],
  'coordinate_geometry':         ['linear_equations'],
  'right_triangle_geometry':     ['triangles_congruence'],
  'trigonometry_basics':         ['right_triangle_geometry', 'functions_basics'],
  'trigonometric_identities':    ['trigonometry_basics'],
  'conic_sections':              ['quadratic_equations', 'coordinate_geometry'],
  'limits_continuity':           ['functions_basics', 'factoring_polynomials'],
  'derivatives':                 ['limits_continuity', 'functions_basics'],
  'applications_of_derivatives': ['derivatives'],
  'integrals':                   ['derivatives'],
  'applications_of_integrals':   ['integrals'],
  'descriptive_statistics':      ['arithmetic_operations', 'fractions_decimals'],
  'statistics_graphs':           ['descriptive_statistics'],
  'data_interpretation':         ['descriptive_statistics', 'ratios_proportions'],
  'basic_probability':           ['fractions_decimals', 'arithmetic_operations'],
  'probability_distributions':   ['basic_probability', 'descriptive_statistics'],
  'inferential_statistics':      ['probability_distributions', 'descriptive_statistics'],
  'circular_trigonometry':       ['trigonometry_basics'],
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
