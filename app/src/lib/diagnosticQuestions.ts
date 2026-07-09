import { getQuestions, shuffle, questionFormat, inferQuestionFormat, isStoryCellQuestion, type Question } from './questionBank'
import { buildStoryDisplay } from './storyDisplay'
import type { CurriculumTrack } from './curriculumTrack'
import type { Confidence } from './bridgePractice'

const G7 = [
  'fractions_decimals', 'ratios_proportions', 'order_of_operations', 'number_properties',
  'descriptive_statistics', 'area_volume', 'lines_angles', 'measurement_units', 'basic_probability',
]
const G8 = [...G7, 'linear_equations', 'exponent_rules', 'right_triangle_geometry', 'triangles_congruence']
const G9 = [...G8, 'linear_inequalities', 'systems_of_linear_equations', 'functions_basics', 'geometric_transformations']
const G10 = [...G9, 'quadratic_equations', 'factoring_polynomials', 'radical_expressions', 'exponential_functions', 'sequences_series']
const G11 = [...G10, 'circles_geometry', 'trigonometry_basics', 'coordinate_geometry']

export const GRADE_CONCEPTS: Record<number, string[]> = {
  7: G7, 8: G8, 9: G9, 10: G10, 11: G11,
}

export const GRADE_STORY: Record<number, string> = {
  7: 'fractions_decimals',
  8: 'linear_equations',
  9: 'functions_basics',
  10: 'quadratic_equations',
  11: 'linear_equations',
}

export const GOAL_EXTRAS: Record<string, string[]> = {
  act_prep: ['geometric_transformations', 'circles_geometry', 'area_volume', 'trigonometry_basics'],
  get_unstuck: ['systems_of_linear_equations', 'factoring_polynomials', 'sequences_series'],
}

export function conceptsForGradeAndGoals(grade: number, goals: string[]): string[] {
  const base = [...(GRADE_CONCEPTS[grade] ?? G9)]
  const extras = new Set(base)
  for (const goal of goals) {
    for (const c of GOAL_EXTRAS[goal] ?? []) extras.add(c)
  }
  return [...extras]
}

/** Skip stems that render blank or broken after LaTeX parsing. */
// Choices like "![label]()" are image-only with empty src — unrenderable as text.
const IMAGE_ONLY_CHOICE = /^!\[[^\]]*\]\(\s*\)$/

export function isRenderableQuestion(q: Question): boolean {
  const stripped = q.question
    .replace(/\$\$[\s\S]*?\$\$/g, ' M ')
    .replace(/\$[^$\n]+\$/g, ' M ')
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped.length < 12) return false
  if (/if\s*,\s*what/i.test(stripped)) return false
  if (/^\s*if\s+what/i.test(stripped)) return false
  if ((q.choices?.length ?? 0) < 4) return false
  if (q.choices.some(c => !String(c ?? '').trim())) return false
  // Reject if any choice is a bare image tag with no text alternative
  if (q.choices.some(c => IMAGE_ONLY_CHOICE.test(String(c ?? '').trim()))) return false
  return true
}

function storyVisualScore(q: Question): number {
  const d = buildStoryDisplay(q)
  if (d.table) return 4
  if (d.visual === 'polygon') return 3
  if (d.visual === 'vignette') return 2
  if (d.visual === 'figure') return 1
  return 0
}

export function pickBestProbe(pool: Question[]): Question | undefined {
  if (!pool.length) return undefined
  const ranked = [...pool].sort((a, b) => storyVisualScore(b) - storyVisualScore(a))
  return ranked[0]
}

/** Difficulty bands for onboarding — never L3 (too punishing for a welcome diagnostic). */
function levelsForGrade(grade: number): (1 | 2)[] {
  if (grade <= 8) return [1]
  return [1, 2]
}

function poolForConcept(conceptId: string, levels: (1 | 2)[], perLevel = 6): Question[] {
  return shuffle(levels.flatMap(l => getQuestions(conceptId, l, perLevel, [], 'General')))
}

/** Spread ~10 playable probes across the student's grade scope.
 *  Optional story-cell slots (rich misconception signal) + bank probes at grade-appropriate levels. */
export function pickDiagnosticQuestions(
  grade: number,
  goalTags: string[],
  target = 10,
  storyCellSlots = 0,
): Question[] {
  const concepts = shuffle(conceptsForGradeAndGoals(grade, goalTags))
  const levels = levelsForGrade(grade)
  const picked: Question[] = []
  const usedIds = new Set<string>()

  if (storyCellSlots > 0) {
    for (const conceptId of concepts) {
      if (picked.filter(isStoryCellQuestion).length >= storyCellSlots) break
      const cell = getQuestions(conceptId, 2, 1, [...usedIds], 'General', undefined, true)[0]
      if (cell && isRenderableQuestion(cell) && !usedIds.has(cell.id)) {
        picked.push(cell)
        usedIds.add(cell.id)
      }
    }
  }

  for (const conceptId of concepts) {
    if (picked.length >= target) break
    const pool = poolForConcept(conceptId, levels).filter(
      q => isRenderableQuestion(q) && !usedIds.has(q.id) && !isStoryCellQuestion(q),
    )
    const best = pickBestProbe(pool)
    if (best) {
      picked.push(best)
      usedIds.add(best.id)
    }
  }

  if (picked.length < Math.min(target, 6)) {
    for (const conceptId of concepts) {
      if (picked.length >= target) break
      const pool = poolForConcept(conceptId, levels, 10).filter(
        q => isRenderableQuestion(q) && !usedIds.has(q.id),
      )
      for (const q of pool) {
        if (picked.length >= target) break
        picked.push(q)
        usedIds.add(q.id)
      }
    }
  }

  return picked.slice(0, target)
}

export function curriculumTrackFor(grade: number, goalTags: string[]): CurriculumTrack {
  if (goalTags.includes('act_prep') || grade >= 11) return 'act_prep'
  if (grade <= 8) return 'middle_school'
  return 'high_school'
}

export function examForGoals(goalTags: string[]): 'ACT' | 'General' {
  return goalTags.includes('act_prep') ? 'ACT' : 'General'
}

/** Prior-grade exposure → kinda; new-grade concepts → hard (seed before probes). */
export function gradeConfidence(grade: number, goalTags: string[]): Record<string, Confidence> {
  const concepts = conceptsForGradeAndGoals(grade, goalTags)
  const priorGrade = GRADE_CONCEPTS[grade - 1] ?? []
  const conf: Record<string, Confidence> = {}
  for (const c of concepts) {
    conf[c] = priorGrade.includes(c) ? 'kinda' : 'hard'
  }
  return conf
}
