/**
 * sync-assembled-books.ts — pushes mindcraft-content-engine's local
 * assembled-book JSON exports into Firestore, where get-book.ts (and from
 * there, the app) can actually read them.
 *
 * The gap this closes: book_assembler.py has been producing real, gated,
 * dependency-ordered books (data/assembled_books/<subject_id>.json, via its
 * `--json` flag) in the SEPARATE mindcraft-content-engine repo for a while,
 * but nothing ever moved that output anywhere a live client could reach —
 * see CONTENT_VOICE_PLATFORM_ARCHITECTURE.md. This script is the bridge:
 * read the content-engine repo's local output (both repos are sibling
 * directories on this machine), upsert each book into Firestore
 * `assembled_books/{subject_id}`, get-book.ts serves it from there.
 *
 * Deliberately a manual/offline sync, not a live proxy (unlike
 * generate-sim.ts's HF Space proxy) — assembly is itself an offline,
 * re-run-when-ready step (per book_assembler.py's own docstring: "a student
 * asking to learn a topic triggers assembly of cached, verified sections,
 * never a fresh monolithic generation"), so pushing its output is the same
 * shape: run this after any book_assembler.py --json run, not on a request
 * path.
 *
 * Usage:
 *   npm run sync-assembled-books --prefix webhook
 *   npm run sync-assembled-books --prefix webhook -- --subject circuits
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { db } from '../lib/firebase'

const CONTENT_ENGINE_BOOKS_DIR = resolve(
  __dirname,
  '../../../mindcraft-content-engine/data/assembled_books',
)

function subjectFilter(): string | null {
  const i = process.argv.indexOf('--subject')
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}

async function main() {
  if (!existsSync(CONTENT_ENGINE_BOOKS_DIR)) {
    console.error(
      `No assembled_books directory at ${CONTENT_ENGINE_BOOKS_DIR} — ` +
        `run book_assembler.py --json in mindcraft-content-engine first.`,
    )
    process.exit(1)
  }

  const only = subjectFilter()
  const files = readdirSync(CONTENT_ENGINE_BOOKS_DIR).filter((f) => f.endsWith('.json'))
  if (!files.length) {
    console.log(`No .json exports found in ${CONTENT_ENGINE_BOOKS_DIR} — ` +
      `book_assembler.py needs its --json flag passed, not just the default .md.`)
    return
  }

  let synced = 0
  for (const file of files) {
    const subjectId = file.replace(/\.json$/, '')
    if (only && subjectId !== only) continue

    const raw = readFileSync(resolve(CONTENT_ENGINE_BOOKS_DIR, file), 'utf-8')
    const book = JSON.parse(raw)

    await db
      .collection('assembled_books')
      .doc(subjectId)
      .set({ ...book, synced_at: new Date().toISOString() })

    const nSims = (book.chapters ?? []).reduce(
      (acc: number, ch: { sections?: { sim_title?: string | null }[] }) =>
        acc + (ch.sections ?? []).filter((s) => s.sim_title).length,
      0,
    )
    console.log(
      `synced ${subjectId}: "${book.title}" — ${book.covered_concepts}/${book.total_concepts} ` +
        `concepts, ${(book.chapters ?? []).length} chapter(s), ${nSims} linked sim(s)`,
    )
    synced++
  }

  if (only && synced === 0) {
    console.error(`--subject ${only} requested but no ${only}.json found in ${CONTENT_ENGINE_BOOKS_DIR}`)
    process.exit(1)
  }
  console.log(`\n${synced} book(s) synced to Firestore assembled_books/.`)
}

main().catch((e) => {
  console.error('sync-assembled-books failed:', e)
  process.exit(1)
})
