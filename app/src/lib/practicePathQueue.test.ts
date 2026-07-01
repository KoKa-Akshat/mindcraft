import { describe, expect, it } from 'vitest'
import { buildPracticePathQueue, conceptsFromIds } from './practicePathQueue'

describe('buildPracticePathQueue', () => {
  it('preserves assessConcepts order (pathfinder chain, not confidence sort)', () => {
    const assessConcepts = [
      { id: 'quadratic_equations', label: 'Quadratics' },
      { id: 'linear_equations', label: 'Linear' },
      { id: 'functions_basics', label: 'Functions' },
    ]
    const confidenceMap = {
      linear_equations: 'easy' as const,
      quadratic_equations: 'hard' as const,
      functions_basics: 'kinda' as const,
    }

    const { pathQueue } = buildPracticePathQueue(assessConcepts, confidenceMap, new Set())

    expect(pathQueue.map(c => c.id)).toEqual([
      'quadratic_equations',
      'linear_equations',
      'functions_basics',
    ])
  })

  it('conceptsFromIds keeps foundational ids absent from PRACTICE_CONCEPTS', () => {
    const out = conceptsFromIds(['basic_equations', 'linear_equations'])
    expect(out.map(c => c.id)).toEqual(['basic_equations', 'linear_equations'])
    expect(out[0].label).toBeTruthy()
  })
})
