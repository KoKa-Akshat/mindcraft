import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
}
const db = getFirestore()

const FIREFLIES_API = 'https://api.fireflies.ai/graphql'
const FF_KEY = process.env.FIREFLIES_API_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    // Fireflies sends: { meetingId, clientReferenceId } or { transcriptId }
    const body = req.body ?? {}
    const meetingId: string = body.meetingId || body.transcriptId || body.id || ''

    console.log('Fireflies webhook received:', JSON.stringify(body).slice(0, 300))

    if (!meetingId) {
      return res.status(200).json({ ok: true, note: 'no meetingId — ping ignored' })
    }

    // Fetch full transcript from Fireflies GraphQL API
    const ffRes = await fetch(FIREFLIES_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FF_KEY}`,
      },
      body: JSON.stringify({
        query: `
          query Transcript($id: String!) {
            transcript(id: $id) {
              id
              title
              date
              duration
              video_url
              meeting_attendees { displayName email }
              summary {
                overview
                action_items
                keywords
              }
              sentences {
                index
                speaker_name
                text
                start_time
                end_time
              }
            }
          }
        `,
        variables: { id: meetingId },
      }),
    })

    const ffData = await ffRes.json()
    const transcript = ffData?.data?.transcript

    if (!transcript) {
      console.error('Fireflies transcript not found for id:', meetingId, 'response:', JSON.stringify(ffData).slice(0, 300))
      return res.status(200).json({ ok: true, note: 'transcript not ready yet' })
    }

    // Build clean transcript text
    const fullText = transcript.sentences?.length
      ? transcript.sentences.map((s: any) => `[${s.speaker_name}]: ${s.text}`).join('\n')
      : transcript.summary?.overview ?? ''

    // Match session — first try by meetingId stored when bot was invited
    let sessionDoc: FirebaseFirestore.DocumentSnapshot | null = null

    const byMeetingId = await db.collection('sessions')
      .where('firefliesMeetingId', '==', meetingId)
      .limit(1).get()
    if (!byMeetingId.empty) {
      sessionDoc = byMeetingId.docs[0]
    }

    // Fallback: match by Zoom/Meet URL stored in video_url or meeting attendees
    if (!sessionDoc && transcript.video_url) {
      const byUrl = await db.collection('sessions')
        .where('meetingUrl', '==', transcript.video_url)
        .limit(1).get()
      if (!byUrl.empty) sessionDoc = byUrl.docs[0]
    }

    // Fallback: match by time window (2hr)
    if (!sessionDoc) {
      const meetingDate = transcript.date ? new Date(transcript.date).getTime() : Date.now()
      const windowMs = 2 * 60 * 60 * 1000
      const byTime = await db.collection('sessions')
        .where('scheduledAt', '>=', meetingDate - windowMs)
        .where('scheduledAt', '<=', meetingDate + windowMs)
        .limit(5).get()

      if (!byTime.empty) {
        sessionDoc = byTime.docs.sort((a, b) =>
          Math.abs(a.data().scheduledAt - meetingDate) -
          Math.abs(b.data().scheduledAt - meetingDate)
        )[0]
      }
    }

    if (!sessionDoc) {
      // Store as orphan for manual linking
      await db.collection('transcripts').doc(meetingId).set({
        meetingId,
        title: transcript.title,
        date: transcript.date,
        fullText,
        summary: transcript.summary ?? null,
        sentences: transcript.sentences ?? [],
        linkedSession: null,
        createdAt: new Date().toISOString(),
      })
      console.log('Stored orphan transcript:', meetingId)
      return res.status(200).json({ ok: true, note: 'stored as orphan — no matching session found' })
    }

    await sessionDoc.ref.update({
      transcript: {
        meetingId,
        fullText,
        summary: transcript.summary ?? null,
        sentences: transcript.sentences ?? [],
        duration: transcript.duration,
        processedAt: new Date().toISOString(),
      },
      status: 'completed',
      summaryStatus: 'pending',
    })

    console.log('Transcript linked to session:', sessionDoc.id)
    return res.status(200).json({ ok: true, sessionId: sessionDoc.id })
  } catch (err: any) {
    console.error('fireflies webhook error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
