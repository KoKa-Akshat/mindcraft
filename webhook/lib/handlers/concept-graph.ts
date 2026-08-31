/**
 * api/concept-graph.ts
 *
 * Builds a concept knowledge subgraph for a queried concept.
 * Uses:
 *   1. Student's sessions (keyword detection in title + bullets)
 *   2. Pre-loaded math ontology (domain prior graph)
 *   3. Weighted edges: session co-occurrence + ontology
 *   4. NEW (2026-08-30): the real 4118-concept conceptLibrary, when the
 *      hardcoded ontology below has nothing for the query.
 *
 * POST { concept: string, studentEmail: string, conceptId?: string }
 * Returns { concept, nodes, edges, source }
 *
 * ── The library blend, and why it is shaped as an opt-in fallback ──────────
 * MATH_ONTOLOGY below is 21 real concepts plus 6 deliberately-unrelated ones.
 * The migrated conceptLibrary is 4118 concepts across 13 subjects with 7330
 * real prerequisite/cross-subject edges, so it is a strictly richer source for
 * anything it covers. It is NOT swapped in wholesale, though, because this
 * endpoint is live and its existing behaviour (session-history detection,
 * mastery from session counts, the exact node/edge shape) is depended on by
 * callers this change cannot see. Instead:
 *
 *   - A request in the existing shape whose concept IS in MATH_ONTOLOGY gets
 *     byte-identical behaviour to before. That path is untouched.
 *   - A request whose concept is NOT in MATH_ONTOLOGY used to return a lone
 *     node with no edges at all, which is a dead end, not an answer. That case
 *     now falls back to the library, so "Phylogenetics" or "Conformity"
 *     returns a real neighbourhood instead of nothing.
 *   - A caller that already knows a library id can force the library path by
 *     passing `conceptId`.
 *
 * Session history and mastery are layered on top of whichever source supplied
 * the neighbours, so the student's own data still drives hasSession/mastery
 * exactly as before. `source` in the response says which prior was used, so a
 * client never has to guess.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../firebase'
import { setCors } from '../cors'
import { CONCEPT_LIBRARY } from '../conceptLibrary'

// ── Math Ontology (domain prior) ─────────────────────────────────────────────
// Undirected adjacency list. Each edge = ontology relationship.
const MATH_ONTOLOGY: Record<string, string[]> = {
  'Logarithms':          ['Exponents', 'Natural Log', 'Log Properties', 'Change of Base', 'Functions'],
  'Exponents':           ['Logarithms', 'Algebra', 'Polynomials', 'Scientific Notation', 'Natural Log'],
  'Natural Log':         ['Logarithms', "Euler's Number", 'Derivatives', 'Exponents'],
  'Log Properties':      ['Logarithms', 'Algebra'],
  'Change of Base':      ['Logarithms', 'Natural Log'],
  'Algebra':             ['Exponents', 'Linear Equations', 'Quadratic Equations', 'Polynomials', 'Functions'],
  'Linear Equations':    ['Algebra', 'Functions', 'Systems of Equations'],
  'Quadratic Equations': ['Algebra', 'Polynomials', 'Factoring', 'Functions'],
  'Polynomials':         ['Algebra', 'Exponents', 'Derivatives', 'Factoring'],
  'Factoring':           ['Polynomials', 'Quadratic Equations', 'Algebra'],
  'Functions':           ['Algebra', 'Calculus 1', 'Trigonometry', 'Logarithms', 'Exponents'],
  'Calculus 1':          ['Limits', 'Derivatives', 'Integrals', 'Functions', 'Natural Log'],
  'Limits':              ['Calculus 1', "L'Hôpital's Rule", 'Continuity', 'Derivatives'],
  'Derivatives':         ['Calculus 1', 'Limits', 'Chain Rule', 'Product Rule', 'Polynomials', 'Natural Log'],
  'Integrals':           ['Calculus 1', 'Derivatives', 'Antiderivatives', 'Area Under Curve'],
  'Chain Rule':          ['Derivatives', 'Calculus 1'],
  'Product Rule':        ['Derivatives', 'Calculus 1'],
  'Trigonometry':        ['Functions', 'Derivatives', 'Unit Circle'],
  'Statistics':          ['Probability', 'Functions', 'Normal Distribution'],
  'Probability':         ['Statistics', 'Combinatorics'],
  "Euler's Number":      ['Natural Log', 'Exponents', 'Calculus 1'],
  // Unrelated — no math edges
  'Piano':               ['Music Theory', 'Chord Progressions'],
  'Music Theory':        ['Piano'],
  'Chord Progressions':  ['Piano'],
  'Entrepreneurship':    ['Business Model', 'Market Research'],
  'Business Model':      ['Entrepreneurship'],
  'Market Research':     ['Entrepreneurship'],
}

// ── Keyword → Concept detection ──────────────────────────────────────────────
const CONCEPT_PATTERNS: [string, RegExp][] = [
  ['Logarithms',          /\blog(arithm|s?\s+base|\s*[\d(b]|\(|\))|ln\b|natural\s+log|log_/i],
  ['Exponents',           /\bexponent|x\^|a\^|b\^|\^n|\^2|\^3|power\s+rule|laws\s+of\s+power|e\^x/i],
  ['Natural Log',         /\bln\b|natural\s+log|e\s*=\s*2\.718|euler/i],
  ['Algebra',             /\balgebra|linear\s+equation|slope.intercept|y\s*=\s*mx|ax\s*\+\s*b|variable|solve\s+for\s+x/i],
  ['Linear Equations',    /\bslope.intercept|y\s*=\s*mx|point.slope|linear\s+equation|systems?\s+of\s+eq/i],
  ['Quadratic Equations', /\bquadratic|x\^2|parabola|discriminant|quadratic\s+formula|ax\^2/i],
  ['Polynomials',         /\bpolynomial|monomial|binomial|degree\s+of|coefficient\b/i],
  ['Factoring',           /\bfactor(ing)?|grouping|factor\s+out/i],
  ['Functions',           /\bf\(x\)|domain\b|range\b|composition\b|function\b/i],
  ['Calculus 1',          /\bcalculus|differential|d\/dx|lim_{|limit\b.*approach|integral\b|derivative\b/i],
  ['Limits',              /\blimit|lim\b|approach(es)?\b|l.h.pital|continuity|continuous\b/i],
  ['Derivatives',         /\bderivative|d\/dx|chain\s+rule|product\s+rule|quotient\s+rule|f'\(|tangent\s+line/i],
  ['Integrals',           /\bintegral|\bantiderivative|riemann\s+sum|area\s+under|∫/i],
  ['Trigonometry',        /\btrigonometry|sin\b|cos\b|tan\b|unit\s+circle|angle\b/i],
  ['Statistics',          /\bstatistics|standard\s+deviation|variance\b|mean\b|distribution\b/i],
  ['Piano',               /\bpiano|chord|scale|melody|octave|treble|bass\s+clef|music\s+theory/i],
  ['Entrepreneurship',    /\bbusiness\s+model|startup|market\s+research|value\s+prop|canvas|customer\s+segment/i],
]

function detectConcepts(text: string): Set<string> {
  const found = new Set<string>()
  for (const [concept, pattern] of CONCEPT_PATTERNS) {
    if (pattern.test(text)) found.add(concept)
  }
  return found
}

// Normalize concept name from query
function normalizeConcept(raw: string): string {
  const lower = raw.toLowerCase().trim()
  const aliases: Record<string, string> = {
    'log': 'Logarithms', 'logs': 'Logarithms', 'logarithm': 'Logarithms',
    'log properties': 'Log Properties', 'logarithm properties': 'Log Properties',
    'exponent': 'Exponents', 'powers': 'Exponents', 'exponential': 'Exponents',
    'natural log': 'Natural Log', 'ln': 'Natural Log',
    'calc': 'Calculus 1', 'calculus': 'Calculus 1', 'calc 1': 'Calculus 1',
    'derivative': 'Derivatives', 'differentiation': 'Derivatives',
    'integral': 'Integrals', 'integration': 'Integrals',
    'limit': 'Limits', 'limits': 'Limits',
    'algebra': 'Algebra', 'algebraic': 'Algebra',
    'quadratic': 'Quadratic Equations', 'parabola': 'Quadratic Equations',
    'polynomial': 'Polynomials',
    'function': 'Functions', 'functions': 'Functions',
    'trig': 'Trigonometry', 'trigonometry': 'Trigonometry',
    'stats': 'Statistics', 'statistics': 'Statistics',
    'piano': 'Piano',
    'entrepreneurship': 'Entrepreneurship', 'business': 'Entrepreneurship',
  }
  return aliases[lower] || raw.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}

export interface GraphNode {
  id:          string
  name:        string
  level:       0 | 1 | 2        // 0=center, 1=direct, 2=second-degree
  hasSession:  boolean
  sessionIds:  string[]
  mastery:     number            // 0-1
  sessionTitle?:   string
  sessionBullets?: string[]
  sessionDate?:    string
  sessionSubject?: string
}

export interface GraphEdge {
  source: string
  target: string
  weight: number                 // 0-1
  type:   'session' | 'ontology' | 'both'
}

// ── conceptLibrary fallback ─────────────────────────────────────────────────

/** Fields needed to build a neighbourhood. Field-masked so this never pulls a
 * lesson body it is not going to use. */
const LIB_FIELDS = ['conceptId', 'name', 'prereqs', 'unlocks', 'crossSubject']

interface LibNode {
  conceptId: string
  name?: string
  prereqs?: string[]
  unlocks?: string[]
  crossSubject?: string[]
}

/** Resolves a display name or a raw library id to one library document.
 * Exact-id first (free), then an equality match on `name` (served by
 * Firestore's automatic single-field index, no composite index needed). */
async function findLibraryNode(idOrName: string): Promise<LibNode | null> {
  const direct = await db.collection(CONCEPT_LIBRARY).doc(idOrName).get()
  if (direct.exists) return { ...(direct.data() as LibNode), conceptId: direct.id }
  const byName = await db.collection(CONCEPT_LIBRARY).where('name', '==', idOrName).limit(1).get()
  if (!byName.empty) return { ...(byName.docs[0].data() as LibNode), conceptId: byName.docs[0].id }
  return null
}

/** id -> display name for a set of library ids, in one batched, masked read. */
async function libraryLabels(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (ids.length === 0) return out
  const refs = ids.map((id) => db.collection(CONCEPT_LIBRARY).doc(id))
  const snaps = await db.getAll(...refs, { fieldMask: LIB_FIELDS })
  for (let i = 0; i < snaps.length; i++) {
    if (snaps[i].exists) out.set(ids[i], (snaps[i].data() as LibNode).name || ids[i])
  }
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { concept: rawConcept, studentEmail, conceptId } = req.body as {
    concept: string
    studentEmail: string
    conceptId?: string
  }
  if (!rawConcept || !studentEmail) return res.status(400).json({ error: 'concept and studentEmail required' })

  const concept = normalizeConcept(rawConcept)

  // ── 1. Fetch all student sessions ─────────────────────────────────────────
  const snap = await db.collection('sessions')
    .where('studentEmail', '==', studentEmail)
    .get()

  // Sort most-recent first in JS (avoids needing a composite Firestore index)
  snap.docs.sort((a, b) => (b.data().scheduledAt ?? 0) - (a.data().scheduledAt ?? 0))

  // Map: concept → { sessionIds, titles, bullets, mastery }
  const conceptData: Record<string, { ids: string[]; title: string; bullets: string[]; date: string; subject: string }> = {}

  for (const doc of snap.docs) {
    const data = doc.data()
    const summary = data.summary
    if (!summary?.published) continue

    const fullText = [summary.title, ...(summary.bullets || [])].join(' ')
    const concepts = detectConcepts(fullText)

    for (const c of concepts) {
      if (!conceptData[c]) {
        conceptData[c] = { ids: [], title: summary.title, bullets: summary.bullets || [], date: summary.date || '', subject: data.subject || '' }
      }
      conceptData[c].ids.push(doc.id)
      // Keep most recent session details
      if (conceptData[c].ids.length === 1) {
        conceptData[c].title    = summary.title
        conceptData[c].bullets  = summary.bullets || []
        conceptData[c].date     = summary.date || ''
        conceptData[c].subject  = data.subject || ''
      }
    }
  }

  // ── 2. Build graph ────────────────────────────────────────────────────────
  const nodes: GraphNode[] = []
  const edges:  GraphEdge[] = []
  const nodeSet = new Set<string>()
  const edgeSet = new Set<string>()

  function addNode(name: string, level: 0 | 1 | 2) {
    if (nodeSet.has(name)) return
    nodeSet.add(name)
    const cd = conceptData[name]
    const sessionCount = cd?.ids.length ?? 0
    nodes.push({
      id:             name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name,
      level,
      hasSession:     sessionCount > 0,
      sessionIds:     cd?.ids ?? [],
      mastery:        Math.min(sessionCount / 3, 1.0),
      sessionTitle:   cd?.title,
      sessionBullets: cd?.bullets,
      sessionDate:    cd?.date,
      sessionSubject: cd?.subject,
    })
  }

  function addEdge(source: string, target: string, sessionBased: boolean, ontologyBased: boolean) {
    const key = [source, target].sort().join('||')
    if (edgeSet.has(key)) {
      // Upgrade type if both
      const existing = edges.find(e => [e.source, e.target].sort().join('||') === key)
      if (existing && sessionBased && ontologyBased) existing.type = 'both'
      return
    }
    edgeSet.add(key)
    const weight = sessionBased && ontologyBased ? 1.0 : sessionBased ? 0.75 : 0.35
    edges.push({
      source,
      target,
      weight,
      type: sessionBased && ontologyBased ? 'both' : sessionBased ? 'session' : 'ontology',
    })
  }

  // ── Pick the domain prior ────────────────────────────────────────────────
  // Default is the hardcoded MATH_ONTOLOGY, so every request that worked
  // before still takes exactly the path it took before. The library is
  // consulted only when the caller asked for it by id, or when the ontology
  // genuinely has nothing (the case that used to return a lone, edgeless
  // node). A library lookup that fails falls straight back to the ontology
  // behaviour rather than erroring: a richer graph is a bonus here, never a
  // dependency.
  let adjacency: Record<string, string[]> = MATH_ONTOLOGY
  let centerName = concept
  let source: 'ontology' | 'library' = 'ontology'

  const wantLibrary = !!conceptId || !MATH_ONTOLOGY[concept]
  if (wantLibrary) {
    try {
      const center = await findLibraryNode(conceptId || concept || rawConcept)
      if (center) {
        const direct = [
          ...(center.prereqs ?? []),
          ...(center.unlocks ?? []),
          ...(center.crossSubject ?? []),
        ].slice(0, 14) // keep the graph readable, same instinct as the level-2 cap below
        // One batched read for the direct neighbours, then their own
        // neighbours for level 2. Two round trips total, not one per node.
        const neighborRefs = direct.map((id) => db.collection(CONCEPT_LIBRARY).doc(id))
        const neighborSnaps = neighborRefs.length ? await db.getAll(...neighborRefs, { fieldMask: LIB_FIELDS }) : []

        const built: Record<string, string[]> = {}
        const labelOf = new Map<string, string>()
        labelOf.set(center.conceptId, center.name || center.conceptId)
        const secondDegree = new Set<string>()
        for (const s of neighborSnaps) {
          if (!s.exists) continue
          const n = s.data() as LibNode
          labelOf.set(s.id, n.name || s.id)
          for (const id of [...(n.prereqs ?? []), ...(n.unlocks ?? [])].slice(0, 4)) {
            if (id !== center.conceptId && !direct.includes(id)) secondDegree.add(id)
          }
        }
        const secondLabels = await libraryLabels([...secondDegree].slice(0, 12))
        for (const [id, label] of secondLabels) labelOf.set(id, label)

        // The rest of this handler works in DISPLAY NAMES, not ids, so the
        // library adjacency is translated into the same name-keyed shape
        // MATH_ONTOLOGY uses. Ids that never resolved to a label are dropped
        // rather than shown raw.
        const nameOf = (id: string) => labelOf.get(id)
        centerName = center.name || center.conceptId
        built[centerName] = direct.map(nameOf).filter((n): n is string => !!n)
        for (const s of neighborSnaps) {
          if (!s.exists) continue
          const n = s.data() as LibNode
          const label = nameOf(s.id)
          if (!label) continue
          built[label] = [
            centerName,
            ...[...(n.prereqs ?? []), ...(n.unlocks ?? [])].slice(0, 4).map(nameOf).filter((x): x is string => !!x),
          ]
        }
        if (built[centerName]?.length) {
          adjacency = built
          source = 'library'
        }
      }
    } catch (e) {
      // Library unavailable or not migrated yet. The ontology path below still
      // answers, which is exactly the behaviour that shipped before.
      console.error('concept-graph: library lookup failed, using the ontology', e)
    }
  }

  // Center node
  addNode(centerName, 0)

  // Level 1: ontology (or library) neighbors
  const level1 = new Set<string>(adjacency[centerName] ?? [])

  // Also add concepts where student has sessions co-occurring with the concept
  const centerSessions = new Set(conceptData[centerName]?.ids ?? [])
  for (const [otherConcept, data] of Object.entries(conceptData)) {
    if (otherConcept === centerName) continue
    const otherSessions = new Set(data.ids)
    const overlap = [...centerSessions].filter(id => otherSessions.has(id)).length
    if (overlap > 0) level1.add(otherConcept)
  }

  for (const neighbor of level1) {
    addNode(neighbor, 1)
    const sessionBased = centerSessions.size > 0 && (conceptData[neighbor]?.ids.length ?? 0) > 0
    const ontologyBased = (adjacency[centerName] ?? []).includes(neighbor)
    addEdge(centerName, neighbor, sessionBased, ontologyBased)
  }

  // Level 2: neighbors of level 1 (max 10 to keep graph readable)
  let l2count = 0
  for (const l1 of level1) {
    if (l2count >= 10) break
    const l2candidates = adjacency[l1] ?? []
    for (const l2 of l2candidates) {
      if (l2 === centerName || level1.has(l2) || l2count >= 10) continue
      addNode(l2, 2)
      addEdge(l1, l2, false, true)
      l2count++
    }
  }

  // `concept` (not centerName) stays the echoed value so an existing caller
  // that matches the response against what it sent keeps matching. `source`
  // is additive and tells a newer client which prior actually built this.
  return res.json({ concept, nodes, edges, source, centerLabel: centerName })
}
