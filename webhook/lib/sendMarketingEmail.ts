/**
 * Thin email sender for marketing follow-ups.
 * Prefers Resend (RESEND_API_KEY). Falls back to Gmail SMTP-over-HTTPS
 * style is not available here — without Resend we return a clear error so
 * the cron can leave the lead queued for admin mailto.
 */

export type SendEmailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

export type SendEmailResult =
  | { ok: true; provider: 'resend'; id?: string }
  | { ok: false; provider: 'none' | 'resend'; error: string }

const FROM =
  process.env.MARKETING_FROM_EMAIL?.trim() ||
  'MindCraft <onboarding@resend.dev>'

export async function sendMarketingEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    return {
      ok: false,
      provider: 'none',
      error: 'RESEND_API_KEY not configured on Vercel',
    }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html || undefined,
        reply_to: process.env.MARKETING_REPLY_TO?.trim() || 'joinmindcraft@gmail.com',
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) {
      return {
        ok: false,
        provider: 'resend',
        error: data.message || `Resend HTTP ${res.status}`,
      }
    }
    return { ok: true, provider: 'resend', id: data.id }
  } catch (err: any) {
    return { ok: false, provider: 'resend', error: err?.message || String(err) }
  }
}

export const DEFAULT_FOLLOWUP = {
  subject: 'Your desk is waiting · MindCraft',
  body: `Hi {{name}},

Thanks for stopping by MindCraft.

School scatters everything into screenshots, planners, and late-night tabs. MindCraft is the operating system for that knowledge — a desk that files what you drop, maps the exact gaps, and turns practice into training you can feel. Think gym membership for math, not another homework chat.

What we keep hearing from families and students: good help looks like an exact gap map, practice that transfers when the question looks different, and an honest note for parents. Not another green streak.

While beta is free, you can claim a seat here:
https://joinmindcraft.com/#start

Or just reply with your grade (or your student's grade) and what should feel easier in two weeks. A real human reads every note.

Talk soon,
Akshat + the MindCraft desk
joinmindcraft@gmail.com`,
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}
