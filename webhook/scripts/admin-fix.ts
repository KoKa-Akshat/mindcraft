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

    // ── Fetch recent transcripts from Fireflies API ───────────────────────────
    if (action === 'check-fireflies') {
      const key = process.env.FIREFLIES_API_KEY
      if (!key) return res.status(200).json({ error: 'FIREFLIES_API_KEY not set in env' })

      const ffRes = await fetch('https://api.fireflies.ai/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          query: `query { transcripts(limit: 5) { id title date duration video_url } }`,
        }),
      })
      const ffData = await ffRes.json()
      const orphans = await db.collection('transcripts').limit(5).get()
      return res.status(200).json({
        firefliesTranscripts: ffData?.data?.transcripts ?? ffData,
        orphanTranscripts: orphans.docs.map(d => ({ id: d.id, ...d.data() })),
      })
    }

    // ── Manually run Fireflies transcript attachment for a given meetingId ─────
    if (action === 'manual-transcript') {
      const { meetingId } = req.body
      if (!meetingId) return res.status(400).json({ error: 'Missing meetingId' })

      const key = process.env.FIREFLIES_API_KEY!
      const ffRes = await fetch('https://api.fireflies.ai/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          query: `query T($id:String!){ transcript(id:$id){ id title date duration video_url
            summary { overview action_items keywords }
            sentences { index speaker_name text start_time end_time }
            meeting_attendees { displayName email }
          }}`,
          variables: { id: meetingId },
        }),
      })
      const ffData = await ffRes.json()
      const transcript = ffData?.data?.transcript
      if (!transcript) return res.status(200).json({ error: 'Transcript not found', raw: ffData })

      const fullText = transcript.sentences?.length
        ? transcript.sentences.map((s: any) => `[${s.speaker_name}]: ${s.text}`).join('\n')
        : transcript.summary?.overview ?? ''

      // Try all 3 match strategies
      let sessionDoc: FirebaseFirestore.DocumentSnapshot | null = null
      const byId = await db.collection('sessions').where('firefliesMeetingId', '==', meetingId).limit(1).get()
      if (!byId.empty) sessionDoc = byId.docs[0]

      if (!sessionDoc && transcript.video_url) {
        const byUrl = await db.collection('sessions').where('meetingUrl', '==', transcript.video_url).limit(1).get()
        if (!byUrl.empty) sessionDoc = byUrl.docs[0]
      }

      if (!sessionDoc) {
        const meetingDate = transcript.date ? new Date(transcript.date).getTime() : Date.now()
        const TWO_HOURS = 2 * 60 * 60 * 1000
        const nearby = await db.collection('sessions')
          .where('scheduledAt', '>=', meetingDate - TWO_HOURS)
          .where('scheduledAt', '<=', meetingDate + TWO_HOURS)
          .limit(5).get()
        if (!nearby.empty) {
          sessionDoc = nearby.docs.sort(
            (a, b) => Math.abs(a.data().scheduledAt - meetingDate) - Math.abs(b.data().scheduledAt - meetingDate)
          )[0]
        }
      }

      if (!sessionDoc) {
        // Store orphan
        await db.collection('transcripts').doc(meetingId).set({
          meetingId, title: transcript.title, date: transcript.date,
          fullText, summary: transcript.summary ?? null, sentences: transcript.sentences ?? [],
          linkedSession: null, createdAt: new Date().toISOString(),
        })
        return res.status(200).json({ ok: true, note: 'no matching session — stored as orphan', transcript: { id: transcript.id, title: transcript.title } })
      }

      await sessionDoc.ref.update({
        transcript: { meetingId, fullText, summary: transcript.summary ?? null, sentences: transcript.sentences ?? [], duration: transcript.duration, processedAt: new Date().toISOString() },
        status: 'completed', summaryStatus: 'pending',
      })
      return res.status(200).json({ ok: true, linkedToSession: sessionDoc.id, transcriptTitle: transcript.title })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message })
  }
}
