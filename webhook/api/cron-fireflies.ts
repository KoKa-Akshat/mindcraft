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
import {
  buildRecentTranscriptsQuery,
  fetchFirefliesGraphQL,
  transcriptFullText,
  matchSession,
  storeOrphanTranscript,
  attachTranscriptToSession,
  type FirefliesTranscript,
} from '../lib/firefliesMatch'

const FIREFLIES_KEY = process.env.FIREFLIES_API_KEY!
const RECENT_TRANSCRIPTS_LIMIT = 10

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Daily safety net for marketing follow-ups (Hobby Vercel can't cron */20).
  // Primary cadence is GitHub Actions → /api/cron-marketing-followup.
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://mindcraft-webhook.vercel.app'
    const secret = process.env.ANTHROPIC_API_KEY?.slice(-8) || ''
    void fetch(
      `${base}/api/app-actions?action=cron-marketing-followup&secret=${encodeURIComponent(secret)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      },
    )
  } catch { /* non-fatal */ }

  if (!FIREFLIES_KEY) {
    return res.status(200).json({ ok: false, note: 'FIREFLIES_API_KEY not configured' })
  }

  try {
    // Fetch the N most recent transcripts from Fireflies
    const ffData = await fetchFirefliesGraphQL(FIREFLIES_KEY, buildRecentTranscriptsQuery(RECENT_TRANSCRIPTS_LIMIT))
    const transcripts: FirefliesTranscript[] = ffData?.data?.transcripts ?? []

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
      const fullText = transcriptFullText(transcript)

      // ── Match to a session (same 3-strategy logic as live webhook) ────────────
      // Unlike the live webhook, a missing date SKIPS the time-window
      // strategy entirely here rather than falling back to Date.now() —
      // a polling pass shouldn't guess a recency window for an undated
      // transcript the way a just-fired webhook reasonably can.
      const meetingDate = transcript.date ? new Date(transcript.date).getTime() : null
      const sessionDoc = await matchSession(meetingId, transcript.video_url, meetingDate)

      if (!sessionDoc) {
        // Store orphan so nothing is silently lost. merge:true (unlike the
        // live webhook's plain set) since this runs every 15 minutes and
        // may re-encounter the same still-unmatched transcript.
        await storeOrphanTranscript({
          meetingId,
          title: transcript.title,
          date: transcript.date,
          fullText,
          summary: transcript.summary,
          sentences: transcript.sentences,
        }, { merge: true })
        results.push(`${meetingId}: stored as orphan`)
        continue
      }

      await attachTranscriptToSession(sessionDoc, {
        meetingId,
        fullText,
        summary: transcript.summary,
        sentences: transcript.sentences,
        duration: transcript.duration,
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
