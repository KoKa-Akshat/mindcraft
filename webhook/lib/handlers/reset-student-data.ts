/**
 * POST /api/reset-student-data
 *
 * Real, live report (2026-08-19): "the graph showing 14/187 concepts
 * mastered... i told you to reset this and the graph should be empty
 * before i start learning things." A test/dev account (Akshat's own,
 * akshatkoirala@gmail.com) had real accumulated mastery data from tonight's
 * testing that needed clearing for a genuine fresh start.
 *
 * Deliberately narrow: clears only the LEARNING data for one specific,
 * email-confirmed account - never touches `users/{uid}` (the real profile:
 * email, role, links), never accepts a bare uid (an email typo is more
 * likely to fail loudly - "no such user" - than a uid typo, which would
 * silently wipe a real but wrong account). Same shared-secret gate as
 * deploy-rules.ts (last 8 chars of ANTHROPIC_API_KEY) - this is an
 * irreversible, real-data action, same class of risk as a rules deploy.
 *
 * Collections cleared, matching exactly what ml/mindcraft_graph/
 * firestore_adapter.py reads to compute mastery/the knowledge graph -
 * confirmed by reading that file directly, not guessed:
 *   interactions, format_interactions, attempt_observations,
 *   attempt_fusions, learning_events (all queried by studentId == uid,
 *   batch-deleted) + knowledge_graphs/{uid}, recommendations/{uid},
 *   ingredient_states/{uid}, ingredient_recommendations/{uid},
 *   affective_state/{uid} (single docs, deleted directly).
 *
 * Call: POST /api/reset-student-data
 *   body: { "secret": "<last 8 chars of ANTHROPIC_API_KEY>", "email": "..." }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { db, auth } from '../firebase'

const QUERY_COLLECTIONS = [
  'interactions',
  'format_interactions',
  'attempt_observations',
  'attempt_fusions',
  'learning_events',
] as const

const DOC_COLLECTIONS = [
  'knowledge_graphs',
  'recommendations',
  'ingredient_states',
  'ingredient_recommendations',
  'affective_state',
] as const

async function deleteWhereStudentId(collection: string, uid: string): Promise<number> {
  let deleted = 0
  // Paginated batch delete - a single test account's event volume is
  // small, but this stays correct even if it grows past one batch.
  while (true) {
    const snap = await db.collection(collection).where('studentId', '==', uid).limit(400).get()
    if (snap.empty) break
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    deleted += snap.size
    if (snap.size < 400) break
  }
  return deleted
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as { secret?: string; email?: string }
  const expected = (process.env.ANTHROPIC_API_KEY || '').trim().slice(-8)
  if (!expected || body.secret !== expected) {
    return res.status(401).json({ error: 'invalid secret' })
  }

  const email = String(body.email || '').trim()
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'real email required' })
  }

  let uid: string
  try {
    const user = await auth.getUserByEmail(email)
    uid = user.uid
  } catch (e) {
    return res.status(404).json({ error: `no Firebase user found for ${email}`, detail: String(e) })
  }

  const queryResults: Record<string, number> = {}
  for (const c of QUERY_COLLECTIONS) {
    queryResults[c] = await deleteWhereStudentId(c, uid)
  }

  const docResults: Record<string, boolean> = {}
  for (const c of DOC_COLLECTIONS) {
    const ref = db.collection(c).doc(uid)
    const snap = await ref.get()
    docResults[c] = snap.exists
    if (snap.exists) await ref.delete()
  }

  return res.status(200).json({
    email,
    uid,
    deletedFromQueryCollections: queryResults,
    deletedDocs: docResults,
    note: 'users/{uid} profile was NOT touched - only mastery/knowledge-graph/event data was cleared.',
  })
}
