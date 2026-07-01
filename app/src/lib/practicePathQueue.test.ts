import { describe, expect, it } from 'vitest'
import { buildPracticePathQueue, conceptsFromIds } from './practicePathQueue'
import { worstWeakness } from './recommendNextConcept'

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

  it('worstWeakness ignores excluded concepts', () => {
    const nodeMap = new Map([
      ['basic_probability', { id: 'basic_probability', mastery: 0.1, status: 'struggling' }],
      ['linear_equations', { id: 'linear_equations', mastery: 0.4, status: 'in_progress' }],
    ])
    const profileRec = {
      studentProfile: {
        topWeaknesses: [
          { conceptId: 'basic_probability', strength: -0.5 },
          { conceptId: 'linear_equations', strength: -0.2 },
        ],
      },
    } as Parameters<typeof worstWeakness>[0]

    const picked = worstWeakness(profileRec, null, nodeMap, new Set(['basic_probability']))
    expect(picked?.conceptId).toBe('linear_equations')
  })
})
