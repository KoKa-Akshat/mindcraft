/**
 * lib/conceptLibrary.ts
 *
 * Shared access layer for the migrated content library: the 4118-concept,
 * 13-subject graph (3746 written lessons, 722 concepts with real built sim
 * HTML, 7330 prerequisite/cross-subject edges) that scripts/migrate-concept-
 * library.ts moved out of a session temp file and into Firestore.
 *
 * Everything that reads the library goes through here so the collection names,
 * the embedding contract, and the guided-path rule live in exactly one place:
 * the migration script that WRITES the vectors and the resolver that READS
 * them must agree on model, dtype, pooling and quantization or search silently
 * returns nonsense, and the only defence against that is not writing it twice.
 *
 * Embedding model: all-MiniLM-L6-v2 via @huggingface/transformers (the JS
 * port). Local inference, not an LLM API call, so semantic search bills
 * NOTHING against the $25/month generation budget. Same model family
 * resolve_server.py validated locally this session, so the retrieval
 * behaviour that ships is the one that was actually measured.
 *
 * ── Where the query gets embedded, and why it is not here ─────────────────
 * The CORPUS vectors are built server-side, once, by
 * scripts/migrate-concept-library.ts. The QUERY vector is built in the
 * student's BROWSER and posted to /api/concept-resolve, which is why this
 * module holds no model loader. Two hard reasons, both measured rather than
 * assumed:
 *
 *   1. Size. @huggingface/transformers pulls onnxruntime-node, which ships
 *      ~208 MB of prebuilt binaries for every platform. Vercel traces all of
 *      them, and a preview deploy measured api/app-actions at 442 MB with the
 *      import present, against a 250 MB ceiling. app-actions is the SHARED
 *      router for about forty live endpoints (generate-sim, desk-ask,
 *      concept-graph, every CRUD handler), and the Hobby plan's 12-function
 *      cap is already exactly consumed, so there is no separate function to
 *      put it in. Shipping it here would quadruple cold-start weight for
 *      forty endpoints that never asked for an ML runtime. handlers/tts.ts
 *      already documents this exact tradeoff and made the same call.
 *   2. Latency, which matters more. Serverless containers idle out in
 *      minutes, and a student searching a few times an hour would land on a
 *      cold container nearly every time — paying the ~9s model fetch on
 *      almost every search, all day. In the browser the model is fetched once
 *      (~22 MB, q8) and then HTTP-cached for weeks, so the first search of a
 *      session is slow once and every search after that is ~50ms.
 *
 * The vectors are compatible by construction: the browser and this migration
 * run the same model id, the same q8 dtype, the same mean pooling and the same
 * L2 normalization, so a browser query vector and a server corpus vector live
 * in one space. EMBEDDING_MODEL / EMBEDDING_DTYPE / EMBEDDING_DIM below are
 * the contract, and app/src/lib/queryEmbedder.ts is required to match them.
 *
 * Known limitation, stated plainly: a non-browser client (the iOS app, say)
 * cannot call /api/concept-resolve today without its own embedder. Adding a
 * server-side text path later means either a dedicated function or an
 * embedding call out to the Python ML service, and is deliberately not
 * half-built here.
 */

/** New collections. Deliberately camelCase-distinct from every existing
 * collection in this project so nothing can collide with live data. */
export const CONCEPT_LIBRARY = 'conceptLibrary'
export const CONCEPT_LIBRARY_SIMS = 'conceptLibrarySims'
export const CONCEPT_LIBRARY_INDEX = 'conceptLibraryIndex'

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'
/** q8 over fp32: 22 MB instead of 97 MB to pull on a cold start, for a
 * cosine difference measured at ~0.002 on real query/concept pairs. The
 * migration script embeds the corpus with the SAME dtype, so query and
 * corpus vectors come from an identical graph. */
export const EMBEDDING_DTYPE = 'q8' as const
export const EMBEDDING_DIM = 384

/** How many prerequisite hops back the guided path may walk. Six keeps the
 * chip strip readable and the branch search cheap, matching the value
 * resolve_server.py validated against this exact graph. */
export const MAX_PATH_DEPTH = 6

/** Lower is more foundational. Anything unlabelled is treated as core, which
 * is what 4055 of the 4118 concepts actually are. */
export const LEVEL_RANK: Record<string, number> = {
  foundational: 0,
  cross_cutting: 1,
  core: 1,
  advanced: 2,
}

/**
 * What a query is matched against. Name plus the lesson summary beats the name
 * alone: a query phrased the way a student phrases it ("how do cells split")
 * lands on the summary's wording far more often than on a terse title. Kept
 * byte-identical to resolve_server.py's concept_text so the retrieval quality
 * measured locally is the retrieval quality that ships.
 */
export function conceptSearchText(
  name: string,
  lessonTitle?: string,
  lessonSummary?: string,
  description?: string,
): string {
  const parts: string[] = [name]
  for (const extra of [lessonTitle, lessonSummary, description]) {
    if (extra && !parts.includes(extra)) parts.push(extra)
  }
  return parts.map((p) => p.trim()).filter(Boolean).join('. ').slice(0, 900)
}

/** float32 -> int8 -> base64. Round-trips through a plain Buffer so the stored
 * form is a compact Firestore string rather than an array of 384 doubles. */
export function packInt8(vectors: Float32Array, scale: number): string {
  const out = Buffer.allocUnsafe(vectors.length)
  for (let i = 0; i < vectors.length; i++) {
    const q = Math.round(vectors[i] / scale)
    out[i] = (q < -127 ? -127 : q > 127 ? 127 : q) & 0xff
  }
  return out.toString('base64')
}

/** base64 int8 -> float32, L2-renormalized per vector so a dot product against
 * a normalized query vector is a true cosine. Renormalizing here (rather than
 * trusting the quantized values to still be unit length) is what keeps the
 * reported confidence score comparable to the local float32 implementation's. */
export function unpackInt8(packed: string, scale: number, dim: number): Float32Array {
  const buf = Buffer.from(packed, 'base64')
  const n = buf.length / dim
  const out = new Float32Array(buf.length)
  for (let v = 0; v < n; v++) {
    const base = v * dim
    let norm = 0
    for (let i = 0; i < dim; i++) {
      const b = buf[base + i]
      const val = (b > 127 ? b - 256 : b) * scale
      out[base + i] = val
      norm += val * val
    }
    norm = Math.sqrt(norm) || 1
    for (let i = 0; i < dim; i++) out[base + i] /= norm
  }
  return out
}

export interface ConceptIndex {
  ids: string[]
  vectors: Float32Array
  dim: number
  model: string
  builtAt: string
}

export interface IndexMeta {
  model: string
  dtype: string
  dim: number
  count: number
  shardCount: number
  scale: number
  builtAt: string
}

// ── Module-scope caches ─────────────────────────────────────────────────────
// Vercel reuses a warm container across requests, so both the vector index and
// the loaded model survive between invocations. Promise-valued (not
// value-valued) so two concurrent cold requests share one load instead of
// racing two.
let indexPromise: Promise<ConceptIndex> | null = null

/**
 * Loads the whole vector index from its Firestore shards, once per container.
 * 3746 vectors is ~1.4 MB across 4 shard documents in int8; loading it whole
 * and scanning it in memory is far cheaper than any per-request alternative
 * Firestore could offer (it has no native vector search on this project's
 * plan), and a full scan of 3746 x 384 int8 dot products is sub-millisecond.
 */
export async function loadConceptIndex(db: FirebaseFirestore.Firestore): Promise<ConceptIndex> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const metaSnap = await db.collection(CONCEPT_LIBRARY_INDEX).doc('meta').get()
      if (!metaSnap.exists) throw new Error('concept library index has not been built')
      const meta = metaSnap.data() as IndexMeta
      const shardRefs = Array.from({ length: meta.shardCount }, (_, i) =>
        db.collection(CONCEPT_LIBRARY_INDEX).doc(`shard_${String(i).padStart(3, '0')}`),
      )
      const shards = await db.getAll(...shardRefs)
      const ids: string[] = []
      const chunks: Float32Array[] = []
      let total = 0
      for (const s of shards) {
        if (!s.exists) throw new Error(`concept library index is missing ${s.id}`)
        const d = s.data() as { ids: string[]; vectors: string; scale: number; dim: number }
        ids.push(...d.ids)
        const chunk = unpackInt8(d.vectors, d.scale, d.dim)
        chunks.push(chunk)
        total += chunk.length
      }
      const vectors = new Float32Array(total)
      let off = 0
      for (const c of chunks) { vectors.set(c, off); off += c.length }
      return { ids, vectors, dim: meta.dim, model: meta.model, builtAt: meta.builtAt }
    })().catch((e) => {
      indexPromise = null // a failed load must not poison the container forever
      throw e
    })
  }
  return indexPromise
}

/**
 * Validates and normalizes a query vector supplied by the client.
 *
 * The client is trusted only to have run the agreed model, never to have got
 * the arithmetic right: the vector is checked for the exact expected
 * dimension and for finite values, then re-normalized here, so a scoring
 * result can never be skewed by a caller that skipped normalization or sent
 * something malformed. Returns null when the input cannot be used, so the
 * handler can answer with a real error instead of scoring garbage.
 */
export function sanitizeQueryVector(raw: unknown): Float32Array | null {
  if (!Array.isArray(raw) || raw.length !== EMBEDDING_DIM) return null
  const out = new Float32Array(EMBEDDING_DIM)
  let norm = 0
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    const v = Number(raw[i])
    if (!Number.isFinite(v)) return null
    out[i] = v
    norm += v * v
  }
  norm = Math.sqrt(norm)
  if (!(norm > 0)) return null
  for (let i = 0; i < EMBEDDING_DIM; i++) out[i] /= norm
  return out
}

export interface ScoredConcept { conceptId: string; score: number }

/** Full cosine scan, top-k. The index is already L2-normalized per vector and
 * the query comes back normalized from the model, so a dot product IS the
 * cosine and no per-row division is needed. */
export function topK(index: ConceptIndex, query: Float32Array, k: number): ScoredConcept[] {
  const { ids, vectors, dim } = index
  const best: ScoredConcept[] = []
  let worst = -Infinity
  for (let i = 0; i < ids.length; i++) {
    let dot = 0
    const base = i * dim
    for (let j = 0; j < dim; j++) dot += vectors[base + j] * query[j]
    if (best.length < k) {
      best.push({ conceptId: ids[i], score: dot })
      if (best.length === k) { best.sort((a, b) => b.score - a.score); worst = best[k - 1].score }
    } else if (dot > worst) {
      best[k - 1] = { conceptId: ids[i], score: dot }
      best.sort((a, b) => b.score - a.score)
      worst = best[k - 1].score
    }
  }
  best.sort((a, b) => b.score - a.score)
  return best
}

export interface PathStep {
  conceptId: string
  label: string
  hasLesson: boolean
  hasSim: boolean
  level?: string
  subject?: string
}

/** The fields the path walk needs. Read with a field mask so walking a ramp
 * never drags whole lesson bodies across the wire. */
interface PathNode {
  conceptId: string
  name: string
  level: string
  subject: string
  hasLesson: boolean
  hasSim: boolean
  prereqs: string[]
}
const PATH_FIELDS = ['conceptId', 'name', 'level', 'subject', 'hasLesson', 'hasSim', 'prereqs']

/**
 * The prerequisite ramp for one concept, ordered foundational-first and always
 * ending with the concept itself.
 *
 * Why this exists at all: raw similarity has no notion of "where do I start".
 * A broad, beginner-shaped query ("what is calculus") embeds closest to
 * whatever concept happens to word itself most like an overview, which in
 * practice is an advanced sub-topic, not a sane first stop. The prerequisite
 * edges already encode the ramp, so the path is walked backward from the match
 * down to a foundational ancestor and handed to the caller foundational-first.
 *
 * Only lesson-bearing ancestors are stepped onto, so every step offered is
 * actually viewable. Where a concept has several prerequisite branches, the
 * branch whose head is most foundational wins and depth breaks the tie, since
 * a longer chain of real lessons is a gentler ramp. This is a port of the
 * logic resolve_server.py validated against this same graph, with one
 * necessary change: it reads the graph a LEVEL at a time via getAll() rather
 * than from an in-memory dict, so a six-hop walk costs at most six round
 * trips instead of one per candidate.
 */
export async function guidedPath(
  db: FirebaseFirestore.Firestore,
  conceptId: string,
): Promise<PathStep[]> {
  const cache = new Map<string, PathNode | null>()

  async function fetchNodes(ids: string[]): Promise<void> {
    const missing = ids.filter((id) => !cache.has(id))
    if (missing.length === 0) return
    const refs = missing.map((id) => db.collection(CONCEPT_LIBRARY).doc(id))
    const snaps = await db.getAll(...refs, { fieldMask: PATH_FIELDS })
    for (let i = 0; i < snaps.length; i++) {
      const s = snaps[i]
      cache.set(missing[i], s.exists ? ({ ...(s.data() as object), conceptId: missing[i] } as PathNode) : null)
    }
  }

  await fetchNodes([conceptId])
  const start = cache.get(conceptId)
  if (!start) return []

  // Breadth-first by depth so each level is a single batched read. Frontier
  // holds the chains built so far; a chain stops growing when its head has no
  // lesson-bearing prerequisite left to step onto.
  let frontier: string[][] = [[conceptId]]
  const complete: string[][] = []
  const seen = new Set<string>([conceptId])

  for (let depth = 0; depth < MAX_PATH_DEPTH && frontier.length > 0; depth++) {
    const wanted = new Set<string>()
    for (const chain of frontier) {
      const head = cache.get(chain[0])
      for (const p of head?.prereqs ?? []) if (!seen.has(p)) wanted.add(p)
    }
    await fetchNodes([...wanted])

    const next: string[][] = []
    for (const chain of frontier) {
      const head = cache.get(chain[0])
      const parents = (head?.prereqs ?? []).filter((p) => {
        if (seen.has(p)) return false // the graph is not guaranteed acyclic
        const n = cache.get(p)
        return !!n && n.hasLesson
      })
      if (parents.length === 0) { complete.push(chain); continue }
      for (const p of parents) next.push([p, ...chain])
    }
    for (const chain of next) seen.add(chain[0])
    frontier = next
  }
  for (const chain of frontier) complete.push(chain) // depth-capped chains still count

  if (complete.length === 0) return [step(cache.get(conceptId)!)]

  let best = complete[0]
  let bestKey: [number, number] = keyFor(best)
  for (const chain of complete.slice(1)) {
    const k = keyFor(chain)
    if (k[0] < bestKey[0] || (k[0] === bestKey[0] && k[1] < bestKey[1])) { best = chain; bestKey = k }
  }
  return best.map((id) => step(cache.get(id)!)).filter(Boolean)

  function keyFor(chain: string[]): [number, number] {
    const head = cache.get(chain[0])
    return [LEVEL_RANK[head?.level ?? 'core'] ?? 1, -chain.length]
  }
  function step(n: PathNode): PathStep {
    return {
      conceptId: n.conceptId,
      label: n.name || n.conceptId,
      hasLesson: !!n.hasLesson,
      hasSim: !!n.hasSim,
      level: n.level,
      subject: n.subject,
    }
  }
}
