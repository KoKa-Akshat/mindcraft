import { describe, expect, it } from 'vitest'
import { selectPastMistakeCallback, type ConceptInteractionPoint } from './pastMistakeCallback'

const DAY = 24 * 60 * 60 * 1000
const JUN_12 = new Date('2026-06-12T12:00:00Z').getTime()

function pt(outcome: number, daysAfterStruggle: number): ConceptInteractionPoint {
  return { outcome, timestamp: JUN_12 + daysAfterStruggle * DAY, source: 'practice' }
}

describe('selectPastMistakeCallback', () => {
  it('returns null with no history at all', () => {
    expect(selectPastMistakeCallback([], 'linear_equations', 'Linear Equations')).toBeNull()
  })

  it('returns null when there is no struggle session', () => {
    const history = [pt(0.3, 0), pt(0.4, 1), pt(0.5, 2)]
    expect(selectPastMistakeCallback(history, 'c', 'Concept')).toBeNull()
  })

  it('returns null when a struggle exists but has not been followed by real improvement', () => {
    const history = [pt(-0.4, 0), pt(0.05, 1)] // one struggle, one coin-flip session — not enough
    expect(selectPastMistakeCallback(history, 'c', 'Concept')).toBeNull()
  })

  it('returns null when improvement count is below the minimum (needs at least 2 good sessions)', () => {
    const history = [pt(-0.4, 0), pt(0.3, 1)] // only ONE good session since the struggle
    expect(selectPastMistakeCallback(history, 'c', 'Concept')).toBeNull()
  })

  it('returns null when the student is currently still struggling, even with a past good streak', () => {
    // Good streak happened, but the LATEST session is bad again — never call this "look how far
    // you've come" while they are presently backsliding.
    const history = [pt(-0.4, 0), pt(0.3, 1), pt(0.4, 2), pt(-0.3, 3)]
    expect(selectPastMistakeCallback(history, 'c', 'Concept')).toBeNull()
  })

  it('surfaces a callback once there is a real struggle followed by 2+ real improved sessions, and it is the current state', () => {
    const history = [pt(-0.5, 0), pt(0.05, 1), pt(0.3, 2), pt(0.4, 3)]
    const result = selectPastMistakeCallback(history, 'linear_equations', 'Linear Equations')
    expect(result).not.toBeNull()
    expect(result?.conceptId).toBe('linear_equations')
    expect(result?.improvedCount).toBe(2)
    expect(result?.struggleTimestamp).toBe(JUN_12)
    expect(result?.line).toContain('Linear Equations')
    expect(result?.line).toContain('2 times')
    expect(result?.line).not.toContain('—')
    expect(result?.line).not.toContain('!')
  })

  it('picks the MOST RECENT qualifying struggle, not the oldest one on record', () => {
    const history = [
      pt(-0.5, 0),   // old struggle
      pt(0.3, 1),
      pt(0.3, 2),
      pt(-0.3, 10),  // a SECOND, more recent struggle
      pt(0.2, 11),
      pt(0.25, 12),
    ]
    const result = selectPastMistakeCallback(history, 'c', 'Concept')
    expect(result?.struggleTimestamp).toBe(JUN_12 + 10 * DAY)
    expect(result?.improvedCount).toBe(2)
  })

  it('is order-independent — unsorted input history still resolves correctly', () => {
    const history = [pt(0.4, 3), pt(-0.5, 0), pt(0.3, 2), pt(0.05, 1)]
    const result = selectPastMistakeCallback(history, 'c', 'Concept')
    expect(result?.struggleTimestamp).toBe(JUN_12)
    expect(result?.improvedCount).toBe(2)
  })

  it('ignores non-finite or malformed points rather than throwing', () => {
    const history = [
      pt(-0.5, 0),
      { outcome: NaN, timestamp: JUN_12 + 1 * DAY, source: 'practice' },
      pt(0.3, 2),
      pt(0.4, 3),
    ]
    expect(() => selectPastMistakeCallback(history, 'c', 'Concept')).not.toThrow()
  })

  it('gracefully returns null (not an error) for a brand-new student with a couple of neutral sessions', () => {
    const history = [pt(0.0, 0), pt(0.05, 1)]
    expect(selectPastMistakeCallback(history, 'c', 'Concept')).toBeNull()
  })
})
