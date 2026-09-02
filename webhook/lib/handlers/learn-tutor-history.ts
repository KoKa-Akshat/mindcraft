/**
 * lib/handlers/learn-tutor-history.ts
 *
 * POST /api/learn-tutor-history (routed through app-actions.ts, same
 * Vercel Hobby function-cap reason every small handler here is).
 *
 * Phase 3's "click a past session in the sidebar, see the actual
 * conversation again" read path. conversations/* is intentionally never
 * exposed to the client directly (no Firestore rule for it, unlike
 * conceptStudyLog or the new learnSessions index), so re-opening a past
 * tutor chat has to go through the backend the same way writing to it
 * already does in learn-tutor.ts.
 *
 * Request:  { conceptId }
 * Response: { messages: [{ role: 'user' | 'assistant', content: string }] }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { loadHistory } from '../conversationStore'

function clip(s: unknown, max: number): string {
  return typeof s === 'string' ? s.slice(0, max) : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Unauthorized' })

  const body = req.body || {}
  const conceptId = clip(body.conceptId, 200)
  if (!conceptId) return res.status(400).json({ error: 'Missing conceptId' })

  // Same conversationId shape learn-tutor.ts saves under: one conversation
  // per student per concept.
  const messages = await loadHistory(`learn:${uid}:${conceptId}`)
  return res.status(200).json({ messages })
}
