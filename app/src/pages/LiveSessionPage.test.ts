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

import { isBookedSessionCurrentlyActive, pickActiveBookedSession } from './LiveSessionPage'
import type { BookedSessionCandidate } from './LiveSessionPage'

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
