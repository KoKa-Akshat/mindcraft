/**
 * POST /api/get-book
 *
 * Serves assembled, gated chapter content from mindcraft-content-engine to
 * the app — the delivery half of a gap CONTENT_VOICE_PLATFORM_ARCHITECTURE.md
 * found: book_assembler.py has been producing real, gated, dependency-ordered
 * books (data/assembled_books/<subject_id>.json, via its own --json export)
 * for a while, but nothing served them anywhere a student's device could
 * reach — BookGraphLoader.swift only ever loaded bundled concept-GRAPH
 * structure, never the assembled prose, and no bundled resource files for it
 * even existed. This handler plus `scripts/sync-assembled-books.ts` (which
 * pushes the content-engine's local JSON exports into Firestore) closes that
 * gap: content-engine assembles offline -> sync script pushes to Firestore
 * -> this handler serves it -> the app reads it live, same "cache the real
 * output, serve on demand" shape generate-sim.ts already uses for sims.
 *
 * No auth required (unlike generate-sim.ts) — this only ever serves already-
 * gated, already-free content that was assembled offline; there is no live
 * spend to protect here the way there is on a generation request.
 *
 * Two request shapes:
 *   {}            -> list every synced book's summary (id, title, coverage)
 *   { subjectId }  -> the full assembled book (chapters/sections/sim links)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { db } from '../firebase'

const COLLECTION = 'assembled_books'

type BookSummary = {
  subjectId: string
  title: string
  totalConcepts: number
  coveredConcepts: number
  updatedAt: string
}

async function listBooks(res: VercelResponse) {
  const snap = await db.collection(COLLECTION).get()
  const books: BookSummary[] = snap.docs.map((doc) => {
    const d = doc.data()
    return {
      subjectId: doc.id,
      title: d.title ?? doc.id,
      totalConcepts: d.total_concepts ?? 0,
      coveredConcepts: d.covered_concepts ?? 0,
      updatedAt: d.synced_at ?? '',
    }
  })
  books.sort((a, b) => a.title.localeCompare(b.title))
  return res.status(200).json({ books })
}

async function getBook(subjectId: string, res: VercelResponse) {
  const snap = await db.collection(COLLECTION).doc(subjectId).get()
  if (!snap.exists) {
    return res.status(404).json({ error: `No assembled book synced for '${subjectId}' yet.` })
  }
  return res.status(200).json({ book: snap.data() })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as { subjectId?: string }
  if (typeof body.subjectId === 'string' && body.subjectId) {
    return getBook(body.subjectId, res)
  }
  return listBooks(res)
}
