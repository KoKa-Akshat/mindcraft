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

// All concept IDs below are canonical ontology IDs (data/5_level_ontology). Topics
// without a distinct ontology concept fold into their closest one:
//   percent_ratio -> ratios_proportions, word_problems -> representation_translation,
//   data_interpretation -> descriptive_statistics, function_transformations ->
//   functions_basics, absolute_value -> linear_inequalities.
const ACT_CONCEPTS = [
  'number_properties',
  'ratios_proportions',
  'linear_equations',
  'linear_inequalities',
  'systems_of_linear_equations',
  'exponent_rules',
  'polynomials',
  'quadratic_equations',
  'rational_expressions',
  'functions_basics',
  'representation_translation',
  'descriptive_statistics',
  'basic_probability',
]

const SAT_CONCEPTS = [
  'linear_equations',
  'linear_inequalities',
  'systems_of_linear_equations',
  'quadratic_equations',
  'polynomials',
  'rational_expressions',
  'exponent_rules',
  'functions_basics',
  'representation_translation',
  'ratios_proportions',
  'descriptive_statistics',
  'basic_probability',
]

const IB_AI_SL_CONCEPTS = [
  'number_properties',
  'ratios_proportions',
  'linear_equations',
  'linear_inequalities',
  'systems_of_linear_equations',
  'exponent_rules',
  'polynomials',
  'quadratic_equations',
  'rational_expressions',
  'functions_basics',
  'representation_translation',
  'descriptive_statistics',
  'basic_probability',
]

const AP_CONCEPTS = [
  'functions_basics',
  'exponent_rules',
  'polynomials',
  'rational_expressions',
  'descriptive_statistics',
  'basic_probability',
  'representation_translation',
  'linear_equations',
  'quadratic_equations',
]

export const EXAM_CURRICULA: Record<ExamCurriculumKey, ExamCurriculum> = {
  ACT: {
    id: 'ACT',
    label: 'ACT Math',
    conceptIds: ACT_CONCEPTS,
    prerequisites: pickPrerequisites(ACT_CONCEPTS, {
      representation_translation: ['linear_equations', 'systems_of_linear_equations', 'ratios_proportions'],
    }),
    generationNotes: 'Prioritize speed, short stems, common traps, and mixed algebra/geometry contexts.',
  },
  SAT: {
    id: 'SAT',
    label: 'Digital SAT Math',
    conceptIds: SAT_CONCEPTS,
    prerequisites: pickPrerequisites(SAT_CONCEPTS, {
      functions_basics: ['linear_equations'],
      representation_translation: ['linear_equations', 'ratios_proportions', 'descriptive_statistics'],
    }),
    generationNotes: 'Prioritize context translation, units, tables, graphs, and equivalent forms.',
  },
  IB: {
    id: 'IB',
    label: 'IB Math AI SL',
    conceptIds: IB_AI_SL_CONCEPTS,
    prerequisites: pickPrerequisites(IB_AI_SL_CONCEPTS, {
      descriptive_statistics: ['ratios_proportions', 'number_properties'],
      basic_probability: ['ratios_proportions', 'descriptive_statistics'],
      representation_translation: ['linear_equations', 'ratios_proportions', 'functions_basics'],
    }),
    generationNotes: 'Prioritize modelling, calculator fluency, graph/table interpretation, statistics, probability, financial growth, and written conclusions. Do not use calculus for AI SL.',
  },
  AP: {
    id: 'AP',
    label: 'AP Math',
    conceptIds: AP_CONCEPTS,
    prerequisites: pickPrerequisites(AP_CONCEPTS, {
      representation_translation: ['linear_equations', 'functions_basics'],
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
