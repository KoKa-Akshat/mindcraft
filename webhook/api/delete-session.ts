import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
}
const db = getFirestore()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const { sessionId, tutorId } = req.body
    if (!sessionId || !tutorId) return res.status(400).json({ error: 'Missing sessionId or tutorId' })

    const snap = await db.collection('sessions').doc(sessionId).get()
    if (!snap.exists) return res.status(404).json({ error: 'Session not found' })

    // Only the assigned tutor can delete
    if (snap.data()?.tutorId !== tutorId) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    await snap.ref.delete()
    return res.status(200).json({ ok: true })
  } catch (err: any) {
    console.error('delete-session error:', err)
    return res.status(500).json({ error: err?.message ?? 'Delete failed' })
  }
}
