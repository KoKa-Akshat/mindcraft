/**
 * Concepts where a polynomial-in-x graph is directly meaningful. GraphBox's
 * parser only reads polynomial expressions (see lib/polynomialExpression.ts),
 * so consumers should default GraphBox open only for these; every other
 * concept still gets the panel, just collapsed (same collapsible-panel
 * pattern as ScientificCalcToggle elsewhere).
 *
 * Shared between Practice.tsx (standalone /practice route) and
 * ConceptChapterPage.tsx (inline quest panels) so the two GraphBox wire-ups
 * never drift apart.
 */
export const GRAPHABLE_CONCEPT_IDS = new Set([
  'linear_equations', 'linear_inequalities', 'systems_of_linear_equations',
  'polynomials', 'factoring_polynomials', 'quadratic_equations',
  'functions_basics', 'function_transformations',
])
