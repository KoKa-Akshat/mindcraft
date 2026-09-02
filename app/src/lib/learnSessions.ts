/**
 * lib/learnSessions.ts
 *
 * Phase 3 of the Learn refactor: the chat-history sidebar. Two reads:
 *
 *   loadLearnSessions   direct client Firestore read of learnSessions/{uid},
 *                       same "authenticated client reads its own doc under
 *                       firestore.rules" pattern loadStudyLog already uses
 *                       for conceptStudyLog. Cheap, one doc, no webhook
 *                       round trip. Written server-side only, by
 *                       webhook/lib/handlers/learn-tutor.ts's
 *                       upsertLearnSession after every reply.
 *
 *   fetchTutorHistory   the actual conversation content for one concept.
 *                       Unlike the study log, conversations/* has no
 *                       Firestore rule at all, deliberately: chat content
 *                       stays backend-gated. Re-opening a past session goes
 *                       through the new /api/learn-tutor-history endpoint
 *                       instead, verified the same way every learn-tutor
 *                       call already is.
 */
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { WEBHOOK_BASE } from './mlApi'
import type { TutorMessage } from '../pages/learn/TutorPanel'

export interface LearnSessionSummary {
  conceptId: string
  conceptLabel: string
  lastMessage: string
  lastRole: 'user' | 'assistant'
  updatedAt: number
}

export async function loadLearnSessions(uid: string): Promise<LearnSessionSummary[]> {
  if (!uid) return []
  try {
    const snap = await getDoc(doc(db, 'learnSessions', uid))
    if (!snap.exists()) return []
    const sessions = snap.data()?.sessions
    return Array.isArray(sessions) ? sessions : []
  } catch {
    return []
  }
}

export async function fetchTutorHistory(conceptId: string): Promise<TutorMessage[]> {
  const token = await auth.currentUser?.getIdToken()
  if (!token || !conceptId) return []
  try {
    const res = await fetch(`${WEBHOOK_BASE}/api/learn-tutor-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ conceptId }),
    })
    if (!res.ok) return []
    const data = await res.json().catch(() => ({}))
    const messages = Array.isArray(data?.messages) ? data.messages : []
    return messages
      .filter((m: unknown): m is { role: string; content: string } =>
        !!m && typeof m === 'object' && (m as { role?: unknown }).role !== undefined && typeof (m as { content?: unknown }).content === 'string')
      .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
      .map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  } catch {
    return []
  }
}
