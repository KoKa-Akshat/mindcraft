/**
 * api/admin-fix.ts
 *
 * Internal admin utility endpoint — not called by the frontend.
 * Used for one-off data repairs and system health checks during development.
 *
 * Actions:
 *   verify-calendly   → check if a tutor's Calendly token + webhook subscription are active
 *   set-calendly-url  → write a custom booking URL to a tutor's Firestore doc
 *   check-tutor       → inspect a tutor's user doc fields
 *   restore-tutor     → recover tutor doc from a ghost doc (used after UID mix-up incident)
 *   delete-ghost      → delete a specific ghost user doc
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const { action } = req.body

    // ── Check if Calendly token + webhook are still valid ──────────────────────
    if (action === 'verify-calendly') {
      const { tutorId } = req.body
      if (!tutorId) return res.status(400).json({ error: 'Missing tutorId' })

      const snap = await db.collection('users').doc(tutorId).get()
      if (!snap.exists) return res.status(404).json({ error: 'User not found' })

      const data  = snap.data()!
      const token = data.calendlyToken
      if (!token) return res.status(200).json({ connected: false, reason: 'No token stored' })

      const meRes = await fetch('https://api.calendly.com/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!meRes.ok) {
        return res.status(200).json({ connected: false, reason: 'Token invalid or expired', status: meRes.status })
      }
      const meData = await meRes.json()

      const webhookId = (data.calendlyWebhookUri as string)?.split('/').pop()
      let webhookActive = false
      if (webhookId) {
        const hookRes = await fetch(`https://api.calendly.com/webhook_subscriptions/${webhookId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (hookRes.ok) {
          webhookActive = (await hookRes.json()).resource?.state === 'active'
        }
      }

      return res.status(200).json({
        connected: true,
        email: meData.resource?.email,
        webhookActive,
        webhookUri: data.calendlyWebhookUri,
        userUri: meData.resource?.uri,
      })
    }

    // ── Set a specific booking URL on a tutor doc ──────────────────────────────
    if (action === 'set-calendly-url') {
      const { tutorId, calendlyUrl } = req.body
      if (!tutorId || !calendlyUrl) return res.status(400).json({ error: 'Missing tutorId or calendlyUrl' })
      await db.collection('users').doc(tutorId).set({ calendlyUrl }, { merge: true })
      return res.status(200).json({ ok: true, tutorId, calendlyUrl })
    }

    // ── Inspect a tutor's user doc ─────────────────────────────────────────────
    if (action === 'check-tutor') {
      const { tutorId } = req.body
      if (!tutorId) return res.status(400).json({ error: 'Missing tutorId' })
      const snap = await db.collection('users').doc(tutorId).get()
      if (!snap.exists) return res.status(404).json({ error: 'User not found' })
      const d = snap.data()!
      return res.status(200).json({
        id:                 snap.id,
        role:               d.role,
        email:              d.email,
        displayName:        d.displayName,
        calendlyEmail:      d.calendlyEmail      ?? null,
        calendlyUrl:        d.calendlyUrl        ?? null,
        calendlyWebhookUri: d.calendlyWebhookUri ?? null,
        hasCalendlyToken:   !!d.calendlyToken,
      })
    }

    // ── Recover tutor doc from ghost doc (post UID mix-up) ─────────────────────
    if (action === 'restore-tutor') {
      const ghostSnap = await db.collection('users').doc('tioOJztTPqfqAIBVz5MxiXqAtn93').get()
      const ghostData = ghostSnap.exists ? ghostSnap.data() : {}

      await db.collection('users').doc('tio0JztTPqfqAIBVz5MxiXqAtn93').set({
        role:               'tutor',
        email:              'joinmindcraft@gmail.com',
        displayName:        'joinmindcraft',
        calendlyEmail:      ghostData?.calendlyEmail      ?? 'joinmindcraft@gmail.com',
        calendlyToken:      ghostData?.calendlyToken      ?? null,
        calendlyWebhookUri: ghostData?.calendlyWebhookUri ?? null,
        calendlyConnectedAt: ghostData?.calendlyConnectedAt ?? new Date().toISOString(),
      }, { merge: true })

      if (ghostSnap.exists) {
        await db.collection('users').doc('tioOJztTPqfqAIBVz5MxiXqAtn93').delete()
      }

      return res.status(200).json({ ok: true, action: 'restored tio0 as tutor, deleted tioO ghost' })
    }

    // ── Delete a specific ghost user doc ───────────────────────────────────────
    if (action === 'delete-ghost') {
      await db.collection('users').doc('tio0JztTPqfqAIBVz5MxiXqAtn93').delete()
      return res.status(200).json({ ok: true, deleted: 'tio0JztTPqfqAIBVz5MxiXqAtn93' })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message })
  }
}
