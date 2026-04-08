import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()
const db = admin.firestore()

// ── Calendly Webhook ──────────────────────────────────────────────────────────
// Receives POST from Calendly when a session is booked or cancelled.
// Creates/updates a session doc in Firestore and links it to the student's account.
export const calendlyWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return }

  const { event, payload } = req.body

  // ── Booking created ──
  if (event === 'invitee.created') {
    const invitee        = payload.invitee
    const scheduledEvent = payload.scheduled_event
    const eventType      = payload.event_type

    const studentEmail = invitee.email as string
    const studentName  = invitee.name  as string
    const startTime    = new Date(scheduledEvent.start_time as string)
    const endTime      = new Date(scheduledEvent.end_time   as string)
    const zoomUrl: string | null = scheduledEvent.location?.join_url ?? null
    const subject: string = (eventType.name as string) || 'Tutoring Session'
    const durationMin  = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

    // Match tutor by their Calendly user URI stored in their Firestore doc
    const calendlyUserUri: string = scheduledEvent.event_memberships?.[0]?.user ?? ''
    const tutorSnap = await db.collection('users')
      .where('role', '==', 'tutor')
      .where('calendlyUri', '==', calendlyUserUri)
      .limit(1).get()

    const tutorDoc  = tutorSnap.empty ? null : tutorSnap.docs[0]
    const tutorId   = tutorDoc?.id ?? 'unassigned'
    const tutorName = (tutorDoc?.data().displayName as string) ?? 'Your Tutor'

    const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const dateStr = startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    // Create session document
    const sessionRef = db.collection('sessions').doc()
    await sessionRef.set({
      studentEmail,
      studentName,
      studentId: null,   // linked below if user already exists
      tutorId,
      tutorName,
      subject,
      status: 'scheduled',
      scheduledAt: startTime.getTime(),
      endAt: endTime.getTime(),
      duration: `${durationMin} min`,
      date: dateStr,
      zoomUrl,
      calendlyEventUri: scheduledEvent.uri,
      calendlyInviteeUri: invitee.uri,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Try to link to existing user (if they signed up before booking)
    const userSnap = await db.collection('users')
      .where('email', '==', studentEmail)
      .limit(1).get()

    if (!userSnap.empty) {
      const userDoc = userSnap.docs[0]
      await sessionRef.update({ studentId: userDoc.id })
      await userDoc.ref.update({
        nextSession: { subject, time: timeStr, tutor: tutorName, zoomUrl },
      })
    }

    res.status(200).json({ ok: true, sessionId: sessionRef.id })
    return
  }

  // ── Booking cancelled ──
  if (event === 'invitee.canceled') {
    const calendlyEventUri: string = payload.scheduled_event?.uri ?? ''
    if (calendlyEventUri) {
      const snap = await db.collection('sessions')
        .where('calendlyEventUri', '==', calendlyEventUri)
        .limit(1).get()
      if (!snap.empty) {
        const sessionDoc = snap.docs[0]
        await sessionDoc.ref.update({ status: 'cancelled' })

        // Clear nextSession from student's user doc if it matches
        const studentId: string | null = sessionDoc.data().studentId ?? null
        if (studentId) {
          await db.collection('users').doc(studentId).update({ nextSession: null })
        }
      }
    }
    res.status(200).json({ ok: true })
    return
  }

  res.status(200).json({ ok: true, note: 'event ignored' })
})
