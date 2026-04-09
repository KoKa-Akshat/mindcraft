/**
 * api/cron-fireflies.ts
 *
 * Scheduled fallback for Fireflies webhook delivery failures.
 * Runs every 15 minutes via Vercel Cron (configured in vercel.json).
 *
 * What it does:
 *   1. Fetches the 10 most recent transcripts from the Fireflies API
 *   2. For each one, checks if a session already has it attached (idempotent)
 *   3. If not attached, runs the same matching logic as the live webhook handler:
 *      firefliesMeetingId → video_url → ±2hr time window
 *   4. Attaches transcript + sets status=completed, summaryStatus=pending
 *
 * This ensures every recording eventually reaches the tutor dashboard
 * even when Fireflies fails to deliver the webhook (common on free plans).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'

const FIREFLIES_API = 'https://api.fireflies.ai/graphql'
const FIREFLIES_KEY = process.env.FIREFLIES_API_KEY!

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (!FIREFLIES_KEY) {
    return res.status(200).json({ ok: false, note: 'FIREFLIES_API_KEY not configured' })
  }

  try {
    // Fetch the 10 most recent transcripts from Fireflies
    const ffRes = await fetch(FIREFLIES_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FIREFLIES_KEY}` },
      body: JSON.stringify({
        query: `
          query {
            transcripts(limit: 10) {
              id title date duration video_url
              summary { overview action_items keywords }
              sentences { index speaker_name text start_time end_time }
            }
          }
        `,
      }),
    })
    const ffData = await ffRes.json()
    const transcripts: any[] = ffData?.data?.transcripts ?? []

    const results: string[] = []

    for (const transcript of transcripts) {
      const meetingId: string = transcript.id

      // Skip if already linked to a session
      const alreadyLinked = await db.collection('sessions')
        .where('transcript.meetingId', '==', meetingId).limit(1).get()
      if (!alreadyLinked.empty) {
        results.push(`${meetingId}: already linked`)
        continue
      }

      // Build plain-text transcript for AI summary
      const fullText = transcript.sentences?.length
        ? transcript.sentences.map((s: any) => `[${s.speaker_name}]: ${s.text}`).join('\n')
        : transcript.summary?.overview ?? ''

      // ── Match to a session (same 3-strategy logic as live webhook) ────────────
      let sessionDoc: FirebaseFirestore.DocumentSnapshot | null = null

      const byId = await db.collection('sessions')
        .where('firefliesMeetingId', '==', meetingId).limit(1).get()
      if (!byId.empty) sessionDoc = byId.docs[0]

      if (!sessionDoc && transcript.video_url) {
        const byUrl = await db.collection('sessions')
          .where('meetingUrl', '==', transcript.video_url).limit(1).get()
        if (!byUrl.empty) sessionDoc = byUrl.docs[0]
      }

      if (!sessionDoc) {
        const meetingDate = transcript.date ? new Date(transcript.date).getTime() : null
        if (meetingDate) {
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
      }

      if (!sessionDoc) {
        // Store orphan so nothing is silently lost
        await db.collection('transcripts').doc(meetingId).set({
          meetingId,
          title:         transcript.title,
          date:          transcript.date,
          fullText,
          summary:       transcript.summary ?? null,
          sentences:     transcript.sentences ?? [],
          linkedSession: null,
          createdAt:     new Date().toISOString(),
        }, { merge: true })
        results.push(`${meetingId}: stored as orphan`)
        continue
      }

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

      results.push(`${meetingId}: linked to ${sessionDoc.id}`)
    }

    console.log('cron-fireflies results:', results)
    return res.status(200).json({ ok: true, processed: transcripts.length, results })
  } catch (err: any) {
    console.error('cron-fireflies error:', err)
    return res.status(500).json({ error: err?.message })
  }
}
