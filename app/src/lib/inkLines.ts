/**
 * Deterministic ink line segmentation — cluster strokes into written lines
 * by vertical overlap. No ML; unit-testable geometry.
 */
import { getStroke } from 'perfect-freehand'
import type { InkBbox, ScratchStrokePoint } from '../types'

export type { InkBbox } from '../types'

export interface InkLineSegment {
  strokeIdx: number[]
  bbox: InkBbox
}

const STROKE_OPTS = { size: 3, thinning: 0.6, smoothing: 0.5 }
const LINE_PADDING = 10

type YRange = { top: number; bottom: number }

function strokeYRange(stroke: ScratchStrokePoint[]): YRange {
  let top = Infinity
  let bottom = -Infinity
  for (const [, y] of stroke) {
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  if (!Number.isFinite(top)) return { top: 0, bottom: 1 }
  return { top, bottom: Math.max(bottom, top + 1) }
}

function yOverlapRatio(a: YRange, b: YRange): number {
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  if (overlap <= 0) return 0
  const shorter = Math.min(a.bottom - a.top, b.bottom - b.top) || 1
  return overlap / shorter
}

function pathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''
  const [firstX, firstY] = stroke[0]
  const rest = stroke.slice(1).reduce((acc, [x, y], i, arr) => {
    const [nx, ny] = arr[(i + 1) % arr.length]
    return `${acc} ${x.toFixed(1)},${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)},${((y + ny) / 2).toFixed(1)}`
  }, '')
  return `M ${firstX.toFixed(1)},${firstY.toFixed(1)} Q${rest} Z`
}

/** Cluster strokes into lines (stroke indices only — bbox added via buildInkLines). */
export function segmentInkLines(strokes: ScratchStrokePoint[][]): Array<{ strokeIdx: number[] }> {
  if (!strokes.length) return []

  const sorted = strokes
    .map((stroke, i) => ({ i, yRange: strokeYRange(stroke) }))
    .sort((a, b) => a.yRange.top - b.yRange.top || a.yRange.bottom - b.yRange.bottom)

  const lines: Array<{ strokeIdx: number[]; yRange: YRange }> = []

  for (const item of sorted) {
    const current = lines[lines.length - 1]
    if (!current) {
      lines.push({ strokeIdx: [item.i], yRange: { ...item.yRange } })
      continue
    }

    const lineHeight = current.yRange.bottom - current.yRange.top || 12
    const overlap = yOverlapRatio(item.yRange, current.yRange)
    const withinBand = item.yRange.top <= current.yRange.bottom + lineHeight * 0.6

    if (overlap > 0.3 || withinBand) {
      current.strokeIdx.push(item.i)
      current.yRange = {
        top: Math.min(current.yRange.top, item.yRange.top),
        bottom: Math.max(current.yRange.bottom, item.yRange.bottom),
      }
    } else {
      lines.push({ strokeIdx: [item.i], yRange: { ...item.yRange } })
    }
  }

  return lines.map(({ strokeIdx }) => ({ strokeIdx }))
}

export function computeLineBbox(
  strokes: ScratchStrokePoint[][],
  strokeIdx: number[],
  canvasWidth: number,
  canvasHeight: number,
  padding = LINE_PADDING,
): InkBbox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const i of strokeIdx) {
    for (const [x, y] of strokes[i] ?? []) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (!Number.isFinite(minX)) {
    return [0, 0, canvasWidth, canvasHeight]
  }

  const x = Math.max(0, minX - padding)
  const y = Math.max(0, minY - padding)
  const right = Math.min(canvasWidth, maxX + padding)
  const bottom = Math.min(canvasHeight, maxY + padding)
  const round = (n: number) => Math.round(n * 10) / 10

  return [round(x), round(y), round(right - x), round(bottom - y)]
}

export function buildInkLines(
  strokes: ScratchStrokePoint[][],
  canvasWidth: number,
  canvasHeight: number,
): InkLineSegment[] {
  return segmentInkLines(strokes).map(seg => ({
    strokeIdx: seg.strokeIdx,
    bbox: computeLineBbox(strokes, seg.strokeIdx, canvasWidth, canvasHeight),
  }))
}

/** Stable fingerprint for a line's ink — used to preserve student edits. */
export function lineInkFingerprint(
  strokes: ScratchStrokePoint[][],
  strokeIdx: number[],
): string {
  return JSON.stringify([...strokeIdx].sort((a, b) => a - b).map(i => strokes[i]))
}

/** Crop + redraw member strokes at 2× for per-line transcription. */
export function exportLineCrop(
  strokes: ScratchStrokePoint[][],
  strokeIdx: number[],
  bbox: InkBbox,
  scale = 2,
): string {
  const [x, y, w, h] = bbox
  if (w <= 0 || h <= 0) return ''

  const off = document.createElement('canvas')
  off.width = Math.round(w * scale)
  off.height = Math.round(h * scale)
  const ctx = off.getContext('2d')
  if (!ctx) return ''

  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#1a2234'

  for (const idx of strokeIdx) {
    const pts = strokes[idx]
    if (!pts?.length) continue
    const translated = pts.map(([px, py, pr]) => [px - x, py - y, pr] as ScratchStrokePoint)
    const outline = getStroke(translated, STROKE_OPTS)
    if (outline.length) ctx.fill(new Path2D(pathFromStroke(outline)))
  }

  return off.toDataURL('image/png')
}
