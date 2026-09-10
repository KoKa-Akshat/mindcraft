/**
 * GET /api/archive-books
 *
 * Original bug report (2026-08-19): "im not seeing dans books in archuve
 * at all" - the iOS Archive browser only ever showed Dan's archive via a
 * live search (askDetailed), since there was no local manifest of his full
 * library to browse by title the way the app's own bundled book graphs
 * already are. This IS that manifest.
 *
 * REAL DATA BUG, found and fixed same night (2026-08-19, live report:
 * "there are 113 dan books wdym 18"): this handler originally read
 * dans-archive-chunks.json (webhook/data/), which only covers 18 of Dan's
 * real ~113 books - it was built from mkdocs search-index excerpts, a
 * narrower scrape that never reached most of his catalog. A COMPLETE,
 * already-run full-site mirror (agent_work/product/archive_mirror/,
 * mirror_book.py + build_chunks.py, confirmed 113/113 in its own run log)
 * already existed in this repo at
 * agent_work/product/desk_os/workflows/archive/chunks.json (2,612 real
 * chunks across 111 distinct real book titles - the other 2 of the real
 * 113 have no populated bookTitle in that file, a smaller residual gap,
 * not the 18-vs-113 one). dans-books.json (webhook/data/) is a small,
 * derived {bookSlug, bookTitle}-only projection of that richer file - built
 * once, not regenerated per-request, since a 2,612-chunk file is overkill
 * to import just for a title list. Regenerate by rerunning the extraction
 * against a fresh chunks.json if the mirror is ever refreshed.
 *
 * dans-archive-chunks.json itself is UNTOUCHED - archive-rag.ts's live
 * search still reads it, and that's a separate concern (search quality on
 * chapter excerpts, not the book list) from this file's fix.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import manifest from '../../data/dans-books.json'

type Book = { bookSlug: string; bookTitle: string }
const BOOKS = ((manifest as { books: Book[] }).books || [])
  .slice()
  .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return res.status(200).json({ books: BOOKS })
}
