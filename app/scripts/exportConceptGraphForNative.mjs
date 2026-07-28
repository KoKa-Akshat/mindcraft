// Read-only export script — native iOS Map tab graph layout.
//
// The native Map tab (KnowledgeMapView.swift) was a flat priority-sorted
// list, not a network/graph view like web's real ConstellationGpsExplorer
// (a force-directed canvas with live drag/zoom). A byte-for-byte native port
// of that 900-line interactive component isn't in scope, but the list-vs-map
// visual gap IS fixable: this script derives a deterministic node layout
// (cluster angle + level-tier radius) from the real 42-concept ontology
// (`ml/data/5_level_ontology/...with_combinations.json`, read-only — Engine
// lane owns that file, this only reads it) plus a same-cluster,
// adjacent-tier edge approximation (foundational→core→advanced), since the
// ontology has no flat prerequisite-edge list at rest (the real prerequisite
// chain is derived at request time by the Python pathfinder, which this
// script does not run). Good enough to make the Map tab READ as a graph
// (nodes positioned by relationship, connecting lines, cluster grouping)
// instead of a list, without fabricating precision the data doesn't have.
//
// Usage: node scripts/exportConceptGraphForNative.mjs [outputPath]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const ontologyPath = path.resolve(
  root,
  '../ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json',
)
const ontology = JSON.parse(fs.readFileSync(ontologyPath, 'utf8'))

const LEVEL_RADIUS = { foundational: 0.28, core: 0.62, advanced: 0.95, cross_cutting: 1.15 }
const LEVEL_ORDER = { foundational: 0, core: 1, advanced: 2, cross_cutting: 3 }

// Coarse cluster assignment by keyword — good enough for a layout angle, not
// claimed as an authoritative taxonomy (the ontology itself has no cluster
// field at rest).
const CLUSTER_RULES = [
  ['geometry', /triangle|circle|geometr|area_volume|vector|conic|lines_angles/],
  ['statistics', /statistic|probability|inferential/],
  ['functions_calculus', /function|limit|derivative|integral|exponential|logarithm/],
  ['algebra', /equation|polynomial|factoring|radical|quadratic|rational|matri|complex_number|algebraic_manipulation|sequence/],
  ['foundational_number', /fraction|ratio|order_of_operations|number_properties|measurement/],
  ['strategy', /representation_translation|act_strategy/],
]
function clusterFor(id) {
  for (const [cluster, re] of CLUSTER_RULES) if (re.test(id)) return cluster
  return 'algebra'
}

const byCluster = new Map()
for (const c of ontology.concepts) {
  const cluster = clusterFor(c.id)
  if (!byCluster.has(cluster)) byCluster.set(cluster, [])
  byCluster.get(cluster).push(c)
}

const clusters = [...byCluster.keys()]
const nodes = []
for (const [clusterIdx, cluster] of clusters.entries()) {
  const members = byCluster.get(cluster)
  const baseAngle = (clusterIdx / clusters.length) * 2 * Math.PI
  const angleSpread = (2 * Math.PI) / clusters.length
  members.forEach((c, i) => {
    const jitterAngle = baseAngle + ((i + 1) / (members.length + 1) - 0.5) * angleSpread * 0.85
    const radius = LEVEL_RADIUS[c.level] ?? 0.7
    nodes.push({
      id: c.id,
      name: c.name,
      level: c.level,
      cluster,
      x: Math.round(Math.cos(jitterAngle) * radius * 1000) / 1000,
      y: Math.round(Math.sin(jitterAngle) * radius * 1000) / 1000,
    })
  })
}

// Edges: connect each node to its nearest same-cluster neighbor one tier
// closer to the center (foundational is its own root, so it links to the
// nearest cross-cluster foundational node instead — keeps the graph
// connected rather than 6 disjoint clusters).
const edges = []
for (const cluster of clusters) {
  const members = byCluster.get(cluster).map(c => nodes.find(n => n.id === c.id))
  const byTier = {}
  for (const n of members) (byTier[n.level] ??= []).push(n)
  const tierOrder = ['foundational', 'core', 'advanced', 'cross_cutting']
  for (let t = 1; t < tierOrder.length; t++) {
    const inner = byTier[tierOrder[t - 1]]
    const outer = byTier[tierOrder[t]]
    if (!inner?.length || !outer?.length) continue
    for (const o of outer) {
      const nearest = inner.reduce((best, n) =>
        Math.hypot(n.x - o.x, n.y - o.y) < Math.hypot(best.x - o.x, best.y - o.y) ? n : best,
      inner[0])
      edges.push([nearest.id, o.id])
    }
  }
}
// Chain the clusters' foundational roots together so the whole graph reads
// as one connected map, not disjoint islands.
const roots = clusters.map(cl => byCluster.get(cl).find(c => c.level === 'foundational') ?? byCluster.get(cl)[0])
for (let i = 1; i < roots.length; i++) edges.push([roots[i - 1].id, roots[i].id])

const output = { nodes, edges }

const outputPath = process.argv[2]
  ? path.resolve(root, process.argv[2])
  : path.resolve(root, '../ios-prototype/MindCraftNotes/MindCraftNotes/Resources/conceptGraph.json')

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(output))

console.log(`Wrote ${nodes.length} nodes, ${edges.length} edges to ${outputPath}`)
