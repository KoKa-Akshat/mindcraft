import { useEffect, useMemo, useRef, useState } from 'react'
import { auth } from '../firebase'
import { WEBHOOK_BASE } from '../lib/mlApi'
import type { CheckWorkResult } from '../lib/mlApi'
import type { ScratchInkState } from '../components/ScratchTranscriptionPane'
import type { ScratchStrokeData } from '../types'
import {
  buildGuideInsights,
  buildJarvisCoachPrompt,
  extractHighlights,
  topInsights,
  type GuideInsight,
  type HighlightSpan,
} from '../lib/journalGuide'

async function fetchCoachNote(
  studentId: string,
  message: string,
  context: string,
): Promise<string | null> {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return null
    const res = await fetch(`${WEBHOOK_BASE}/api/jarvis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, context, studentId }),
    })
    const data = await res.json().catch(() => ({}))
    const reply = typeof data.reply === 'string' ? data.reply.trim() : ''
    return reply || null
  } catch {
    return null
  }
}

export interface JournalGuideState {
  insights: GuideInsight[]
  highlights: HighlightSpan[]
  thinking: boolean
  coachLoading: boolean
}

export function useJournalGuide(params: {
  conceptId: string
  questionText: string
  strokeData?: ScratchStrokeData | null
  inkState?: ScratchInkState | null
  transcribing?: boolean
  workCheck?: CheckWorkResult | null
  answerSelected?: boolean
  questionStartedAt: number
  enableCoach?: boolean
}): JournalGuideState {
  const [coachNote, setCoachNote] = useState<string | null>(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const coachKeyRef = useRef('')
  const [tick, setTick] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 2000)
    return () => window.clearInterval(id)
  }, [params.questionStartedAt])

  const elapsedMs = tick - params.questionStartedAt

  const highlights = useMemo(
    () => extractHighlights(params.questionText),
    [params.questionText],
  )

  const insights = useMemo(() => topInsights(buildGuideInsights({
    conceptId: params.conceptId,
    questionText: params.questionText,
    strokeData: params.strokeData,
    inkState: params.inkState,
    transcribing: params.transcribing,
    workCheck: params.workCheck,
    answerSelected: params.answerSelected,
    elapsedMs,
    coachNote,
  })), [
    params.conceptId,
    params.questionText,
    params.strokeData,
    params.inkState,
    params.transcribing,
    params.workCheck,
    params.answerSelected,
    elapsedMs,
    coachNote,
  ])

  const filledLines = params.inkState?.workLines?.filter(l => l.text.trim() || l.latex.trim()).length ?? 0

  useEffect(() => {
    if (params.enableCoach === false) return
    const studentId = auth.currentUser?.uid
    if (!studentId) return
    if (filledLines < 2) {
      setCoachNote(null)
      return
    }

    const key = `${params.conceptId}:${filledLines}:${params.inkState?.workLines?.map(l => l.latex).join('|') ?? ''}`
    if (key === coachKeyRef.current) return

    const timer = window.setTimeout(async () => {
      coachKeyRef.current = key
      setCoachLoading(true)
      const { message, context } = buildJarvisCoachPrompt({
        conceptId: params.conceptId,
        questionText: params.questionText,
        inkState: params.inkState,
        workCheck: params.workCheck,
      })
      const reply = await fetchCoachNote(studentId, message, context)
      if (reply) setCoachNote(reply.replace(/^["']|["']$/g, '').slice(0, 120))
      setCoachLoading(false)
    }, 4500)

    return () => window.clearTimeout(timer)
  }, [
    params.enableCoach,
    params.conceptId,
    params.questionText,
    params.inkState,
    params.workCheck,
    filledLines,
  ])

  useEffect(() => {
    setCoachNote(null)
    coachKeyRef.current = ''
  }, [params.questionText, params.conceptId])

  return {
    insights,
    highlights,
    thinking: Boolean(params.transcribing || coachLoading),
    coachLoading,
  }
}
