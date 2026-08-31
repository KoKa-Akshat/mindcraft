/**
 * POST /api/concept-resolve
 *
 * Free-text semantic search over the WHOLE migrated content library: "how do
 * cells divide" -> the single best-matching concept out of 3746 lesson-bearing
 * ones, plus the prerequisite ramp to reach it. This is the production version
 * of what resolve_server.py proved locally this session, and it is genuinely
 * new: nothing already deployed resolved free text onto a concept. The old
 * concept-graph handler only ever normalized a query against a hardcoded
 * 13-concept alias table, which could not reach biology, chemistry, history,
 * or anything else in the library.
 *
 * Costs nothing against the $25/month generation budget, by design. The whole
 * path is embedding arithmetic, never an LLM API call, so there is
 * deliberately no checkPlatformBudget/recordActualSpend here — adding one
 * would be accounting for spend that does not happen.
 *
 * ── Input is a query VECTOR, not raw text ────────────────────────────────
 * The caller embeds its own query with the model named in
 * lib/conceptLibrary.ts (app/src/lib/queryEmbedder.ts does this in the
 * browser) and posts the 384 floats. This handler holds no model. The full
 * reasoning is in lib/conceptLibrary.ts's header, but in short: importing
 * @huggingface/transformers here drags onnxruntime-node's ~208 MB of
 * per-platform binaries into api/app-actions, which a preview deploy measured
 * at 442 MB against a 250 MB ceiling — and app-actions is the SHARED router
 * for about forty live endpoints, with the Hobby plan's 12-function cap
 * already fully consumed so there is nowhere else to put it. Separately, and
 * more importantly for the student: serverless containers idle out in
 * minutes, so a server-side model would pay its ~9s cold load on nearly every
 * real search, where the browser pays it once and then caches for weeks.
 *
 * The vector is validated for exact dimension and finiteness and re-normalized
 * server-side (sanitizeQueryVector), so a malformed or unnormalized client can
 * get an error, never a silently skewed ranking.
 *
 * Auth is required: the endpoint spends no money, but it scans the whole
 * library per call and its only real caller is the signed-in app, so it takes
 * a verified Firebase ID token and a real origin allowlist rather than the
 * wildcard setCors() the cheap CRUD handlers use.
 *
 * Latency: the vector index is 4 Firestore documents (~1.4 MB int8) loaded
 * once per warm container, after which a resolve is a sub-millisecond scan
 * plus the guided-path walk. `coldStart` and real per-stage timings are
 * returned so the client can narrate a slow first call honestly.
 *
 * Routed through app-actions.ts: the Hobby plan's 12-function ceiling is
 * already exactly reached by the 12 files in api/, so no new top-level
 * function is available.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsAllowlist } from '../cors'
import { verifyToken } from '../verifyToken'
import { db } from '../firebase'
import {
  CONCEPT_LIBRARY,
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  EMBEDDING_DTYPE,
  loadConceptIndex,
  sanitizeQueryVector,
  topK,
  guidedPath,
} from '../conceptLibrary'

const ALLOWED_ORIGINS = [
  'https://mindcraft-93858.web.app',
  'https://mindcraft-93858.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

const MAX_QUERY_CHARS = 600
const DEFAULT_TOP_K = 5
const MAX_TOP_K = 10

/** Fields the match list needs. Field-masked so returning five matches never
 * drags five full lesson bodies across the wire. */
const MATCH_FIELDS = ['conceptId', 'name', 'subject', 'subjectTitle', 'level', 'hasLesson', 'hasSim']

/** Set once the first successful load happens in this container, so the
 * response can tell the client whether it just paid the cold-start cost. */
let warmed = false

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsAllowlist(req, res, { allowedOrigins: ALLOWED_ORIGINS })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body = (req.body || {}) as { text?: string; vector?: unknown; topK?: number; withPath?: boolean }
  // `text` is carried through for display and logging only; the ranking is
  // driven entirely by `vector`. It is never used to guess a result.
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_QUERY_CHARS) : ''
  const queryVec = sanitizeQueryVector(body.vector)
  if (!queryVec) {
    return res.status(400).json({
      error: `A ${EMBEDDING_DIM}-dimension query vector is required.`,
      detail: `Embed the query with ${EMBEDDING_MODEL} (dtype ${EMBEDDING_DTYPE}, mean pooling) and post it as \`vector\`. This endpoint deliberately does not host the model; see lib/conceptLibrary.ts.`,
    })
  }
  const k = Math.max(1, Math.min(MAX_TOP_K, Number(body.topK) || DEFAULT_TOP_K))
  const withPath = body.withPath !== false

  const wasCold = !warmed
  const t0 = Date.now()
  try {
    const index = await loadConceptIndex(db)
    const tLoaded = Date.now()
    const tEmbedded = tLoaded // the embed happened on the client, before this call

    const scored = topK(index, queryVec, k)
    const tScored = Date.now()

    // Hydrate ids into real labels. One batched read, field-masked.
    const refs = scored.map((s) => db.collection(CONCEPT_LIBRARY).doc(s.conceptId))
    const snaps = refs.length ? await db.getAll(...refs, { fieldMask: MATCH_FIELDS }) : []
    const matches = scored.map((s, i) => {
      const d = snaps[i]?.exists ? (snaps[i].data() as Record<string, unknown>) : {}
      return {
        conceptId: s.conceptId,
        label: (d.name as string) || s.conceptId,
        subject: (d.subject as string) || '',
        subjectTitle: (d.subjectTitle as string) || '',
        level: (d.level as string) || 'core',
        hasLesson: d.hasLesson === true,
        hasSim: d.hasSim === true,
        score: s.score,
      }
    })

    // The ramp is built for the top match only. The client renders the path for
    // whatever it actually resolves to and checks that the path's last step
    // matches before using it, so building more than one here would be waste.
    const path = withPath && matches.length ? await guidedPath(db, matches[0].conceptId) : []

    warmed = true
    return res.status(200).json({
      query: text,
      matches,
      path,
      indexedConcepts: index.ids.length,
      indexBuiltAt: index.builtAt,
      model: index.model,
      coldStart: wasCold,
      timingsMs: {
        load: tLoaded - t0,
        embed: tEmbedded - tLoaded,
        score: tScored - tEmbedded,
        total: Date.now() - t0,
      },
    })
  } catch (e) {
    // An honest failure, not a fabricated empty result: an empty match list
    // would read to the client as "nothing in the library is about this",
    // which is a completely different and untrue statement.
    console.error('concept-resolve failed', e)
    return res.status(503).json({
      error: 'Concept search is unavailable right now.',
      detail: String(e).slice(0, 300),
    })
  }
}
