/**
 * POST /api/claim-invited-role
 *
 * Fixes a real bug: a brand-new tutor/parent's first login used to try a
 * plain client-side setDoc({role:'tutor'|'parent'}) (app/src/lib/postLogin.ts's
 * ensureRoleDoc), but firebase/firestore.rules only permits role to be absent
 * or exactly 'student' on a Firestore CREATE — so that write was rejected
 * (correctly, the rule is doing its job) and the new tutor/parent's first
 * login just threw a generic "Sign-in failed" error. Same shape as
 * grant-admin.ts (Admin SDK write bypasses the client rule), generalized to
 * the two other invite-only roles this app has: student self-registration
 * doesn't need this endpoint, since the rules already permit that write
 * directly from the client.
 *
 * Trust model: the caller only gets whatever role an ADMIN already filed
 * their email under in login_allowlist (webhook/lib/handlers's admin-link.ts
 * / app/src/lib/loginAllowlist.ts write path, itself admin-only per the
 * Firestore rules) — this endpoint can't grant a role nobody pre-approved,
 * it just moves the already-approved write from an unprivileged client
 * context to a privileged server context.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, auth } from '../firebase'
import { setCors } from '../cors'

type AllowlistRole = 'student' | 'tutor' | 'parent'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const token = await auth.verifyIdToken(header.slice(7))
    const email = token.email?.trim().toLowerCase() ?? ''
    if (!token.email_verified || !email) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    const allowlistSnap = await db.collection('login_allowlist').doc(email).get()
    const role = allowlistSnap.data()?.role as AllowlistRole | undefined
    if (!allowlistSnap.exists || (role !== 'tutor' && role !== 'parent' && role !== 'student')) {
      return res.status(403).json({ error: 'This email has not been added by an admin yet.' })
    }

    await db.collection('users').doc(token.uid).set({
      role,
      email,
      displayName: token.name ?? '',
      createdAt: new Date().toISOString(),
    }, { merge: true })

    return res.status(200).json({ ok: true, role })
  } catch (err: any) {
    console.error('claim-invited-role error:', err)
    return res.status(401).json({ error: 'Unauthorized' })
  }
}
