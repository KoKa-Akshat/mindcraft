/**
 * scripts/migrate-concept-library.ts
 *
 * One-time (safely re-runnable) migration of the real 13-subject content
 * library into Firestore, so it stops living only in a session temp file and
 * becomes durable production content the webhook can serve.
 *
 * Source: graph_data.json produced by the content pipeline (4118 concepts,
 * 3746 with a written lesson, 7330 prerequisite/cross-subject edges) plus the
 * built self-contained sim HTML files sitting next to it.
 *
 * Three NEW collections, none of which collide with anything already in this
 * project (checked against every .collection() call in webhook/: users,
 * sessions, generated_sims, question_cache, generation_budgets, classrooms,
 * transcripts, events, reports, conversations, prepSessions, payments,
 * marketing_leads, marketing_settings, login_allowlist, affective_state,
 * agentState, researchBatches, session_reports, sim_interactions,
 * story_module_cache):
 *
 *   conceptLibrary/{conceptId}
 *       One doc per concept. Lesson body inlined (largest real node is ~10 KB,
 *       comfortably under Firestore's 1 MB doc ceiling — verified, not
 *       assumed, see the size guard below which HARD FAILS rather than
 *       silently truncating). Prerequisite edges are denormalized onto the
 *       node as `prereqs` / `unlocks` / `crossSubject` id arrays instead of
 *       living in their own collection: every real query this library serves
 *       (guided prerequisite path, related-concept navigator, concept-graph
 *       neighbours) walks edges FROM a concept it already has in hand, so
 *       embedding them turns an edge lookup into zero extra reads.
 *
 *   conceptLibrarySims/{conceptId}
 *       The sim HTML, split out of the node doc on purpose: sims average
 *       ~15 KB and would quadruple the cost of every node read that does not
 *       need them (search, path building, the graph export all ignore sims).
 *       Only written for a concept whose sim HTML actually exists on disk.
 *
 *   conceptLibraryIndex/{meta|shard_NNN}
 *       Precomputed embeddings for semantic search, so the resolver never
 *       re-embeds 3746 concepts per request. all-MiniLM-L6-v2 via
 *       @huggingface/transformers (the same model family resolve_server.py
 *       validated locally), int8-quantized and packed base64 into ~1000-concept
 *       shards. Quantization is what makes this viable at all: fp32 would be
 *       5.7 MB across ~10 shard reads on every cold start, int8 is 1.4 MB
 *       across 4, and for top-k retrieval the recall difference is nil
 *       (cosine difference measured at ~0.002 on real query/concept pairs
 *       during the local prototype pass; the verify step at the end of this
 *       script checks document counts and sample docs, not recall).
 *
 * Idempotent by construction: every write is a .set() keyed on the concept id,
 * so a re-run converges on the same documents instead of duplicating. Safe to
 * re-run after a content round.
 *
 * Usage (needs FIREBASE_SERVICE_ACCOUNT in the env, like every script here):
 *   npx ts-node --transpile-only scripts/migrate-concept-library.ts             (dry run)
 *   npx ts-node --transpile-only scripts/migrate-concept-library.ts --write     (real write)
 *   ... --source /path/to/graph_data.json   (defaults to the SSD snapshot)
 *   ... --skip-embeddings                   (nodes + sims only)
 *   ... --only-embeddings                   (rebuild just the vector index)
 */

import * as fs from 'fs'
import * as path from 'path'
import { db } from '../lib/firebase'
import {
  CONCEPT_LIBRARY,
  CONCEPT_LIBRARY_SIMS,
  CONCEPT_LIBRARY_INDEX,
  EMBEDDING_MODEL,
  EMBEDDING_DTYPE,
  EMBEDDING_DIM,
  conceptSearchText,
  packInt8,
} from '../lib/conceptLibrary'

// The content pipeline's own output. Copied off the session scratchpad onto
// the SSD so this migration does not depend on a temp directory surviving.
const DEFAULT_SOURCE = '/Volumes/SSK SSD/mindcraft-content-snapshot/graph_data.json'

/** Firestore's real limits, enforced rather than hoped for. */
const MAX_DOC_BYTES = 1_048_576
const NODE_BATCH = 400      // node docs are small (~3.5 KB avg)
const SIM_BATCH = 60        // sim docs are ~15 KB; keeps each commit well under the 10 MB request ceiling
const SHARD_SIZE = 1000     // ~512 KB of base64 int8 per shard, plus ids

interface RawSim {
  sim_id?: string
  title?: string
  source_repo?: string
  play_file?: string
}
interface RawLesson {
  title?: string
  summary?: string
  body?: string
  source?: string
}
interface RawNode {
  id: string
  name?: string
  level?: string
  subject?: string
  x?: number
  y?: number
  sims?: RawSim[]
  lesson?: RawLesson | null
  description?: string
}
interface RawEdge {
  from: string
  to: string
  weight?: number
  relation?: string
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const write = process.argv.includes('--write')
  const skipEmbeddings = process.argv.includes('--skip-embeddings')
  const onlyEmbeddings = process.argv.includes('--only-embeddings')
  const source = arg('--source') ?? DEFAULT_SOURCE
  const simRoot = path.dirname(source)

  if (!fs.existsSync(source)) {
    console.error(`ERROR: source graph not found: ${source}`)
    process.exit(1)
  }

  console.log(`source        ${source}`)
  console.log(`mode          ${write ? 'WRITE (real Firestore)' : 'DRY RUN (nothing written)'}`)

  const raw = JSON.parse(fs.readFileSync(source, 'utf8')) as {
    nodes: RawNode[]
    edges: RawEdge[]
    subjects?: { id: string; title?: string }[]
  }
  const subjectTitles = new Map<string, string>()
  for (const s of raw.subjects ?? []) subjectTitles.set(s.id, s.title ?? s.id)

  // ── Edge denormalization ──────────────────────────────────────────────────
  // `from` is the prerequisite OF `to` (same reading resolve_server.py uses to
  // build its backward ramp). cross_subject edges are lateral, not "you need
  // this first", so they are kept in a separate field and never walked as a
  // prerequisite.
  const nodeIds = new Set(raw.nodes.map((n) => n.id))
  const prereqs = new Map<string, string[]>()
  const unlocks = new Map<string, string[]>()
  const crossSubject = new Map<string, string[]>()
  let danglingEdges = 0
  function push(m: Map<string, string[]>, k: string, v: string) {
    const list = m.get(k)
    if (list) { if (!list.includes(v)) list.push(v) } else m.set(k, [v])
  }
  for (const e of raw.edges) {
    if (!e.from || !e.to || !nodeIds.has(e.from) || !nodeIds.has(e.to)) { danglingEdges++; continue }
    if ((e.relation ?? 'prerequisite') === 'prerequisite') {
      push(prereqs, e.to, e.from)
      push(unlocks, e.from, e.to)
    } else {
      push(crossSubject, e.from, e.to)
      push(crossSubject, e.to, e.from)
    }
  }

  // ── Build the docs ────────────────────────────────────────────────────────
  const nodeDocs: { id: string; data: Record<string, unknown> }[] = []
  const simDocs: { id: string; data: Record<string, unknown> }[] = []
  let lessonCount = 0
  let simRefCount = 0
  let simMissingCount = 0
  let oversize = 0
  let largestNode = 0
  let largestSim = 0

  for (const n of raw.nodes) {
    const lesson = n.lesson ?? null
    const hasLesson = !!(lesson && (lesson.body || lesson.summary))
    if (hasLesson) lessonCount++

    // A sim counts ONLY when its built HTML is really on disk. 64 of the 1074
    // sim references in the source point at an extract that never built into a
    // play file, so trusting the reference alone would advertise sims that
    // cannot be shown. Same honesty rule resolve_server.py's sim_payload uses.
    let simDoc: { simId: string; title: string; sourceRepo: string; html: string } | null = null
    const simMeta: { simId: string; title: string; sourceRepo: string }[] = []
    for (const s of n.sims ?? []) {
      simRefCount++
      if (!s.play_file) { simMissingCount++; continue }
      const p = path.join(simRoot, s.play_file)
      if (!fs.existsSync(p)) { simMissingCount++; continue }
      const meta = {
        simId: s.sim_id ?? path.basename(s.play_file, '.html'),
        title: s.title ?? s.sim_id ?? 'Simulation',
        sourceRepo: s.source_repo ?? '',
      }
      simMeta.push(meta)
      if (!simDoc) simDoc = { ...meta, html: fs.readFileSync(p, 'utf8') }
    }

    const data: Record<string, unknown> = {
      conceptId: n.id,
      name: n.name ?? n.id,
      subject: n.subject ?? 'unknown',
      subjectTitle: subjectTitles.get(n.subject ?? '') ?? (n.subject ?? 'unknown'),
      level: n.level ?? 'core',
      description: n.description ?? '',
      x: typeof n.x === 'number' ? n.x : 0,
      y: typeof n.y === 'number' ? n.y : 0,
      hasLesson,
      lesson: hasLesson
        ? {
            title: lesson!.title ?? n.name ?? n.id,
            summary: lesson!.summary ?? '',
            body: lesson!.body ?? '',
            source: lesson!.source ?? '',
          }
        : null,
      hasSim: !!simDoc,
      sims: simMeta,
      prereqs: prereqs.get(n.id) ?? [],
      unlocks: unlocks.get(n.id) ?? [],
      crossSubject: crossSubject.get(n.id) ?? [],
      searchText: conceptSearchText(n.name ?? n.id, lesson?.title, lesson?.summary, n.description),
      updatedAt: new Date().toISOString(),
    }

    const bytes = Buffer.byteLength(JSON.stringify(data), 'utf8')
    largestNode = Math.max(largestNode, bytes)
    if (bytes > MAX_DOC_BYTES) {
      console.error(`ERROR: node doc ${n.id} is ${bytes} bytes, over Firestore's 1 MB ceiling`)
      oversize++
    }
    nodeDocs.push({ id: n.id, data })

    if (simDoc) {
      const simData = { conceptId: n.id, ...simDoc, updatedAt: new Date().toISOString() }
      const simBytes = Buffer.byteLength(JSON.stringify(simData), 'utf8')
      largestSim = Math.max(largestSim, simBytes)
      if (simBytes > MAX_DOC_BYTES) {
        console.error(`ERROR: sim doc ${n.id} is ${simBytes} bytes, over Firestore's 1 MB ceiling`)
        oversize++
      }
      simDocs.push({ id: n.id, data: simData })
    }
  }

  if (oversize > 0) {
    console.error(`ABORTING: ${oversize} document(s) exceed Firestore's per-document limit.`)
    process.exit(1)
  }

  console.log(`nodes         ${nodeDocs.length}  (${lessonCount} with a lesson)`)
  console.log(`sims          ${simDocs.length} concepts with real on-disk HTML, out of ${simRefCount} sim references (${simMissingCount} reference an extract that never built)`)
  console.log(`edges         ${raw.edges.length} in source, ${danglingEdges} dangling and skipped`)
  console.log(`largest doc   node ${(largestNode / 1024).toFixed(1)} KB, sim ${(largestSim / 1024).toFixed(1)} KB (limit 1024 KB)`)

  // ── Write nodes + sims ────────────────────────────────────────────────────
  if (!onlyEmbeddings) {
    if (write) {
      await commitBatches(CONCEPT_LIBRARY, nodeDocs, NODE_BATCH, 'nodes')
      await commitBatches(CONCEPT_LIBRARY_SIMS, simDocs, SIM_BATCH, 'sims')
    } else {
      console.log(`would write   ${nodeDocs.length} -> ${CONCEPT_LIBRARY}, ${simDocs.length} -> ${CONCEPT_LIBRARY_SIMS}`)
    }
  }

  // ── Embeddings ────────────────────────────────────────────────────────────
  if (!skipEmbeddings) {
    // Only lesson-bearing concepts are indexed: resolving a query onto a
    // concept with nothing to read is a dead end, not a result.
    const indexable = nodeDocs.filter((d) => d.data.hasLesson === true)
    indexable.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    console.log(`embedding     ${indexable.length} lesson-bearing concepts with ${EMBEDDING_MODEL} (${EMBEDDING_DTYPE})`)

    // @huggingface/transformers is ESM-only. This script runs under ts-node
    // with module=commonjs (the project tsconfig), which would downlevel a
    // plain `await import()` into require() and fail on an ESM package. The
    // Function constructor keeps it a real dynamic import at runtime. NOTE:
    // this trick is deliberately NOT used in lib/conceptLibrary.ts — Vercel
    // has to statically see that import to trace the dependency into the
    // deployed function bundle, and esbuild handles the ESM there correctly.
    const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<typeof import('@huggingface/transformers')>
    const { pipeline } = await dynamicImport('@huggingface/transformers')
    const t0 = Date.now()
    const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: EMBEDDING_DTYPE })
    console.log(`model loaded  ${Date.now() - t0} ms`)

    const vectors = new Float32Array(indexable.length * EMBEDDING_DIM)
    const BATCH = 64
    const tEmb = Date.now()
    for (let i = 0; i < indexable.length; i += BATCH) {
      const slice = indexable.slice(i, i + BATCH)
      const out = await extractor(slice.map((d) => d.data.searchText as string), { pooling: 'mean', normalize: true })
      const data = out.data as Float32Array
      vectors.set(data.subarray(0, slice.length * EMBEDDING_DIM), i * EMBEDDING_DIM)
      if (i % 640 === 0) process.stdout.write(`\r  embedded ${Math.min(i + BATCH, indexable.length)}/${indexable.length}`)
    }
    console.log(`\r  embedded ${indexable.length}/${indexable.length} in ${((Date.now() - tEmb) / 1000).toFixed(1)}s`)

    // Global int8 scale. A single positive scalar over the whole corpus does
    // not change the ranking at all (cosine is scale-invariant per vector once
    // renormalized), it only decides how much of the int8 range is used.
    let maxAbs = 0
    for (let i = 0; i < vectors.length; i++) { const a = Math.abs(vectors[i]); if (a > maxAbs) maxAbs = a }
    const scale = maxAbs / 127

    const shards: { id: string; data: Record<string, unknown> }[] = []
    for (let s = 0; s * SHARD_SIZE < indexable.length; s++) {
      const from = s * SHARD_SIZE
      const to = Math.min(from + SHARD_SIZE, indexable.length)
      const ids = indexable.slice(from, to).map((d) => d.id)
      const packed = packInt8(vectors.subarray(from * EMBEDDING_DIM, to * EMBEDDING_DIM), scale)
      const data = { ids, vectors: packed, count: to - from, dim: EMBEDDING_DIM, scale }
      const bytes = Buffer.byteLength(JSON.stringify(data), 'utf8')
      if (bytes > MAX_DOC_BYTES) {
        console.error(`ERROR: shard ${s} is ${bytes} bytes, over the 1 MB ceiling. Lower SHARD_SIZE.`)
        process.exit(1)
      }
      shards.push({ id: `shard_${String(s).padStart(3, '0')}`, data })
    }
    const meta = {
      model: EMBEDDING_MODEL,
      dtype: EMBEDDING_DTYPE,
      dim: EMBEDDING_DIM,
      count: indexable.length,
      shardCount: shards.length,
      shardSize: SHARD_SIZE,
      scale,
      quantization: 'int8',
      builtAt: new Date().toISOString(),
    }
    console.log(`index         ${indexable.length} vectors, ${shards.length} shards, scale ${scale.toExponential(3)}`)

    if (write) {
      await commitBatches(CONCEPT_LIBRARY_INDEX, [...shards, { id: 'meta', data: meta }], 10, 'index')
    } else {
      console.log(`would write   ${shards.length} shards + meta -> ${CONCEPT_LIBRARY_INDEX}`)
    }
  }

  // ── Verify by reading back, not by trusting the writes ────────────────────
  if (write) {
    console.log('\nverifying against Firestore (real reads, not the write calls)...')
    const nodeSnap = await db.collection(CONCEPT_LIBRARY).count().get()
    const simSnap = await db.collection(CONCEPT_LIBRARY_SIMS).count().get()
    console.log(`  ${CONCEPT_LIBRARY}: ${nodeSnap.data().count} docs (expected ${nodeDocs.length})`)
    console.log(`  ${CONCEPT_LIBRARY_SIMS}: ${simSnap.data().count} docs (expected ${simDocs.length})`)

    const samples = ['biology::phylogenetics', 'circles_geometry', 'calculus::the-derivative', 'us-history::the-constitution']
    for (const id of samples) {
      const d = await db.collection(CONCEPT_LIBRARY).doc(id).get()
      if (!d.exists) { console.log(`  ${id}: NOT FOUND`); continue }
      const v = d.data() as { name?: string; hasLesson?: boolean; hasSim?: boolean; lesson?: { body?: string }; prereqs?: string[] }
      console.log(`  ${id}: "${v.name}" lesson=${v.hasLesson} (${v.lesson?.body?.length ?? 0} chars) sim=${v.hasSim} prereqs=${v.prereqs?.length ?? 0}`)
    }
    if (!skipEmbeddings) {
      const m = await db.collection(CONCEPT_LIBRARY_INDEX).doc('meta').get()
      console.log(`  index meta: ${JSON.stringify(m.data())}`)
    }
  }
}

async function commitBatches(
  collection: string,
  docs: { id: string; data: Record<string, unknown> }[],
  size: number,
  label: string,
) {
  let written = 0
  for (let i = 0; i < docs.length; i += size) {
    const batch = db.batch()
    for (const d of docs.slice(i, i + size)) {
      batch.set(db.collection(collection).doc(d.id), d.data)
    }
    await batch.commit()
    written += Math.min(size, docs.length - i)
    process.stdout.write(`\r  ${label}: wrote ${written}/${docs.length}`)
  }
  console.log(`\r  ${label}: wrote ${written}/${docs.length} to ${collection}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
