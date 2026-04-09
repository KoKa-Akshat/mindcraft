/**
 * api/delete-session.ts
 *
 * Deletes a session document server-side using the Admin SDK (bypasses Firestore rules).
 * The tutorId check ensures only the session's own tutor can delete it.
 *
 * Called from: TutorDashboard and SessionDetail delete buttons.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'
import { setCors } from '../lib/cors'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const { sessionId, tutorId } = req.body
    if (!sessionId || !tutorId) {
      return res.status(400).json({ error: 'Missing sessionId or tutorId' })
    }

    const snap = await db.collection('sessions').doc(sessionId).get()
    if (!snap.exists) return res.status(404).json({ error: 'Session not found' })

    // Only the session's assigned tutor may delete it
    if (snap.data()!.tutorId !== tutorId) {
      return res.status(403).json({ error: 'Not authorized to delete this session' })
    }

    await snap.ref.delete()
    return res.status(200).json({ ok: true })
  } catch (err: any) {
    console.error('delete-session error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
