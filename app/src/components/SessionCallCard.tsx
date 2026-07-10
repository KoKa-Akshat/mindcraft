/**
 * SessionCallCard.tsx — the "incoming call" moment for a live session.
 *
 * Shared between the tutor dashboard and the student Field Journal dashboard.
 * When a booked session is inside its call window (10 min before start until
 * its end), an iPhone-style incoming-call card slides up from the corner:
 * pulsing rings around the other person's avatar, a big green join button
 * that opens the session's Google Meet URL in a new tab, and a quiet dismiss.
 *
 * The component owns ALL of its visibility logic — parents render it whenever
 * they know about an upcoming session with a meeting URL, and the card decides
 * (on a 30s tick) whether it's time to show. Dismissal is remembered per
 * session for the browser session (sessionStorage), so it doesn't nag.
 *
 * NOTE: `meetingUrl` here is either the session's own link (Calendly-created)
 * or the tutor's permanent Meet room (users/{tutorId}.googleMeetUrl) as a
 * fallback. No Google Calendar API / OAuth anywhere — it's just a stored URL.
 */

import { useEffect, useState } from 'react'
import s from './SessionCallCard.module.css'

const CALL_EARLY_MS = 10 * 60 * 1000

interface Props {
  /** Session doc id — keys the per-session dismissal. */
  sessionId: string
  meetingUrl: string
  /** Who is on the other end of the call (tutor name for students, student name for tutors). */
  personName: string
  subject?: string
  scheduledAt: number
  /** Session end (ms). Defaults to scheduledAt + 90 min when the doc lacks endAt. */
  endAt?: number
}

function dismissKey(sessionId: string): string {
  return `mc:callDismissed:${sessionId}`
}

export default function SessionCallCard({
  sessionId, meetingUrl, personName, subject, scheduledAt, endAt,
}: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(dismissKey(sessionId)) === '1' } catch { return false }
  })

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Re-check dismissal when the session changes (tutor with several bookings).
  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(dismissKey(sessionId)) === '1') } catch { setDismissed(false) }
  }, [sessionId])

  const end = endAt ?? scheduledAt + 90 * 60 * 1000
  const inWindow = now >= scheduledAt - CALL_EARLY_MS && now <= end
  if (!inWindow || dismissed || !meetingUrl) return null

  const minsToStart = Math.ceil((scheduledAt - now) / 60_000)
  const statusLine = minsToStart > 0 ? `starts in ${minsToStart} min` : 'live now'

  function handleJoin() {
    window.open(meetingUrl, '_blank', 'noopener')
  }

  function handleDismiss() {
    setDismissed(true)
    try { sessionStorage.setItem(dismissKey(sessionId), '1') } catch { /* ignore */ }
  }

  return (
    <div className={s.card} role="dialog" aria-label={`Session with ${personName} — ${statusLine}`}>
      <div className={s.avatarWrap} aria-hidden="true">
        <span className={s.ring} />
        <span className={`${s.ring} ${s.ringDelay}`} />
        <div className={s.avatar}>{personName[0]?.toUpperCase() ?? '?'}</div>
      </div>

      <div className={s.info}>
        <span className={s.kicker}>{minsToStart > 0 ? 'Session starting' : 'Session is live'}</span>
        <span className={s.name}>{personName}</span>
        <span className={s.meta}>
          {subject ? `${subject} · ` : ''}{statusLine}
        </span>
      </div>

      <div className={s.actions}>
        <button
          type="button"
          className={s.declineBtn}
          onClick={handleDismiss}
          title="Not yet"
          aria-label="Dismiss call screen"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          className={s.joinBtn}
          onClick={handleJoin}
          aria-label={`Join Google Meet session with ${personName}`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.4 11.4 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.57 1 1 0 01-.24 1.02l-2.21 2.2z" />
          </svg>
          <span>Join</span>
        </button>
      </div>
    </div>
  )
}
