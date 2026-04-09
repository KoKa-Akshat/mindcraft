import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
}
const db = getFirestore()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')
  try {
    const { action } = req.body

    if (action === 'delete-ghost') {
      // Delete the ghost doc with zero (tio0) - the real one has capital O (tioO)
      await db.collection('users').doc('tio0JztTPqfqAIBVz5MxiXqAtn93').delete()
      return res.status(200).json({ ok: true, deleted: 'tio0JztTPqfqAIBVz5MxiXqAtn93' })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message })
  }
}
