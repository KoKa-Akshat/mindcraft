/**
 * Shared ACT Map letterform layout.
 *
 * Places TOC concepts along a capital-F path (stem + top bar + mid bar)
 * so the Map reads as one neat composition instead of a sparse grid.
 * Weekly Review picker uses the same slots so both surfaces match.
 */
import { ACT_TOC_SECTIONS } from './actToc'

export type ActMapPlaced = {
  id: string
  section: string
  x: number
  y: number
}

const STEM_X = 16
const TOP_Y = 13
const MID_Y = 42
const BOT_Y = 90
const TOP_END = 90
const MID_END = 66

/** Ordered concept list: Warm-ups → Algebra → Geometry → Data. */
export function actMapConceptOrder(): Array<{ id: string; section: string }> {
  const out: Array<{ id: string; section: string }> = []
  for (const sec of ACT_TOC_SECTIONS) {
    for (const id of sec.conceptIds) {
      out.push({ id, section: sec.title })
    }
  }
  return out
}

type FStrokeBudget = { topN: number; upperN: number; midN: number; lowerN: number }

/** Split N nodes across the four F strokes (top bar, upper stem, mid bar, lower stem). */
function allocateFStrokes(count: number): FStrokeBudget {
  let topN: number
  let upperN: number
  let midN: number
  let lowerN: number

  // Prefer the classic ~8 / 3 / 6 / 10 split when we have the full TOC (~27).
  if (count >= 20) {
    topN = Math.max(5, Math.round(count * 0.3))
    midN = Math.max(4, Math.round(count * 0.22))
    upperN = Math.max(2, Math.round(count * 0.12))
    lowerN = count - topN - midN - upperN
    if (lowerN < 3) {
      const need = 3 - lowerN
      lowerN = 3
      topN = Math.max(4, topN - need)
    }
  } else {
    topN = Math.max(3, Math.ceil(count * 0.35))
    midN = Math.max(2, Math.ceil(count * 0.25))
    upperN = Math.max(1, Math.floor(count * 0.12))
    lowerN = count - topN - midN - upperN
    while (lowerN < 1 && topN > 3) {
      topN -= 1
      lowerN += 1
    }
    if (lowerN < 1) {
      lowerN = 1
      midN = Math.max(1, midN - 1)
    }
  }

  let total = topN + upperN + midN + lowerN
  while (total > count) {
    if (topN >= midN && topN > 3) topN -= 1
    else if (lowerN > 2) lowerN -= 1
    else if (midN > 2) midN -= 1
    else if (upperN > 1) upperN -= 1
    else break
    total = topN + upperN + midN + lowerN
  }
  while (total < count) {
    lowerN += 1
    total += 1
  }

  return { topN, upperN, midN, lowerN }
}

/**
 * Build N points along a capital F.
 * Stroke budget scales with N so a partial weekly set still reads as F.
 */
export function fLetterSlots(count: number): Array<{ x: number; y: number }> {
  if (count <= 0) return []
  if (count === 1) return [{ x: STEM_X, y: 48 }]
  if (count === 2) {
    return [
      { x: STEM_X, y: TOP_Y },
      { x: STEM_X, y: BOT_Y },
    ]
  }

  const { topN, upperN, midN, lowerN } = allocateFStrokes(count)
  const slots: Array<{ x: number; y: number }> = []

  for (let i = 0; i < topN; i++) {
    const t = topN === 1 ? 0 : i / (topN - 1)
    slots.push({ x: STEM_X + t * (TOP_END - STEM_X), y: TOP_Y })
  }
  for (let i = 1; i <= upperN; i++) {
    const t = i / (upperN + 1)
    slots.push({ x: STEM_X, y: TOP_Y + t * (MID_Y - TOP_Y) })
  }
  for (let i = 0; i < midN; i++) {
    const t = midN === 1 ? 0 : i / (midN - 1)
    slots.push({ x: STEM_X + t * (MID_END - STEM_X), y: MID_Y })
  }
  for (let i = 1; i <= lowerN; i++) {
    const t = i / lowerN
    slots.push({ x: STEM_X, y: MID_Y + t * (BOT_Y - MID_Y) })
  }

  return slots
}

/** Index pairs that trace the F strokes (adjacent slots on each arm/stem). */
export function fSpinePairs(count: number): Array<[number, number]> {
  if (count < 2) return []
  if (count === 2) return [[0, 1]]

  const { topN, upperN, midN, lowerN } = allocateFStrokes(count)
  const pairs: Array<[number, number]> = []
  const chain = (from: number, to: number) => {
    for (let i = from; i < to; i++) pairs.push([i, i + 1])
  }

  const top0 = 0
  const topLast = topN - 1
  const upper0 = topN
  const upperLast = topN + upperN - 1
  const mid0 = topN + upperN
  const midLast = mid0 + midN - 1
  const lower0 = midLast + 1
  const lowerLast = count - 1

  chain(top0, topLast)
  if (upperN > 0) {
    pairs.push([top0, upper0])
    chain(upper0, upperLast)
    pairs.push([upperLast, mid0])
  } else {
    pairs.push([top0, mid0])
  }
  chain(mid0, midLast)
  if (lowerN > 0) {
    pairs.push([mid0, lower0])
    chain(lower0, lowerLast)
  }

  return pairs
}

/** Place concepts (optionally filtered) onto the shared F letterform. */
export function layoutActMapNodes(onlyIds?: Set<string>): ActMapPlaced[] {
  const ordered = actMapConceptOrder().filter(c => !onlyIds || onlyIds.has(c.id))
  const slots = fLetterSlots(ordered.length)
  return ordered.map((c, i) => ({
    id: c.id,
    section: c.section,
    x: Math.min(94, Math.max(6, slots[i]?.x ?? STEM_X)),
    y: Math.min(92, Math.max(8, slots[i]?.y ?? 50)),
  }))
}

/** Spine edges as id pairs for the current placement. */
export function actMapSpineEdges(nodes: ActMapPlaced[]): Array<[string, string]> {
  const pairs = fSpinePairs(nodes.length)
  return pairs
    .map(([a, b]) => {
      const left = nodes[a]
      const right = nodes[b]
      if (!left || !right) return null
      return [left.id, right.id] as [string, string]
    })
    .filter((e): e is [string, string] => !!e)
}
