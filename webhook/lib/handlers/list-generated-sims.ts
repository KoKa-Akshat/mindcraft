/**
 * GET/POST /api/list-generated-sims
 *
 * Lists every gate-passed sim in the `generated_sims` Firestore library —
 * the second leg of the Archive-Simulations union (ARCHIVE_SIMS: Store B).
 *
 * The gap this closes is the exact bug shape archive-books.ts documents for
 * books (a narrower derived source silently standing in for a fuller one):
 * generate-sim.ts has been persisting every gate-passed generation into
 * `generated_sims` since 2026-08-19 so repeat topics reuse instead of
 * re-bill, but the ONLY read path was the per-topic cache lookup inside a
 * generation request — no endpoint anywhere listed the library, so the iOS
 * Archive's Simulations tab never showed a single student-generated sim
 * unless it also happened to be inlined into an assembled book.
 *
 * Deliberately a plain, ungated read — NOT a generation call: listing sims
 * that already exist spends nothing, so generationBudget.ts is not involved
 * and never should be here. No auth either, same reasoning as get-book.ts /
 * archive-books.ts: every doc in this collection already cleared the full
 * quality gate before generate-sim.ts would persist it (see its
 * persistToLibrary comment), so this only ever serves verified, already-paid
 * -for content. (Contrast generate-sim.ts itself, which requires a Firebase
 * token precisely because it CAN spend money.)
 *
 * Each returned sim mirrors generate-sim.ts's libraryLookup() field-for-field
 * (the GeneratedSimResult shape iOS already decodes from a /generate-sim
 * cache hit), plus createdAt for display ordering.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { db } from '../firebase'
import type { GeneratedSimResult } from '../generatedSimContract'

const LIBRARY_COLLECTION = 'generated_sims'

type ListedSim = GeneratedSimResult & { createdAt: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const snap = await db.collection(LIBRARY_COLLECTION).get()
  const sims: ListedSim[] = []
  for (const doc of snap.docs) {
    const d = doc.data() as (Partial<GeneratedSimResult> & { html?: string; createdAt?: string }) | undefined
    // Same guard as libraryLookup(): a doc with no renderable html is not a
    // servable sim, whatever else it claims — skip it, never ship it.
    if (!d?.html) continue
    sims.push({
      title: d.title ?? '',
      description: d.description ?? '',
      html: d.html,
      conceptId: d.conceptId ?? doc.id,
      conceptLabel: d.conceptLabel ?? '',
      learningObjectives: Array.isArray(d.learningObjectives) ? d.learningObjectives : [],
      rubricPercentage: typeof d.rubricPercentage === 'number' ? d.rubricPercentage : null,
      qualityGateScore: typeof d.qualityGateScore === 'number' ? d.qualityGateScore : null,
      topic: d.topic ?? '',
      topicSlug: doc.id,
      createdAt: d.createdAt ?? '',
    })
  }
  sims.sort((a, b) => a.title.localeCompare(b.title))
  return res.status(200).json({ sims })
}
