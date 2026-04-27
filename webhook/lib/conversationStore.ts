/**
 * lib/conversationStore.ts
 *
 * Persists JARVIS conversation history in Firestore so the agent has memory
 * across cold starts and sessions. Each student gets one document under
 * `conversations/{studentId}` with a capped array of message objects.
 */

import { db } from './firebase'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'

const MAX_IN_CONTEXT = 10  // messages passed to the agent per request
const MAX_STORED     = 60  // messages kept in Firestore (30 exchanges)

interface StoredMessage {
  role: 'human' | 'ai'
  content: string
  ts: number
}

export async function loadHistory(studentId: string): Promise<BaseMessage[]> {
  try {
    const doc = await db.collection('conversations').doc(studentId).get()
    if (!doc.exists) return []
    const messages: StoredMessage[] = doc.data()?.messages ?? []
    return messages.slice(-MAX_IN_CONTEXT).map(m =>
      m.role === 'human' ? new HumanMessage(m.content) : new AIMessage(m.content)
    )
  } catch {
    return []
  }
}

export async function saveExchange(studentId: string, human: string, ai: string): Promise<void> {
  const ref = db.collection('conversations').doc(studentId)
  const doc = await ref.get()
  const existing: StoredMessage[] = doc.exists ? (doc.data()?.messages ?? []) : []
  const updated = [
    ...existing,
    { role: 'human' as const, content: human, ts: Date.now() },
    { role: 'ai'    as const, content: ai,    ts: Date.now() },
  ].slice(-MAX_STORED)
  await ref.set({ messages: updated }, { merge: true })
}
