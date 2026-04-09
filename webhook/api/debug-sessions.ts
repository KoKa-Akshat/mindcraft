import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
}
const db = getFirestore()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')
  try {
    const { tutorId, email } = req.body
    let snap
    if (tutorId === 'ALL') {
      snap = await db.collection('sessions').limit(20).get()
    } else if (email) {
      snap = await db.collection('users').where('email', '==', email).limit(5).get()
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      return res.status(200).json({ users })
    } else {
      snap = await db.collection('sessions').where('tutorId', '==', tutorId).limit(10).get()
    }
    const sessions = snap.docs.map(d => ({ id: d.id, tutorId: d.data().tutorId, status: d.data().status, studentName: d.data().studentName, summaryStatus: d.data().summaryStatus }))
    return res.status(200).json({ count: sessions.length, sessions })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message })
  }
}
