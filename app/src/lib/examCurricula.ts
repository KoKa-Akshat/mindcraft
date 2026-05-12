import { PREREQUISITES } from './conceptMap'

export type ExamCurriculumKey = 'ACT' | 'SAT' | 'IB' | 'AP' | 'General'

export type ExamCurriculum = {
  id: ExamCurriculumKey
  label: string
  conceptIds: string[]
  prerequisites: Record<string, string[]>
  generationNotes: string
}

function pickPrerequisites(conceptIds: string[], overrides: Record<string, string[]> = {}) {
  const allowed = new Set(conceptIds)
  return Object.fromEntries(
    conceptIds.map(id => {
      const prereqs = overrides[id] ?? PREREQUISITES[id] ?? []
      return [id, prereqs.filter(prereq => allowed.has(prereq))]
    }),
  )
}

const ACT_CONCEPTS = [
  'number_properties',
  'percent_ratio',
  'linear_equations',
  'linear_inequalities',
  'absolute_value',
  'systems_of_linear_equations',
  'exponent_rules',
  'polynomials',
  'quadratic_equations',
  'rational_expressions',
  'functions_basics',
  'function_transformations',
  'word_problems',
  'descriptive_statistics',
  'basic_probability',
]

const SAT_CONCEPTS = [
  'linear_equations',
  'linear_inequalities',
  'systems_of_linear_equations',
  'absolute_value',
  'quadratic_equations',
  'polynomials',
  'rational_expressions',
  'exponent_rules',
  'functions_basics',
  'function_transformations',
  'word_problems',
  'percent_ratio',
  'descriptive_statistics',
  'basic_probability',
]

const IB_AI_SL_CONCEPTS = [
  'number_properties',
  'percent_ratio',
  'linear_equations',
  'linear_inequalities',
  'systems_of_linear_equations',
  'exponent_rules',
  'polynomials',
  'quadratic_equations',
  'rational_expressions',
  'functions_basics',
  'function_transformations',
  'word_problems',
  'descriptive_statistics',
  'basic_probability',
]

const AP_CONCEPTS = [
  'functions_basics',
  'function_transformations',
  'exponent_rules',
  'polynomials',
  'rational_expressions',
  'descriptive_statistics',
  'basic_probability',
  'word_problems',
  'linear_equations',
  'quadratic_equations',
]

export const EXAM_CURRICULA: Record<ExamCurriculumKey, ExamCurriculum> = {
  ACT: {
    id: 'ACT',
    label: 'ACT Math',
    conceptIds: ACT_CONCEPTS,
    prerequisites: pickPrerequisites(ACT_CONCEPTS, {
      word_problems: ['linear_equations', 'systems_of_linear_equations', 'percent_ratio'],
      coordinate_geometry: ['linear_equations', 'functions_basics'],
      trigonometry_basics: ['right_triangle_geometry'],
    }),
    generationNotes: 'Prioritize speed, short stems, common traps, and mixed algebra/geometry contexts.',
  },
  SAT: {
    id: 'SAT',
    label: 'Digital SAT Math',
    conceptIds: SAT_CONCEPTS,
    prerequisites: pickPrerequisites(SAT_CONCEPTS, {
      data_interpretation: ['descriptive_statistics', 'percent_ratio', 'linear_equations'],
      functions_basics: ['linear_equations'],
      coordinate_geometry: ['linear_equations', 'functions_basics'],
    }),
    generationNotes: 'Prioritize context translation, units, tables, graphs, and equivalent forms.',
  },
  IB: {
    id: 'IB',
    label: 'IB Math AI SL',
    conceptIds: IB_AI_SL_CONCEPTS,
    prerequisites: pickPrerequisites(IB_AI_SL_CONCEPTS, {
      descriptive_statistics: ['percent_ratio', 'number_properties'],
      statistics_graphs: ['descriptive_statistics', 'data_interpretation'],
      data_interpretation: ['descriptive_statistics', 'percent_ratio', 'linear_equations'],
      basic_probability: ['percent_ratio', 'descriptive_statistics'],
      exponential_functions: ['functions_basics', 'exponent_rules', 'percent_ratio'],
      logarithmic_functions: ['exponential_functions', 'functions_basics'],
      sequences_series: ['linear_equations', 'functions_basics', 'percent_ratio'],
      word_problems: ['linear_equations', 'percent_ratio', 'functions_basics'],
    }),
    generationNotes: 'Prioritize modelling, calculator fluency, graph/table interpretation, statistics, probability, financial growth, and written conclusions. Do not use calculus for AI SL.',
  },
  AP: {
    id: 'AP',
    label: 'AP Math',
    conceptIds: AP_CONCEPTS,
    prerequisites: pickPrerequisites(AP_CONCEPTS, {
      limits_continuity: ['functions_basics', 'factoring_polynomials'],
      derivatives: ['limits_continuity', 'functions_basics'],
      applications_of_derivatives: ['derivatives'],
      integrals: ['derivatives'],
      applications_of_integrals: ['integrals'],
    }),
    generationNotes: 'Prioritize notation, function behavior, rates of change, graphical reasoning, and interval language.',
  },
  General: {
    id: 'General',
    label: 'General Math',
    conceptIds: ACT_CONCEPTS,
    prerequisites: pickPrerequisites(ACT_CONCEPTS),
    generationNotes: 'Prioritize broad high-school readiness and clear skill repair.',
  },
}

export function getExamConceptIds(exam: string) {
  return (EXAM_CURRICULA[exam as ExamCurriculumKey] ?? EXAM_CURRICULA.General).conceptIds
}

export function getExamPrerequisites(exam: string) {
  return (EXAM_CURRICULA[exam as ExamCurriculumKey] ?? EXAM_CURRICULA.General).prerequisites
}

export function getExamGenerationNotes(exam: string) {
  return (EXAM_CURRICULA[exam as ExamCurriculumKey] ?? EXAM_CURRICULA.General).generationNotes
}
