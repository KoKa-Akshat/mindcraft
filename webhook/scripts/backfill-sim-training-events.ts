/**
 * scripts/backfill-sim-training-events.ts — one-time backfill of the new
 * `sim_training_events` collection from the existing `generated_sims`
 * serving cache (PR1 of the live-sim -> training-data plan).
 *
 * What it can and cannot recover, honestly:
 *   - generated_sims only ever stored GATE-PASSED standalone sims, with
 *     their scores (rubricPercentage/qualityGateScore) — those survive and
 *     are backfilled here.
 *   - lesson plans, references, separate js, and token usage were never
 *     stored there (that omission is exactly what PR1's live capture
 *     fixes) — backfilled docs carry honest nulls for those.
 *   - Book-path sims were only ever inlined into assembled_books section
 *     html, never stored per-sim — that history is NOT reconstructable.
 *     Known, accepted gap; nothing here pretends otherwise.
 *
 * Idempotent: doc IDs reuse the library doc's jobId (the same ID the live
 * writer uses), so re-running, or racing the live writer, converges on the
 * same docs via .set() instead of duplicating.
 *
 * Usage (needs FIREBASE_SERVICE_ACCOUNT in the env, like every script here):
 *   npm run backfill-sim-training-events --prefix webhook              (dry run — prints what it would write)
 *   npm run backfill-sim-training-events --prefix webhook -- --write   (actually writes)
 */

import { db } from '../lib/firebase'
import {
  SIM_TRAINING_EVENTS_COLLECTION,
  buildBackfillTrainingEvent,
  captureSimTrainingEvents,
} from '../lib/simTrainingEvents'

const LIBRARY_COLLECTION = 'generated_sims'

async function main() {
  const write = process.argv.includes('--write')
  const snap = await db.collection(LIBRARY_COLLECTION).get()
  if (snap.empty) {
    console.log(`No docs in ${LIBRARY_COLLECTION} — nothing to backfill.`)
    return
  }

  let built = 0
  let skipped = 0
  for (const doc of snap.docs) {
    const event = buildBackfillTrainingEvent(doc.id, doc.data() as Record<string, unknown>)
    if (!event) {
      skipped++
      console.log(`skip ${doc.id}: no html stored (nothing trainable to carry over)`)
      continue
    }
    built++
    if (write) {
      await captureSimTrainingEvents(db, [event])
      console.log(`wrote ${SIM_TRAINING_EVENTS_COLLECTION}/${event.docId}  (from ${LIBRARY_COLLECTION}/${doc.id})`)
    } else {
      console.log(
        `[dry-run] would write ${SIM_TRAINING_EVENTS_COLLECTION}/${event.docId}  ` +
          `title="${String(event.data.title)}" rubric=${String(event.data.rubricPercentage)} ` +
          `gate=${String(event.data.qualityGateScore)}`,
      )
    }
  }
  console.log(
    `\n${write ? 'Backfilled' : '[dry-run] Would backfill'} ${built} doc(s), skipped ${skipped}. ` +
      (write ? '' : 'Re-run with --write to persist.'),
  )
}

main().catch((e) => {
  console.error('backfill-sim-training-events failed:', e)
  process.exit(1)
})
