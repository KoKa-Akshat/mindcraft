import { describe, expect, it } from 'vitest'
import fixture from '../../../data/c1_worst_weakness_fixture.json'
import type { RecommendResult } from './mlApi'
import { topMisconceptionGap, withMatchingMisconception, worstWeakness, type WeaknessCandidate } from './recommendNextConcept'
import { hasFormatQuestions, questionCount, type FormatId } from './questionBank'

type GraphNode = { id: string; mastery?: number; status?: string; eventCount?: number }

type FixtureCase = {
  id: string
  nodeMap: Record<string, GraphNode>
  profileRec: RecommendResult
  pathRec: RecommendResult
  severity_derivations: Record<string, { severity: number; formula: string }>
  expected: {
    winner: WeaknessCandidate
    ranking: Array<{
      source: WeaknessCandidate['source']
      conceptId: string
      formatId?: string
      severity: number
    }>
  }
}

function hasPlayableQuestions(conceptId: string): boolean {
  return ([1, 2, 3] as const).some(l => questionCount(conceptId, l) > 0)
}

function conceptMastery(conceptId: string, nodeMap: Map<string, GraphNode>): number {
  return nodeMap.get(conceptId)?.mastery ?? 0
}

function gapSeverity(
  gap: RecommendResult['recommendations'][number],
  nodeMap: Map<string, GraphNode>,
): number {
  if (gap.severity != null) return gap.severity
  const anchorId = gap.bridgeToConcept ?? gap.conceptId
  let base = 1 - conceptMastery(anchorId ?? '', nodeMap)
  if (gap.bridgeEvidence === 'hypothesis') base *= fixture.meta.hypothesis_scale
  return base
}

function nodeMapFromFixture(raw: Record<string, GraphNode>): Map<string, GraphNode> {
  return new Map(Object.entries(raw))
}

/** Mirror worstWeakness candidate collection (without the max pick). */
function allCandidates(
  profileRec: RecommendResult,
  pathRec: RecommendResult,
  nodeMap: Map<string, GraphNode>,
): WeaknessCandidate[] {
  const candidates: WeaknessCandidate[] = []

  for (const w of profileRec.studentProfile?.topWeaknesses ?? []) {
    if (!hasPlayableQuestions(w.conceptId)) continue
    candidates.push({
      conceptId: w.conceptId,
      severity: 1 - conceptMastery(w.conceptId, nodeMap),
      source: 'profile',
    })
  }

  for (const gap of pathRec.recommendations ?? []) {
    if (!gap.isBridgeGap) continue
    if (gap.gapType === 'format') {
      const conceptId = gap.bridgeToConcept
      const formatId = gap.bridgeFromConcept as FormatId | undefined
      if (!conceptId || !formatId || !hasFormatQuestions(conceptId, formatId)) continue
      candidates.push({
        conceptId,
        formatId,
        severity: gapSeverity(gap, nodeMap),
        source: 'format_gap',
      })
    } else {
      const conceptId = gap.bridgeToConcept ?? gap.conceptId
      if (!conceptId || !hasPlayableQuestions(conceptId)) continue
      candidates.push({
        conceptId,
        severity: gapSeverity(gap, nodeMap),
        source: 'concept_gap',
      })
    }
  }

  return candidates.sort((a, b) => b.severity - a.severity)
}

describe('worstWeakness — C1 shared fixture', () => {
  const { hypothesis_scale: hypothesisScale } = fixture.meta

  it('fixture severities match C1 formulas from FORMAT_WEAKNESS_PLAN.md:26-31', () => {
    const c = (fixture.cases as FixtureCase[])[0]
    const d = c.severity_derivations

    expect(d.profile.severity).toBeCloseTo(1 - c.nodeMap.linear_equations.mastery!)
    expect(d.profile.formula).toBe('1 - concept_mastery')

    expect(d.concept_gap.severity).toBeCloseTo(1 - 0.3)
    expect(d.concept_gap.formula).toBe('1 - bridge_confidence')

    expect(d.format_gap.severity).toBeCloseTo(1 - 0.15)
    expect(d.format_gap.formula).toBe('1 - format_mastery')
    expect(c.nodeMap.functions_basics.mastery!).toBeGreaterThanOrEqual(fixture.meta.concept_mastered_gate)

    expect(hypothesisScale).toBe(0.5)
  })

  for (const c of fixture.cases as FixtureCase[]) {
    it(`${c.id}: picks max playable severity across profile, concept-gap, and format-gap`, () => {
      const nodeMap = nodeMapFromFixture(c.nodeMap)
      const formatId = c.expected.winner.formatId!
      expect(hasFormatQuestions(c.expected.winner.conceptId, formatId)).toBe(true)

      const result = worstWeakness(c.profileRec, c.pathRec, nodeMap)

      expect(result).not.toBeNull()
      expect(result!.source).toBe(c.expected.winner.source)
      expect(result!.conceptId).toBe(c.expected.winner.conceptId)
      expect(result!.formatId).toBe(c.expected.winner.formatId)
      expect(result!.severity).toBeCloseTo(c.expected.winner.severity)
    })

    it(`${c.id}: full severity ranking matches C1 contract`, () => {
      const nodeMap = nodeMapFromFixture(c.nodeMap)
      const ranked = allCandidates(c.profileRec, c.pathRec, nodeMap)

      expect(ranked.map(r => r.source)).toEqual(c.expected.ranking.map(r => r.source))
      ranked.forEach((r, i) => {
        expect(r.conceptId).toBe(c.expected.ranking[i].conceptId)
        expect(r.severity).toBeCloseTo(c.expected.ranking[i].severity)
        if (c.expected.ranking[i].formatId) {
          expect(r.formatId).toBe(c.expected.ranking[i].formatId)
        }
      })
    })
  }
})

describe('worstWeakness — C6 misconception isolation', () => {
  const c = (fixture.cases as FixtureCase[])[0]
  const nodeMap = nodeMapFromFixture(c.nodeMap)

  it('empty misconceptionGaps[] is byte-identical to omitting the field', () => {
    const baseline = worstWeakness(c.profileRec, c.pathRec, nodeMap)
    const withEmpty = worstWeakness(
      { ...c.profileRec, misconceptionGaps: [] },
      c.pathRec,
      nodeMap,
    )
    expect(withEmpty).toEqual(baseline)
    expect(baseline?.source).toBe('format_gap')
    expect(baseline?.conceptId).toBe('functions_basics')
  })

  it('does not fold a high-severity misconception insight into C1 ranking', () => {
    const profileWithGap: RecommendResult = {
      ...c.profileRec,
      misconceptionGaps: [{
        conceptId: 'ratios_proportions',
        misconceptionId: 'mis_ratios_proportions__thinks_difference_one_part_ratio',
        ingredientId: 'ratios_proportions__unit_rate',
        distractorChoiceIndex: 0,
        severity: 0.9,
      }],
    }
    const result = worstWeakness(profileWithGap, c.pathRec, nodeMap)
    expect(result?.source).toBe('format_gap')
    expect(result?.conceptId).toBe('functions_basics')
  })

  it('returns the same winner with or without misconceptionGaps', () => {
    const profileWithGap: RecommendResult = {
      ...c.profileRec,
      misconceptionGaps: [{
        conceptId: 'ratios_proportions',
        misconceptionId: 'mis_ratios_proportions__thinks_difference_one_part_ratio',
        ingredientId: 'ratios_proportions__unit_rate',
        severity: 0.9,
      }],
    }
    const tier3 = worstWeakness(profileWithGap, c.pathRec, nodeMap)
    const today = worstWeakness(c.profileRec, c.pathRec, nodeMap)
    expect(tier3).toEqual(today)
    expect(today?.source).toBe('format_gap')
    expect(today?.conceptId).toBe('functions_basics')
  })

  it('exposes the top playable misconception separately from the C1 winner', () => {
    const profileWithGaps: RecommendResult = {
      ...c.profileRec,
      misconceptionGaps: [
        {
          conceptId: 'ratios_proportions',
          misconceptionId: 'mis_ratio_low',
          ingredientId: 'ratios_proportions__unit_rate',
          severity: 0.6,
        },
        {
          conceptId: 'linear_equations',
          misconceptionId: 'mis_linear_high',
          ingredientId: 'linear_equations__inverse_operations',
          distractorChoiceIndex: 2,
          severity: 0.9,
        },
      ],
    }
    expect(worstWeakness(profileWithGaps, c.pathRec, nodeMap)?.source).toBe('format_gap')
    expect(topMisconceptionGap(profileWithGaps)).toMatchObject({
      conceptId: 'linear_equations',
      misconceptionId: 'mis_linear_high',
      ingredientId: 'linear_equations__inverse_operations',
      distractorChoiceIndex: 2,
    })
  })

  it('attaches matching targeting metadata without changing the ranked source or severity', () => {
    const ranked = worstWeakness(c.profileRec, c.pathRec, nodeMap)!
    const rec: RecommendResult = {
      ...c.profileRec,
      misconceptionGaps: [{
        conceptId: ranked.conceptId,
        misconceptionId: 'mis_matching_format_concept',
        ingredientId: 'functions_basics__function_notation',
        distractorChoiceIndex: 1,
        severity: 0.99,
      }],
    }
    expect(withMatchingMisconception(ranked, rec)).toEqual({
      ...ranked,
      misconceptionId: 'mis_matching_format_concept',
      ingredientId: 'functions_basics__function_notation',
      distractorChoiceIndex: 1,
    })
  })
})
