import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../firebase'
import { setCors } from '../cors'
import { verifyTokenFull } from '../verifyToken'

const PARENT_EMAIL_MESSAGE =
  'Ask your child to add your email as their parent email in MindCraft, then try again.'

function cleanEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const token = await verifyTokenFull(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const callerEmail = cleanEmail(token.email)
    if (!token.email_verified || !callerEmail) {
      return res.status(403).json({ error: 'Please verify your email first.' })
    }

    const childEmail = cleanEmail(req.body?.childEmail)
    if (!childEmail) return res.status(400).json({ error: 'Missing child email' })

    const callerSnap = await db.collection('users').doc(token.uid).get()
    const caller = callerSnap.data() ?? {}
    const isAdmin = caller.role === 'admin'

    const parentUid = isAdmin && typeof req.body?.parentUid === 'string' && req.body.parentUid.trim()
      ? req.body.parentUid.trim()
      : token.uid

    if (isAdmin && parentUid !== token.uid) {
      const parentSnap = await db.collection('users').doc(parentUid).get()
      if (!parentSnap.exists) return res.status(404).json({ error: 'No parent account found' })
    }

    const childSnap = await db.collection('users')
      .where('email', '==', childEmail)
      .limit(1)
      .get()

    if (childSnap.empty) return res.status(404).json({ error: 'No account found' })

    const childDoc = childSnap.docs[0]
    const child = childDoc.data()
    const allowedParentEmail = cleanEmail(child.parentEmail)

    if (!isAdmin && allowedParentEmail !== callerEmail) {
      return res.status(403).json({ error: PARENT_EMAIL_MESSAGE })
    }

    // childId stays the single "most recently linked" scalar for every
    // existing reader that only ever cared about one kid (ParentDashboard's
    // legacy path, Admin.tsx's summary columns). childIds is the new array,
    // additive only — a parent linking a 2nd/3rd child never loses the
    // earlier ones the way overwriting a scalar would.
    await db.collection('users').doc(parentUid).set({
      childId: childDoc.id,
      childIds: FieldValue.arrayUnion(childDoc.id),
      role: 'parent',
    }, { merge: true })

    return res.status(200).json({ childId: childDoc.id })
  } catch (err: any) {
    console.error('link-child error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
