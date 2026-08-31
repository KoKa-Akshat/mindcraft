/**
 * Public marketing lead capture.
 * POST https://mindcraft-webhook.vercel.app/api/marketing-lead
 * Body: { email, name?, role?, source?, note?, page? }
 * plus the optional intake fields the #claim form on joinmindcraft.com sends:
 * { parentFirstName?, parentLastName?, phone?, howHeard?, studentFirstName?,
 *   studentLastName?, school?, grade?, subject?, message? }
 * All additive: the original shape still works unchanged, and unknown
 * callers sending only the original fields are unaffected.
 *
 * Stores Firestore marketing_leads/{emailLower}, emails founders@joinmindcraft.com,
 * and schedules a 1-hour follow-up (sent by cron-marketing-followup).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from '../firebase'
import { setCors } from '../cors'
import { DEFAULT_FOLLOWUP, FOUNDERS_EMAIL, sendMarketingEmail } from '../sendMarketingEmail'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FOLLOWUP_DELAY_MS = 60 * 60 * 1000 // 1 hour

async function notifyFounders(input: {
  email: string
  name: string
  role: string
  source: string
  note: string
  page: string
  returning: boolean
  intake?: Record<string, string>
}) {
  const subject = input.returning
    ? `Lead again · ${input.email}`
    : `New lead · ${input.email}`
  const intake = input.intake || {}
  const student = [intake.studentFirstName, intake.studentLastName].filter(Boolean).join(' ')
  const lines = [
    input.returning ? 'A returning visitor submitted again.' : 'A new visitor submitted their email.',
    `Email: ${input.email}`,
    input.name && `Name: ${input.name}`,
    `Role: ${input.role}`,
    `Source: ${input.source}`,
    input.page && `Page: ${input.page}`,
    intake.phone && `Phone: ${intake.phone}`,
    intake.howHeard && `How they heard of us: ${intake.howHeard}`,
    student && `Student: ${student}`,
    intake.school && `School: ${intake.school}`,
    intake.grade && `Grade: ${intake.grade}`,
    intake.subject && `Subject: ${intake.subject}`,
    input.note && `Note: ${input.note}`,
  ].filter(Boolean)
  try {
    const result = await sendMarketingEmail({
      to: FOUNDERS_EMAIL,
      subject,
      text: lines.join('\n'),
    })
    if (!result.ok) console.error('[marketing-lead] founders notify', result.error)
  } catch (err) {
    console.error('[marketing-lead] founders notify', err)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {}
    const email = String(body.email || '').trim().toLowerCase()
    const name = String(body.name || '').trim().slice(0, 120)
    const role = String(body.role || 'visitor').trim().slice(0, 40)
    const source = String(body.source || 'marketing_site').trim().slice(0, 80)
    const note = String(body.note || body.goal || body.message || '').trim().slice(0, 2000)
    const page = String(body.page || '').trim().slice(0, 200)
    const honey = String(body._honey || body.honey || '').trim()

    // Optional intake fields from the fuller #claim form. Only non-empty
    // values are kept, so the original minimal payloads write exactly the
    // documents they always did.
    const intake: Record<string, string> = {}
    const INTAKE_FIELDS: Array<[string, number]> = [
      ['parentFirstName', 120],
      ['parentLastName', 120],
      ['phone', 40],
      ['howHeard', 120],
      ['studentFirstName', 120],
      ['studentLastName', 120],
      ['school', 160],
      ['grade', 40],
      ['subject', 160],
      ['message', 2000],
    ]
    for (const [key, max] of INTAKE_FIELDS) {
      const value = String(body[key] || '').trim().slice(0, max)
      if (value) intake[key] = value
    }

    if (honey) return res.status(200).json({ ok: true, ignored: true })
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Valid email required' })

    const id = email.replace(/\//g, '_')
    const ref = db.collection('marketing_leads').doc(id)
    const existing = await ref.get()
    const now = Timestamp.now()
    const followUpAt = Timestamp.fromMillis(Date.now() + FOLLOWUP_DELAY_MS)

    if (existing.exists) {
      const prev = existing.data() || {}
      await ref.set(
        {
          email,
          name: name || prev.name || '',
          role: role || prev.role || 'visitor',
          source: source || prev.source || 'marketing_site',
          note: note || prev.note || '',
          page: page || prev.page || '',
          // merge:true keeps any previously stored intake value a resubmission
          // left blank, same policy as the fields above.
          ...intake,
          visitCount: (prev.visitCount || 1) + 1,
          lastSeenAt: now,
          updatedAt: FieldValue.serverTimestamp(),
          // Do not reset a completed follow-up; only (re)schedule if never sent.
          ...(prev.followUpStatus === 'sent'
            ? {}
            : {
                followUpAt,
                followUpStatus: 'scheduled',
              }),
        },
        { merge: true },
      )
      await notifyFounders({ email, name: name || String(prev.name || ''), role, source, note, page, returning: true, intake })
      return res.status(200).json({ ok: true, id, returning: true })
    }

    await ref.set({
      email,
      name,
      role,
      source,
      note,
      page,
      ...intake,
      visitCount: 1,
      createdAt: FieldValue.serverTimestamp(),
      lastSeenAt: now,
      followUpAt,
      followUpStatus: 'scheduled', // scheduled | sent | failed | skipped
      followUpError: null,
      followUpSentAt: null,
    })

    // Ensure a default editable draft exists for Admin.
    const settingsRef = db.collection('marketing_settings').doc('followUpEmail')
    const settings = await settingsRef.get()
    if (!settings.exists) {
      await settingsRef.set({
        subject: DEFAULT_FOLLOWUP.subject,
        body: DEFAULT_FOLLOWUP.body,
        delayMinutes: 60,
        enabled: true,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    await notifyFounders({ email, name, role, source, note, page, returning: false, intake })
    return res.status(200).json({ ok: true, id, returning: false })
  } catch (err: any) {
    console.error('[marketing-lead]', err)
    return res.status(500).json({ error: err?.message || 'Failed to save lead' })
  }
}
