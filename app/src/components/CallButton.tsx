/**
 * CallButton — starts a live co-working session (plan:
 * snuggly-wandering-candle.md, build-order step 3) and routes both the
 * student and, once they join via a later step's LiveJoinBanner, a linked
 * tutor/parent to the same `/live-session/:sessionId`. Hidden entirely when
 * the student has no linked tutor — same guard pattern as
 * `FlagQuestion.tsx`/`PingTutor.tsx` (`users/{uid}.tutorId`), since a live
 * session with no one to join is a dead end.
 */
import { useState } from 'react'
import { Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createLiveSession } from '../lib/liveSession'
import type { LiveSessionContextType } from '../lib/liveSession'
import s from './CallButton.module.css'

export type CallButtonContext = {
  contextType: LiveSessionContextType
  questionId?: string
  conceptId?: string
  conceptName?: string
  questionText?: string
  /** Worksheet context only — see `LiveSessionDoc.pageImage` in liveSession.ts. */
  pageImage?: string
  pageIndex?: number
  pageCount?: number
}

type Props = {
  studentId: string
  tutorId: string | null
  context: CallButtonContext
  className?: string
}

export default function CallButton({ studentId, tutorId, context, className }: Props) {
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(false)

  if (!tutorId) return null

  async function start() {
    if (!studentId || starting) return
    setStarting(true)
    setError(false)
    const sessionId = await createLiveSession({
      studentId,
      tutorId,
      contextType: context.contextType,
      questionId: context.questionId ?? null,
      conceptId: context.conceptId ?? null,
      conceptName: context.conceptName ?? null,
      questionText: context.questionText ?? null,
      pageImage: context.pageImage ?? null,
      pageIndex: context.pageIndex ?? null,
      pageCount: context.pageCount ?? null,
    })
    setStarting(false)
    if (sessionId) {
      navigate(`/live-session/${sessionId}`)
    } else {
      setError(true)
    }
  }

  return (
    <button
      type="button"
      className={`${s.callBtn}${className ? ` ${className}` : ''}`}
      onClick={() => void start()}
      disabled={starting}
      title={error ? 'Could not start — try again' : 'Call your tutor in to work on this together'}
    >
      <Phone size={12} strokeWidth={2} aria-hidden="true" />
      {starting ? 'starting…' : error ? 'try again' : 'call'}
    </button>
  )
}
