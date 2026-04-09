/**
 * api/fireflies.ts
 *
 * Receives Fireflies webhook events after a meeting is recorded and processed.
 * Fetches the full transcript via GraphQL, then links it to the matching session.
 *
 * Session matching strategy (in order):
 *   1. firefliesMeetingId field on session doc (set when bot was invited)
 *   2. video_url from transcript matches session.meetingUrl
 *   3. Time window — session scheduled within ±2 hrs of transcript date
 *
 * If no session is found, the transcript is stored as an orphan in /transcripts
 * for manual review rather than silently dropped.
 *
 * Webhook URL: https://mindcraft-webhook.vercel.app/api/fireflies
 * Configure at: app.fireflies.ai → Settings → Integrations → Webhook
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'

const FIREFLIES_API = 'https://api.fireflies.ai/graphql'
const FIREFLIES_KEY = process.env.FIREFLIES_API_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const body = req.body ?? {}
    const meetingId: string = body.meetingId || body.transcriptId || body.id || ''

    console.log('Fireflies webhook received:', JSON.stringify(body).slice(0, 300))

    if (!meetingId) {
      return res.status(200).json({ ok: true, note: 'no meetingId — ping ignored' })
    }

    // Fetch full transcript from Fireflies
    const ffRes = await fetch(FIREFLIES_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FIREFLIES_KEY}` },
      body: JSON.stringify({
        query: `
          query Transcript($id: String!) {
            transcript(id: $id) {
              id title date duration video_url
              meeting_attendees { displayName email }
              summary { overview action_items keywords }
              sentences { index speaker_name text start_time end_time }
            }
          }
        `,
        variables: { id: meetingId },
      }),
    })
    const ffData    = await ffRes.json()
    const transcript = ffData?.data?.transcript

    if (!transcript) {
      console.error('Transcript not ready for meetingId:', meetingId, ffData)
      return res.status(200).json({ ok: true, note: 'transcript not ready yet' })
    }

    // Build a clean readable transcript string for the AI summary
    const fullText = transcript.sentences?.length
      ? transcript.sentences.map((s: any) => `[${s.speaker_name}]: ${s.text}`).join('\n')
      : transcript.summary?.overview ?? ''

    // ── Match transcript to a session ──────────────────────────────────────────

    let sessionDoc: FirebaseFirestore.DocumentSnapshot | null = null

    // 1. Exact match by meeting ID stored when bot was invited
    const byId = await db.collection('sessions').where('firefliesMeetingId', '==', meetingId).limit(1).get()
    if (!byId.empty) sessionDoc = byId.docs[0]

    // 2. Match by the meeting URL Fireflies recorded
    if (!sessionDoc && transcript.video_url) {
      const byUrl = await db.collection('sessions').where('meetingUrl', '==', transcript.video_url).limit(1).get()
      if (!byUrl.empty) sessionDoc = byUrl.docs[0]
    }

    // 3. Match by time window (closest session within ±2 hours of transcript date)
    if (!sessionDoc) {
      const meetingDate = transcript.date ? new Date(transcript.date).getTime() : Date.now()
      const TWO_HOURS   = 2 * 60 * 60 * 1000
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

    // No match — store as orphan for manual review
    if (!sessionDoc) {
      await db.collection('transcripts').doc(meetingId).set({
        meetingId,
        title:         transcript.title,
        date:          transcript.date,
        fullText,
        summary:       transcript.summary ?? null,
        sentences:     transcript.sentences ?? [],
        linkedSession: null,
        createdAt:     new Date().toISOString(),
      })
      console.log('Stored orphan transcript:', meetingId)
      return res.status(200).json({ ok: true, note: 'stored as orphan — no matching session' })
    }

    // Attach transcript to session and mark it ready for review
    await sessionDoc.ref.update({
      transcript: {
        meetingId,
        fullText,
        summary:     transcript.summary ?? null,
        sentences:   transcript.sentences ?? [],
        duration:    transcript.duration,
        processedAt: new Date().toISOString(),
      },
      status:        'completed',
      summaryStatus: 'pending',
    })

    console.log('Transcript linked to session:', sessionDoc.id)
    return res.status(200).json({ ok: true, sessionId: sessionDoc.id })
  } catch (err: any) {
    console.error('fireflies webhook error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
