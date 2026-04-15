/**
 * api/concept-graph.ts
 *
 * Builds a concept knowledge subgraph for a queried concept.
 * Uses:
 *   1. Student's sessions (keyword detection in title + bullets)
 *   2. Pre-loaded math ontology (domain prior graph)
 *   3. Weighted edges: session co-occurrence + ontology
 *
 * POST { concept: string, studentEmail: string }
 * Returns { concept, nodes, edges }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../lib/firebase'
import { setCors } from '../lib/cors'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { concept: rawConcept, studentEmail } = req.body as { concept: string; studentEmail: string }
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

  // Center node
  addNode(concept, 0)

  // Level 1: ontology neighbors
  const level1 = new Set<string>(MATH_ONTOLOGY[concept] ?? [])

  // Also add concepts where student has sessions co-occurring with the concept
  const centerSessions = new Set(conceptData[concept]?.ids ?? [])
  for (const [otherConcept, data] of Object.entries(conceptData)) {
    if (otherConcept === concept) continue
    const otherSessions = new Set(data.ids)
    const overlap = [...centerSessions].filter(id => otherSessions.has(id)).length
    if (overlap > 0) level1.add(otherConcept)
  }

  for (const neighbor of level1) {
    addNode(neighbor, 1)
    const sessionBased = centerSessions.size > 0 && (conceptData[neighbor]?.ids.length ?? 0) > 0
    const ontologyBased = (MATH_ONTOLOGY[concept] ?? []).includes(neighbor)
    addEdge(concept, neighbor, sessionBased, ontologyBased)
  }

  // Level 2: neighbors of level 1 (max 10 to keep graph readable)
  let l2count = 0
  for (const l1 of level1) {
    if (l2count >= 10) break
    const l2candidates = MATH_ONTOLOGY[l1] ?? []
    for (const l2 of l2candidates) {
      if (l2 === concept || level1.has(l2) || l2count >= 10) continue
      addNode(l2, 2)
      addEdge(l1, l2, false, true)
      l2count++
    }
  }

  return res.json({ concept, nodes, edges })
}
