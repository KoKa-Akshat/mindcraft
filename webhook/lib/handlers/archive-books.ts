/**
 * GET /api/archive-books
 *
 * Real bug report (2026-08-19): "im not seeing dans books in archuve at
 * all" - the iOS Archive browser only ever showed Dan's archive via a live
 * search (askDetailed), since there was no local manifest of his full
 * library to browse by title the way the app's own bundled book graphs
 * already are. This IS that manifest - a deduplicated list of
 * {bookSlug, bookTitle} pulled straight from the same real corpus
 * archive-rag.ts already searches (dans-archive-chunks.json), not a
 * fabricated catalog. 18 real books as of this corpus snapshot (Calculus,
 * Algebra I, Biology, Chemistry, Computer Science, and more).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import corpus from '../../data/dans-archive-chunks.json'

type Chunk = { bookSlug: string; bookTitle: string }
const CHUNKS = (corpus as { chunks: Chunk[] }).chunks || []

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const bySlug = new Map<string, string>()
  for (const chunk of CHUNKS) {
    if (!bySlug.has(chunk.bookSlug)) bySlug.set(chunk.bookSlug, chunk.bookTitle)
  }
  const books = Array.from(bySlug.entries())
    .map(([bookSlug, bookTitle]) => ({ bookSlug, bookTitle }))
    .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle))

  return res.status(200).json({ books })
}
