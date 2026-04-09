/**
 * api/debug-sessions.ts
 *
 * Internal debugging endpoint — not called by the frontend.
 * Useful for inspecting Firestore state during development or incident response.
 *
 * Actions:
 *   tutorId: 'ALL'        → return up to 20 sessions across all tutors
 *   email: '...'          → look up user docs by email
 *   tutorId: '<uid>'      → return up to 10 sessions for that tutor
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const { tutorId, email } = req.body

    // Look up users by email
    if (email) {
      const snap = await db.collection('users').where('email', '==', email).limit(5).get()
      return res.status(200).json({ users: snap.docs.map(d => ({ id: d.id, ...d.data() })) })
    }

    // Fetch sessions
    const snap = tutorId === 'ALL'
      ? await db.collection('sessions').limit(20).get()
      : await db.collection('sessions').where('tutorId', '==', tutorId).limit(10).get()

    const sessions = snap.docs.map(d => ({
      id:            d.id,
      tutorId:       d.data().tutorId,
      status:        d.data().status,
      studentName:   d.data().studentName,
      summaryStatus: d.data().summaryStatus,
    }))

    return res.status(200).json({ count: sessions.length, sessions })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message })
  }
}
