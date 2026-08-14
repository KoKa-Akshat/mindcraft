import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getQuestions, getTargeted } = vi.hoisted(() => ({
  getQuestions: vi.fn((_concept: string, level: 1 | 2 | 3) => [
    { id: `q-${level}`, question: `question-${level}`, level },
  ]),
  getTargeted: vi.fn((_concept: string, level: 1 | 2 | 3) => [
    { id: `target-${level}`, question: `target-${level}`, level },
  ]),
}))

vi.mock('./questionBank', () => ({
  getQuestions,
  getQuestionsForMisconceptionWeakness: getTargeted,
}))

import {
  emphasizedChapterStory,
  personalizedChapterQuestions,
  resolveChapterQuestions,
  staticChapterQuestions,
} from './bookPersonalization'
import fresh from './__fixtures__/book-fresh-student.json'
import formatGap from './__fixtures__/book-format-gap.json'
import misconceptionGap from './__fixtures__/book-misconception-gap.json'
import engineFailure from './__fixtures__/book-engine-failure.json'

describe('book learner-model adaptation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the exact static draw for a fresh student', () => {
    const expected = staticChapterQuestions('linear_equations').map(q => q.id)
    vi.clearAllMocks()
    const actual = personalizedChapterQuestions('linear_equations', {
      weakness: fresh.weakness,
      topMisconceptionGap: fresh.topMisconceptionGap,
    }).map(q => q.id)
    expect(actual).toEqual(expected)
    expect(getQuestions).toHaveBeenCalledTimes(3)
    expect(getQuestions.mock.calls.map(call => call.slice(0, 3))).toEqual([
      ['linear_equations', 1, 10],
      ['linear_equations', 2, 10],
      ['linear_equations', 3, 5],
    ])
  })

  it('passes a format gap and story preference to the question bank', () => {
    personalizedChapterQuestions('linear_equations', {
      confidence: 'kinda',
      weakness: formatGap.weakness as never,
    })
    expect(getQuestions).toHaveBeenCalledWith(
      'linear_equations', 2, 10, [], 'General', 'table', true, undefined,
    )
  })

  it('targets and leads with a covered misconception ingredient', () => {
    personalizedChapterQuestions('fractions_decimals', {
      confidence: 'hard',
      topMisconceptionGap: misconceptionGap.topMisconceptionGap as never,
    })
    expect(getTargeted).toHaveBeenCalled()
    const gap = misconceptionGap.topMisconceptionGap as never
    expect(emphasizedChapterStory('default', {
      fractions_decimals__part_whole_meaning: 'targeted opening',
    }, gap, 'fractions_decimals')).toBe('targeted opening')
    expect(emphasizedChapterStory('default', {}, gap, 'fractions_decimals')).toBe('default')
  })

  it.each([
    [`HTTP ${engineFailure.error.status}`, new Error(`HTTP ${engineFailure.error.status}`)],
    [engineFailure.error.kind, new Error(engineFailure.error.kind)],
  ])('returns the static chapter when recommendations reject with %s', async (_label, rejection) => {
    const staticQuestions = staticChapterQuestions('linear_equations')
    const resultPromise = resolveChapterQuestions('linear_equations', staticQuestions, {
      loadProfile: async () => ({ curriculumTrack: 'act_prep', grade: 11 }),
      loadRecommendations: vi.fn().mockRejectedValue(rejection),
      loadDiagnostic: async () => ({
        exam: 'ACT',
        confidenceMap: { linear_equations: 'hard' },
      }),
      listStudentWork: async () => [{ conceptId: 'linear_equations', questionId: 'seen-1' }],
    })

    await expect(resultPromise).resolves.toEqual({
      questions: staticQuestions,
      misconceptionGap: null,
    })
    const result = await resultPromise
    expect(result.questions).toEqual(staticQuestions)
    expect(result.misconceptionGap).toBeNull()
  })
})
