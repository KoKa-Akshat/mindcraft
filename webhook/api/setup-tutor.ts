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
    const { tutorId, calendlyToken } = req.body
    if (!tutorId || !calendlyToken) return res.status(400).json({ error: 'Missing fields' })

    // Verify Calendly token and get email
    const meRes = await fetch('https://api.calendly.com/users/me', {
      headers: { Authorization: `Bearer ${calendlyToken}` },
    })
    const meJson = await meRes.json()
    if (!meRes.ok) return res.status(400).json({ error: 'Invalid Calendly token', detail: meJson })

    const calendlyEmail = meJson.resource?.email
    const userUri = meJson.resource?.uri
    const orgUri = meJson.resource?.current_organization

    // Get existing webhook or register a new one
    const listRes = await fetch(
      `https://api.calendly.com/webhook_subscriptions?organization=${orgUri}&user=${userUri}&scope=user`,
      { headers: { Authorization: `Bearer ${calendlyToken}` } }
    )
    const listJson = await listRes.json()
    let webhookUri = listJson.collection?.[0]?.uri ?? null

    if (!webhookUri) {
      const hookRes = await fetch('https://api.calendly.com/webhook_subscriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${calendlyToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://mindcraft-webhook.vercel.app/api/calendly',
          events: ['invitee.created', 'invitee.canceled'],
          organization: orgUri,
          user: userUri,
          scope: 'user',
        }),
      })
      const hookJson = await hookRes.json()
      webhookUri = hookJson.resource?.uri ?? null
    }

    // Use set with merge so it works even if doc was accidentally deleted
    await db.collection('users').doc(tutorId).set({
      calendlyEmail,
      calendlyToken,
      calendlyWebhookUri: webhookUri,
      calendlyConnectedAt: new Date().toISOString(),
      role: 'tutor',
      email: calendlyEmail,
      displayName: calendlyEmail.split('@')[0],
    }, { merge: true })

    return res.status(200).json({ ok: true, calendlyEmail, webhookUri })
  } catch (err: any) {
    console.error('setup-tutor error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal error' })
  }
}
