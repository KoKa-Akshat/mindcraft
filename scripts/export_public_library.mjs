#!/usr/bin/env node
/**
 * scripts/export_public_library.mjs
 *
 * Exports the real migrated content library out of Firestore into the static
 * files the PUBLIC marketing page (index.html at the repo root, served at
 * joinmindcraft.com) serves to anonymous visitors.
 *
 * Why this exists at all: the concept search on the marketing page has to work
 * for a visitor with no account, no sign-in and no cost to us. The real product
 * reads conceptLibrary/conceptLibrarySims straight from Firestore behind
 * firestore.rules and posts a query vector to /api/concept-resolve, which
 * requires a verified Firebase ID token. Neither is available to a stranger on
 * a marketing page, so the same content is projected down to flat files on the
 * same hosting target and read with plain GETs. Nothing here calls a paid API,
 * at export time or at view time.
 *
 * Source of truth is Firestore, written by
 * webhook/scripts/migrate-concept-library.ts. This script never re-derives
 * anything: it copies what is already there, including the embedding vectors,
 * so the public page and the signed-in app score queries against literally the
 * same numbers and cannot silently drift apart.
 *
 * ── Payload shape, and the real numbers behind it ─────────────────────────
 * Measured against the live collections on 2026-08-31: 4118 concepts, 3746
 * with a written lesson (13.6 MB once exported, avg 3.7 KB), 722 with real
 * built sim HTML (10.2 MB, avg 14.5 KB, max 37.9 KB).
 *
 * So a single bundled JSON would be a 23.8 MB download on every page load of a
 * public marketing page, to show one concept. That is not a tradeoff, it is
 * just wrong. Instead:
 *
 *   library/concepts/<slug>.json   one file per lesson-bearing concept, 3746
 *       files, fetched only after a query has already resolved to that
 *       concept. This mirrors exactly what the signed-in app does (one
 *       Firestore read per concept, see app/src/lib/conceptLibrary.ts's
 *       fetchConceptContent) with a static file standing in for the read. A
 *       visitor who searches once downloads ~3.7 KB of lesson, not 13.6 MB.
 *
 *   library/sims/<slug>.html       the sim HTML as a real HTML file, 722
 *       files, so the page can iframe it directly instead of shipping ~14.5 KB
 *       of escaped markup through JSON and injecting it. Split out of the
 *       concept file for the same reason the migration split
 *       conceptLibrarySims out of conceptLibrary: 3024 of the 3746
 *       lesson-bearing concepts have no sim and must not pay for one.
 *
 *   library/concept-index.json     search index metadata plus the display
 *       catalog for all 3746 indexed concepts, in vector order. ~600 KB, which
 *       is mostly repeated JSON keys and compresses to a fraction of that over
 *       the wire; the readable object form is worth keeping for a data file
 *       other people have to open and understand.
 *   library/concept-index.bin      the int8 vectors themselves, raw:
 *       3746 x 384 = 1,438,464 bytes. The Firestore shards store the same
 *       bytes base64-encoded because a Firestore field has to be a string; a
 *       static file does not, and dropping base64 saves about 470 KB (25%) and
 *       skips parsing a 1.9 MB string in the browser. Same bytes, same global
 *       scale, same int8 quantization, so a vector unpacked here is identical
 *       to one unpacked by webhook/lib/conceptLibrary.ts's unpackInt8.
 *
 *   library/zpd.json               a small connected subgraph of REAL
 *       prerequisite edges that feeds the native Zone of Proximal Development
 *       visualization in the #frontier section. Tens of KB, no lesson text.
 *
 * Both index files are fetched lazily, on the visitor's first search, never on
 * page load. A visitor who never types anything downloads none of this.
 *
 * ── Idempotent, and safe to re-run after every content round ──────────────
 * Filenames are a pure function of the concept id, JSON keys are written in a
 * fixed order, and there is no timestamp inside the per-concept files, so
 * re-running with unchanged content produces byte-identical output and an
 * empty git diff. Files left over from a previous round (a concept that lost
 * its lesson, a sim that was withdrawn) are pruned, and the prune only ever
 * touches the two directories this script owns.
 *
 * Usage (needs FIREBASE_SERVICE_ACCOUNT, read from webhook/.env.local the same
 * way webhook's own scripts do, or from the environment):
 *   node scripts/export_public_library.mjs             (dry run, writes nothing)
 *   node scripts/export_public_library.mjs --write
 *   node scripts/export_public_library.mjs --write --out library
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// firebase-admin lives in webhook/node_modules, where every other script in
// this repo that talks to Firestore already gets it. Resolving from there
// keeps the marketing side dependency-free: no package.json change, no second
// copy of a 60 MB SDK, and no reason to touch webhook/ source.
const require = createRequire(path.join(ROOT, 'webhook', 'package.json'))

const CONCEPT_LIBRARY = 'conceptLibrary'
const CONCEPT_LIBRARY_SIMS = 'conceptLibrarySims'
const CONCEPT_LIBRARY_INDEX = 'conceptLibraryIndex'

/** Neighbour ids carried into a concept file for the "what this builds on /
 * what it unlocks" chips. Six each is what fits the chip strip without
 * wrapping into a wall, and matches MAX_PATH_DEPTH's readability logic in
 * webhook/lib/conceptLibrary.ts. */
const MAX_NEIGHBOURS = 6

/** How far the ZPD subgraph walks out from each seed concept. Three hops is
 * what the visualization can actually use: ring 1 (prerequisites), ring 2
 * (direct unlocks) and ring 3 (two hops out), plus one spare hop so that
 * clicking a ring-2 concept to re-center it still has complete rings of its
 * own instead of a visibly truncated graph. */
const ZPD_DEPTH = 3
const ZPD_SEED_COUNT = 4
/** Neighbours carried per node in the ZPD slice. The chosen seeds are real
 * hubs (TCP alone unlocks 17 concepts), and walking all of them three hops out
 * produced a 146 KB file to draw about a dozen dots. Six and eight are more
 * than the rings can legibly hold anyway, and the true totals are kept
 * alongside so the visualization can say "8 of 17" rather than imply that
 * eight is all there is. */
const ZPD_PREREQ_FANOUT = 6
const ZPD_UNLOCK_FANOUT = 8

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

/**
 * Concept id to filename. 4076 of the 4118 ids are subject-prefixed
 * ("biology::phylogenetics"); the rest are bare ("circles_geometry"). A double
 * colon is legal in a URL path but is a minefield across filesystems and
 * static hosts, so it becomes a double underscore. Verified collision-free
 * against the live id set, and the check below keeps it that way rather than
 * trusting that it stays true after a content round.
 */
function slugFor(conceptId) {
  return conceptId.replace(/::/g, '__')
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return process.env.FIREBASE_SERVICE_ACCOUNT
  const envPath = path.join(ROOT, 'webhook', '.env.local')
  if (!fs.existsSync(envPath)) return null
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m && m[1] === 'FIREBASE_SERVICE_ACCOUNT') return m[2].trim()
  }
  return null
}

/** Stable key order so a re-run with unchanged content is a byte-identical
 * file and therefore an empty git diff. */
function stableJson(value) {
  return JSON.stringify(value)
}

/** Writes only when the bytes actually changed, so re-running does not churn
 * 4468 file mtimes for nothing. Returns true when it wrote. */
function writeIfChanged(file, contents, write) {
  const buf = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8')
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file)
    if (existing.equals(buf)) return false
  }
  if (write) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, buf)
  }
  return true
}

async function main() {
  const write = process.argv.includes('--write')
  const outDir = path.resolve(ROOT, arg('--out', 'library'))

  const sa = loadServiceAccount()
  if (!sa) {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT not found in the environment or webhook/.env.local')
    return 1
  }

  const { initializeApp, cert, getApps } = require('firebase-admin/app')
  const { getFirestore } = require('firebase-admin/firestore')
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(sa)) })
  const db = getFirestore()

  console.log(`out           ${outDir}`)
  console.log(`mode          ${write ? 'WRITE' : 'DRY RUN (nothing written)'}`)

  // ── Read every concept once ───────────────────────────────────────────────
  // The whole collection is 4118 docs and this runs on a laptop, not in a
  // request, so one full read is simpler and cheaper than any clever paging.
  const snap = await db.collection(CONCEPT_LIBRARY).get()
  const nodes = new Map()
  snap.forEach((doc) => {
    const d = doc.data()
    nodes.set(doc.id, {
      id: doc.id,
      name: String(d.name ?? doc.id),
      subject: String(d.subject ?? ''),
      subjectTitle: String(d.subjectTitle ?? d.subject ?? ''),
      level: String(d.level ?? 'core'),
      hasLesson: d.hasLesson === true,
      hasSim: d.hasSim === true,
      lesson: d.lesson ?? null,
      prereqs: Array.isArray(d.prereqs) ? d.prereqs : [],
      unlocks: Array.isArray(d.unlocks) ? d.unlocks : [],
      sims: Array.isArray(d.sims) ? d.sims : [],
    })
  })
  console.log(`concepts      ${nodes.size} read from ${CONCEPT_LIBRARY}`)

  // Slug collisions would silently overwrite one concept's lesson with
  // another's, which is exactly the class of bug that is invisible until a
  // visitor reads the wrong chapter. Hard fail instead.
  const bySlug = new Map()
  for (const id of nodes.keys()) {
    const s = slugFor(id)
    if (bySlug.has(s)) {
      console.error(`ERROR: "${id}" and "${bySlug.get(s)}" both map to ${s}.json`)
      return 1
    }
    bySlug.set(s, id)
  }

  // ── Per-concept lesson files ──────────────────────────────────────────────
  const label = (id) => {
    const n = nodes.get(id)
    return n ? { id, label: n.name, hasLesson: n.hasLesson, hasSim: n.hasSim } : null
  }

  const conceptDir = path.join(outDir, 'concepts')
  const wantedConceptFiles = new Set()
  let conceptChanged = 0
  let conceptBytes = 0
  for (const n of nodes.values()) {
    if (!n.hasLesson || !n.lesson) continue
    const slug = slugFor(n.id)
    wantedConceptFiles.add(`${slug}.json`)
    const simMeta = n.sims[0] ?? null
    const payload = {
      id: n.id,
      name: n.name,
      subject: n.subject,
      subjectTitle: n.subjectTitle,
      level: n.level,
      lesson: {
        title: String(n.lesson.title ?? n.name),
        summary: String(n.lesson.summary ?? ''),
        body: String(n.lesson.body ?? ''),
        source: String(n.lesson.source ?? ''),
      },
      hasSim: n.hasSim,
      // The sim FILE, not the sim HTML. Named here so the page never has to
      // guess a URL from an id, and so a concept whose sim failed to export
      // reports hasSim:false rather than pointing at a 404.
      sim: n.hasSim
        ? {
            simId: String(simMeta?.simId ?? slug),
            title: String(simMeta?.title ?? 'Simulation'),
            sourceRepo: String(simMeta?.sourceRepo ?? ''),
            file: `sims/${slug}.html`,
          }
        : null,
      prereqs: n.prereqs.slice(0, MAX_NEIGHBOURS).map(label).filter(Boolean),
      unlocks: n.unlocks.slice(0, MAX_NEIGHBOURS).map(label).filter(Boolean),
    }
    const text = stableJson(payload)
    conceptBytes += Buffer.byteLength(text, 'utf8')
    if (writeIfChanged(path.join(conceptDir, `${slug}.json`), text, write)) conceptChanged++
  }
  console.log(
    `lessons       ${wantedConceptFiles.size} files, ${(conceptBytes / 1048576).toFixed(1)} MB total, ` +
      `avg ${(conceptBytes / wantedConceptFiles.size / 1024).toFixed(1)} KB  (${conceptChanged} new or changed)`,
  )

  // ── Per-concept sim HTML ──────────────────────────────────────────────────
  const simSnap = await db.collection(CONCEPT_LIBRARY_SIMS).get()
  const simDir = path.join(outDir, 'sims')
  const wantedSimFiles = new Set()
  let simChanged = 0
  let simBytes = 0
  let simSkipped = 0
  simSnap.forEach((doc) => {
    const d = doc.data()
    const html = typeof d.html === 'string' ? d.html : ''
    // A sim doc with no HTML would produce an empty iframe advertised as a
    // real sim. Skip it and let the concept show the honest empty state.
    if (!html) {
      simSkipped++
      return
    }
    const slug = slugFor(doc.id)
    wantedSimFiles.add(`${slug}.html`)
    simBytes += Buffer.byteLength(html, 'utf8')
    if (writeIfChanged(path.join(simDir, `${slug}.html`), html, write)) simChanged++
  })
  console.log(
    `sims          ${wantedSimFiles.size} files, ${(simBytes / 1048576).toFixed(1)} MB total, ` +
      `avg ${(simBytes / Math.max(wantedSimFiles.size, 1) / 1024).toFixed(1)} KB  (${simChanged} new or changed` +
      `${simSkipped ? `, ${simSkipped} skipped with empty html` : ''})`,
  )

  // ── Search index, copied verbatim out of the Firestore shards ─────────────
  // Deliberately NOT re-embedded here. Re-embedding would need the model, take
  // minutes, and open a real gap: the public page would be scoring against
  // vectors built by a different run than the ones the signed-in app scores
  // against. Copying the shards makes drift impossible by construction.
  const metaSnap = await db.collection(CONCEPT_LIBRARY_INDEX).doc('meta').get()
  if (!metaSnap.exists) {
    console.error(`ERROR: ${CONCEPT_LIBRARY_INDEX}/meta is missing. Run webhook's migrate-concept-library.ts first.`)
    return 1
  }
  const meta = metaSnap.data()
  const shardIds = Array.from({ length: meta.shardCount }, (_, i) => `shard_${String(i).padStart(3, '0')}`)
  const shardSnaps = await db.getAll(...shardIds.map((id) => db.collection(CONCEPT_LIBRARY_INDEX).doc(id)))

  const indexIds = []
  const chunks = []
  for (let i = 0; i < shardSnaps.length; i++) {
    const s = shardSnaps[i]
    if (!s.exists) {
      console.error(`ERROR: index shard ${shardIds[i]} is missing`)
      return 1
    }
    const d = s.data()
    if (d.scale !== meta.scale || d.dim !== meta.dim) {
      // Every shard was packed with one global scale. A shard that disagrees
      // means a partial re-migration, and unpacking it against meta.scale
      // would produce vectors that look fine and rank wrong.
      console.error(`ERROR: shard ${shardIds[i]} has scale ${d.scale}/dim ${d.dim}, meta says ${meta.scale}/${meta.dim}`)
      return 1
    }
    indexIds.push(...d.ids)
    chunks.push(Buffer.from(d.vectors, 'base64'))
  }
  const vectorBytes = Buffer.concat(chunks)
  if (vectorBytes.length !== indexIds.length * meta.dim) {
    console.error(`ERROR: ${indexIds.length} ids but ${vectorBytes.length} vector bytes at dim ${meta.dim}`)
    return 1
  }

  // Every indexed concept must have a lesson file, or search can resolve onto
  // something the page then cannot show. Checked, not assumed.
  const orphans = indexIds.filter((id) => !wantedConceptFiles.has(`${slugFor(id)}.json`))
  if (orphans.length) {
    console.error(`ERROR: ${orphans.length} indexed concepts have no exported lesson, e.g. ${orphans.slice(0, 5).join(', ')}`)
    return 1
  }

  const catalog = indexIds.map((id) => {
    const n = nodes.get(id)
    return {
      id,
      name: n ? n.name : id,
      subject: n ? n.subject : '',
      subjectTitle: n ? n.subjectTitle : '',
      level: n ? n.level : 'core',
      hasSim: !!(n && n.hasSim && wantedSimFiles.has(`${slugFor(id)}.html`)),
    }
  })
  const indexJson = stableJson({
    // Contract with app/src/lib/queryEmbedder.ts. A browser that embeds a
    // query with a different model or dtype would get plausible nonsense back,
    // so the page reads these and refuses rather than guessing.
    model: meta.model,
    dtype: meta.dtype,
    dim: meta.dim,
    count: indexIds.length,
    scale: meta.scale,
    quantization: meta.quantization ?? 'int8',
    pooling: 'mean',
    normalized: true,
    vectorsFile: 'concept-index.bin',
    builtAt: meta.builtAt,
    source: `firestore:${CONCEPT_LIBRARY_INDEX}`,
    concepts: catalog,
  })
  const indexChanged = writeIfChanged(path.join(outDir, 'concept-index.json'), indexJson, write)
  const vectorsChanged = writeIfChanged(path.join(outDir, 'concept-index.bin'), vectorBytes, write)
  console.log(
    `index         ${indexIds.length} vectors, ${(vectorBytes.length / 1048576).toFixed(2)} MB raw int8 + ` +
      `${(Buffer.byteLength(indexJson, 'utf8') / 1024).toFixed(0)} KB catalog  ` +
      `(${indexChanged || vectorsChanged ? 'changed' : 'unchanged'}, model ${meta.model} ${meta.dtype})`,
  )

  // ── ZPD subgraph ──────────────────────────────────────────────────────────
  const zpd = buildZpd(nodes)
  const zpdJson = stableJson(zpd)
  const zpdChanged = writeIfChanged(path.join(outDir, 'zpd.json'), zpdJson, write)
  console.log(
    `zpd           ${zpd.seeds.length} seed concepts, ${Object.keys(zpd.nodes).length} nodes, ` +
      `${(Buffer.byteLength(zpdJson, 'utf8') / 1024).toFixed(0)} KB  (${zpdChanged ? 'changed' : 'unchanged'})`,
  )
  for (const s of zpd.seeds) {
    const n = zpd.nodes[s]
    console.log(`                ${s}  "${n.name}"  ${n.prereqs.length} prereq / ${n.unlocks.length} unlock`)
  }

  // ── Prune what a previous round left behind ───────────────────────────────
  // Scoped to the two generated directories only. Anything else under the out
  // directory is left alone on purpose: this script owns concepts/ and sims/,
  // nothing more.
  let pruned = 0
  for (const [dir, wanted] of [
    [conceptDir, wantedConceptFiles],
    [simDir, wantedSimFiles],
  ]) {
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (wanted.has(f)) continue
      pruned++
      if (write) fs.unlinkSync(path.join(dir, f))
    }
  }
  console.log(`pruned        ${pruned} stale file(s)${write ? '' : ' (would prune)'}`)

  if (!write) console.log('\nDRY RUN: nothing was written. Re-run with --write.')
  return 0
}

/**
 * A small, real, connected slice of the prerequisite graph for the Zone of
 * Proximal Development visualization on the marketing page.
 *
 * The pedagogy the picture has to carry is Vygotsky's, and the graph already
 * encodes it honestly, so nothing is invented here:
 *   comfort zone      the concept's own prerequisites, already behind you
 *   proximal zone     what those prerequisites unlock next, reachable now
 *   frustration zone  two hops out, gated behind something unlearned
 *
 * Seeds are chosen deterministically (sorted by id, then filtered) so a re-run
 * picks the same four concepts and the diff stays empty. They are required to
 * have real prerequisites AND real unlocks whose own unlocks exist, because a
 * seed missing any of those would render a zone diagram with an empty ring,
 * which teaches the wrong thing.
 */
function buildZpd(nodes) {
  const candidates = [...nodes.values()]
    .filter((n) => n.hasLesson && n.prereqs.length >= 2 && n.unlocks.length >= 3)
    .filter((n) => n.unlocks.some((u) => (nodes.get(u)?.unlocks.length ?? 0) >= 2))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  // Rank, then take the best concept from each of the four best subjects, so
  // the demo centers are not four flavours of one subject and are not just
  // whichever subjects sort first alphabetically. A concept with a real sim
  // wins, because that is one a visitor can go and touch; after that the
  // richest neighbourhood wins, because a center with more real unlocks draws
  // a fuller proximal ring. Every tiebreak ends on the id, so the choice is
  // deterministic and a re-run does not reshuffle the file.
  const score = (c) => (c.hasSim ? 1000 : 0) + Math.min(c.unlocks.length, 12) * 10 + Math.min(c.prereqs.length, 6)
  const bySubject = new Map()
  for (const c of candidates) {
    const held = bySubject.get(c.subject)
    if (!held || score(c) > score(held)) bySubject.set(c.subject, c)
  }
  const seeds = [...bySubject.values()]
    .sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1))
    .slice(0, ZPD_SEED_COUNT)
    .sort((a, b) => (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0))

  // The capped neighbour lists, computed once so the walk and the written file
  // agree. Concepts that carry a lesson come first (a ring position spent on a
  // concept with nothing behind it is a dead click), then the id, so the
  // choice is stable across runs.
  const rank = (a, b) => {
    const na = nodes.get(a)
    const nb = nodes.get(b)
    if (!na || !nb) return na ? -1 : 1
    if (na.hasLesson !== nb.hasLesson) return na.hasLesson ? -1 : 1
    return na.id < nb.id ? -1 : 1
  }
  const capped = new Map()
  for (const n of nodes.values()) {
    capped.set(n.id, {
      prereqs: n.prereqs.filter((p) => nodes.has(p)).sort(rank).slice(0, ZPD_PREREQ_FANOUT),
      unlocks: n.unlocks.filter((u) => nodes.has(u)).sort(rank).slice(0, ZPD_UNLOCK_FANOUT),
    })
  }

  // Breadth-first over the undirected union of prerequisite and unlock edges.
  const depth = new Map()
  let frontier = seeds.map((s) => s.id)
  for (const id of frontier) depth.set(id, 0)
  for (let d = 1; d <= ZPD_DEPTH; d++) {
    const next = []
    for (const id of frontier) {
      const c = capped.get(id)
      if (!c) continue
      for (const nb of [...c.prereqs, ...c.unlocks]) {
        if (depth.has(nb)) continue
        depth.set(nb, d)
        next.push(nb)
      }
    }
    frontier = next
  }

  const subjects = {}
  const out = {}
  for (const id of depth.keys()) {
    const n = nodes.get(id)
    const c = capped.get(id)
    subjects[n.subject] = n.subjectTitle
    const prereqs = c.prereqs.filter((p) => depth.has(p))
    const unlocks = c.unlocks.filter((u) => depth.has(u))
    out[id] = {
      name: n.name,
      subject: n.subject,
      hasLesson: n.hasLesson,
      hasSim: n.hasSim,
      prereqs,
      unlocks,
      // The REAL degree, not the capped one, so the viz can be honest about
      // how much of a hub it is only showing part of.
      prereqCount: n.prereqs.length,
      unlockCount: n.unlocks.length,
      // True when every neighbour this node would draw is present in the
      // slice, so the viz can offer re-centering on it without rendering rings
      // that are quietly missing concepts. Anything else stays a leaf.
      full: prereqs.length === c.prereqs.length && unlocks.length === c.unlocks.length,
    }
  }
  return {
    source: `firestore:${CONCEPT_LIBRARY}`,
    depth: ZPD_DEPTH,
    fanout: { prereqs: ZPD_PREREQ_FANOUT, unlocks: ZPD_UNLOCK_FANOUT },
    seeds: seeds.map((s) => s.id),
    subjects,
    nodes: out,
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
