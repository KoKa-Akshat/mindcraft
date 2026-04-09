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
      await db.collection('users').doc('tio0JztTPqfqAIBVz5MxiXqAtn93').delete()
      return res.status(200).json({ ok: true, deleted: 'tio0JztTPqfqAIBVz5MxiXqAtn93' })
    }

    if (action === 'restore-tutor') {
      // Copy calendly data from ghost tioO doc to real tio0 doc, then delete tioO
      const ghostSnap = await db.collection('users').doc('tioOJztTPqfqAIBVz5MxiXqAtn93').get()
      const ghostData = ghostSnap.exists ? ghostSnap.data() : {}

      await db.collection('users').doc('tio0JztTPqfqAIBVz5MxiXqAtn93').set({
        role: 'tutor',
        email: 'joinmindcraft@gmail.com',
        displayName: 'joinmindcraft',
        calendlyEmail: ghostData?.calendlyEmail ?? 'joinmindcraft@gmail.com',
        calendlyToken: ghostData?.calendlyToken ?? null,
        calendlyWebhookUri: ghostData?.calendlyWebhookUri ?? null,
        calendlyConnectedAt: ghostData?.calendlyConnectedAt ?? new Date().toISOString(),
      }, { merge: true })

      // Delete the fake tioO doc
      if (ghostSnap.exists) {
        await db.collection('users').doc('tioOJztTPqfqAIBVz5MxiXqAtn93').delete()
      }

      return res.status(200).json({ ok: true, action: 'restored tio0 as tutor, deleted tioO' })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message })
  }
}
