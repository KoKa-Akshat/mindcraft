import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
  })
}
const db = getFirestore()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const { event, payload } = req.body

  if (event === 'invitee.created') {
    const { invitee, scheduled_event: scheduledEvent } = payload

    const studentEmail: string = invitee.email
    const studentName:  string = invitee.name
    const startTime            = new Date(scheduledEvent.start_time as string)
    const endTime              = new Date(scheduledEvent.end_time   as string)
    const meetingUrl: string|null = scheduledEvent.location?.join_url ?? null
    const durationMin          = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    const subject              = 'Tutoring Session'

    const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const dateStr = startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    const { user_email: organizerEmail = '' } =
      (scheduledEvent.event_memberships as any[])?.[0] ?? {}
    let tutorId:   string | null = null
    let tutorName: string        = 'Tutor'
    const tryEmails = organizerEmail ? [
      db.collection('users').where('email', '==', organizerEmail).limit(1).get(),
      db.collection('users').where('calendlyEmail', '==', organizerEmail).limit(1).get(),
    ] : []
    for (const p of tryEmails) {
      const snap = await p
      if (!snap.empty) {
        tutorId   = snap.docs[0].id
        tutorName = (snap.docs[0].data().displayName as string | undefined) ?? organizerEmail.split('@')[0]
        break
      }
    }
    if (!tutorId) {
      const fallback = await db.collection('users').where('role', '==', 'tutor').limit(1).get()
      if (!fallback.empty) {
        tutorId   = fallback.docs[0].id
        tutorName = (fallback.docs[0].data().displayName as string | undefined) ?? 'Tutor'
      }
    }

    const sessionRef = db.collection('sessions').doc()
    await sessionRef.set({
      studentEmail,
      studentName,
      studentId:          null,
      tutorId,
      tutorName,
      subject,
      status:             'scheduled',
      scheduledAt:        startTime.getTime(),
      endAt:              endTime.getTime(),
      duration:           `${durationMin} min`,
      date:               dateStr,
      meetingUrl,
      calendlyEventUri:   scheduledEvent.uri,
      calendlyInviteeUri: invitee.uri,
      createdAt:          FieldValue.serverTimestamp(),
    })

    const userSnap = await db.collection('users')
      .where('email', '==', studentEmail)
      .limit(1).get()

    if (!userSnap.empty) {
      const userDoc = userSnap.docs[0]
      await sessionRef.update({ studentId: userDoc.id })

      // Auto-complete any past sessions for this student that are still 'scheduled'
      const pastSnap = await db.collection('sessions')
        .where('studentEmail', '==', studentEmail)
        .where('status', '==', 'scheduled')
        .get()
      const now = Date.now()
      const pastUpdates = pastSnap.docs
        .filter(d => d.id !== sessionRef.id && (d.data().endAt ?? d.data().scheduledAt + 90 * 60 * 1000) < now)
        .map(d => d.ref.update({ status: 'completed' }))
      await Promise.all(pastUpdates)

      await userDoc.ref.update({
        nextSession: { subject, time: timeStr, tutor: tutorName, meetingUrl, scheduledAt: startTime.getTime() },
      })
    }

    // Invite Fireflies bot to the meeting
    if (meetingUrl && process.env.FIREFLIES_API_KEY) {
      await fetch('https://api.fireflies.ai/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FIREFLIES_API_KEY}`,
        },
        body: JSON.stringify({
          query: `mutation { addToLiveMeeting(meeting_link: "${meetingUrl}") { success message } }`,
        }),
      }).catch(() => {}) // non-fatal — calendar invite is the primary mechanism
    }

    return res.status(200).json({ ok: true, sessionId: sessionRef.id })
  }

  if (event === 'invitee.canceled') {
    const calendlyEventUri: string = payload.scheduled_event?.uri ?? ''
    if (calendlyEventUri) {
      const snap = await db.collection('sessions')
        .where('calendlyEventUri', '==', calendlyEventUri)
        .limit(1).get()
      if (!snap.empty) {
        const sessionDoc = snap.docs[0]
        await sessionDoc.ref.update({ status: 'cancelled' })
        const studentId: string | null = sessionDoc.data().studentId ?? null
        if (studentId) {
          await db.collection('users').doc(studentId).update({ nextSession: null })
        }
      }
    }
    return res.status(200).json({ ok: true })
  }

  return res.status(200).json({ ok: true, note: 'event ignored' })
}
