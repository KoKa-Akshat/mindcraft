/**
 * api/calendly.ts
 *
 * Receives Calendly webhook events and keeps MindCraft in sync.
 *
 * invitee.created  → creates a session doc, invites Fireflies bot, auto-completes stale sessions
 * invitee.canceled → marks the matching session as cancelled, clears student's nextSession
 *
 * Calendly webhook is registered per-tutor via /api/register-calendly.
 * The tutor is matched by the organizer email on the scheduled event.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../lib/firebase'

const FIREFLIES_API  = 'https://api.fireflies.ai/graphql'
const FIREFLIES_KEY  = process.env.FIREFLIES_API_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const { event, payload } = req.body

  // ── Booking created ─────────────────────────────────────────────────────────
  if (event === 'invitee.created') {
    const scheduledEvent = payload.scheduled_event
    const studentEmail: string = payload.email
    const studentName:  string = payload.name
    const startTime  = new Date(scheduledEvent.start_time as string)
    const endTime    = new Date(scheduledEvent.end_time   as string)
    const meetingUrl: string | null = scheduledEvent.location?.join_url ?? null
    const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60_000)

    const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const dateStr = startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    // Find tutor by organizer email
    const organizerEmail: string = (scheduledEvent.event_memberships as any[])?.[0]?.user_email ?? ''
    let tutorId   = ''
    let tutorName = 'Tutor'

    for (const emailQuery of [
      db.collection('users').where('email',        '==', organizerEmail).limit(1).get(),
      db.collection('users').where('calendlyEmail', '==', organizerEmail).limit(1).get(),
    ]) {
      const snap = await emailQuery
      if (!snap.empty) {
        tutorId   = snap.docs[0].id
        tutorName = snap.docs[0].data().displayName ?? organizerEmail.split('@')[0]
        break
      }
    }

    // Fall back to first tutor in DB if email lookup fails
    if (!tutorId) {
      const fallback = await db.collection('users').where('role', '==', 'tutor').limit(1).get()
      if (!fallback.empty) {
        tutorId   = fallback.docs[0].id
        tutorName = fallback.docs[0].data().displayName ?? 'Tutor'
      }
    }

    // Skip if this Calendly event already has a session doc (webhook can fire twice)
    const existing = await db.collection('sessions')
      .where('calendlyEventUri', '==', scheduledEvent.uri)
      .limit(1).get()
    if (!existing.empty) {
      return res.status(200).json({ ok: true, note: 'duplicate — skipped', sessionId: existing.docs[0].id })
    }

    // Create session
    const sessionRef = db.collection('sessions').doc()
    await sessionRef.set({
      studentEmail,
      studentName,
      studentId:          null,
      tutorId,
      tutorName,
      subject:            'Tutoring Session',
      status:             'scheduled',
      scheduledAt:        startTime.getTime(),
      endAt:              endTime.getTime(),
      duration:           `${durationMin} min`,
      date:               dateStr,
      meetingUrl,
      calendlyEventUri:   scheduledEvent.uri,
      calendlyInviteeUri: payload.uri,
      createdAt:          FieldValue.serverTimestamp(),
    })

    // Link to student account if they have one, then auto-complete their stale sessions
    const studentUserSnap = await db.collection('users').where('email', '==', studentEmail).limit(1).get()
    if (!studentUserSnap.empty) {
      const studentDoc = studentUserSnap.docs[0]
      const now = Date.now()

      await sessionRef.update({ studentId: studentDoc.id })

      // Auto-complete any of this student's sessions that ended before now
      const stale = await db.collection('sessions')
        .where('studentEmail', '==', studentEmail)
        .where('status', '==', 'scheduled')
        .get()
      await Promise.all(
        stale.docs
          .filter(d => d.id !== sessionRef.id && (d.data().endAt ?? d.data().scheduledAt + 90 * 60_000) < now)
          .map(d => d.ref.update({ status: 'completed' }))
      )

      // Write next session info to student's user doc for their dashboard
      await studentDoc.ref.update({
        nextSession: { subject: 'Tutoring Session', time: timeStr, tutor: tutorName, meetingUrl, scheduledAt: startTime.getTime() },
      })
    }

    // Invite Fireflies bot to record the meeting
    if (meetingUrl && FIREFLIES_KEY) {
      try {
        const ffRes = await fetch(FIREFLIES_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FIREFLIES_KEY}` },
          body: JSON.stringify({
            query: `mutation AddBot($url: String!) { addToLiveMeeting(meeting_link: $url) { success message } }`,
            variables: { url: meetingUrl },
          }),
        })
        const ffData = await ffRes.json()
        console.log('Fireflies bot invite:', JSON.stringify(ffData))
        await sessionRef.update({ firefliesMeetingUrl: meetingUrl })
      } catch (err) {
        console.error('Fireflies invite failed:', err)
      }
    }

    // Auto-complete any of this tutor's other stale sessions
    const tutorStale = await db.collection('sessions')
      .where('tutorId', '==', tutorId)
      .where('status', '==', 'scheduled')
      .get()
    const now = Date.now()
    await Promise.all(
      tutorStale.docs
        .filter(d => d.id !== sessionRef.id && (d.data().endAt ?? d.data().scheduledAt + 90 * 60_000) < now)
        .map(d => d.ref.update({ status: 'completed', summaryStatus: d.data().summaryStatus ?? 'pending' }))
    )

    return res.status(200).json({ ok: true, sessionId: sessionRef.id })
  }

  // ── Booking cancelled ───────────────────────────────────────────────────────
  if (event === 'invitee.canceled') {
    const eventUri: string = payload.scheduled_event?.uri ?? ''
    if (eventUri) {
      const snap = await db.collection('sessions').where('calendlyEventUri', '==', eventUri).limit(1).get()
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

  return res.status(200).json({ ok: true, note: 'event type ignored' })
}
