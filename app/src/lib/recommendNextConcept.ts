import { mlIdToLabel } from './conceptMap'
import { fetchKnowledgeGraph } from './graphCache'
import { fetchExamConceptIds, getRecommendations, type ConceptRecommendation, type RecommendResult } from './mlApi'
import { loadDiagnostic } from './practiceState'
import { hasFormatQuestions, questionCount, type FormatId } from './questionBank'

// A concept is a valid PRACTICE target only if the bank can serve it questions.
// Cross-cutting meta-concepts (e.g. representation_translation) have none, so
// they're never routed to as a drill — the path still treats them as prereqs.
function hasPlayableQuestions(conceptId: string | null | undefined): boolean {
  if (!conceptId) return false
  return ([1, 2, 3] as const).some(l => questionCount(conceptId, l) > 0)
}

const URGENCY: Record<string, number> = {
  struggling: 0,
  untouched: 1,
  in_progress: 2,
  mastered: 3,
}

export interface NextConcept {
  conceptId: string
  label: string
  mastery: number
  status: string
  /** Set when the worst weakness is a format↔concept gap (C1 / C3). */
  formatId?: FormatId
}

export interface PracticeHubRecommendations {
  weakness: NextConcept | null
  learn: NextConcept | null
}

export type WeaknessCandidate = {
  conceptId: string
  formatId?: FormatId
  severity: number
  source: 'profile' | 'concept_gap' | 'format_gap'
}

type GraphNode = { id: string; mastery?: number; status?: string; eventCount?: number }

/** 0 exposure — matches KG `status: "untouched"` (`event_count === 0` in serve.py). */
function isZeroExposure(id: string, nodeMap: Map<string, GraphNode>): boolean {
  const n = nodeMap.get(id)
  if (!n) return true
  return (n.eventCount ?? 0) === 0
}

function pickMostUrgent(nodes: GraphNode[]): string | null {
  if (!nodes.length) return null
  return [...nodes]
    .sort(
      (a, b) =>
        (URGENCY[a.status ?? 'untouched'] - URGENCY[b.status ?? 'untouched'])
        || ((a.mastery ?? 0) - (b.mastery ?? 0)),
    )[0]?.id ?? null
}

function chainSteps(rec: RecommendResult | null) {
  return rec?.recommendations?.filter(r => !r.isSupplement && !r.isBridgeGap) ?? []
}

function conceptMastery(conceptId: string, nodeMap: Map<string, GraphNode>): number {
  return nodeMap.get(conceptId)?.mastery ?? 0
}

/** C1 fallback when Agent A has not shipped `severity` yet. */
function gapSeverity(gap: ConceptRecommendation, nodeMap: Map<string, GraphNode>): number {
  if (gap.severity != null) return gap.severity
  const anchorId = gap.bridgeToConcept ?? gap.conceptId
  let base = 1 - conceptMastery(anchorId ?? '', nodeMap)
  if (gap.bridgeEvidence === 'hypothesis') base *= 0.5
  return base
}

/**
 * C1 — pick the single most severe **playable** weakness across profile
 * weaknesses, concept-bridge gaps, and format gaps.
 */
export function worstWeakness(
  profileRec: RecommendResult | null,
  pathRec: RecommendResult | null,
  nodeMap: Map<string, GraphNode>,
): WeaknessCandidate | null {
  const candidates: WeaknessCandidate[] = []

  for (const w of profileRec?.studentProfile?.topWeaknesses ?? []) {
    if (!hasPlayableQuestions(w.conceptId)) continue
    candidates.push({
      conceptId: w.conceptId,
      severity: 1 - conceptMastery(w.conceptId, nodeMap),
      source: 'profile',
    })
  }

  for (const gap of pathRec?.recommendations ?? []) {
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

  if (!candidates.length) return null
  return candidates.reduce((best, c) => (c.severity > best.severity ? c : best))
}

function toNextConcept(
  conceptId: string | null | undefined,
  nodeMap: Map<string, GraphNode>,
  formatId?: FormatId,
): NextConcept | null {
  if (!conceptId) return null
  const node = nodeMap.get(conceptId)
  return {
    conceptId,
    label: mlIdToLabel(conceptId),
    mastery: node?.mastery ?? 0,
    status: node?.status ?? 'untouched',
    formatId,
  }
}

/**
 * Dashboard + practice hub recommendations.
 *
 * Weak spot — `worstWeakness()` across profile + concept/format gaps (C1).
 * Learn next — first 0-exposure playable concept on the exam path.
 */
export async function fetchPracticeHubRecommendations(
  userId: string,
): Promise<PracticeHubRecommendations> {
  if (!userId) return { weakness: null, learn: null }

  const diagnostic = await loadDiagnostic(userId)
  const exam = diagnostic?.exam ?? 'ACT'
  const examConceptIds = await fetchExamConceptIds(exam)
  const scope = examConceptIds.length > 0 ? examConceptIds : undefined

  const kg = await fetchKnowledgeGraph(userId)
  const nodes = (kg?.nodes ?? []) as GraphNode[]
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const profileRec = await getRecommendations(userId, [], 'curriculum', exam)
  const anchorWeakness = profileRec?.studentProfile?.topWeaknesses
    ?.find(w => hasPlayableQuestions(w.conceptId))?.conceptId ?? null
  const anchor = anchorWeakness ?? pickMostUrgent(
    scope ? nodes.filter(n => scope.includes(n.id)) : nodes,
  )
  const pathRec = anchor
    ? await getRecommendations(userId, [anchor], 'curriculum', exam)
    : null

  const worst = worstWeakness(profileRec, pathRec, nodeMap)
  let weaknessId = worst?.conceptId ?? null
  const weaknessFormat = worst?.formatId

  if (!weaknessId) {
    weaknessId = [...(scope ? nodes.filter(n => scope.includes(n.id)) : nodes)]
      .filter(n => hasPlayableQuestions(n.id))
      .sort((a, b) =>
        (URGENCY[a.status ?? 'untouched'] - URGENCY[b.status ?? 'untouched'])
        || ((a.mastery ?? 0) - (b.mastery ?? 0)))[0]?.id ?? null
  }

  const examRec = await getRecommendations(userId, [], 'exam', exam)
  const actPath = chainSteps(examRec).map(s => s.conceptId)
  const learnId =
    actPath.find(id => id !== weaknessId && isZeroExposure(id, nodeMap) && hasPlayableQuestions(id))
    ?? [...(scope ? nodes.filter(n => scope.includes(n.id)) : nodes)]
        .filter(n => n.id !== weaknessId && isZeroExposure(n.id, nodeMap) && hasPlayableQuestions(n.id))
        .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))[0]?.id
    ?? null

  return {
    weakness: toNextConcept(weaknessId, nodeMap, weaknessFormat),
    learn: toNextConcept(learnId, nodeMap),
  }
}

/** Weakness-prioritized drill target from `/recommend`. */
export async function fetchNextConcept(userId: string): Promise<NextConcept | null> {
  const { weakness } = await fetchPracticeHubRecommendations(userId)
  return weakness
}

/** Next step on the pathfinder chain (Learning GPS "learn new"). */
export async function fetchNextNewConcept(userId: string): Promise<NextConcept | null> {
  const { learn } = await fetchPracticeHubRecommendations(userId)
  return learn
}
