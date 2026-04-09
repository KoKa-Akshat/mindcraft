/**
 * api/register-calendly.ts
 *
 * Called by the tutor dashboard when a tutor connects their Calendly account.
 * Verifies the Personal Access Token, registers (or reuses) a webhook subscription,
 * and saves everything to the tutor's Firestore user doc.
 *
 * After this runs, every new Calendly booking automatically hits /api/calendly.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'
import { setCors } from '../lib/cors'

const WEBHOOK_URL = 'https://mindcraft-webhook.vercel.app/api/calendly'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const { tutorId, calendlyToken } = req.body
    if (!tutorId || !calendlyToken) {
      return res.status(400).json({ error: 'Missing tutorId or calendlyToken' })
    }

    // Verify the token is valid and get the user's Calendly identity
    const meRes = await fetch('https://api.calendly.com/users/me', {
      headers: { Authorization: `Bearer ${calendlyToken}` },
    })
    if (!meRes.ok) return res.status(400).json({ error: 'Invalid Calendly token' })

    const meData       = await meRes.json()
    const userUri      = meData.resource?.uri
    const orgUri       = meData.resource?.current_organization
    const calendlyEmail = meData.resource?.email
    if (!userUri || !orgUri) {
      return res.status(400).json({ error: 'Could not read Calendly user info' })
    }

    // Check for an existing webhook subscription for this user
    const listRes = await fetch(
      `https://api.calendly.com/webhook_subscriptions?organization=${orgUri}&user=${userUri}&scope=user`,
      { headers: { Authorization: `Bearer ${calendlyToken}` } }
    )
    const listData = await listRes.json()

    let webhookUri: string | null = null
    const existing = listData.collection?.find((w: any) => w.callback_url === WEBHOOK_URL)

    if (existing) {
      // Reuse the existing subscription — no need to recreate
      webhookUri = existing.uri
    } else {
      // Delete any old subscriptions pointing elsewhere, then register fresh
      if (listData.collection?.length > 0) {
        await Promise.all(
          listData.collection.map((w: any) =>
            fetch(`https://api.calendly.com/webhook_subscriptions/${w.uri.split('/').pop()}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${calendlyToken}` },
            }).catch(() => {})
          )
        )
      }

      const hookRes = await fetch('https://api.calendly.com/webhook_subscriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${calendlyToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:          WEBHOOK_URL,
          events:       ['invitee.created', 'invitee.canceled'],
          organization: orgUri,
          user:         userUri,
          scope:        'user',
        }),
      })
      const hookData = await hookRes.json()
      if (!hookRes.ok) {
        return res.status(400).json({ error: hookData.message ?? 'Failed to register webhook' })
      }
      webhookUri = hookData.resource?.uri
    }

    // Persist token, email, and webhook URI to the tutor's user doc
    await db.collection('users').doc(tutorId).set({
      calendlyToken,
      calendlyEmail,
      calendlyWebhookUri: webhookUri,
      calendlyConnectedAt: new Date().toISOString(),
      role:  'tutor',
      email: calendlyEmail,
    }, { merge: true })

    return res.status(200).json({ ok: true, calendlyEmail, webhookUri })
  } catch (err: any) {
    console.error('register-calendly error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
