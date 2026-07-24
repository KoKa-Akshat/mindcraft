/**
 * ACT table-of-contents data, grounded in Layer-1 act_relevance.tested
 * (shipped as actOntologyCoverage.json). Used by the dashboard Contents page.
 */
import actOntologyCoverage from '../data/actOntologyCoverage.json'
import { getConceptContent } from './conceptContent'
import { mlIdToLabel } from './conceptMap'

export type ActTocSectionId = 'warmups' | 'algebra' | 'geometry' | 'data'

export type ActTocSection = {
  id: ActTocSectionId
  title: string
  /** One-line lane pitch under the section title. */
  blurb: string
  /** Soft lane wash (background). */
  wash: string
  /** Stronger accent for chips / marks. */
  accent: string
  /** Ink tint for titles in that lane. */
  ink: string
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

/** Friendly ACT notebook sections: short labels, no jargon. */
export const ACT_TOC_SECTIONS: ActTocSection[] = [
  {
    id: 'warmups',
    title: 'Warm-ups',
    blurb: 'The fluency you lean on when everything else gets noisy.',
    wash: 'linear-gradient(180deg, #fff8f1 0%, #ffe8d6 100%)',
    accent: '#e07a3a',
    ink: '#8a3f12',
    conceptIds: tiers.foundational.conceptIds,
  },
  {
    id: 'algebra',
    title: 'Algebra',
    blurb: 'Equations, functions, and the moves that unlock most ACT items.',
    wash: 'linear-gradient(180deg, #f3faf5 0%, #d9f0e2 100%)',
    accent: '#2f8f62',
    ink: '#14553a',
    conceptIds: CORE.filter(id =>
      /linear|quadratic|polynomial|factor|radical|exponent|function|sequence|system|inequal/.test(id),
    ),
  },
  {
    id: 'geometry',
    title: 'Geometry',
    blurb: 'Shapes, angles, and space: draw it, then name it.',
    wash: 'linear-gradient(180deg, #f2f7fc 0%, #d9e8f7 100%)',
    accent: '#3a7eb8',
    ink: '#1a4a72',
    // NOTE (2026-07-23 fix): was `|line` which substring-matches "line" INSIDE
    // "linear_equations"/"linear_inequalities"/"systems_of_linear_equations",
    // so those three concepts also passed the algebra regex above and got
    // placed in BOTH sections, i.e. rendered as duplicate nodes with the same
    // React key on the Map (the "duplicate key" console warning flagged in
    // ACTIVE_TASK.md 2026-07-23). `lines_` (with the trailing underscore)
    // still matches the intended `lines_angles` concept id but no longer
    // matches `linear_*`. Verified: TOC concept pool is exactly 27 unique
    // ids after this fix (was 30 with 3 counted twice).
    conceptIds: CORE.filter(id =>
      /triangle|circle|angle|area|volume|trig|geometric|lines_/.test(id),
    ),
  },
  {
    id: 'data',
    title: 'Data & chance',
    blurb: 'Read the story in a table, then weigh what could happen next.',
    wash: 'linear-gradient(180deg, #fff9ec 0%, #ffe9b8 100%)',
    accent: '#c4921a',
    ink: '#7a5200',
    conceptIds: CORE.filter(id => /stat|probabil/.test(id)),
  },
  // Note: Layer-1 cross_cutting (act_strategy, representation_translation)
  // have no playable bank questions yet, so omit them from the student TOC
  // rather than ship empty truncated chips with nowhere to go.
]

/** Short blurbs for concepts that lack a ConceptContent tagline. */
const FALLBACK_BLURBS: Record<string, string> = {
  fractions_decimals: 'Parts of a whole, switch freely between fractions and decimals.',
  order_of_operations: 'Parentheses first, then powers, then multiply/divide, then add/subtract.',
  basic_equations: 'Balance both sides until the unknown stands alone.',
  radical_expressions: 'Simplify roots the way you simplify fractions, clean the inside first.',
  exponential_functions: 'Growth and decay curves that multiply, not add.',
  sequences_series: 'Find the pattern, then the next term, or the sum.',
  triangles_congruence: 'Same shape and size: matching sides and angles tell the story.',
  geometric_transformations: 'Slide, flip, and turn: the figure moves, the measures stay.',
  fractions: 'Parts of a whole.',
}

export function actConceptLabel(conceptId: string): string {
  return byConcept[conceptId]?.name ?? mlIdToLabel(conceptId)
}

/** One short caption for Contents cards, prefers ConceptContent tagline. */
export function actConceptBlurb(conceptId: string): string {
  const tagline = getConceptContent(conceptId)?.tagline?.trim()
  if (tagline) return tagline
  return FALLBACK_BLURBS[conceptId] ?? 'Open the lesson for the story and a short drill.'
}

export function allActConceptIds(): string[] {
  return ACT_TOC_SECTIONS.flatMap(s => s.conceptIds)
}

/** Which ACT_TOC_SECTIONS lane a concept id lives in, if any. Reused by the
 *  diagnostic's confidence step (Diagnostic.tsx) so its grouping is the SAME
 *  live section membership the Map/Contents already use, not a second
 *  hand-copied regex. */
export function actTocSectionForConcept(conceptId: string): ActTocSectionId | null {
  const hit = ACT_TOC_SECTIONS.find(sec => sec.conceptIds.includes(conceptId))
  return hit ? hit.id : null
}

export function actFrequency(conceptId: string): number {
  return byConcept[conceptId]?.actFrequency ?? 0
}
