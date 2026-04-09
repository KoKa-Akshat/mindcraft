import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
}
const db = getFirestore()

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
const WEBHOOK_URL = 'https://mindcraft-webhook.vercel.app/api/calendly'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const { tutorId, calendlyToken } = req.body
    if (!tutorId || !calendlyToken) return res.status(400).json({ error: 'Missing tutorId or calendlyToken' })

    // Verify token
    const meRes = await fetch('https://api.calendly.com/users/me', {
      headers: { Authorization: `Bearer ${calendlyToken}` },
    })
    if (!meRes.ok) return res.status(400).json({ error: 'Invalid Calendly token' })

    const meData = await meRes.json()
    const userUri = meData.resource?.uri
    const orgUri  = meData.resource?.current_organization
    const calendlyEmail = meData.resource?.email
    if (!userUri || !orgUri) return res.status(400).json({ error: 'Could not read Calendly user info' })

    // Try to get existing webhook first
    const listRes = await fetch(
      `https://api.calendly.com/webhook_subscriptions?organization=${orgUri}&user=${userUri}&scope=user`,
      { headers: { Authorization: `Bearer ${calendlyToken}` } }
    )
    const listData = await listRes.json()
    let webhookUri: string | null = null

    const existing = listData.collection?.find((w: any) => w.callback_url === WEBHOOK_URL)
    if (existing) {
      // Webhook already exists — just reuse it
      webhookUri = existing.uri
    } else {
      // Delete any old webhook for a different URL, then register fresh
      if (listData.collection?.length > 0) {
        for (const w of listData.collection) {
          await fetch(`https://api.calendly.com/webhook_subscriptions/${w.uri.split('/').pop()}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${calendlyToken}` },
          }).catch(() => {})
        }
      }
      const hookRes = await fetch('https://api.calendly.com/webhook_subscriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${calendlyToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          events: ['invitee.created', 'invitee.canceled'],
          organization: orgUri,
          user: userUri,
          scope: 'user',
        }),
      })
      const hookData = await hookRes.json()
      if (!hookRes.ok) return res.status(400).json({ error: hookData.message ?? 'Failed to register webhook' })
      webhookUri = hookData.resource?.uri
    }

    // Use set+merge so it works whether doc exists or not
    await db.collection('users').doc(tutorId).set({
      calendlyToken,
      calendlyEmail,
      calendlyWebhookUri: webhookUri,
      calendlyConnectedAt: new Date().toISOString(),
      role: 'tutor',
      email: calendlyEmail,
    }, { merge: true })

    return res.status(200).json({ ok: true, calendlyEmail, webhookUri })
  } catch (err: any) {
    console.error('register-calendly error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal error' })
  }
}
