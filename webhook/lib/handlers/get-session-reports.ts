/**
 * POST /api/get-session-reports
 *
 * The read half of the ZPD/session-report design shipped tonight -
 * generate-session-report.ts writes to session_reports/{uid}/reports/{id}
 * on every workDashboard call end, but nothing ever read them back. This
 * closes that: real auth (unlike get-book.ts's public read - these are a
 * specific student's own session data, not shared content), returns the
 * caller's own most recent reports, newest first.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { db } from '../firebase'

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body = (req.body || {}) as { limit?: number }
  const limit = typeof body.limit === 'number' && body.limit > 0 ? Math.min(Math.floor(body.limit), MAX_LIMIT) : DEFAULT_LIMIT

  try {
    const snap = await db
      .collection('session_reports')
      .doc(uid)
      .collection('reports')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const reports = snap.docs.map((doc) => {
      const d = doc.data()
      return {
        id: doc.id,
        report: typeof d.report === 'string' ? d.report : '',
        context: typeof d.context === 'string' ? d.context : null,
        simEventCount: typeof d.simEventCount === 'number' ? d.simEventCount : 0,
        topWeaknesses: Array.isArray(d.topWeaknesses) ? d.topWeaknesses : [],
        createdAt: typeof d.createdAt === 'string' ? d.createdAt : '',
      }
    })
    return res.status(200).json({ reports })
  } catch (e) {
    return res.status(502).json({ error: `Failed to load session reports: ${String(e)}` })
  }
}
