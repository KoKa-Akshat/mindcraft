/**
 * POST /api/ingest-lesson-graph
 *
 * The iOS app has no ML service credential of its own (X-Service-Key is a
 * shared secret and must stay server-side — see mlServiceHeaders() in
 * jarvisTools.ts, the same pattern reused here) and /ingest-lesson-graph on
 * the ml service is deliberately service-key-only (it mutates the shared
 * ontology, not one student's data — see CONTENT_GROWTH_PIPELINE.md). This
 * is the proxy: Study Session calls this after Jesse generates a lesson,
 * this attaches the secret and forwards to the ml service, which tags the
 * lesson into a real concept graph and reloads it live.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'

const DEFAULT_ML_BASE =
  process.env.ML_API_URL ??
  process.env.ML_URL ??
  'https://joinmindcraft-mindcraft-ml.hf.space'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as { topic?: string; chapterTitles?: string[] }
  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  const chapterTitles = Array.isArray(body.chapterTitles)
    ? body.chapterTitles.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : []
  if (!topic || chapterTitles.length === 0) {
    return res.status(400).json({ error: 'topic and chapterTitles required' })
  }

  const key = process.env.ML_SERVICE_SECRET
  if (!key) return res.status(500).json({ error: 'ML_SERVICE_SECRET not configured' })

  try {
    const mlRes = await fetch(`${DEFAULT_ML_BASE}/ingest-lesson-graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': key },
      body: JSON.stringify({ topic, chapter_titles: chapterTitles }),
    })
    const data = await mlRes.json().catch(() => ({}))
    if (!mlRes.ok) {
      // A bad/duplicate graph is a real, expected outcome (e.g. the loader's
      // own DAG/namespace validation rejecting it) — surface the ml
      // service's own detail rather than a generic 500 so the client can
      // tell "this lesson's concepts didn't tag cleanly" apart from "the
      // service is down."
      return res.status(mlRes.status).json(data)
    }
    return res.status(200).json({
      subjectId: data.subjectId,
      conceptIds: data.conceptIds ?? [],
      totalConcepts: data.totalConcepts,
    })
  } catch (e) {
    return res.status(502).json({ error: `ML service unreachable: ${String(e)}` })
  }
}
