/**
 * api/agent-check-in.ts
 *
 * Optional pre-session check-in. Student writes 2–3 sentences about how they
 * feel; Claude Haiku extracts a structured affective state and stores it at
 * Firestore affective_state/{student_id}/latest.
 *
 * The mindcraft-ml /recommend endpoint reads this on every call and adjusts:
 *   - explicit_struggles  → forced into the trimmed chain
 *   - stress > 0.7        → target_mastery lowered by 0.1
 *   - missing or stale    → ignored (structural graph only)
 *
 * Auth: Firebase ID token (Authorization: Bearer <token>).
 * Caller must own the student_id — uid from token must match.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '../lib/firebase'
import { verifyToken } from '../lib/verifyToken'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

const ALLOWED_ORIGINS = [
  'https://mindcraft-93858.web.app',
  'https://mindcraft-93858.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

// Canonical concept list so Haiku maps student words to exact ontology IDs.
const CONCEPT_IDS: Record<string, string> = {
  'fractions_decimals':        'Fractions and Decimals',
  'ratios_proportions':        'Ratios and Proportions',
  'order_of_operations':       'Order of Operations',
  'basic_equations':           'Basic One-Variable Equations',
  'linear_equations':          'Linear Equations',
  'functions_basics':          'Basics of Functions',
  'right_triangle_geometry':   'Right Triangle Geometry',
  'trigonometry_basics':       'Trigonometry Basics',
  'limits_continuity':         'Limits and Continuity',
  'derivatives':               'Derivatives',
  'linear_inequalities':       'Linear Inequalities',
  'systems_of_linear_equations': 'Systems of Linear Equations',
  'exponent_rules':            'Exponent Rules',
  'polynomials':               'Polynomial Operations',
  'factoring_polynomials':     'Factoring Polynomials',
  'radical_expressions':       'Radical Expressions',
  'quadratic_equations':       'Quadratic Equations',
  'descriptive_statistics':    'Descriptive Statistics',
  'basic_probability':         'Basic Probability',
  'exponential_functions':     'Exponential Functions',
  'logarithmic_functions':     'Logarithmic Functions',
  'sequences_series':          'Sequences and Series',
  'lines_angles':              'Lines and Angles',
  'triangles_congruence':      'Triangles and Congruence',
  'circles_geometry':          'Geometry of Circles',
  'area_volume':               'Area and Volume',
  'geometric_transformations': 'Geometric Transformations',
  'rational_expressions':      'Rational Expressions',
  'complex_numbers':           'Complex Numbers',
  'vectors':                   'Vectors',
  'matrices':                  'Matrices',
  'conic_sections':            'Conic Sections',
  'probability_distributions': 'Probability Distributions',
  'applications_of_derivatives': 'Applications of Derivatives',
  'integrals':                 'Integrals',
  'applications_of_integrals': 'Applications of Integrals',
  'inferential_statistics':    'Inferential Statistics',
  'number_properties':         'Number Properties, Factors, and Divisibility',
  'measurement_units':         'Units, Measurement, and Dimensional Reasoning',
  'algebraic_manipulation':    'Algebraic Structure and Symbolic Manipulation',
  'representation_translation':'Representation Translation and Mathematical Modeling',
  'act_strategy':              'ACT Mathematical Strategy and Test-Taking Heuristics',
}

const CONCEPT_LIST_TEXT = Object.entries(CONCEPT_IDS)
  .map(([id, name]) => `  ${id} = "${name}"`)
  .join('\n')

function buildPrompt(text: string): string {
  return `You are a math tutoring assistant extracting a student's emotional and conceptual state from a brief check-in message before a practice session.

AVAILABLE CONCEPT IDs (use ONLY these):
${CONCEPT_LIST_TEXT}

STUDENT MESSAGE:
"${text}"

Extract the following and respond with ONLY valid JSON, no markdown, no explanation:
{
  "stress": <0.0–1.0, how anxious or stressed the student sounds>,
  "motivation": <0.0–1.0, how engaged or motivated they sound>,
  "confidence_by_concept": { "<concept_id>": <0.0–1.0>, ... },
  "explicit_struggles": ["<concept_id>", ...]
}

Rules:
- stress/motivation: infer from tone. Calm+ready = low stress, high motivation.
- explicit_struggles: only concepts the student explicitly says they find hard or are confused about.
- confidence_by_concept: only concepts they mention. Omit if message has no specific concept references.
- Use ONLY concept_ids from the list above. If a topic doesn't map to a listed concept, skip it.
- If the message is vague or unrelated to math, return stress:0.3, motivation:0.5, empty arrays/objects.`
}

export interface AffectiveState {
  stress: number
  motivation: number
  confidence_by_concept: Record<string, number>
  explicit_struggles: string[]
  captured_at: number
}

function parseAffectiveState(raw: string): AffectiveState {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const parsed  = JSON.parse(cleaned)

  const clamp = (v: unknown, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback
  }

  const validIds = new Set(Object.keys(CONCEPT_IDS))

  const confidence_by_concept: Record<string, number> = {}
  if (parsed.confidence_by_concept && typeof parsed.confidence_by_concept === 'object') {
    for (const [k, v] of Object.entries(parsed.confidence_by_concept)) {
      if (validIds.has(k)) confidence_by_concept[k] = clamp(v, 0.5)
    }
  }

  const explicit_struggles: string[] = Array.isArray(parsed.explicit_struggles)
    ? parsed.explicit_struggles.filter((s: unknown) => typeof s === 'string' && validIds.has(s))
    : []

  return {
    stress:                clamp(parsed.stress,     0.3),
    motivation:            clamp(parsed.motivation, 0.5),
    confidence_by_concept,
    explicit_struggles,
    captured_at:           Date.now(),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin ?? ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin',  origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  // Auth: verify Firebase ID token
  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Unauthorized' })

  const body       = req.body as Record<string, unknown>
  const student_id = String(body.student_id ?? '')
  const text       = String(body.text ?? '').trim()

  if (!student_id || student_id !== uid) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!text) {
    return res.status(400).json({ error: 'text is required' })
  }
  if (text.length > 1000) {
    return res.status(400).json({ error: 'text too long (max 1000 chars)' })
  }

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages:   [{ role: 'user', content: buildPrompt(text) }],
    })

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'

    let affectiveState: AffectiveState
    try {
      affectiveState = parseAffectiveState(raw)
    } catch {
      return res.status(500).json({ error: 'Failed to parse model response', raw: raw.slice(0, 200) })
    }

    // Store in Firestore under affective_state/{student_id}/latest
    // The ML /recommend endpoint reads this on every recommendation call.
    await db
      .collection('affective_state')
      .doc(student_id)
      .set({ latest: affectiveState })

    return res.json(affectiveState)
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Check-in failed' })
  }
}
