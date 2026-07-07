import { describe, expect, it } from 'vitest'
import type { ScratchStrokePoint } from '../types'
import {
  buildInkLines,
  computeLineBbox,
  exportLineCrop,
  lineInkFingerprint,
  segmentInkLines,
} from './inkLines'

type Pt = ScratchStrokePoint

function hLine(y: number, x0: number, x1: number, thickness = 4): Pt[] {
  const pts: Pt[] = []
  for (let x = x0; x <= x1; x += 4) {
    for (let dy = 0; dy < thickness; dy++) pts.push([x, y + dy, 0.5])
  }
  return pts
}

describe('segmentInkLines', () => {
  it('puts widely separated horizontal strokes on separate lines', () => {
    const strokes = [hLine(20, 10, 80), hLine(120, 10, 80)]
    const lines = segmentInkLines(strokes)
    expect(lines).toHaveLength(2)
    expect(lines[0].strokeIdx).toEqual([0])
    expect(lines[1].strokeIdx).toEqual([1])
  })

  it('merges strokes on the same vertical band', () => {
    const strokes = [hLine(40, 10, 50), hLine(42, 60, 100)]
    const lines = segmentInkLines(strokes)
    expect(lines).toHaveLength(1)
    expect(lines[0].strokeIdx).toEqual([0, 1])
  })

  it('returns empty for no strokes', () => {
    expect(segmentInkLines([])).toEqual([])
  })
})

describe('computeLineBbox', () => {
  it('adds padding and clamps to canvas', () => {
    const strokes = [hLine(50, 20, 60)]
    const bbox = computeLineBbox(strokes, [0], 300, 200, 10)
    expect(bbox[0]).toBe(10)
    expect(bbox[1]).toBe(40)
    expect(bbox[2]).toBeGreaterThan(40)
    expect(bbox[3]).toBeGreaterThan(0)
  })
})

describe('buildInkLines', () => {
  it('assigns bboxes per segmented line', () => {
    const strokes = [hLine(30, 10, 70), hLine(140, 10, 70)]
    const lines = buildInkLines(strokes, 300, 240)
    expect(lines).toHaveLength(2)
    expect(lines[0].bbox[1]).toBeLessThan(lines[1].bbox[1])
    expect(lines[0].strokeIdx).toEqual([0])
    expect(lines[1].strokeIdx).toEqual([1])
  })
})

describe('lineInkFingerprint', () => {
  it('is stable for stroke order in idx array', () => {
    const strokes = [hLine(10, 0, 20), hLine(20, 0, 20)]
    const a = lineInkFingerprint(strokes, [1, 0])
    const b = lineInkFingerprint(strokes, [0, 1])
    expect(a).toBe(b)
  })
})

describe('exportLineCrop', () => {
  it.skipIf(typeof document === 'undefined')('returns a png data url for a line crop', () => {
    const strokes = [hLine(50, 30, 90)]
    const bbox = computeLineBbox(strokes, [0], 300, 200)
    const url = exportLineCrop(strokes, [0], bbox, 2)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
  })
})
