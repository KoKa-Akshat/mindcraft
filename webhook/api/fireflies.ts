import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
}
const db = getFirestore()

const FIREFLIES_API = 'https://api.fireflies.ai/graphql'
const FF_KEY = process.env.FIREFLIES_API_KEY!

// Called by Fireflies webhook when a transcript is ready
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const { meetingId } = req.body

  if (!meetingId) return res.status(200).json({ ok: true, note: 'no meetingId — test event ignored' })

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

  if (!transcript) return res.status(404).json({ error: 'Transcript not found' })

  // Build clean transcript text
  const fullText = transcript.sentences
    ?.map((s: any) => `[${s.speaker_name}]: ${s.text}`)
    .join('\n') ?? ''

  // Match to Firestore session by meeting title/date
  // Fireflies title usually contains the Calendly event name
  const meetingDate = new Date(transcript.date).getTime()
  const windowMs = 2 * 60 * 60 * 1000 // 2hr window

  const sessSnap = await db.collection('sessions')
    .where('scheduledAt', '>=', meetingDate - windowMs)
    .where('scheduledAt', '<=', meetingDate + windowMs)
    .limit(5)
    .get()

  if (sessSnap.empty) {
    // Store orphaned transcript keyed by meetingId for manual review
    await db.collection('transcripts').doc(meetingId).set({
      meetingId,
      title: transcript.title,
      date: meetingDate,
      fullText,
      summary: transcript.summary ?? null,
      sentences: transcript.sentences ?? [],
      linkedSession: null,
      createdAt: new Date().toISOString(),
    })
    return res.status(200).json({ ok: true, note: 'stored as orphan' })
  }

  // Pick closest session by time
  const session = sessSnap.docs
    .sort((a, b) =>
      Math.abs(a.data().scheduledAt - meetingDate) -
      Math.abs(b.data().scheduledAt - meetingDate)
    )[0]

  await session.ref.update({
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

  return res.status(200).json({ ok: true, sessionId: session.id })
}
