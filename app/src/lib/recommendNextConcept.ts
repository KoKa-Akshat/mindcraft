import { mlIdToLabel } from './conceptMap'
import { fetchKnowledgeGraph } from './graphCache'
import { getRecommendations } from './mlApi'

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

/** Weakness-prioritized next concept — same signal as the old Learning GPS auto-load. */
export async function fetchNextConcept(userId: string): Promise<NextConcept | null> {
  if (!userId) return null

  const [rec, kg] = await Promise.all([
    getRecommendations(userId, [], 'curriculum'),
    fetchKnowledgeGraph(userId),
  ])

  const nodes = (kg?.nodes ?? []) as Array<{ id: string; mastery?: number; status?: string }>
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const bridgeTarget = rec?.recommendations
    ?.find(r => r.isBridgeGap && r.gapType === 'concept')?.bridgeToConcept
  const weakest = rec?.studentProfile?.topWeaknesses?.[0]?.conceptId

  let conceptId = bridgeTarget ?? weakest ?? null

  if (!conceptId && nodes.length) {
    conceptId = [...nodes]
      .sort(
        (a, b) =>
          (URGENCY[a.status ?? 'untouched'] - URGENCY[b.status ?? 'untouched'])
          || ((a.mastery ?? 0) - (b.mastery ?? 0)),
      )[0]?.id ?? null
  }

  if (!conceptId) return null

  const node = nodeMap.get(conceptId)
  return {
    conceptId,
    label: mlIdToLabel(conceptId),
    mastery: node?.mastery ?? 0,
    status: node?.status ?? 'untouched',
  }
}
