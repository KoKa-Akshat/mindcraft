import { allowedLevels, getRecommendedLevel, type Confidence } from './bridgePractice'
import {
  getQuestions,
  getQuestionsForMisconceptionWeakness,
  type FormatId,
  type Question,
} from './questionBank'
import type { NextConcept, PracticeHubRecommendations } from './recommendNextConcept'
import type { CurriculumTrack } from './curriculumTrack'

export const CHAPTER_QUESTION_COUNT = 10

export type ChapterLearnerContext = {
  confidence?: Confidence
  seenIds?: string[]
  examType?: Question['examTag'] | 'General'
  grade?: number
  weakness?: NextConcept | null
  topMisconceptionGap?: NextConcept | null
}

export type ChapterQuestionLoaders = {
  loadProfile: () => Promise<{ curriculumTrack?: CurriculumTrack | null; grade?: number }>
  loadRecommendations: (track: CurriculumTrack | null) => Promise<PracticeHubRecommendations>
  loadDiagnostic: () => Promise<{
    exam: string | null
    confidenceMap: Record<string, string>
  } | null>
  listStudentWork: () => Promise<Array<{ conceptId?: string; questionId?: string }>>
}

export type ResolvedChapterQuestions = {
  questions: Question[]
  misconceptionGap: NextConcept | null
}

export function staticChapterQuestions(conceptId: string): Question[] {
  return dedupeQuestions([
    ...getQuestions(conceptId, 1, CHAPTER_QUESTION_COUNT),
    ...getQuestions(conceptId, 2, CHAPTER_QUESTION_COUNT),
    ...getQuestions(conceptId, 3, Math.ceil(CHAPTER_QUESTION_COUNT / 2)),
  ])
}

function dedupeQuestions(questions: Question[]): Question[] {
  const seen = new Set<string>()
  return questions.filter(q => {
    if (seen.has(q.question)) return false
    seen.add(q.question)
    return true
  }).slice(0, CHAPTER_QUESTION_COUNT)
}

/** Pure adapter from existing learner signals to the existing question-bank API. */
export function personalizedChapterQuestions(
  conceptId: string,
  context: ChapterLearnerContext | null,
): Question[] {
  if (!context) return staticChapterQuestions(conceptId)

  const misconception = context.topMisconceptionGap?.conceptId === conceptId
    ? context.topMisconceptionGap
    : null
  const weakness = context.weakness?.conceptId === conceptId ? context.weakness : null
  const format = weakness?.formatId
  const hasSignal = context.confidence != null || !!format || !!misconception
  if (!hasSignal) return staticChapterQuestions(conceptId)

  const preferred = getRecommendedLevel(context.confidence)
  const levels = allowedLevels(context.confidence)
  const orderedLevels = [preferred, ...levels.filter(level => level !== preferred)]
  const seenIds = context.seenIds ?? []
  const examType = context.examType ?? 'General'
  const perLevel = Math.ceil(CHAPTER_QUESTION_COUNT / orderedLevels.length)
  const questions = orderedLevels.flatMap(level => misconception
    ? getQuestionsForMisconceptionWeakness(
        conceptId,
        level,
        perLevel,
        seenIds,
        examType,
        format,
        { ingredientId: misconception.ingredientId, misconceptionId: misconception.misconceptionId },
      )
    : getQuestions(
        conceptId,
        level,
        perLevel,
        seenIds,
        examType,
        format,
        true,
        context.grade,
      ))

  const selected = dedupeQuestions(questions)
  return selected.length ? selected : staticChapterQuestions(conceptId)
}

/**
 * Resolve every asynchronous learner-model input as one fail-soft operation.
 * A sleeping or unavailable dependency can never prevent a static chapter.
 */
export async function resolveChapterQuestions(
  conceptId: string,
  staticQuestions: Question[],
  loaders: ChapterQuestionLoaders,
): Promise<ResolvedChapterQuestions> {
  try {
    const profile = await loaders.loadProfile()
    const track = profile.curriculumTrack ?? null
    const [recommendations, diagnostic, work] = await Promise.all([
      loaders.loadRecommendations(track),
      loaders.loadDiagnostic(),
      loaders.listStudentWork(),
    ])
    const misconceptionGap = recommendations.topMisconceptionGap?.conceptId === conceptId
      ? recommendations.topMisconceptionGap
      : null
    return {
      questions: personalizedChapterQuestions(conceptId, {
        confidence: diagnostic?.confidenceMap?.[conceptId] as Confidence | undefined,
        seenIds: work
          .filter(entry => entry.conceptId === conceptId && entry.questionId)
          .map(entry => entry.questionId!),
        examType: examForTrack(track, diagnostic?.exam),
        grade: typeof profile.grade === 'number' ? profile.grade : gradeForTrack(track),
        weakness: recommendations.weakness,
        topMisconceptionGap: misconceptionGap,
      }),
      misconceptionGap,
    }
  } catch {
    return { questions: staticQuestions, misconceptionGap: null }
  }
}

export function emphasizedChapterStory(
  defaultStory: string,
  ingredientStories: Record<string, unknown>,
  gap: NextConcept | null | undefined,
  conceptId: string,
): string {
  if (!gap?.ingredientId || gap.conceptId !== conceptId) return defaultStory
  const targeted = ingredientStories[gap.ingredientId]
  return typeof targeted === 'string' && targeted.trim() ? targeted : defaultStory
}

export function gradeForTrack(track: string | null | undefined): number | undefined {
  if (track === 'middle_school') return 8
  if (track === 'high_school') return 10
  if (track === 'act_prep') return 11
  return undefined
}

export function examForTrack(track: string | null | undefined, diagnosticExam?: string | null): Question['examTag'] | 'General' {
  if (track === 'act_prep') return 'ACT'
  if (diagnosticExam === 'ACT' || diagnosticExam === 'SAT') return diagnosticExam
  return 'General'
}
