// Real, rerunnable export script — native iOS question bank.
//
// `ios-prototype/MindCraftNotes/MindCraftNotes/Models/QuestionBankLoader.swift`
// has carried a doc comment since it was written claiming its bundled
// `Resources/questionBank.json` came from "the REAL getQuestions() from
// app/src/lib/questionBank.ts" via this exact script — but this script did
// not actually exist anywhere in the repo (checked working tree AND git
// history) until round 9 of the native build wrote it for real. Whatever
// produced the committed `questionBank.json` snapshot (dated 2026-07-25) was
// not this file; there is no way to verify what it was. This script closes
// that gap for real, going forward: it imports the REAL `questionBank.ts`
// module (via `vite-node`, so TypeScript/Vite path aliases resolve exactly
// like the live app) and dumps its actual, fully-merged/deduped/aliased `Q`
// array — every source (static + generated + ACT master + ACT annotated +
// Eedi + OpenStax + OpenStax MCQ + Khan + Story Cells), exactly as the live
// web app itself serves it — through the new `allQuestionsForNativeExport()`
// read-only export `questionBank.ts` now carries specifically for this
// script (see that function's own doc comment). No merge/dedup/alias logic
// is reimplemented here — reimplementing it would risk silently drifting
// from the real thing, the same trap CLAUDE.md's "no parallel Swift
// implementation that can drift" rule warns about, just in JS this time.
//
// Only the fields the native `BankQuestionWire` struct actually decodes
// (id, conceptId, level, question, choices, correctIndex) are kept in the
// output — matches the existing native decode contract exactly, so no Swift
// change is needed to consume a freshly-regenerated file. `explanation`/
// `hints`/`format`/etc. are real fields on the live `Question` type but
// aren't dropped for a good reason beyond "native doesn't render them yet";
// re-export with more fields once a native call site actually reads them.
//
// Usage: cd app && npx vite-node scripts/exportQuestionBankForNative.mjs [outputPath]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { allQuestionsForNativeExport } from '../src/lib/questionBank.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const all = allQuestionsForNativeExport()

const wire = all.map(q => ({
  id: q.id,
  conceptId: q.conceptId,
  level: q.level,
  question: q.question,
  choices: q.choices,
  correctIndex: q.correctIndex,
}))

const outputPath = process.argv[2]
  ? path.resolve(root, process.argv[2])
  : path.resolve(root, '../ios-prototype/MindCraftNotes/MindCraftNotes/Resources/questionBank.json')

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(wire))

const byConcept = new Map()
for (const q of wire) byConcept.set(q.conceptId, (byConcept.get(q.conceptId) ?? 0) + 1)

console.log(`Wrote ${wire.length} questions across ${byConcept.size} concepts to ${outputPath}`)
