/**
 * ScratchPad live-write plumbing (plan: snuggly-wandering-candle.md,
 * build-order step 2) — unit coverage for the two pure functions the
 * component's `end()`/`redraw()` delegate to.
 *
 * This repo has no jsdom test environment (see vitest.config.ts — `include:
 * ['src/**\/*.test.ts']`, no `.tsx`, no DOM globals), so ScratchPad's canvas/
 * pointer-event behavior isn't mountable/renderable here. Per
 * MathText.test.ts's precedent, that's fine for logic that's genuinely pure —
 * `maybeAppendLiveStroke` and `combineStrokesForPaint` were split out of
 * `end()`/`redraw()` specifically so the live-session wiring is verifiable
 * without a DOM.
 */
import { describe, expect, it, vi } from 'vitest'
import { combineStrokesForPaint, maybeAppendLiveStroke } from './ScratchPad'
import type { ScratchStrokePoint } from '../types'

const pt = (x: number, y: number, p = 0.5): ScratchStrokePoint => [x, y, p]

describe('maybeAppendLiveStroke', () => {
  it('forwards the finished stroke when liveSessionId and authorId are both set', () => {
    const appendFn = vi.fn()
    const stroke: ScratchStrokePoint[] = [pt(1, 2), pt(3, 4)]
    maybeAppendLiveStroke(stroke, 'session-1', 'uid-student', 'student', appendFn)
    expect(appendFn).toHaveBeenCalledTimes(1)
    expect(appendFn).toHaveBeenCalledWith('session-1', 'uid-student', 'student', stroke)
  })

  it('defaults authorRole to "student" when omitted but liveSessionId/authorId are set', () => {
    const appendFn = vi.fn()
    const stroke: ScratchStrokePoint[] = [pt(0, 0)]
    maybeAppendLiveStroke(stroke, 'session-1', 'uid-student', undefined, appendFn)
    expect(appendFn).toHaveBeenCalledWith('session-1', 'uid-student', 'student', stroke)
  })

  it('passes through a non-student authorRole (tutor/parent) unchanged', () => {
    const appendFn = vi.fn()
    const stroke: ScratchStrokePoint[] = [pt(5, 5)]
    maybeAppendLiveStroke(stroke, 'session-1', 'uid-tutor', 'tutor', appendFn)
    expect(appendFn).toHaveBeenCalledWith('session-1', 'uid-tutor', 'tutor', stroke)
  })

  it('does NOT forward when liveSessionId is unset (default/backward-compat call sites)', () => {
    const appendFn = vi.fn()
    maybeAppendLiveStroke([pt(1, 1)], undefined, 'uid-student', 'student', appendFn)
    expect(appendFn).not.toHaveBeenCalled()
  })

  it('does NOT forward when authorId is unset', () => {
    const appendFn = vi.fn()
    maybeAppendLiveStroke([pt(1, 1)], 'session-1', undefined, 'student', appendFn)
    expect(appendFn).not.toHaveBeenCalled()
  })

  it('does NOT forward when neither liveSessionId nor authorId are set (every existing ScratchPad call site today)', () => {
    const appendFn = vi.fn()
    maybeAppendLiveStroke([pt(1, 1)], undefined, undefined, undefined, appendFn)
    expect(appendFn).not.toHaveBeenCalled()
  })

  it('does NOT forward an empty finished stroke even with ids set', () => {
    const appendFn = vi.fn()
    maybeAppendLiveStroke([], 'session-1', 'uid-student', 'student', appendFn)
    expect(appendFn).not.toHaveBeenCalled()
  })
})

describe('combineStrokesForPaint', () => {
  it('returns just the committed strokes when there is no in-progress stroke and no remote strokes', () => {
    const committed: ScratchStrokePoint[][] = [[pt(0, 0), pt(1, 1)]]
    expect(combineStrokesForPaint(committed, [])).toEqual(committed)
  })

  it('appends the in-progress stroke (if non-empty) after the committed strokes', () => {
    const committed: ScratchStrokePoint[][] = [[pt(0, 0)]]
    const inProgress: ScratchStrokePoint[] = [pt(9, 9)]
    expect(combineStrokesForPaint(committed, inProgress)).toEqual([...committed, inProgress])
  })

  it('omits the in-progress entry entirely when it is empty (no phantom zero-length stroke)', () => {
    const committed: ScratchStrokePoint[][] = [[pt(0, 0)]]
    expect(combineStrokesForPaint(committed, [])).toEqual(committed)
  })

  it('includes remoteStrokes so remote ink paints through the same list', () => {
    const committed: ScratchStrokePoint[][] = [[pt(0, 0)]]
    const remote: ScratchStrokePoint[][] = [[pt(50, 50), pt(51, 51)]]
    const result = combineStrokesForPaint(committed, [], remote)
    expect(result).toContainEqual(remote[0])
    expect(result).toEqual([...committed, ...remote])
  })

  it('merges committed + in-progress + remote in that order', () => {
    const committed: ScratchStrokePoint[][] = [[pt(0, 0)]]
    const inProgress: ScratchStrokePoint[] = [pt(1, 1)]
    const remote: ScratchStrokePoint[][] = [[pt(2, 2)]]
    expect(combineStrokesForPaint(committed, inProgress, remote)).toEqual([
      [pt(0, 0)],
      inProgress,
      [pt(2, 2)],
    ])
  })

  it('defaults remoteStrokes to empty when omitted (backward-compat: solo scratchpad unaffected)', () => {
    const committed: ScratchStrokePoint[][] = [[pt(0, 0)]]
    expect(combineStrokesForPaint(committed, [])).toEqual(committed)
  })
})
