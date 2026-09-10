/**
 * lib/conversationStore.ts
 *
 * Persists JARVIS conversation history in Firestore so the agent has memory
 * across cold starts and sessions. Each student gets one document under
 * `conversations/{studentId}` with a capped array of message objects.
 *
 * Messages are stored and returned in Anthropic SDK format
 * ({ role: 'user' | 'assistant', content: string }) so jarvis.ts can
 * splice them directly into client.messages.create() calls.
 */

import { db } from './firebase'

const MAX_IN_CONTEXT = 10  // messages passed to the agent per request
const MAX_STORED     = 60  // messages kept in Firestore (30 exchanges)

interface StoredMessage {
  role:    'user' | 'assistant'
  content: string
  ts:      number
}

export type AnthropicMessage = Pick<StoredMessage, 'role' | 'content'>

export async function loadHistory(studentId: string): Promise<AnthropicMessage[]> {
  try {
    const doc = await db.collection('conversations').doc(studentId).get()
    if (!doc.exists) return []
    const messages: StoredMessage[] = doc.data()?.messages ?? []
    return messages
      .slice(-MAX_IN_CONTEXT)
      .map(({ role, content }) => ({ role, content }))
  } catch {
    return []
  }
}

export async function saveExchange(
  studentId: string,
  human: string,
  ai: string,
): Promise<void> {
  const ref = db.collection('conversations').doc(studentId)
  const snap = await ref.get()
  const existing: StoredMessage[] = snap.exists ? (snap.data()?.messages ?? []) : []
  const updated = [
    ...existing,
    { role: 'user'      as const, content: human, ts: Date.now() },
    { role: 'assistant' as const, content: ai,    ts: Date.now() },
  ].slice(-MAX_STORED)
  await ref.set({ messages: updated }, { merge: true })
}
