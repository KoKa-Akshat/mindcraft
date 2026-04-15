/**
 * logEvent.ts
 *
 * Lightweight client-side event logger → Firestore `events` collection.
 * Non-blocking: errors are swallowed so logging never breaks the UI.
 *
 * Usage:
 *   logEvent(user.uid, 'jarvis_navigate', { to: '/study-timer', trigger: 'voice' })
 *   logEvent(user.uid, 'graph_search', { concept: 'Logarithms' })
 *   logEvent(user.uid, 'node_click',   { node: 'Exponents', hasSession: true })
 */

import { db } from '../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export async function logEvent(
  userId: string | null | undefined,
  type:   string,
  data?:  Record<string, unknown>,
) {
  if (!userId) return
  try {
    await addDoc(collection(db, 'events'), {
      userId,
      type,
      data:  data ?? {},
      page:  window.location.pathname,
      ts:    serverTimestamp(),
    })
  } catch { /* non-blocking */ }
}
