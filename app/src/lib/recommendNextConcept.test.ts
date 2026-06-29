import { describe, expect, it } from 'vitest'
import fixture from '../../../data/c1_worst_weakness_fixture.json'
import type { RecommendResult } from './mlApi'
import { worstWeakness, type WeaknessCandidate } from './recommendNextConcept'
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
