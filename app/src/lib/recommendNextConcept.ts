import { mlIdToLabel } from './conceptMap'
import { fetchKnowledgeGraph } from './graphCache'
import { getRecommendations, type RecommendResult } from './mlApi'
import { questionCount } from './questionBank'

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
  const isUntouched = (id: string) => (nodeMap.get(id)?.status ?? 'untouched') === 'untouched'

  // ── Weak spot: observed weakness (must be playable), bridge-gap override, ──
  // ── then most-urgent playable node as cold-start fallback. ──
  const profileRec = await getRecommendations(userId, [], 'curriculum')
  let weaknessId =
    profileRec?.studentProfile?.topWeaknesses?.find(w => hasPlayableQuestions(w.conceptId))?.conceptId
    ?? null

  const anchor = weaknessId ?? pickMostUrgent(nodes)
  let pathRec: RecommendResult | null = null
  if (anchor) pathRec = await getRecommendations(userId, [anchor], 'curriculum')

  // Bridge-gap override only when its target is itself playable.
  const bridgeTarget = pathRec?.recommendations
    ?.find(r => r.isBridgeGap && r.gapType === 'concept' && hasPlayableQuestions(r.bridgeToConcept))
    ?.bridgeToConcept
  if (bridgeTarget) weaknessId = bridgeTarget
  if (!weaknessId) {
    weaknessId = [...nodes]
      .filter(n => hasPlayableQuestions(n.id))
      .sort((a, b) =>
        (URGENCY[a.status ?? 'untouched'] - URGENCY[b.status ?? 'untouched'])
        || ((a.mastery ?? 0) - (b.mastery ?? 0)))[0]?.id ?? null
  }

  // ── Learn next: the next 0-exposure (untouched), PLAYABLE concept on the ──
  // ── ACT path. Concrete ACT concepts only — never a content-less meta node. ──
  const examRec = await getRecommendations(userId, [], 'exam')
  const actPath = chainSteps(examRec).map(s => s.conceptId)
  let learnId =
    // 1) next NEW ACT concept you can actually drill
    actPath.find(id => id !== weaknessId && isUntouched(id) && hasPlayableQuestions(id))
    // 2) any playable ACT concept on the path (already-seen but not mastered)
    ?? actPath.find(id => id !== weaknessId && hasPlayableQuestions(id))
    // 3) curriculum chain toward the weakness, first playable step
    ?? chainSteps(pathRec).map(s => s.conceptId)
        .find(id => id !== weaknessId && hasPlayableQuestions(id))
    // 4) any untouched playable concept across the ontology
    ?? [...nodes]
        .filter(n => isUntouched(n.id) && hasPlayableQuestions(n.id) && n.id !== weaknessId)
        .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))[0]?.id
    ?? null

  return {
    weakness: toNextConcept(weaknessId, nodeMap),
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
