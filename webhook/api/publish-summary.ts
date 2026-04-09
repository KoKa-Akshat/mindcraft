/**
 * api/publish-summary.ts
 *
 * Publishes a session summary card to the student's dashboard.
 * Must run server-side (Admin SDK) because the tutor cannot write
 * to another user's Firestore doc from the client (security rules block it).
 *
 * Updates two documents atomically:
 *   1. sessions/{id}          — summaryCard, summaryStatus: 'published', tutorNotes
 *   2. users/{studentId}      — lastSession (what appears on student dashboard)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'
import { setCors } from '../lib/cors'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const { sessionId, card, tutorNotes } = req.body
    if (!sessionId || !card?.title) {
      return res.status(400).json({ error: 'Missing sessionId or card.title' })
    }

    const sessionSnap = await db.collection('sessions').doc(sessionId).get()
    if (!sessionSnap.exists) return res.status(404).json({ error: 'Session not found' })

    const session = sessionSnap.data()!

    // 1. Update the session doc
    await sessionSnap.ref.update({
      summaryCard:   card,
      summaryStatus: 'published',
      tutorNotes:    tutorNotes || session.tutorNotes || null,
    })

    // 2. Push lastSession to the student's user doc (Admin SDK bypasses client rules)
    if (session.studentId) {
      await db.collection('users').doc(session.studentId).update({
        lastSession: {
          id:          sessionId,
          subject:     session.subject,
          date:        session.date,
          duration:    session.duration,
          title:       card.title,
          bullets:     [...(card.topics ?? []).slice(0, 2), ...(card.homework ?? []).slice(0, 2)].filter(Boolean),
          tutorName:   session.tutorName,
          scheduledAt: session.scheduledAt,
          tutorNote:   card.tutorNote  ?? '',
          progress:    card.progress   ?? '',
        },
      })
    }

    return res.status(200).json({ ok: true })
  } catch (err: any) {
    console.error('publish-summary error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
