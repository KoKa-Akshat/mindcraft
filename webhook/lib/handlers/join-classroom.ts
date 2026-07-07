import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../firebase'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const code = typeof req.body?.code === 'string'
      ? req.body.code.trim().toUpperCase()
      : ''
    if (!code) return res.status(400).json({ error: 'Missing code' })

    const classSnap = await db.collection('classrooms')
      .where('code', '==', code)
      .limit(1)
      .get()

    if (classSnap.empty) return res.status(404).json({ error: 'Invalid code' })

    const classroom = classSnap.docs[0]
    const data = classroom.data()
    const tutorId = data.tutorId
    if (!tutorId || typeof tutorId !== 'string') {
      return res.status(500).json({ error: 'Classroom is missing tutorId' })
    }

    await db.runTransaction(async tx => {
      tx.update(classroom.ref, { studentIds: FieldValue.arrayUnion(uid) })
      tx.set(db.collection('users').doc(uid), {
        role: 'student',
        tutorId,
        classroomId: classroom.id,
      }, { merge: true })
    })

    return res.status(200).json({
      tutorId,
      tutorName: data.tutorName,
      classroomId: classroom.id,
      code: data.code,
    })
  } catch (err: any) {
    console.error('join-classroom error:', err)
    return res.status(500).json({ error: err?.message ?? 'Internal server error' })
  }
}
