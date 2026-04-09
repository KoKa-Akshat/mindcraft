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

  const { tutorId, calendlyToken } = req.body
  if (!tutorId || !calendlyToken) return res.status(400).json({ error: 'Missing tutorId or calendlyToken' })

  // Verify token and get user/org URIs
  const meRes = await fetch('https://api.calendly.com/users/me', {
    headers: { Authorization: `Bearer ${calendlyToken}` },
  })
  if (!meRes.ok) return res.status(400).json({ error: 'Invalid Calendly token' })

  const meData = await meRes.json()
  const userUri = meData.resource?.uri
  const orgUri  = meData.resource?.current_organization
  const calendlyEmail = meData.resource?.email

  if (!userUri || !orgUri) return res.status(400).json({ error: 'Could not read Calendly user info' })

  // Remove any existing webhook for this user to avoid duplicates
  const existingSnap = await db.collection('users').doc(tutorId).get()
  const existingWebhookUri = existingSnap.data()?.calendlyWebhookUri
  if (existingWebhookUri) {
    await fetch(`https://api.calendly.com/webhook_subscriptions/${existingWebhookUri.split('/').pop()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${calendlyToken}` },
    }).catch(() => {})
  }

  // Register user-level webhook
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

  if (!hookRes.ok) {
    const err = await hookRes.json()
    return res.status(400).json({ error: err.message ?? 'Failed to register webhook' })
  }

  const hookData = await hookRes.json()
  const webhookUri = hookData.resource?.uri

  // Save token + webhook info to tutor doc
  await db.collection('users').doc(tutorId).update({
    calendlyToken,
    calendlyEmail,
    calendlyWebhookUri: webhookUri,
    calendlyConnectedAt: new Date().toISOString(),
  })

  return res.status(200).json({ ok: true, calendlyEmail, webhookUri })
}
