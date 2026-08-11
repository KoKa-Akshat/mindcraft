/**
 * Sends scheduled marketing follow-ups about 1 hour after capture.
 * Cron: every 15 minutes (vercel.json).
 *
 * Auth: Vercel Cron sends Authorization: Bearer <CRON_SECRET> when set.
 * Also accepts ?secret= last-8 of ANTHROPIC_API_KEY for manual runs.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from '../firebase'
import {
  DEFAULT_FOLLOWUP,
  renderTemplate,
  sendMarketingEmail,
} from '../sendMarketingEmail'

function authorized(req: VercelRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.authorization || ''
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  const q = typeof req.query.secret === 'string' ? req.query.secret : ''
  const tail = process.env.ANTHROPIC_API_KEY?.slice(-8)
  if (tail && q === tail) return true
  // Vercel Cron on Hobby may omit bearer; allow if User-Agent looks like cron
  // and no CRON_SECRET is configured (same pragmatism as other crons here).
  if (!cronSecret && (req.headers['user-agent'] || '').includes('vercel-cron')) return true
  return false
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!authorized(req)) return res.status(403).json({ error: 'Forbidden' })

  try {
    const settingsSnap = await db.collection('marketing_settings').doc('followUpEmail').get()
    const settings = settingsSnap.data() || {}
    if (settings.enabled === false) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'follow-up disabled in admin' })
    }

    const subjectTpl = String(settings.subject || DEFAULT_FOLLOWUP.subject)
    const bodyTpl = String(settings.body || DEFAULT_FOLLOWUP.body)
    const now = Timestamp.now()

    const due = await db
      .collection('marketing_leads')
      .where('followUpStatus', '==', 'scheduled')
      .where('followUpAt', '<=', now)
      .limit(40)
      .get()

    const results: Array<{ email: string; status: string; detail?: string }> = []

    for (const doc of due.docs) {
      const lead = doc.data()
      const email = String(lead.email || doc.id)
      const name = String(lead.name || '').trim() || 'there'
      const subject = renderTemplate(subjectTpl, { name, email })
      const text = renderTemplate(bodyTpl, { name, email })
      const html = text
        .split('\n')
        .map((line) => (line.trim() ? `<p style="margin:0 0 12px;font:16px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#143a2e;">${escapeHtml(line)}</p>` : '<br/>'))
        .join('')

      const sent = await sendMarketingEmail({ to: email, subject, text, html })
      if (sent.ok) {
        await doc.ref.update({
          followUpStatus: 'sent',
          followUpSentAt: FieldValue.serverTimestamp(),
          followUpProvider: sent.provider,
          followUpMessageId: sent.id || null,
          followUpError: null,
        })
        results.push({ email, status: 'sent', detail: sent.id })
      } else {
        await doc.ref.update({
          followUpStatus: sent.provider === 'none' ? 'scheduled' : 'failed',
          followUpError: sent.error,
          // If provider missing, bump followUpAt so we don't tight-loop; retry in 30m.
          ...(sent.provider === 'none'
            ? { followUpAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000) }
            : {}),
        })
        results.push({ email, status: sent.provider === 'none' ? 'queued_no_provider' : 'failed', detail: sent.error })
      }
    }

    return res.status(200).json({
      ok: true,
      checked: due.size,
      results,
      resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    })
  } catch (err: any) {
    console.error('[cron-marketing-followup]', err)
    return res.status(500).json({ error: err?.message || 'cron failed' })
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
