import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'
import { setCors } from '../lib/cors'
import { verifyToken } from '../lib/verifyToken'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const MAX_CODE_ATTEMPTS = 10

function makeCode() {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

function displayNameForUser(data: Record<string, any> | undefined, uid: string) {
  return data?.displayName || data?.name || data?.email || uid
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const userSnap = await db.collection('users').doc(uid).get()
    const user = userSnap.data()
    if (user?.role !== 'tutor' && user?.role !== 'admin') {
      return res.status(403).json({ error: 'Only tutors can create classrooms' })
    }

    const existing = await db.collection('classrooms')
      .where('tutorId', '==', uid)
      .limit(1)
      .get()

    if (!existing.empty) {
      const doc = existing.docs[0]
      return res.status(200).json({ id: doc.id, ...doc.data() })
    }

    let code = ''
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const candidate = makeCode()
      const collision = await db.collection('classrooms')
        .where('code', '==', candidate)
        .limit(1)
        .get()
      if (collision.empty) {
        code = candidate
        break
      }
    }

    if (!code) return res.status(500).json({ error: 'Could not generate classroom code' })

    const docRef = db.collection('classrooms').doc()
    const classroom = {
      code,
      tutorId: uid,
      tutorName: displayNameForUser(user, uid),
      studentIds: [],
      createdAt: Date.now(),
    }

    await docRef.set(classroom)
    return res.status(200).json({ id: docRef.id, ...classroom })
  } catch (err: any) {
    console.error('create-classroom error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
