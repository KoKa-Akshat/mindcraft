/**
 * graphCache.ts — one shared fetch of the student knowledge graph.
 *
 * Both LearningGPS (dashboard auto-load) and the Knowledge Graph page need
 * GET /knowledge-graph/{uid}. Without sharing, each one re-fetches — so opening
 * the dashboard then navigating to the graph page hits Cloud Run twice. This
 * caches the in-flight promise per user so concurrent callers dedupe to a
 * single request and later mounts reuse the result instantly.
 *
 * Failures are NOT cached (a cold-start miss must be retriable), and mutations
 * (practice/homework outcomes, onboarding seed) call invalidateKnowledgeGraph
 * so the next view reflects updated mastery.
 */

const ML_API_URL =
  import.meta.env.VITE_ML_API_URL ?? import.meta.env.VITE_ML_URL ?? ''

type KGResponse = { nodes: Array<Record<string, unknown>> } & Record<string, unknown>

const cache = new Map<string, Promise<KGResponse | null>>()

export function fetchKnowledgeGraph(userId: string, force = false): Promise<KGResponse | null> {
  if (!userId || !ML_API_URL) return Promise.resolve(null)
  if (force) cache.delete(userId)

  const existing = cache.get(userId)
  if (existing) return existing

  const p = fetch(`${ML_API_URL}/knowledge-graph/${userId}`)
    .then(res => (res.ok ? (res.json() as Promise<KGResponse>) : null))
    .catch(() => null)

  cache.set(userId, p)
  // Don't persist a failed/empty fetch — let the next caller retry.
  void p.then(v => { if (!v) cache.delete(userId) })
  return p
}

export function invalidateKnowledgeGraph(userId: string): void {
  cache.delete(userId)
}
