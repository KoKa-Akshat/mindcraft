/**
 * LiveJoinBanner.tsx
 *
 * Plan: snuggly-wandering-candle.md, build-order steps 4-5. This is the
 * DISCOVERY mechanism for the "Call" live co-working feature — how a tutor
 * or parent even finds out a student has an active `liveSessions` doc.
 * Subscribes via `subscribeActiveLiveSessionsForTutor`/
 * `subscribeActiveLiveSessionsForParent` (liveSession.ts) — both take the
 * CALLER's own uid (tutorId or parentId), not a list of student ids; the
 * parent variant resolves `childId`/`childIds` internally via `getDoc`, so
 * this component never re-derives that list itself. When an active session
 * exists, shows a small banner naming the student with a button that
 * navigates to `/live-session/:sessionId`. Renders nothing when there's no
 * active session — no empty/collapsed placeholder.
 *
 * Deliberately visually distinct from `SessionCallCard` (the Calendly
 * booked-session "incoming call" card, bottom-right, 10-min early-join
 * window, pulsing rings): this is a slim banner pinned to the top of the
 * viewport, with a small pulsing dot instead of full ring animation, and no
 * timing/window logic at all — a live session simply exists or it doesn't.
 * Kept structurally separate from SessionCallCard/callSession on purpose
 * (see CLAUDE.md/the plan): that component is about booked-session windows,
 * this one is about ad-hoc live calls.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  subscribeActiveLiveSessionsForParent, subscribeActiveLiveSessionsForTutor,
} from '../lib/liveSession'
import type { LiveSessionEntry } from '../lib/liveSession'
import s from './LiveJoinBanner.module.css'

interface LiveJoinBannerProps {
  role: 'tutor' | 'parent'
  /** The signed-in user's OWN uid (tutor's uid, or parent's uid) — matches
   * what the two subscribe functions in liveSession.ts actually take today. */
  linkedId: string | null | undefined
  /** studentId -> display name, reused from whatever lookup the host page
   * already built (TutorDashboard's `students` roster, ParentDashboard's
   * `childNames`) — deliberately not a new Firestore read here. */
  studentNames?: Record<string, string>
}

/** Picks the single most-recently-active session to show when more than one
 * is live at once (untested multi-session UI per the plan's non-goals —
 * this just keeps the banner from rendering more than one at a time). */
function mostRecentSession(sessions: LiveSessionEntry[]): LiveSessionEntry | null {
  if (sessions.length === 0) return null
  return [...sessions].sort((a, b) => {
    const at = a.lastActivityAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0
    const bt = b.lastActivityAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0
    return bt - at
  })[0]
}

export default function LiveJoinBanner({ role, linkedId, studentNames }: LiveJoinBannerProps) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<LiveSessionEntry[]>([])

  useEffect(() => {
    if (!linkedId) { setSessions([]); return }
    const subscribe = role === 'tutor'
      ? subscribeActiveLiveSessionsForTutor
      : subscribeActiveLiveSessionsForParent
    return subscribe(linkedId, setSessions)
  }, [role, linkedId])

  const active = useMemo(() => mostRecentSession(sessions), [sessions])

  if (!active) return null

  const studentName = studentNames?.[active.studentId] || 'Your student'

  return (
    <div className={s.banner} role="status">
      <span className={s.dot} aria-hidden="true" />
      <span className={s.text}>
        <strong className={s.name}>{studentName}</strong> wants you to join — live now
      </span>
      <button
        type="button"
        className={s.joinBtn}
        onClick={() => navigate(`/live-session/${active.id}`)}
      >
        Join call
      </button>
    </div>
  )
}
