/**
 * ACT table-of-contents data — grounded in Layer-1 act_relevance.tested
 * (shipped as actOntologyCoverage.json). Used by the dashboard left page.
 */
import actOntologyCoverage from '../data/actOntologyCoverage.json'
import { mlIdToLabel } from './conceptMap'

export type ActTocSection = {
  id: string
  title: string
  conceptIds: string[]
}

type CoverageTiers = {
  foundational: { conceptIds: string[] }
  core: { conceptIds: string[] }
  cross_cutting: { conceptIds: string[] }
}

const tiers = actOntologyCoverage.levelTiers as CoverageTiers
const byConcept = actOntologyCoverage.byConceptId as Record<
  string,
  { name?: string; actFrequency?: number }
>

const CORE = tiers.core.conceptIds

/** Friendly ACT notebook sections — short labels, no jargon. */
export const ACT_TOC_SECTIONS: ActTocSection[] = [
  {
    id: 'warmups',
    title: 'Warm-ups',
    conceptIds: tiers.foundational.conceptIds,
  },
  {
    id: 'algebra',
    title: 'Algebra',
    conceptIds: CORE.filter(id =>
      /linear|quadratic|polynomial|factor|radical|exponent|function|sequence|system|inequal/.test(id),
    ),
  },
  {
    id: 'geometry',
    title: 'Geometry',
    conceptIds: CORE.filter(id =>
      /triangle|circle|angle|area|volume|trig|geometric|line/.test(id),
    ),
  },
  {
    id: 'data',
    title: 'Data & chance',
    conceptIds: CORE.filter(id => /stat|probabil/.test(id)),
  },
  // Note: Layer-1 cross_cutting (act_strategy, representation_translation)
  // have no playable bank questions yet — omit from the student TOC so we
  // don't ship empty truncated chips with nowhere to go.
]

export function actConceptLabel(conceptId: string): string {
  return byConcept[conceptId]?.name ?? mlIdToLabel(conceptId)
}

export function allActConceptIds(): string[] {
  return ACT_TOC_SECTIONS.flatMap(s => s.conceptIds)
}

export function actFrequency(conceptId: string): number {
  return byConcept[conceptId]?.actFrequency ?? 0
}
