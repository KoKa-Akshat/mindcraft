/**
 * Concentric mandala placement for Weekly Review topic dots.
 * Rings grow outward from center; counts scale with N so small sets
 * still read as a neat blossom, not a sparse F.
 */
export type MandalaPlaced = {
  id: string
  x: number
  y: number
  ring: number
}

function ringBudget(count: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [1]
  if (count <= 7) return [1, count - 1]
  if (count <= 15) return [1, 6, count - 7]
  if (count <= 24) {
    const mid = Math.min(8, count - 1 - 6)
    return [1, 6, mid, count - 1 - 6 - mid]
  }
  // ~27 playable ACT topics
  const r1 = 1
  const r2 = 6
  const r3 = 10
  const r4 = count - r1 - r2 - r3
  return [r1, r2, r3, Math.max(0, r4)]
}

/** Place concept ids on concentric rings (percent coords in a 0–100 box). */
export function layoutMandalaNodes(ids: string[]): MandalaPlaced[] {
  const budgets = ringBudget(ids.length)
  const radii = [0, 18, 32, 44]
  const out: MandalaPlaced[] = []
  let cursor = 0

  for (let ring = 0; ring < budgets.length; ring++) {
    const n = budgets[ring]
    if (n <= 0) continue
    const r = radii[Math.min(ring, radii.length - 1)] ?? 44
    // Rotate each ring so spokes don’t stack into radial rays.
    const phase = ring * 0.35
    for (let i = 0; i < n && cursor < ids.length; i++, cursor++) {
      if (ring === 0 || n === 1) {
        out.push({ id: ids[cursor], x: 50, y: 50, ring })
        continue
      }
      const a = phase + (i / n) * Math.PI * 2 - Math.PI / 2
      const x = 50 + Math.cos(a) * r
      const y = 50 + Math.sin(a) * r * 0.92 // slight oval so it fits the map frame
      out.push({
        id: ids[cursor],
        x: Math.min(94, Math.max(6, x)),
        y: Math.min(92, Math.max(8, y)),
        ring,
      })
    }
  }

  while (cursor < ids.length) {
    const i = cursor
    const a = (i / Math.max(1, ids.length)) * Math.PI * 2
    out.push({
      id: ids[cursor],
      x: 50 + Math.cos(a) * 46,
      y: 50 + Math.sin(a) * 42,
      ring: 4,
    })
    cursor += 1
  }

  return out
}
