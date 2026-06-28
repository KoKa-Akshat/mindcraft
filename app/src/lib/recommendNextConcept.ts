import { mlIdToLabel } from './conceptMap'
import { fetchKnowledgeGraph } from './graphCache'
import { getRecommendations, type RecommendResult } from './mlApi'

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
}

export interface PracticeHubRecommendations {
  weakness: NextConcept | null
  learn: NextConcept | null
}

type GraphNode = { id: string; mastery?: number; status?: string }

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

function toNextConcept(
  conceptId: string | null | undefined,
  nodeMap: Map<string, GraphNode>,
): NextConcept | null {
  if (!conceptId) return null
  const node = nodeMap.get(conceptId)
  return {
    conceptId,
    label: mlIdToLabel(conceptId),
    mastery: node?.mastery ?? 0,
    status: node?.status ?? 'untouched',
  }
}

/**
 * Dashboard + practice hub recommendations.
 *
 * Weak spot — `/recommend` studentProfile.topWeaknesses (seeded by gap scan +
 * practice), with bridge-gap override when a path exists.
 *
 * Learn next — pathfinder trimmed chain via `/recommend` with a target concept
 * (weakness anchor, or most-urgent graph node). Empty curriculum targets do
 * NOT produce a chain; exam mode is the fallback ACT roadmap.
 */
export async function fetchPracticeHubRecommendations(
  userId: string,
): Promise<PracticeHubRecommendations> {
  if (!userId) return { weakness: null, learn: null }

  const kg = await fetchKnowledgeGraph(userId)
  const nodes = (kg?.nodes ?? []) as GraphNode[]
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const fallbackId = pickMostUrgent(nodes)

  const profileRec = await getRecommendations(userId, [], 'curriculum')
  const weaknessId =
    profileRec?.studentProfile?.topWeaknesses?.[0]?.conceptId
    ?? fallbackId

  // Pathfinder needs a target — anchor on the weakness (or fallback node).
  const pathTarget = weaknessId ?? fallbackId
  let pathRec: RecommendResult | null = null
  if (pathTarget) {
    pathRec = await getRecommendations(userId, [pathTarget], 'curriculum')
  }

  // Bridge gaps only appear once the pathfinder built a chain.
  const bridgeTarget = pathRec?.recommendations
    ?.find(r => r.isBridgeGap && r.gapType === 'concept')?.bridgeToConcept
  const resolvedWeaknessId = bridgeTarget ?? weaknessId

  let learnId = chainSteps(pathRec)[0]?.conceptId ?? null
  if (learnId && learnId === resolvedWeaknessId) {
    learnId = chainSteps(pathRec)[1]?.conceptId ?? null
  }

  // ACT exam overlay when curriculum path is empty (cold start / no target).
  if (!learnId) {
    const examRec = await getRecommendations(userId, [], 'exam')
    const examChain = chainSteps(examRec)
    learnId = examChain.find(c => c.conceptId !== resolvedWeaknessId)?.conceptId
      ?? examChain[0]?.conceptId
      ?? null
  }

  return {
    weakness: toNextConcept(resolvedWeaknessId, nodeMap),
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
