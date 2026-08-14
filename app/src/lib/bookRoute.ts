import { mlIdToLabel } from './conceptMap'
import { chainSteps } from './recommendNextConcept'
import type { RecommendResult } from './mlApi'
import type { StudyPlanItem } from '../components/book/StudyPlanList'

export type RouteKnowledgeNode = { id: string; mastery?: number; status?: string }

export function studyPlanFromRecommendation(
  recommendation: RecommendResult | null,
  nodes: RouteKnowledgeNode[],
  targetId: string,
): { items: StudyPlanItem[]; completedCount: number; progressPct: number } {
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const steps = chainSteps(recommendation)
  const ids = steps.length ? steps.map(step => step.conceptId) : [targetId]
  const activeId = ids.includes(targetId)
    ? targetId
    : ids.find(id => nodeMap.get(id)?.status !== 'mastered') ?? ids[ids.length - 1]
  const items = ids.map(id => ({
    id,
    label: mlIdToLabel(id),
    state: nodeMap.get(id)?.status === 'mastered'
      ? 'done' as const
      : id === activeId ? 'active' as const : 'upcoming' as const,
  }))
  // A mastered target has no natural active row; keep the route actionable.
  if (!items.some(item => item.state === 'active') && items.length) {
    items[items.length - 1] = { ...items[items.length - 1], state: 'active' }
  }
  const completedCount = items.filter(item => item.state === 'done').length
  return {
    items,
    completedCount,
    progressPct: items.length ? Math.round((completedCount / items.length) * 100) : 0,
  }
}
