import { describe, expect, it } from 'vitest'
import eediQuestionsData from '../data/eediQuestions.json'
import { matchFolkTale, type FolkTaleEntry } from './storyMatch'
import type { Question } from './questionBank'

const FRACTION_TALE: FolkTaleEntry = {
  id: 'fraction-tale',
  title: 'The Fraction Tale',
  culture: 'Test culture',
  region: 'Test region',
  synopsis: 'A test tale.',
  setting: 'Test setting',
  math_theme_tags: ['fraction'],
  concept_affinity: ['fractions_decimals'],
  concept_affinity_scores: { fractions_decimals: 0.9 },
  quality_score: 1,
}

describe('storyMatch', () => {
  it('normalizes folk math tags before scoring them against canonical question signals', () => {
    const match = matchFolkTale({
      id: 'fraction-question',
      conceptId: 'fractions_decimals',
      level: 1,
      question: 'What fraction is 3/4?',
      choices: ['1/4', '2/4', '3/4', '4/4'],
      correctIndex: 2,
      explanation: '',
      hints: [],
    }, {}, [FRACTION_TALE])

    expect(match).not.toBeNull()
    expect(match!.tale.id).toBe('fraction-tale')
    expect(match!.score).toBeGreaterThanOrEqual(0.38)
  })

  it('activates on a meaningful share of the production Eedi bank (was ~0 before the fix)', () => {
    const bank = eediQuestionsData as Question[]
    const matches = bank
      .map(question => matchFolkTale(question))
      .filter((match): match is NonNullable<typeof match> => match !== null)

    // Before the canonicalization fix, the max match score across the bank was
    // 0.343 (below the 0.38 activation threshold), so effectively nothing fired.
    // A `> 0` bound wouldn't catch a regression back to that state. Require a
    // meaningful fraction to match — comfortably below the current ~44% so this
    // doesn't flake on minor bank edits, but far above "a handful slipped through".
    expect(matches.length).toBeGreaterThan(bank.length * 0.15)
  })
})
