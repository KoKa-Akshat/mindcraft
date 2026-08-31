/**
 * lib/queryEmbedder.ts
 *
 * Turns a student's typed question into the 384-dimension vector that
 * /api/concept-resolve scores against the migrated concept library.
 *
 * This runs in the BROWSER, on purpose. The corpus vectors for all 3746
 * lesson-bearing concepts were precomputed server-side once, at migration
 * time; only the one short query has to be embedded per search, and doing it
 * here is better than doing it in the serverless function on both counts that
 * matter:
 *
 *   - Latency. Serverless containers idle out after minutes. A student
 *     searching a few times an hour would hit a cold container nearly every
 *     time and pay the ~9s model load on almost every search, forever. Here
 *     the model is fetched once (~22 MB, int8-quantized) and then served from
 *     the browser's HTTP cache for weeks, so only the first search of a fresh
 *     browser profile is slow.
 *   - Deployability. @huggingface/transformers drags onnxruntime-node's
 *     ~208 MB of per-platform prebuilt binaries into the function bundle. A
 *     real preview deploy measured api/app-actions at 442 MB against a 250 MB
 *     ceiling with that import present, and app-actions is the shared router
 *     for about forty live endpoints. In the browser, none of that ships.
 *
 * Cost: nothing. This is local inference in the student's own browser, not an
 * LLM API call, so semantic search never touches the platform generation
 * budget.
 *
 * CONTRACT, and it is not optional: the model id, dtype, pooling and
 * normalization here MUST match webhook/lib/conceptLibrary.ts's
 * EMBEDDING_MODEL / EMBEDDING_DTYPE and the migration script that built the
 * corpus. Query and corpus vectors have to live in the same space or search
 * silently returns plausible-looking nonsense, which is the worst possible
 * failure mode. If either side is changed, both change and the corpus is
 * re-embedded by re-running the migration.
 */

/** Must equal EMBEDDING_MODEL in webhook/lib/conceptLibrary.ts. */
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'
/** Must equal EMBEDDING_DTYPE. q8 is 22 MB against fp32's 97 MB, for a cosine
 * difference measured at ~0.002 on real query/concept pairs, and the corpus
 * was embedded with the same quantization. */
const DTYPE = 'q8'
/** Must equal EMBEDDING_DIM. */
export const EMBEDDING_DIM = 384

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: Float32Array }>

// Promise-valued rather than value-valued so two searches fired before the
// model has finished loading share one load instead of racing two.
let extractorPromise: Promise<Extractor> | null = null

/** True once the model has finished loading in this tab, so the UI can tell
 * the difference between "downloading a 22 MB model" and "thinking". */
let ready = false
export function embedderReady(): boolean {
  return ready
}

async function getExtractor(onProgress?: (pct: number) => void): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      // Dynamic import so transformers.js lands in its own lazily-fetched
      // chunk. The main bundle is already large; a student who never opens
      // Learn must not pay for this.
      const { pipeline, env } = await import('@huggingface/transformers')
      // Browser-only: never try to read a local model directory off the
      // origin, and let the HF CDN + the browser cache do the caching.
      env.allowLocalModels = false
      const extractor = await pipeline('feature-extraction', MODEL_ID, {
        dtype: DTYPE,
        progress_callback: (p: { status?: string; progress?: number }) => {
          if (p?.status === 'progress' && typeof p.progress === 'number') onProgress?.(p.progress)
        },
      })
      ready = true
      return extractor as unknown as Extractor
    })().catch((e) => {
      // A failed load must not poison the tab: the next search retries.
      extractorPromise = null
      throw e
    })
  }
  return extractorPromise
}

/**
 * Embeds one query. Returns a plain number[] because that is what crosses the
 * wire to /api/concept-resolve, which validates the dimension and
 * re-normalizes before it scores anything.
 *
 * onProgress reports model DOWNLOAD progress (0-100) on the first call only,
 * so the UI can show honest progress rather than an indefinite spinner.
 */
export async function embedQuery(text: string, onProgress?: (pct: number) => void): Promise<number[]> {
  const extractor = await getExtractor(onProgress)
  const out = await extractor([text], { pooling: 'mean', normalize: true })
  const v = out.data
  if (v.length < EMBEDDING_DIM) {
    throw new Error(`Embedding model returned ${v.length} dimensions, expected ${EMBEDDING_DIM}.`)
  }
  return Array.from(v.slice(0, EMBEDDING_DIM))
}

/** Optional warm-up: start pulling the model as soon as the Learn view opens,
 * so the download overlaps with the student typing rather than starting after
 * they hit Search. Never throws; a failure here just means the real search
 * pays the load instead. */
export function prewarmEmbedder(onProgress?: (pct: number) => void): void {
  void getExtractor(onProgress).catch(() => {})
}
