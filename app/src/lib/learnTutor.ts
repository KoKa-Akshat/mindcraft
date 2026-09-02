/**
 * lib/learnTutor.ts
 *
 * Client for POST /api/learn-tutor, the Phase 2 guarded tutor chat (see
 * webhook/lib/handlers/learn-tutor.ts for the full contract and guardrail
 * design). Runs on the student's own BYOK key when one is set (same key
 * Settings already collects for homework upload), platform key as a capped
 * fallback, and a client-side hint reveal if neither is available, so a
 * failure here never dead-ends the conversation.
 */
import { auth } from '../firebase'
import { WEBHOOK_BASE } from './mlApi'
import { readByokConfig } from './byokSettings'

export interface TutorTurnResult {
  reply: string
  action: 'none' | 'reveal_hint'
  fallback: boolean
}

export async function askTutor(params: {
  sessionId: string
  message: string
  conceptId: string
  conceptLabel: string
  questionText?: string
  chapterSummary?: string
  hintsShown: number
}): Promise<TutorTurnResult> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Not signed in')
  const byok = readByokConfig()

  const res = await fetch(`${WEBHOOK_BASE}/api/learn-tutor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...params, byok: byok ?? undefined }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Tutor chat failed (${res.status}).`)
  return {
    reply: typeof data.reply === 'string' ? data.reply : "Jesse didn't say anything back. Try again.",
    action: data.action === 'reveal_hint' ? 'reveal_hint' : 'none',
    fallback: data.fallback === true,
  }
}
