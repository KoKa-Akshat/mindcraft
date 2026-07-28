/**
 * mapping.ts
 *
 * Single source of truth for how graph space maps onto the 2D Wisdom Sight
 * overlay. Adapted 2026-07-21 for the 2D illustrated pivot: previously this
 * module mapped graph space into Three.js world space shared by a procedural
 * ridge mesh and the sight overlay. The ridge is now a fixed illustration
 * (`assets2d/valley_blocks.jpg`), so the "never disagree" guarantee now
 * applies between the SVG parabola path and the rune-stone / root-marker
 * positions drawn on the SAME overlay -- they read from the exact same
 * functions and can never drift apart, even though the static hill art
 * underneath is not itself deformed per-quadratic the way procedural
 * geometry could be (a hand-painted illustration cannot be reshaped per
 * question; see LESSONS.md for the full reasoning on this tradeoff).
 *
 * All positions are percentages [0, 100] of the scene container, matching
 * the SVG viewBox="0 0 100 100" used by ParabolaOverlay.tsx, so the curve
 * scales responsively with the illustration behind it at any viewport size.
 *
 * Pure module: no DOM, no SVG, no React, no Three.js. Fully unit-testable.
 */

import { evaluate, type ZoneQuadratic } from './quadratics'

/**
 * Root feet in valley_blocks.jpg (image % == overlay % at background-size 100%).
 * Matches the hand-drawn X marks on the left/right slopes.
 */
export const RIDGE_X0_PCT = 28
export const RIDGE_X1_PCT = 74

/** Shore line under the ridge (roots / horizon picks). */
export const BASELINE_Y_PCT = 57

/** Tallest painted peak (for vertex markers). */
export const PEAK_Y_PCT = 14

/**
 * The black ridge line the student drew: left slope → left peak → saddle →
 * right peak → right slope. Absolute % in valley_blocks.jpg, sitting just
 * above the green. X is remapped so the ends pin to the quadratic roots.
 */
const HILL_RIDGE_ABS: ReadonlyArray<readonly [number, number]> = [
  [28, 39], // left X
  [31, 32],
  [34, 24],
  [37, 17],
  [40, 13.5], // left peak
  [43, 16],
  [47, 20],
  [50, 22], // saddle
  [54, 18],
  [58, 15.5], // right peak
  [63, 22],
  [68, 30],
  [74, 39], // right X
]

/** Graph-y-units per percent of vertical rise when peak = 9 (bank max). */
export const Y_PCT_PER_UNIT = (BASELINE_Y_PCT - PEAK_Y_PCT) / 9

/** Graph x that sits at the ridge's horizontal center. */
export function graphCenter(q: Pick<ZoneQuadratic, 'r1' | 'r2'>): number {
  return (q.r1 + q.r2) / 2
}

/** Graph-x sampling range the overlay draws (a margin past each root). */
export function graphRange(q: Pick<ZoneQuadratic, 'r1' | 'r2'>): { x0: number; x1: number } {
  return { x0: q.r1 - 2.5, x1: q.r2 + 2.5 }
}

/**
 * Graph x -> overlay percent x.
 * Roots pin to the mountain feet so the silhouette spans both peaks.
 */
export function graphXToPercent(q: Pick<ZoneQuadratic, 'r1' | 'r2'>, graphX: number): number {
  const span = q.r2 - q.r1
  if (span === 0) return (RIDGE_X0_PCT + RIDGE_X1_PCT) / 2
  const t = (graphX - q.r1) / span
  return RIDGE_X0_PCT + t * (RIDGE_X1_PCT - RIDGE_X0_PCT)
}

/** Overlay percent x -> graph x. Inverse of graphXToPercent. */
export function percentToGraphX(q: Pick<ZoneQuadratic, 'r1' | 'r2'>, pct: number): number {
  const span = q.r2 - q.r1
  const t = (pct - RIDGE_X0_PCT) / (RIDGE_X1_PCT - RIDGE_X0_PCT)
  return q.r1 + t * span
}

/** Peak graph-y used to stretch this quadratic's vertex to the painted peaks. */
export function visualPeakY(q: Pick<ZoneQuadratic, 'a' | 'r1' | 'r2'>): number {
  const half = (q.r2 - q.r1) / 2
  return Math.max(-q.a * half * half, 1e-6)
}

/**
 * Graph y -> overlay percent y.
 * Pass `peakY` (usually visualPeakY(q)) so this mountain fills the art;
 * defaults to 9 for bank-max absolute scale.
 */
export function graphYToPercent(graphY: number, peakY = 9): number {
  const scale = (BASELINE_Y_PCT - PEAK_Y_PCT) / peakY
  return BASELINE_Y_PCT - graphY * scale
}

/** Snap a graph x to the placement grid (half units). */
export function snapGraphX(graphX: number): number {
  return Math.round(graphX * 2) / 2
}

/**
 * Sampled {xPct, yPct} points along y = a(x - r1)(x - r2), for the
 * ParabolaOverlay SVG path. Clamped to y >= 0 outside the roots.
 */
export function curvePoints(
  q: Pick<ZoneQuadratic, 'a' | 'r1' | 'r2'>,
  samples = 48,
): Array<{ xPct: number; yPct: number }> {
  const { x0, x1 } = graphRange(q)
  const peakY = visualPeakY(q)
  const pts: Array<{ xPct: number; yPct: number }> = []
  for (let i = 0; i <= samples; i++) {
    const gx = x0 + ((x1 - x0) * i) / samples
    const gy = Math.max(0, evaluate(q, gx))
    pts.push({ xPct: graphXToPercent(q, gx), yPct: graphYToPercent(gy, peakY) })
  }
  return pts
}

/** Build an SVG path `d` attribute (smooth-ish polyline) from curvePoints. */
export function curvePathD(q: Pick<ZoneQuadratic, 'a' | 'r1' | 'r2'>, samples = 48): string {
  const pts = curvePoints(q, samples)
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.xPct.toFixed(2)} ${p.yPct.toFixed(2)}`).join(' ')
}

/**
 * Open ridge path = the hand-drawn black line above the hills.
 * Ends pin to the quadratic roots; Y stays locked to the painted ridge.
 */
export function ridgePathD(q: Pick<ZoneQuadratic, 'r1' | 'r2'>): string {
  const x0 = graphXToPercent(q, q.r1)
  const x1 = graphXToPercent(q, q.r2)
  const src0 = HILL_RIDGE_ABS[0][0]
  const src1 = HILL_RIDGE_ABS[HILL_RIDGE_ABS.length - 1][0]
  const span = src1 - src0
  return HILL_RIDGE_ABS.map(([x, y], i) => {
    const t = (x - src0) / span
    const xPct = x0 + t * (x1 - x0)
    return `${i === 0 ? 'M' : 'L'} ${xPct.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

/**
 * Closed mountain silhouette: ridge + horizon return. Spans both painted peaks.
 */
export function mountainOutlinePathD(
  q: Pick<ZoneQuadratic, 'a' | 'r1' | 'r2'>,
): string {
  const left = { xPct: graphXToPercent(q, q.r1), yPct: BASELINE_Y_PCT }
  const right = { xPct: graphXToPercent(q, q.r2), yPct: BASELINE_Y_PCT }
  const ridge = ridgePathD(q)
  return `${ridge} L ${right.xPct.toFixed(2)} ${right.yPct.toFixed(2)} L ${left.xPct.toFixed(2)} ${left.yPct.toFixed(2)} Z`
}
