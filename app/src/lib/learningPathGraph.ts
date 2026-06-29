import { ML_TO_LABEL } from './conceptMap'
import { getRecommendations } from './mlApi'

export const GPS_W = 268
export const GPS_H = 330
const VPAD_T = 24, VPAD_B = 42
const MAX_PREREQ_DEPTH = 3, MAX_PER_LEVEL = 5

export const STATUS_COLOR: Record<string, string> = {
  mastered:            '#A8E063',
  stable:              '#A8E063',
  comeback_built:      '#A8E063',
  ready_for_challenge: '#A8E063',
  in_progress:         '#5B9BD5',
  repairing:           '#5B9BD5',
  struggling:          '#FF6B6B',
  open_gap:            '#FF6B6B',
  untouched:           '#8B9BA8',
  unexplored:          '#8B9BA8',
}

export const STATUS_LABEL: Record<string, string> = {
  mastered:            'Mastered',
  stable:              'Mastered',
  comeback_built:      'Mastered',
  ready_for_challenge: 'Ready to Level Up',
  in_progress:         'In Progress',
  repairing:           'In Progress',
  struggling:          'Needs Work',
  open_gap:            'Needs Work',
  untouched:           'Not Started',
  unexplored:          'Not Started',
}

export const URGENCY: Record<string, number> = {
  struggling: 0, open_gap: 0,
  untouched: 1, unexplored: 1,
  in_progress: 2, repairing: 2,
  mastered: 3, stable: 3, comeback_built: 3, ready_for_challenge: 3,
}

export interface GPSMLNode {
  id: string
  mastery: number
  status: string
}

export interface VNode {
  id: string
  label: string
  short: string
  mastery: number
  status: string
  depth: number
  x: number
  y: number
  isTarget: boolean
  isUnlock: boolean
}

export interface VEdge {
  x1: number; y1: number; x2: number; y2: number
  needsWork: boolean
  isUnlock: boolean
}

export interface GPSGraph {
  nodes: VNode[]
  edges: VEdge[]
  actionList: VNode[]
  mastered: number
  total: number
  unlockCount: number
}

function trunc(str: string, n: number) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

function isMastered(status: string) {
  return status === 'mastered' || status === 'stable' || status === 'comeback_built' || status === 'ready_for_challenge'
}

export function buildGraph(
  targetId: string,
  chain: string[],
  unlocks: string[],
  nodeMap: Map<string, GPSMLNode>,
): GPSGraph {
  const depthMap = new Map<string, number>()
  const unlockSet = new Set<string>()

  const tIdx = chain.lastIndexOf(targetId)
  const baseIdx = tIdx >= 0 ? tIdx : chain.length - 1
  chain.forEach((id, i) => {
    const d = Math.min(baseIdx - i, MAX_PREREQ_DEPTH)
    if (!depthMap.has(id)) depthMap.set(id, d)
  })
  if (!depthMap.has(targetId)) depthMap.set(targetId, 0)

  for (const dep of unlocks.slice(0, MAX_PER_LEVEL)) {
    if (!depthMap.has(dep)) {
      depthMap.set(dep, -1)
      unlockSet.add(dep)
    }
  }

  const minD = Math.min(...depthMap.values())
  const maxD = Math.max(...depthMap.values(), 0)
  const range = maxD - minD || 1

  const byDepth = new Map<number, string[]>()
  for (const [id, d] of depthMap) {
    const arr = byDepth.get(d) ?? []
    byDepth.set(d, arr)
    if (id === targetId || arr.length < MAX_PER_LEVEL) arr.push(id)
  }

  const posMap = new Map<string, { x: number; y: number }>()
  for (const [d, ids] of byDepth) {
    const baseY = VPAD_T + ((d - minD) / range) * (GPS_H - VPAD_T - VPAD_B)
    const count = ids.length
    const step = (GPS_W - 32) / Math.max(count, 1)
    ids.forEach((id, i) => {
      const stagger = count >= 3 && i % 2 === 1 ? 15 : 0
      posMap.set(id, { x: 16 + step * i + step / 2, y: baseY + stagger })
    })
  }

  const nodes: VNode[] = []
  for (const id of depthMap.keys()) {
    const pos = posMap.get(id)
    if (!pos) continue
    const ml = nodeMap.get(id)
    const label = ML_TO_LABEL[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    nodes.push({
      id, label, short: trunc(label, 11),
      mastery: ml?.mastery ?? 0,
      status: ml?.status ?? 'untouched',
      depth: depthMap.get(id)!,
      x: pos.x, y: pos.y,
      isTarget: id === targetId,
      isUnlock: unlockSet.has(id),
    })
  }

  const edges: VEdge[] = []
  for (let i = 0; i < chain.length - 1; i++) {
    const lower = posMap.get(chain[i])
    const upper = posMap.get(chain[i + 1])
    if (!lower || !upper) continue
    const needsWork =
      !isMastered(nodeMap.get(chain[i])?.status ?? 'untouched') ||
      !isMastered(nodeMap.get(chain[i + 1])?.status ?? 'untouched')
    edges.push({ x1: upper.x, y1: upper.y, x2: lower.x, y2: lower.y, needsWork, isUnlock: false })
  }
  const tPos = posMap.get(targetId)
  if (tPos) {
    for (const dep of unlockSet) {
      const to = posMap.get(dep)
      if (!to) continue
      edges.push({ x1: tPos.x, y1: tPos.y, x2: to.x, y2: to.y, needsWork: false, isUnlock: true })
    }
  }

  const prereqNodes = nodes.filter(n => !n.isTarget && !n.isUnlock)
  const actionList = prereqNodes
    .sort((a, b) => (URGENCY[a.status] - URGENCY[b.status]) || (a.depth - b.depth) || (a.mastery - b.mastery))
    .slice(0, 4)

  const mastered = prereqNodes.filter(n => isMastered(n.status)).length
  const total = prereqNodes.length

  return { nodes, edges, actionList, mastered, total, unlockCount: unlockSet.size }
}

export async function fetchLearningPath(
  userId: string,
  targetConceptId: string,
): Promise<{ chain: string[]; unlocks: string[] }> {
  const result = await getRecommendations(userId, [targetConceptId], 'curriculum')
  if (!result) return { chain: [targetConceptId], unlocks: [] }
  const r = result as typeof result & { unlocks?: string[] }
  return {
    chain: Array.isArray(result.canonicalChain) && result.canonicalChain.length
      ? result.canonicalChain
      : [targetConceptId],
    unlocks: Array.isArray(r.unlocks) ? r.unlocks : [],
  }
}
