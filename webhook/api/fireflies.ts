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
import {
  buildTranscriptByIdQuery,
  fetchFirefliesGraphQL,
  transcriptFullText,
  matchSession,
  storeOrphanTranscript,
  attachTranscriptToSession,
  type FirefliesTranscript,
} from '../lib/firefliesMatch'

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
    const ffData = await fetchFirefliesGraphQL(FIREFLIES_KEY, buildTranscriptByIdQuery(), { id: meetingId })
    const transcript: FirefliesTranscript | undefined = ffData?.data?.transcript

    if (!transcript) {
      console.error('Transcript not ready for meetingId:', meetingId, ffData)
      return res.status(200).json({ ok: true, note: 'transcript not ready yet' })
    }

    // Build a clean readable transcript string for the AI summary
    const fullText = transcriptFullText(transcript)

    // ── Match transcript to a session ──────────────────────────────────────────
    const meetingDate = transcript.date ? new Date(transcript.date).getTime() : Date.now()
    const sessionDoc = await matchSession(meetingId, transcript.video_url, meetingDate)

    // No match — store as orphan for manual review
    if (!sessionDoc) {
      await storeOrphanTranscript({
        meetingId,
        title: transcript.title,
        date: transcript.date,
        fullText,
        summary: transcript.summary,
        sentences: transcript.sentences,
      })
      console.log('Stored orphan transcript:', meetingId)
      return res.status(200).json({ ok: true, note: 'stored as orphan — no matching session' })
    }

    // Attach transcript to session and mark it ready for review
    await attachTranscriptToSession(sessionDoc, {
      meetingId,
      fullText,
      summary: transcript.summary,
      sentences: transcript.sentences,
      duration: transcript.duration,
    })

    console.log('Transcript linked to session:', sessionDoc.id)
    return res.status(200).json({ ok: true, sessionId: sessionDoc.id })
  } catch (err: any) {
    console.error('fireflies webhook error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
