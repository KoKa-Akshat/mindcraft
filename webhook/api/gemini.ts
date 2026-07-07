/**
 * api/gemini.ts
 *
 * Unified student-path endpoint. Name kept for backwards-compat.
 * Dispatches by presence of stripe-signature header OR action/product field.
 *
 * POST (stripe-signature header) → Stripe webhook handler
 * POST { action: 'diagnose', ... }           → Gap diagnosis
 * POST { action: 'readiness-copy', ... }     → Readiness statement copy
 * POST { product: 'session'|'monthly', ... } → Create Stripe checkout
 * POST { prompt: string }                    → Claude Haiku proxy (legacy)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import Stripe from 'stripe'
import { db } from '../lib/firebase'
import { randomUUID } from 'crypto'

const ALLOWED_ORIGIN = 'https://mindcraft-93858.web.app'
const APP_BASE       = 'https://mindcraft-93858.web.app'
const anthropic      = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
})

const PRICE_SESSION = process.env.STRIPE_PRICE_SESSION ?? ''
const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY ?? ''
const SESSION_TTL   = 48 * 60 * 60 * 1000
const MONTHLY_TTL   = 32 * 24 * 60 * 60 * 1000

// ── Exam blueprints ───────────────────────────────────────────────────────────

const EXAM_BLUEPRINTS: Record<string, Record<string, number>> = {
  SAT_MATH: {
    'Heart of Algebra':            35,
    'Problem Solving & Data':      29,
    'Passport to Advanced Math':   28,
    'Additional Topics in Math':    8,
  },
  ACT_MATH: {
    'Preparing for Higher Math':   60,
    'Number & Quantity':            8,
    'Algebra':                     12,
    'Functions':                   12,
    'Geometry':                    12,
    'Statistics & Probability':    16,
    'Integrating Essential Skills': 40,
  },
  IB_MATH_AA: {
    'Number & Algebra':            16,
    'Functions':                   20,
    'Geometry & Trigonometry':     18,
    'Statistics & Probability':    18,
    'Calculus':                    28,
  },
  IB_MATH_AI: {
    'Number & Algebra':            16,
    'Functions':                   18,
    'Geometry & Trigonometry':     18,
    'Statistics & Probability':    30,
    'Calculus':                    18,
  },
  AP_CALC_AB: {
    'Limits & Continuity':         10,
    'Differentiation: Definition': 10,
    'Differentiation: Composite':  15,
    'Contextual Applications':     10,
    'Analytical Applications':     15,
    'Integration & Accumulation':  17,
    'Differential Equations':      11,
    'Applications of Integration': 12,
  },
}

const EXAM_CONTEXT: Record<string, string> = {
  SAT_MATH:   'Digital SAT Math — College Board. 44 questions, 70 minutes.',
  ACT_MATH:   'ACT Mathematics — 60 questions, 60 minutes.',
  IB_MATH_AA: 'IB Mathematics: Analysis & Approaches SL/HL.',
  IB_MATH_AI: 'IB Mathematics: Applications & Interpretation SL/HL.',
  AP_CALC_AB: 'AP Calculus AB.',
}

const EXAM_LABEL: Record<string, string> = {
  SAT_MATH:   'SAT Math',
  ACT_MATH:   'ACT Math',
  IB_MATH_AA: 'IB Math AA',
  IB_MATH_AI: 'IB Math AI',
  AP_CALC_AB: 'AP Calc AB',
}

type ExamType = 'SAT_MATH' | 'ACT_MATH' | 'IB_MATH_AA' | 'IB_MATH_AI' | 'AP_CALC_AB'

interface Gap {
  conceptId:          string
  conceptName:        string
  urgency:            'critical' | 'moderate' | 'stable'
  studentScore:       number
  examWeight:         number
  brokenPrerequisite: string
  bridgeConcept:      string
  practiceCount:      number
}

function blueprintText(examType: ExamType): string {
  const bp = EXAM_BLUEPRINTS[examType]
  return Object.entries(bp).map(([d, w]) => `  • ${d}: ${w}%`).join('\n')
}

function urgencyFromScore(score: number): 'critical' | 'moderate' | 'stable' {
  if (score < 0.45) return 'critical'
  if (score < 0.72) return 'moderate'
  return 'stable'
}

function practiceCountFromUrgency(u: string): number {
  if (u === 'critical') return 10
  if (u === 'moderate') return 6
  return 3
}

function parseGapsFromJSON(raw: string): Gap[] {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const parsed  = JSON.parse(cleaned)
  const arr: unknown[] = Array.isArray(parsed) ? parsed : parsed.gaps ?? []
  return arr
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
    .map(g => {
      const score   = Math.max(0, Math.min(1, Number(g.studentScore ?? 0.5)))
      const urgency = urgencyFromScore(score)
      return {
        conceptId:          String(g.conceptId ?? 'unknown'),
        conceptName:        String(g.conceptName ?? 'Unknown concept'),
        urgency,
        studentScore:       score,
        examWeight:         Number(g.examWeight ?? 10),
        brokenPrerequisite: String(g.brokenPrerequisite ?? ''),
        bridgeConcept:      String(g.bridgeConcept ?? ''),
        practiceCount:      practiceCountFromUrgency(urgency),
      }
    })
    .sort((a, b) => (b.examWeight * (1 - b.studentScore)) - (a.examWeight * (1 - a.studentScore)))
}

function buildDiagnosisPrompt(examType: ExamType, studentInfo: string, mode: 'triage' | 'foundation' = 'foundation'): string {
  const taskLine = mode === 'triage'
    ? 'TRIAGE MODE — exam is in ≤4 days. Identify the 3–5 highest-impact gaps (examWeight × difficulty). Prioritize deceptive question patterns and common traps over foundational repair.'
    : 'FOUNDATION MODE — identify 3–7 learning gaps, starting from prerequisite breaks.'

  return `You are an expert ${EXAM_CONTEXT[examType]} diagnostic engine.

EXAM BLUEPRINT:
${blueprintText(examType)}

STUDENT INPUT:
${studentInfo}

TASK: ${taskLine}
For each gap:
1. studentScore (0.0–1.0) from evidence only
2. examWeight from the blueprint
3. brokenPrerequisite — the single upstream concept causing the gap
4. bridgeConcept — something they DO understand to anchor new learning

LANGUAGE RULES: Never use weak, bad, failed, not ready, low ability.
Use: open gap, still forming, needs repair, not yet stable.

OUTPUT: Valid JSON array only. No markdown, no preamble.
[{"conceptId":"snake_case","conceptName":"Human name","studentScore":0.0,"examWeight":15,"brokenPrerequisite":"upstream concept","bridgeConcept":"anchor concept"}]

If evidence is sparse, wrap as: {"gaps":[...],"diagnosisConfidence":"low"}`
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  // ── Stripe webhook ────────────────────────────────────────────────────────────
  if (req.headers['stripe-signature']) {
    const sig    = req.headers['stripe-signature'] as string
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? ''
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret)
    } catch {
      return res.status(400).json({ error: 'Invalid signature' })
    }
    if (event.type === 'checkout.session.completed') {
      const session   = event.data.object as Stripe.Checkout.Session
      const studentId = session.metadata?.studentId
      const product   = session.metadata?.product ?? 'session'
      if (studentId) {
        const expiresAt = Date.now() + (product === 'monthly' ? MONTHLY_TTL : SESSION_TTL)
        try {
          await db.collection('users').doc(studentId).collection('payments').doc(session.id)
            .set({ sessionId: session.id, product, createdAt: Date.now(), expiresAt, amount: session.amount_total ?? 0 })
        } catch {
          return res.status(500).json({ error: 'Firestore write failed' })
        }
      }
    }
    return res.json({ received: true })
  }

  const body    = req.body as Record<string, unknown>
  const action  = body.action  as string | undefined
  const product = body.product as string | undefined

  // Abuse guard: cap free-text fields before they reach any model call.
  for (const key of ['textDescription', 'problem_text', 'problemText'] as const) {
    const v = body[key]
    if (typeof v === 'string' && v.length > 4000) body[key] = v.slice(0, 4000)
  }

  // ── Diagnose ──────────────────────────────────────────────────────────────────
  if (action === 'diagnose') {
    const { examType, inputType, fileBase64, fileMimeType, textDescription, confidenceMap, studentId, timeToExam } = body as {
      examType:         ExamType
      inputType:        'file' | 'text' | 'confidence_scan'
      fileBase64?:      string
      fileMimeType?:    string
      textDescription?: string
      confidenceMap?:   Record<string, 'easy' | 'kinda' | 'hard'>
      studentId?:       string
      timeToExam?:      number
    }

    const mode: 'triage' | 'foundation' = (timeToExam ?? 7) <= 4 ? 'triage' : 'foundation'

    if (!examType || !EXAM_BLUEPRINTS[examType]) return res.status(400).json({ error: 'Invalid examType' })
    if (!inputType) return res.status(400).json({ error: 'inputType is required' })

    try {
      let diagnosisRaw: string
      let confidence: 'high' | 'medium' | 'low' = 'medium'

      if (inputType === 'file' && fileBase64 && fileMimeType) {
        const mediaType = fileMimeType.startsWith('image/')
          ? (fileMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
          : 'image/jpeg'
        const ext = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } },
            { type: 'text', text: `Extract every problem, the student's work, and any scoring. Output plain text.` },
          ]}],
        })
        const extracted = ext.content[0]?.type === 'text' ? ext.content[0].text : ''
        confidence = 'high'
        const diag = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514', max_tokens: 2048,
          messages: [{ role: 'user', content: buildDiagnosisPrompt(examType, `Extracted from uploaded test:\n\n${extracted}`, mode) }],
        })
        diagnosisRaw = diag.content[0]?.type === 'text' ? diag.content[0].text : '[]'

      } else if (inputType === 'text' && textDescription) {
        const diag = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514', max_tokens: 2048,
          messages: [{ role: 'user', content: buildDiagnosisPrompt(examType, `Student's self-description:\n\n${textDescription}`, mode) }],
        })
        diagnosisRaw = diag.content[0]?.type === 'text' ? diag.content[0].text : '[]'

      } else if (inputType === 'confidence_scan' && confidenceMap) {
        const mapText = Object.entries(confidenceMap).map(([t, l]) => `  ${t}: ${l}`).join('\n')
        const diag = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514', max_tokens: 2048,
          messages: [{ role: 'user', content: buildDiagnosisPrompt(examType, `Student self-reported confidence:\n\n${mapText}`, mode) }],
        })
        diagnosisRaw = diag.content[0]?.type === 'text' ? diag.content[0].text : '[]'

      } else {
        return res.status(400).json({ error: 'Provide fileBase64, textDescription, or confidenceMap' })
      }

      let gaps: Gap[]
      try { gaps = parseGapsFromJSON(diagnosisRaw) }
      catch { return res.status(500).json({ error: 'Model returned unparseable JSON', raw: diagnosisRaw.slice(0, 200) }) }
      if (gaps.length === 0) return res.status(500).json({ error: 'No gaps identified' })

      const sessionId = randomUUID()
      try {
        await db.collection('sessions').doc(sessionId).set({
          sessionId, examType, mode, gaps, diagnosisConfidence: confidence,
          status: 'in_progress', createdAt: Date.now(), studentId: studentId ?? null,
          currentGap: gaps[0].conceptId, questionsAnswered: 0,
        })
        if (studentId) {
          await db.collection('users').doc(studentId).collection('prepSessions').doc(sessionId)
            .set({ sessionId, examType, createdAt: Date.now(), status: 'in_progress' })
        }
      } catch { /* non-fatal */ }

      return res.json({ gaps, sessionId, examType, mode, diagnosisConfidence: confidence })

    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Diagnosis failed' })
    }
  }

  // ── Readiness copy ────────────────────────────────────────────────────────────
  if (action === 'readiness-copy') {
    const { examType, readinessPct, gaps, calibration } = body as {
      examType:     string
      readinessPct: number
      gaps:         { conceptName: string; urgency: string; studentScore: number; examWeight: number }[]
      calibration?: { conceptName: string; perceived: number; actual: number | null; delta: number | null }[]
    }
    const exam      = EXAM_LABEL[examType] ?? examType
    const stable    = gaps.filter(g => g.urgency === 'stable').map(g => g.conceptName)
    const stillOpen = gaps.filter(g => g.urgency !== 'stable').map(g => g.conceptName)

    const calibrationText = calibration && calibration.length > 0
      ? `\nCalibration (felt vs actual):\n${calibration.map(c => `  ${c.conceptName}: felt ${c.perceived}%, actual ${c.actual ?? '?'}%${c.delta != null ? ` (${c.delta > 0 ? '+' : ''}${c.delta})` : ''}`).join('\n')}`
      : ''

    const copyPrompt = `You are a MindCraft coach writing a 2–3 sentence readiness statement for a student who just completed a ${exam} prep session.

Readiness: ${readinessPct}%
Stabilized: ${stable.join(', ') || 'none yet'}
Still open: ${stillOpen.join(', ') || 'none'}${calibrationText}

RULES: Never say weak, bad, failed, not ready. Use: open gap, still forming, stabilized, building, closing.
If calibration is included: note whether the student over- or under-estimated themselves on any concept — make it honest, not harsh.
Tone: direct, honest, respectful. No emojis. No "Great job!". Write ONLY the 2–3 sentence statement.`

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 200,
        messages: [{ role: 'user', content: copyPrompt }],
      })
      return res.json({ copy: msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '' })
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Copy generation failed' })
    }
  }

  // ── Create Stripe checkout ────────────────────────────────────────────────────
  if (product === 'session' || product === 'monthly') {
    const { studentId } = body as { studentId?: string }
    const priceId = product === 'monthly' ? PRICE_MONTHLY : PRICE_SESSION
    if (!priceId) return res.status(500).json({ error: 'Stripe price not configured' })
    try {
      const session = await stripe.checkout.sessions.create({
        mode:                 product === 'monthly' ? 'subscription' : 'payment',
        payment_method_types: ['card'],
        line_items:           [{ price: priceId, quantity: 1 }],
        success_url:          `${APP_BASE}/prep?payment=success`,
        cancel_url:           `${APP_BASE}/prep`,
        metadata:             { studentId: studentId ?? '', product },
      })
      return res.json({ url: session.url })
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Checkout failed' })
    }
  }

  return res.status(400).json({ error: 'Unknown action' })
}
