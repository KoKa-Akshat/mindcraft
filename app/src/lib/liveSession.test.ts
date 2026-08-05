import { describe, expect, it } from 'vitest'
import type { Timestamp } from 'firebase/firestore'
import { isLiveSessionStale, toFirestorePoints, fromFirestorePoints } from './liveSession'
import type { ScratchStrokePoint } from '../types'

function ts(ms: number): Timestamp {
  return { toMillis: () => ms } as unknown as Timestamp
}

describe('isLiveSessionStale', () => {
  it('treats an ended session as stale regardless of recency', () => {
    expect(isLiveSessionStale({
      status: 'ended',
      lastActivityAt: ts(Date.now()),
      createdAt: ts(Date.now()),
    })).toBe(true)
  })

  it('treats an active session with recent activity as not stale', () => {
    const now = Date.now()
    expect(isLiveSessionStale({
      status: 'active',
      lastActivityAt: ts(now - 60_000), // 1 minute ago
      createdAt: ts(now - 5 * 60_000),
    }, now)).toBe(false)
  })

  it('treats an active session idle past 20 minutes as stale', () => {
    const now = Date.now()
    expect(isLiveSessionStale({
      status: 'active',
      lastActivityAt: ts(now - 21 * 60_000),
      createdAt: ts(now - 30 * 60_000),
    }, now)).toBe(true)
  })

  it('falls back to createdAt when lastActivityAt is missing', () => {
    const now = Date.now()
    expect(isLiveSessionStale({
      status: 'active',
      lastActivityAt: null,
      createdAt: ts(now - 25 * 60_000),
    }, now)).toBe(true)
    expect(isLiveSessionStale({
      status: 'active',
      lastActivityAt: null,
      createdAt: ts(now - 5 * 60_000),
    }, now)).toBe(false)
  })

  it('treats a brand-new session with no timestamps yet as fresh, not stale', () => {
    expect(isLiveSessionStale({
      status: 'active',
      lastActivityAt: null,
      createdAt: null,
    })).toBe(false)
  })
})

describe('toFirestorePoints / fromFirestorePoints', () => {
  it('round-trips ScratchStrokePoint tuples through the Firestore-safe wire format', () => {
    const points: ScratchStrokePoint[] = [[1, 2, 0.5], [3.5, 4.25, 1]]
    const wire = toFirestorePoints(points)
    // Must never be an array of arrays — Firestore rejects that shape.
    expect(wire.every(p => !Array.isArray(p))).toBe(true)
    expect(wire).toEqual([{ x: 1, y: 2, p: 0.5 }, { x: 3.5, y: 4.25, p: 1 }])
    expect(fromFirestorePoints(wire)).toEqual(points)
  })

  it('fromFirestorePoints fails soft to [] on non-array input', () => {
    expect(fromFirestorePoints(undefined)).toEqual([])
    expect(fromFirestorePoints(null)).toEqual([])
    expect(fromFirestorePoints('not an array')).toEqual([])
  })

  it('fromFirestorePoints defaults missing x/y/p to 0', () => {
    expect(fromFirestorePoints([{}])).toEqual([[0, 0, 0]])
  })
})
