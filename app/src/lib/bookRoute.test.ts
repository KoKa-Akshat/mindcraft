import { describe, expect, it } from 'vitest'
import { studyPlanFromRecommendation } from './bookRoute'
import type { RecommendResult } from './mlApi'

describe('book route mapping', () => {
  it('produces one active item and internally consistent progress', () => {
    const recommendation = {
      recommendations: [
        { conceptId: 'fractions_decimals' },
        { conceptId: 'ratios_proportions' },
        { conceptId: 'linear_equations' },
      ],
    } as RecommendResult
    const plan = studyPlanFromRecommendation(recommendation, [
      { id: 'fractions_decimals', status: 'mastered' },
      { id: 'ratios_proportions', status: 'mastered' },
      { id: 'linear_equations', status: 'in_progress' },
    ], 'linear_equations')

    expect(plan.items.filter(item => item.state === 'active')).toHaveLength(1)
    expect(plan.completedCount).toBe(2)
    expect(plan.progressPct).toBe(67)
  })
})
