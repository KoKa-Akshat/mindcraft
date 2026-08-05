import { describe, expect, it } from 'vitest'
import { selectStoryForConcept } from './storySelection'

describe('storySelection', () => {
  it("reads a concept's locked narrative frame from the concept-story record", () => {
    expect(selectStoryForConcept('fractions_decimals')).toMatchObject({
      protagonist: 'Simon Stevin',
      settingLine: 'Antwerp, the Low Countries, 1585',
      questionBridge: 'Simon slides the ledger toward you. Break the whole into parts. Every tenth counts.',
    })
  })
})
