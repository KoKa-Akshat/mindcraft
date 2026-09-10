/**
 * scripts/export-concept-graph.ts
 *
 * Regenerates the small JSON the 3D concept-graph viewer consumes, reading
 * from the MIGRATED Firestore library instead of a session temp file.
 *
 * This replaces scripts/export_concept_graph.py as the source of truth for
 * app/public/full-concept-graph.json. That script projected down from
 * graph_data.json, which lived only in a Claude session's scratchpad; this one
 * reads conceptLibrary, which is durable production data. The OUTPUT SHAPE IS
 * DELIBERATELY IDENTICAL so app/public/full-graph-viewer.html needs no change:
 *
 *     nodes:    {id, name, subject, level, hasLesson, hasSim}
 *     edges:    {source, target, relation, weight}
 *     subjects: {id, title, color, nodeCount, withLesson, withSim}
 *     counts:   {nodes, edges, withLesson, withSim, subjects}
 *
 * One honest difference from the Python version, worth knowing when the two
 * outputs are compared: the Python script set hasSim from the mere PRESENCE of
 * a sim reference (759 concepts). Firestore only holds sims whose built HTML
 * actually existed on disk at migration time, so this reports 722. The smaller
 * number is the true one: 37 of those references point at an extract that
 * never built into a playable file, and advertising a sim that cannot be shown
 * is worse than admitting the gap.
 *
 * Also writes app/public/full-concept-graph-counts.json, a few hundred bytes
 * carrying just the counts and subject rollup, so pages that only need honest
 * totals ("722 of 4118 concepts have a sim") do not download the 1.5 MB graph.
 *
 * Idempotent: nodes and edges are sorted, so the same library always produces
 * the same bytes apart from the generatedAt stamp.
 *
 * Usage (needs FIREBASE_SERVICE_ACCOUNT in the env):
 *   node --env-file=.env.local -r ts-node/register/transpile-only scripts/export-concept-graph.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'
import { db } from '../lib/firebase'
import { CONCEPT_LIBRARY } from '../lib/conceptLibrary'

const OUT_GRAPH = path.resolve(__dirname, '../../app/public/full-concept-graph.json')
const OUT_COUNTS = path.resolve(__dirname, '../../app/public/full-concept-graph-counts.json')

/** Same hand-tuned, hue-spaced palette the Python exporter used, pinned per
 * subject id so adding a subject never recolors an existing one. */
const SUBJECT_COLORS: Record<string, string> = {
  'act-math': '#c4f547',
  'algebra-1': '#8ee06a',
  biology: '#43d98b',
  blockchain: '#f0a93c',
  calculus: '#38d6c4',
  chemistry: '#45c2f0',
  circuits: '#5aa8ff',
  'computer-science': '#8b8cf7',
  networking: '#a97cf0',
  psychology: '#c96ee8',
  'quantum-computing': '#ef6fc6',
  'statistics-course': '#f56a92',
  'us-history': '#f5794f',
}

/** Stable, repeatable color for a subject added after that palette was
 * written. Hue from a hash of the id, saturation/lightness fixed in the same
 * band as the curated colors so it never looks alien. */
function fallbackColor(subjectId: string): string {
  const d = createHash('sha256').update(subjectId).digest()
  const hue = ((d[0] << 8) | d[1]) / 65535
  const [r, g, b] = hslToRgb(hue, 0.72, 0.62)
  return '#' + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)]
}

function pretty(id: string): string {
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface OutNode { id: string; name: string; subject: string; level: string; hasLesson: boolean; hasSim: boolean }
interface OutEdge { source: string; target: string; relation: string; weight: number }

async function main() {
  console.log(`reading ${CONCEPT_LIBRARY} from Firestore...`)
  const snap = await db.collection(CONCEPT_LIBRARY).get()
  if (snap.empty) {
    console.error(`ERROR: ${CONCEPT_LIBRARY} is empty. Run scripts/migrate-concept-library.ts --write first.`)
    process.exit(1)
  }

  const nodes: OutNode[] = []
  const subjectTitles = new Map<string, string>()
  const edgeSeen = new Set<string>()
  const edges: OutEdge[] = []
  const ids = new Set<string>()

  interface LibDoc {
    name?: string
    subject?: string
    subjectTitle?: string
    level?: string
    hasLesson?: boolean
    hasSim?: boolean
    prereqs?: string[]
    crossSubject?: string[]
  }

  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as LibDoc }))
  for (const { id, data } of docs) {
    ids.add(id)
    const subject = data.subject || 'unknown'
    if (data.subjectTitle) subjectTitles.set(subject, data.subjectTitle)
    nodes.push({
      id,
      name: data.name || id,
      subject,
      level: data.level || 'core',
      hasLesson: data.hasLesson === true,
      hasSim: data.hasSim === true,
    })
  }

  // Edges are reconstructed from the denormalized arrays. `prereqs` on X holds
  // the concepts that come BEFORE X, so the edge is prereq -> X, which is the
  // same direction the source graph's {from, to} carried. crossSubject is
  // stored on both endpoints, so it is de-duplicated by sorted pair.
  let dangling = 0
  for (const { id, data } of docs) {
    for (const from of data.prereqs ?? []) {
      if (!ids.has(from)) { dangling++; continue }
      const key = `${from}|${id}|prerequisite`
      if (edgeSeen.has(key)) continue
      edgeSeen.add(key)
      edges.push({ source: from, target: id, relation: 'prerequisite', weight: 1 })
    }
    for (const other of data.crossSubject ?? []) {
      if (!ids.has(other)) { dangling++; continue }
      const [a, b] = [id, other].sort()
      const key = `${a}|${b}|cross_subject`
      if (edgeSeen.has(key)) continue
      edgeSeen.add(key)
      edges.push({ source: a, target: b, relation: 'cross_subject', weight: 0.5 })
    }
  }

  nodes.sort((a, b) => (a.subject === b.subject ? (a.id < b.id ? -1 : 1) : a.subject < b.subject ? -1 : 1))
  edges.sort((a, b) =>
    a.source !== b.source ? (a.source < b.source ? -1 : 1)
      : a.target !== b.target ? (a.target < b.target ? -1 : 1)
        : a.relation < b.relation ? -1 : 1,
  )

  const bySubject = new Map<string, { id: string; title: string; color: string; nodeCount: number; withLesson: number; withSim: number }>()
  for (const n of nodes) {
    let s = bySubject.get(n.subject)
    if (!s) {
      s = {
        id: n.subject,
        title: subjectTitles.get(n.subject) ?? pretty(n.subject),
        color: SUBJECT_COLORS[n.subject] ?? fallbackColor(n.subject),
        nodeCount: 0,
        withLesson: 0,
        withSim: 0,
      }
      bySubject.set(n.subject, s)
    }
    s.nodeCount++
    if (n.hasLesson) s.withLesson++
    if (n.hasSim) s.withSim++
  }
  const subjects = [...bySubject.values()].sort((a, b) => (a.id < b.id ? -1 : 1))

  const counts = {
    nodes: nodes.length,
    edges: edges.length,
    withLesson: nodes.filter((n) => n.hasLesson).length,
    withSim: nodes.filter((n) => n.hasSim).length,
    subjects: subjects.length,
  }
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  fs.mkdirSync(path.dirname(OUT_GRAPH), { recursive: true })
  fs.writeFileSync(
    OUT_GRAPH,
    JSON.stringify({ generatedAt, source: `firestore:${CONCEPT_LIBRARY}`, counts, subjects, nodes, edges }),
  )
  fs.writeFileSync(
    OUT_COUNTS,
    JSON.stringify({ generatedAt, source: `firestore:${CONCEPT_LIBRARY}`, counts, subjects }),
  )

  console.log(`wrote   ${OUT_GRAPH} (${(fs.statSync(OUT_GRAPH).size / 1024).toFixed(0)} KB)`)
  console.log(`wrote   ${OUT_COUNTS} (${fs.statSync(OUT_COUNTS).size} bytes)`)
  console.log(`nodes   ${counts.nodes} (${counts.withLesson} with a lesson, ${counts.withSim} with a sim)`)
  console.log(`edges   ${counts.edges} across ${counts.subjects} subjects`)
  if (dangling) console.log(`note    skipped ${dangling} edge endpoints pointing at unknown concepts`)
  const uncolored = subjects.filter((s) => !SUBJECT_COLORS[s.id]).map((s) => s.id)
  if (uncolored.length) console.log(`note    new subjects on a generated color: ${uncolored.join(', ')}`)
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
