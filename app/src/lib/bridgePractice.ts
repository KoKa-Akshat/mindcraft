import { PREREQUISITES } from './conceptMap'

export type Confidence = 'easy' | 'kinda' | 'hard'

export type BridgeRecommendation = {
  fromId: string
  toId: string
  viaIds: string[]
  level: 1 | 2 | 3
}

export function getRecommendedLevel(confidence: Confidence | undefined): 1 | 2 | 3 {
  if (confidence === 'hard') return 1
  if (confidence === 'kinda') return 2
  return 3
}

export function getAtomicPrereqPath(targetId: string, sourceIds: Set<string>) {
  const queue = [{ id: targetId, path: [] as string[] }]
  const seen = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (seen.has(current.id)) continue
    seen.add(current.id)

    for (const prereq of PREREQUISITES[current.id] ?? []) {
      const nextPath = [...current.path, prereq]
      if (sourceIds.has(prereq)) return { fromId: prereq, viaIds: nextPath }
      queue.push({ id: prereq, path: nextPath })
    }
  }

  return null
}

export function buildBridgeRecommendations(
  confidenceMap: Record<string, Confidence>,
  limit = 2,
): BridgeRecommendation[] {
  const sourceIds = new Set(
    Object.entries(confidenceMap)
      .filter(([, confidence]) => confidence === 'easy')
      .map(([id]) => id),
  )

  const targets = Object.entries(confidenceMap)
    .filter(([, confidence]) => confidence === 'hard' || confidence === 'kinda')
    .map(([id, confidence]) => ({ id, confidence }))

  const seen = new Set<string>()
  return targets.flatMap(target => {
    const bridge = getAtomicPrereqPath(target.id, sourceIds)
    if (!bridge) return []

    const key = `${bridge.fromId}->${target.id}`
    if (seen.has(key)) return []
    seen.add(key)

    return [{
      fromId: bridge.fromId,
      toId: target.id,
      viaIds: bridge.viaIds,
      level: getRecommendedLevel(target.confidence),
    }]
  }).slice(0, limit)
}
