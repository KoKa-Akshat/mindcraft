import { describe, expect, it, vi } from 'vitest'

// LiveSessionPage.tsx imports `useUser` from '../App', which statically
// imports every page in the app (App.tsx is one big route table, not code-
// split) — including Practice.tsx's homework upload path, which pulls in
// pdfjs-dist and needs `DOMMatrix` at import time. This repo's vitest config
// has no jsdom environment (see ScratchPad.test.ts's own comment on the same
// constraint), so that whole graph can't load under plain Node. Stubbing
// '../App' here (vi.mock calls are hoisted above the imports below by
// vitest) replaces only that one import for this test file — it never
// touches the real App.tsx — and is enough to import LiveSessionPage.tsx's
// two pure "Talk" link-resolution helpers under test, which don't reference
// `useUser` themselves.
vi.mock('../App', () => ({ useUser: () => null }))

import { isBookedSessionCurrentlyActive, isSessionGoneQuiet, pickActiveBookedSession } from './LiveSessionPage'
import type { BookedSessionCandidate } from './LiveSessionPage'
import type { Timestamp } from 'firebase/firestore'

/** Minimal fake matching the `.toMillis?.()` shape `isLiveSessionStale`
 * (lib/liveSession.ts) actually reads off a Firestore Timestamp — same
 * fake shape liveSession.test.ts already uses for the function this one
 * wraps. */
function fakeTimestamp(millis: number): Timestamp {
  return { toMillis: () => millis } as unknown as Timestamp
}

describe('isBookedSessionCurrentlyActive', () => {
  const now = Date.now()

  it('is active starting 10 minutes before scheduledAt', () => {
    expect(isBookedSessionCurrentlyActive({
      status: 'scheduled',
      scheduledAt: now + 9 * 60_000,
      meetingUrl: 'https://meet.google.com/abc',
    }, now)).toBe(true)
  })

  it('is not active more than 10 minutes before scheduledAt', () => {
    expect(isBookedSessionCurrentlyActive({
      status: 'scheduled',
      scheduledAt: now + 11 * 60_000,
      meetingUrl: 'https://meet.google.com/abc',
    }, now)).toBe(false)
  })

  it('is active up through endAt', () => {
    expect(isBookedSessionCurrentlyActive({
      status: 'scheduled',
      scheduledAt: now - 30 * 60_000,
      endAt: now + 5 * 60_000,
      meetingUrl: 'https://meet.google.com/abc',
    }, now)).toBe(true)
  })

  it('is not active past endAt', () => {
    expect(isBookedSessionCurrentlyActive({
      status: 'scheduled',
      scheduledAt: now - 30 * 60_000,
      endAt: now - 1 * 60_000,
      meetingUrl: 'https://meet.google.com/abc',
    }, now)).toBe(false)
  })

  it('defaults to a 90-minute window when endAt is missing', () => {
    expect(isBookedSessionCurrentlyActive({
      status: 'scheduled',
      scheduledAt: now - 89 * 60_000,
      meetingUrl: 'https://meet.google.com/abc',
    }, now)).toBe(true)
    expect(isBookedSessionCurrentlyActive({
      status: 'scheduled',
      scheduledAt: now - 91 * 60_000,
      meetingUrl: 'https://meet.google.com/abc',
    }, now)).toBe(false)
  })

  it('is never active without its own meetingUrl (tier 1 requires one)', () => {
    expect(isBookedSessionCurrentlyActive({
      status: 'scheduled',
      scheduledAt: now,
      meetingUrl: null,
    }, now)).toBe(false)
    expect(isBookedSessionCurrentlyActive({
      status: 'scheduled',
      scheduledAt: now,
      meetingUrl: '',
    }, now)).toBe(false)
  })

  it('is never active when status is not scheduled', () => {
    expect(isBookedSessionCurrentlyActive({
      status: 'completed',
      scheduledAt: now,
      meetingUrl: 'https://meet.google.com/abc',
    }, now)).toBe(false)
    expect(isBookedSessionCurrentlyActive({
      status: 'cancelled',
      scheduledAt: now,
      meetingUrl: 'https://meet.google.com/abc',
    }, now)).toBe(false)
  })
})

describe('isSessionGoneQuiet', () => {
  const now = Date.now()

  it('is not quiet for null (no session loaded yet)', () => {
    expect(isSessionGoneQuiet(null, now)).toBe(false)
  })

  it('is not quiet for an active session with recent activity', () => {
    expect(isSessionGoneQuiet({
      status: 'active',
      lastActivityAt: fakeTimestamp(now - 2 * 60_000),
      createdAt: fakeTimestamp(now - 10 * 60_000),
    }, now)).toBe(false)
  })

  it('is quiet for an active session idle past the 20-minute staleness window', () => {
    expect(isSessionGoneQuiet({
      status: 'active',
      lastActivityAt: fakeTimestamp(now - 25 * 60_000),
      createdAt: fakeTimestamp(now - 40 * 60_000),
    }, now)).toBe(true)
  })

  it('is NOT quiet for an explicitly ended session — that is the "ended" banner\'s job, not this one, so the two never render for the same reason', () => {
    expect(isSessionGoneQuiet({
      status: 'ended',
      lastActivityAt: fakeTimestamp(now - 25 * 60_000),
      createdAt: fakeTimestamp(now - 40 * 60_000),
    }, now)).toBe(false)
  })

  it('is not quiet for a brand-new session with no activity timestamp yet', () => {
    expect(isSessionGoneQuiet({
      status: 'active',
      lastActivityAt: null,
      createdAt: null,
    }, now)).toBe(false)
  })
})

describe('pickActiveBookedSession', () => {
  // Candidates here simulate an already student-scoped list (the caller's
  // responsibility per resolveTalkUrl — see the function's own doc comment).
  const now = Date.now()
  const active: BookedSessionCandidate = {
    studentId: 'studentA',
    status: 'scheduled',
    scheduledAt: now,
    meetingUrl: 'https://meet.google.com/for-a',
  }
  const stale: BookedSessionCandidate = {
    studentId: 'studentA',
    status: 'completed',
    scheduledAt: now - 200 * 60_000,
    meetingUrl: 'https://meet.google.com/old',
  }

  it('finds the first currently-active session in the list', () => {
    expect(pickActiveBookedSession([stale, active], now)).toBe(active)
  })

  it('returns null when no candidate is currently active', () => {
    expect(pickActiveBookedSession([stale], now)).toBeNull()
    expect(pickActiveBookedSession([], now)).toBeNull()
  })
})
