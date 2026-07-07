import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, auth } from '../lib/firebase'
import { setCors } from '../lib/cors'

function adminEmailSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const token = await auth.verifyIdToken(header.slice(7))
    const email = token.email?.trim().toLowerCase() ?? ''
    const allowlist = adminEmailSet()

    if (!token.email_verified || !email || !allowlist.has(email)) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    await db.collection('users').doc(token.uid).set({
      role: 'admin',
      email,
      displayName: token.name ?? '',
    }, { merge: true })

    return res.status(200).json({ ok: true })
  } catch (err: any) {
    console.error('grant-admin error:', err)
    return res.status(401).json({ error: 'Unauthorized' })
  }
}
