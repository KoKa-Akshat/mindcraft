/**
 * api/generate-questions.ts
 *
 * Dynamic question generation agent using LangChain + Groq (Llama 3.3 70B).
 * Results are cached in Firestore for 24 hours to avoid regenerating identical
 * concept/level/exam combos across users.
 *
 * POST { conceptId, level, examType?, count?, bridgeFrom? }
 * → { questions: Question[], cached: boolean }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ChatGroq }            from '@langchain/groq'
import { ChatPromptTemplate }  from '@langchain/core/prompts'
import { JsonOutputParser }    from '@langchain/core/output_parsers'
import { db }                  from '../lib/firebase'

const ALLOWED_ORIGIN = 'https://mindcraft-93858.web.app'
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000   // 24 h
const ALLOWED_EXAMS  = new Set(['ACT', 'SAT', 'IB', 'AP', 'General'])

function labelForConcept(id: string) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Concept knowledge injected into the prompt ────────────────────────────────
const CONCEPT_KNOWLEDGE: Record<string, string> = {
  linear_equations:            'Isolating x: adding/subtracting, multiply/divide, distributive property, variables on both sides. Traps: sign errors, "what is 3x" vs "what is x", forgetting to apply operation to both sides.',
  linear_inequalities:         'Solving inequalities; flip sign when multiplying/dividing by a negative. Compound inequalities (AND/OR). Graphing on a number line.',
  absolute_value:              '|x|=a means x=a OR x=−a. Solving |ax+b|=c and |ax+b|<c. Trap: students often ignore the negative case.',
  quadratic_equations:         'Factoring, quadratic formula, completing the square, discriminant. Traps: forgetting ±, sign errors in discriminant, vertex vs roots, leading coefficient ≠ 1.',
  functions_basics:            'f(x) notation, evaluating, domain/range, function composition. Traps: f(x+1)≠f(x)+1, confusing input/output, undefined at division-by-zero.',
  systems_of_linear_equations: 'Substitution and elimination. Identifying no-solution (parallel) vs infinite-solutions (same line). Word problems with two unknowns.',
  exponent_rules:              'Product aᵐ·aⁿ=aᵐ⁺ⁿ, quotient, power of power, negative exponents, fractional exponents = radicals. Traps: (2x)³≠2x³, a⁰=1.',
  polynomials:                 'Adding, multiplying polynomials; FOIL; (a+b)²; (a+b)(a−b). Long/synthetic division. Remainder theorem. Factor theorem.',
  rational_expressions:        'Simplify by factoring numerator/denominator. Add/subtract with LCD. Domain restrictions (denominator ≠ 0). Complex fractions.',
  function_transformations:    'f(x−h)+k shifts right h, up k. −f(x) reflects over x-axis. f(−x) reflects over y-axis. af(x) stretches. Counter-intuitive horizontal direction.',
  coordinate_geometry:         'Slope, distance, midpoint, equations of lines, intersections, graph interpretation, and geometry on the coordinate plane. Traps: slope sign, mixing x/y changes, treating a drawn shape as not algebraic.',
  trigonometry_basics:         'Right-triangle trig, sine/cosine/tangent ratios, special right triangles, radians/degrees, and basic unit-circle connections. Traps: mixing opposite/adjacent, degree/radian confusion, calculator mode.',
  number_properties:           'Odd/even rules, prime factorisation, GCF, LCM, divisibility rules. Integer vs real distinctions on standardised tests.',
  word_problems:               'Rate × time = distance, work-rate problems, mixture problems, age problems. Translating English → algebra is the core skill.',
  percent_ratio:               'Percent change = (new−old)/old × 100. Proportional reasoning. Unit conversion. Scale/similar figures. Markup/discount.',
  descriptive_statistics:      'Mean, median, mode, range. Effect of adding a constant or outlier. Interpreting box plots and histograms. Standard deviation direction.',
  basic_probability:           'P(A), complementary P(A)=1−P(not A), P(A and B) independent, P(A or B)=P(A)+P(B)−P(A∩B). Conditional probability basics.',
}

const LEVEL_GUIDANCE: Record<number, string> = {
  1: 'FOUNDATION — direct single-procedure application, clean integers, 1–2 steps maximum. Test the bare core skill. Ideal for rebuilding from scratch.',
  2: 'APPLIED — word problem or multi-step setup, realistic messy numbers, 3–4 steps. Test problem-solving and setup, not just mechanics.',
  3: 'EXAM READY — non-routine, strategic, mirrors real ACT/SAT/IB difficulty. Combines sub-skills or tests edge cases. Wrong answers must be strategically designed to match common exam traps.',
}

const EXAM_STYLE: Record<string, string> = {
  ACT:     'ACT Math: phrasing like "which of the following", speed-focused, concrete numbers, word-problem contexts (plumber, car, store). 5 choices on real ACT but generate 4 here.',
  SAT:     'SAT Math: context-heavy with data tables or graphs described in text, real-world framing, "based on the equation above", units explicitly stated.',
  IB:      'IB Mathematics SL/HL: exact values (leave in terms of π or √), "Hence find…", "Show that…", "Write down the value of…", multi-part questions welcome.',
  AP:      'AP Calculus/Precalculus: "Let f be defined by…", interval notation, "on the open interval", domain/range conditions, correct function notation throughout.',
  General: 'Clear, friendly high school math. Straightforward wording. Emphasise understanding over speed.',
}

const EXAM_BLUEPRINT: Record<string, string> = {
  ACT: 'Prioritise fast ACT multiple-choice math: concise wording, numeric answers, common traps, and realistic pacing. Good contexts: rates, percent change, systems, functions, probability, statistics, quadratics, and coordinate-style algebra. Avoid long proofs.',
  SAT: 'Prioritise Digital SAT math: context-heavy algebra, units, tables described in text, equivalent forms, function notation, and distractors based on misreading the setup. Make it feel like SAT math, not a generic worksheet.',
  IB: 'Prioritise IB Mathematics style: exact values, symbolic reasoning, "hence" / "show that" flavor even though output is multiple-choice, and multi-step setup. Include distractors for manipulation errors, domain restrictions, surds, pi, and exact forms.',
  AP: 'Prioritise AP Precalculus/Calculus readiness: function notation, intervals, transformations, rates of change, graphical/table descriptions in words, and notation discipline. Probe reasoning, not only computation.',
  General: 'Prioritise clear high-school skill-building questions that diagnose the core concept without unnecessary exam flavor.',
}

const EXAM_FORMAT_RULES: Record<string, string> = {
  ACT: 'Use short, direct stems. Ask for the answer quickly. Distractors should reflect arithmetic slips, sign errors, and choosing the tempting shortcut too soon.',
  SAT: 'Use a wordier setup with explicit units, equation interpretation, table/graph descriptions, or equivalent-form reasoning. The hard part should often be translating the setup.',
  IB: 'Use symbolic or exact-form reasoning. Even as multiple choice, make the question feel like a compressed multi-part prompt with method, notation, and exact values mattering.',
  AP: 'Use function notation, intervals, graphical or tabular descriptions, rate/change language, and notation discipline. The question should test reasoning about behavior, not only solving an equation.',
  General: 'Use clean skill-building prompts with varied formats and no heavy exam-specific style.',
}

type GeneratedQuestion = {
  id: string
  conceptId: string
  level: 1 | 2 | 3
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
  hints: string[]
  examTag?: 'ACT' | 'SAT' | 'IB' | 'AP' | null
}

function clampCount(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return 8
  return Math.max(1, Math.min(10, Math.floor(parsed)))
}

function normalizeExamType(value: unknown) {
  return typeof value === 'string' && ALLOWED_EXAMS.has(value) ? value : 'General'
}

function normalizeBridgeFrom(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return /^[a-z0-9_]{2,64}$/.test(trimmed) ? trimmed : undefined
}

function isGeneratedQuestion(q: unknown, conceptId: string, level: number, examType: string): q is GeneratedQuestion {
  if (!q || typeof q !== 'object') return false
  const item = q as Partial<GeneratedQuestion>
  const examTagValid = item.examTag === undefined || item.examTag === null || ['ACT', 'SAT', 'IB', 'AP'].includes(item.examTag)
  const examTagMatches = examType === 'General' ? true : item.examTag === examType

  return typeof item.id === 'string'
    && typeof item.question === 'string'
    && Array.isArray(item.choices)
    && item.choices.length === 4
    && item.choices.every(choice => typeof choice === 'string' && choice.trim().length > 0)
    && Number.isInteger(item.correctIndex)
    && item.correctIndex! >= 0
    && item.correctIndex! < 4
    && typeof item.explanation === 'string'
    && Array.isArray(item.hints)
    && item.hints.length === 3
    && item.hints.every(hint => typeof hint === 'string' && hint.trim().length > 0)
    && item.conceptId === conceptId
    && item.level === level
    && examTagValid
    && examTagMatches
}

function normalizeQuestions(questions: unknown, conceptId: string, level: number, count: number, examType: string) {
  if (!Array.isArray(questions)) return []

  const seen = new Set<string>()
  return questions
    .filter(q => isGeneratedQuestion(q, conceptId, level, examType))
    .filter(q => {
      if (seen.has(q.id)) return false
      seen.add(q.id)
      return true
    })
    .slice(0, count)
}

// ── LangChain prompt ──────────────────────────────────────────────────────────
const SYSTEM_TEMPLATE = `You are an expert mathematics question writer for standardised test prep.

CONCEPT: {concept_label}
CONCEPT KNOWLEDGE: {concept_knowledge}
DIFFICULTY: {level_guidance}
EXAM STYLE: {exam_style}
EXAM BLUEPRINT: {exam_blueprint}
EXAM FORMAT RULES: {exam_format_rules}
BRIDGE CONTEXT: {bridge_context}

Generate exactly {count} UNIQUE multiple-choice questions. Each question must:
• Be GENUINELY DIAGNOSTIC — reveal whether the student understands or is guessing
• Have EXACTLY 4 answer choices labelled as plain text (no A/B/C/D prefix)
• Have ONE correct answer and THREE distractors that each represent a different realistic student mistake
• Include a FULL worked solution in "explanation" (show every step)
• Include EXACTLY 3 progressive hints: hint 1 = nudge toward the right approach, hint 2 = key algebraic/procedural step shown, hint 3 = one step away from the answer
• Vary question structure — do NOT repeat the same template twice
• Numbers and contexts must be different across all {count} questions

Return ONLY a JSON array — no markdown fences, no preamble, no commentary:
[
  {{
    "id": "gen-{concept_short}-{level_num}-1",
    "conceptId": "{concept_id}",
    "level": {level_num},
    "question": "Full question text here",
    "choices": ["correct or wrong option", "wrong option", "wrong option", "wrong option"],
    "correctIndex": 0,
    "explanation": "Step-by-step solution shown clearly",
    "hints": ["Hint 1 text", "Hint 2 text", "Hint 3 text"],
    "examTag": "ACT"
  }}
]

Shuffle the correct answer position across questions (correctIndex should not always be 0).
examTag must be {exam_tag_instruction}.`

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const { conceptId, level, examType: rawExamType = 'General', count: rawCount = 8, bridgeFrom } = (req.body ?? {}) as {
    conceptId?: string
    level?: number
    examType?: string
    count?: number
    bridgeFrom?: string
  }

  if (!conceptId || !level) {
    return res.status(400).json({ error: 'conceptId and level are required' })
  }

  const examType = normalizeExamType(rawExamType)
  const normalizedBridgeFrom = normalizeBridgeFrom(bridgeFrom)
  const count = clampCount(rawCount)
  const bridgeKey = normalizedBridgeFrom ? `_B${normalizedBridgeFrom}` : ''
  const cacheKey = `${conceptId}_L${level}_${examType}_N${count}${bridgeKey}`

  // ── 1. Check Firestore cache ───────────────────────────────────────────────
  try {
    const doc = await db.collection('question_cache').doc(cacheKey).get()
    if (doc.exists) {
      const data = doc.data()!
      const ageMs = Date.now() - (data.cachedAt ?? 0)
      if (ageMs < CACHE_TTL_MS) {
        const cachedQuestions = normalizeQuestions(data.questions, conceptId, level, count, examType)
        if (cachedQuestions.length >= count) {
          return res.json({ questions: cachedQuestions, cached: true })
        }
      }
    }
  } catch {
    // Firestore unavailable — proceed to generate
  }

  // ── 2. Build LangChain chain ───────────────────────────────────────────────
  const model = new ChatGroq({
    apiKey:      process.env.GROQ_API_KEY ?? '',
    model:       'llama-3.3-70b-versatile',
    temperature: 0.80,
    maxTokens:   4096,
  })

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_TEMPLATE],
  ])

  const chain = prompt.pipe(model).pipe(new JsonOutputParser())

  const conceptLabel = labelForConcept(conceptId)
  const conceptShort = conceptId.split('_').map((w: string) => w[0]).join('')
  const bridgeContext = normalizedBridgeFrom
    ? `Bridge from the student's strength in ${labelForConcept(normalizedBridgeFrom)} into their weaker target ${conceptLabel}. At least half the questions should require connecting both ideas, not drilling ${conceptLabel} in isolation.`
    : 'No bridge context. Focus on the target concept itself.'

  // ── 3. Generate ────────────────────────────────────────────────────────────
  let questions: unknown[]
  try {
    questions = await chain.invoke({
      count:             String(count),
      concept_label:     conceptLabel,
      concept_id:        conceptId,
      concept_short:     conceptShort,
      concept_knowledge: CONCEPT_KNOWLEDGE[conceptId] ?? `Core ${conceptLabel} skills and applications`,
      level_guidance:    LEVEL_GUIDANCE[level]        ?? LEVEL_GUIDANCE[2],
      exam_style:        EXAM_STYLE[examType]          ?? EXAM_STYLE.General,
      exam_blueprint:    EXAM_BLUEPRINT[examType]      ?? EXAM_BLUEPRINT.General,
      exam_format_rules: EXAM_FORMAT_RULES[examType]   ?? EXAM_FORMAT_RULES.General,
      bridge_context:    bridgeContext,
      exam_tag_instruction: examType === 'General'
        ? 'one of "ACT","SAT","IB","AP" or null — only tag when the question genuinely reflects that exam style'
        : `"${examType}" for every question`,
      level_num:         String(level),
    }) as unknown[]
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Question generation failed'
    return res.status(500).json({ error: msg })
  }

  const normalizedQuestions = normalizeQuestions(questions, conceptId, level, count, examType)
  if (normalizedQuestions.length < count) {
    return res.status(500).json({ error: `Model returned ${normalizedQuestions.length}/${count} valid exam-tagged questions` })
  }

  // ── 4. Persist to Firestore cache ──────────────────────────────────────────
  try {
    await db.collection('question_cache').doc(cacheKey).set({
      questions: normalizedQuestions,
      cachedAt:  Date.now(),
      conceptId,
      level,
      examType,
    })
  } catch {
    // Cache write failure is non-fatal
  }

  return res.json({ questions: normalizedQuestions, cached: false })
}
