/**
 * Public marketing lead capture.
 * POST https://mindcraft-webhook.vercel.app/api/marketing-lead
 * Body: { email, name?, role?, source?, note?, page? }
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
}) {
  const subject = input.returning
    ? `Lead again · ${input.email}`
    : `New lead · ${input.email}`
  const lines = [
    input.returning ? 'A returning visitor submitted again.' : 'A new visitor submitted their email.',
    `Email: ${input.email}`,
    input.name && `Name: ${input.name}`,
    `Role: ${input.role}`,
    `Source: ${input.source}`,
    input.page && `Page: ${input.page}`,
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
    const note = String(body.note || body.goal || '').trim().slice(0, 2000)
    const page = String(body.page || '').trim().slice(0, 200)
    const honey = String(body._honey || body.honey || '').trim()

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
      await notifyFounders({ email, name: name || String(prev.name || ''), role, source, note, page, returning: true })
      return res.status(200).json({ ok: true, id, returning: true })
    }

    await ref.set({
      email,
      name,
      role,
      source,
      note,
      page,
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

    await notifyFounders({ email, name, role, source, note, page, returning: false })
    return res.status(200).json({ ok: true, id, returning: false })
  } catch (err: any) {
    console.error('[marketing-lead]', err)
    return res.status(500).json({ error: err?.message || 'Failed to save lead' })
  }
}
