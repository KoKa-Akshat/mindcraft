/**
 * mlApi.ts — typed client for the MindCraft ML server.
 *
 * The ML_BASE env var points at the running FastAPI instance.
 * In development this is http://localhost:8000.
 * In production it will be the Cloud Run URL.
 */

import { auth } from '../firebase'

export const ML_BASE =
  import.meta.env.VITE_ML_API_URL ??
  import.meta.env.VITE_ML_URL ??
  'http://localhost:8000'

/**
 * Headers for an ML API call, carrying the signed-in user's Firebase ID token
 * as `Authorization: Bearer <token>` so serve.py can verify the caller and
 * enforce that they only touch their own student_id. Merge in any extras
 * (e.g. Content-Type) via the argument.
 */
export async function mlAuthHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra }
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ConceptRecommendation {
  conceptId: string
  reason: string
  positionInChain: number | null
  isSupplement: boolean
  supplementFor: string | null
  alignmentScore: number | null
  pcaProfile: Record<string, number>
  // Gap fields (present only when isBridgeGap). gapType: "concept" (cross-concept
  // bridge) | "format" (vessel). For format gaps, bridgeFromConcept is the
  // format_id and bridgeToConcept is the anchor concept.
  isBridgeGap?: boolean
  gapType?: 'concept' | 'format' | null
  bridgeId?: string | null
  bridgeFromConcept?: string | null
  bridgeToConcept?: string | null
  bridgeEvidence?: 'evidence' | 'hypothesis' | null
  /** C1 — gap severity in [0,1]; higher = worse. Agent A produces; B falls back to 1−mastery. */
  severity?: number
}

export interface StudentProfile {
  masteryProjection: Record<string, number>
  strengthProjection: Record<string, number>
  displacementMagnitude: number
  displacementDirection: Record<string, number>
  topStrengths: Array<{ conceptId: string; strength: number }>
  topWeaknesses: Array<{ conceptId: string; strength: number }>
}

/** Tier-3 weak spot from `/recommend` misconceptionGaps[] (EXTENSION_RECOMMEND §5.1). */
export interface MisconceptionGap {
  conceptId: string
  misconceptionId: string
  severity: number
  ingredientId?: string | null
  /** Legacy server field — first linked ingredient when singular id absent. */
  ingredientIds?: string[]
  distractorChoiceIndex?: number
  personalHitRate?: number
  populationHitRate?: number
  nObservations?: number
  /** Legacy server field before E1 contract shipped. */
  hits?: number
}

export interface RecommendResult {
  mode: string
  targetConcepts: string[]
  canonicalChain: string[]
  recommendations: ConceptRecommendation[]
  studentProfile: StudentProfile
  misconceptionGaps?: MisconceptionGap[]
}

export interface PracticeCard {
  cardTemplateId: string
  targetType: 'ingredient' | 'bridge'
  targetId: string
  representationKey: string
  title: string
  body: string
  prompt: string
  needScore: number
  reason: string
}

export interface IngredientRecommendResult {
  studentId: string
  problemText: string
  problemFeatures: {
    primary_concept: string
    secondary_concepts: string[]
    features: string[]
  }
  cards: PracticeCard[]
  compositionPrompt: string
}

export interface SubmitAnswerResult {
  studentId: string
  targetType: string
  targetId: string
  studentSucceeded: boolean
  updatedConceptMastery: Record<string, number>
  styleScores: Record<string, number>
}

export interface StudentProfileResult {
  studentId: string
  eventCount: number
  masteryByConcept: Record<string, number>
  topStrengths: Array<{ conceptId: string; strength: number }>
  topWeaknesses: Array<{ conceptId: string; strength: number }>
}

export interface CheckWorkLineRule {
  id: string
  label: string
  ingredientIds?: string[]
}

export interface CheckWorkResult {
  firstBrokenLine: number | null
  verdictPerLine: Array<{
    line: number
    latex: string
    normalized: string
    verdict: 'ok' | 'wrong' | 'unparsed'
    reason: string
    rule?: CheckWorkLineRule
  }>
  hypothesis?: {
    misconception_id: string
    label: string
  } | null
}

export interface WorkEvidenceStep {
  rule_id?: string | null
  verdict: 'ok' | 'wrong'
  rule?: {
    id: string
    label?: string | null
    ingredientIds?: string[]
  } | null
}

export interface RecordWorkEvidenceRequest {
  student_id: string
  question_id: string
  concept_id: string
  steps: WorkEvidenceStep[]
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function getRecommendations(
  studentId: string,
  targetConcepts: string[],
  mode: 'curriculum' | 'exam' | 'explore' = 'curriculum',
  exam?: string | null,
  excludedConcepts?: string[],
): Promise<RecommendResult | null> {
  try {
    const res = await fetch(`${ML_BASE}/recommend`, {
      method: 'POST',
      headers: await mlAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        student_id: studentId,
        target_concepts: targetConcepts,
        mode,
        ...(exam ? { exam } : {}),
        ...(excludedConcepts?.length ? { excluded_concepts: excludedConcepts } : {}),
      }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/** Exam-track concept ids from Layer 1 act_relevance.tested (ACT). */
export async function fetchExamConceptIds(exam: string): Promise<string[]> {
  try {
    const res = await fetch(`${ML_BASE}/exam-concepts/${encodeURIComponent(exam)}`)
    if (!res.ok) return []
    const data = await res.json() as { conceptIds?: string[] }
    return data.conceptIds ?? []
  } catch {
    return []
  }
}

export async function getIngredientCards(
  studentId: string,
  problemText: string,
  maxCards = 4,
): Promise<IngredientRecommendResult | null> {
  try {
    const res = await fetch(`${ML_BASE}/recommend-ingredients`, {
      method: 'POST',
      headers: await mlAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ student_id: studentId, problem_text: problemText, max_cards: maxCards }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function submitAnswer(
  studentId: string,
  cardTemplateId: string,
  targetType: 'ingredient' | 'bridge',
  targetId: string,
  representationKey: string,
  studentSucceeded: boolean,
): Promise<SubmitAnswerResult | null> {
  try {
    const res = await fetch(`${ML_BASE}/submit-answer`, {
      method: 'POST',
      headers: await mlAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        student_id: studentId,
        card_template_id: cardTemplateId,
        target_type: targetType,
        target_id: targetId,
        representation_key: representationKey,
        student_succeeded: studentSucceeded,
      }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function processSummary(
  studentId: string,
  bullets: string[],
  topics: string[],
  durationMinutes = 45,
): Promise<{ eventsCreated: number; conceptsDetected: string[] } | null> {
  try {
    const res = await fetch(`${ML_BASE}/process-summary`, {
      method: 'POST',
      headers: await mlAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        student_id: studentId,
        bullets,
        topics,
        duration_minutes: durationMinutes,
      }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/**
 * Seed the concept graph from the onboarding "gap scan" (per-concept confidence)
 * so a brand-new student gets personalized recommendations before their first
 * session. Idempotent server-side — re-onboarding overwrites the prior seed.
 */
export async function seedAssessment(
  studentId: string,
  assessment: Record<string, 'hard' | 'kinda' | 'easy'>,
): Promise<{ seededConcepts: string[]; skippedConcepts: string[]; eventsCreated: number } | null> {
  try {
    const res = await fetch(`${ML_BASE}/seed-assessment`, {
      method: 'POST',
      headers: await mlAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ student_id: studentId, assessment }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/**
 * Record practice/homework outcomes into the concept graph so mastery moves as
 * the student answers problems. Events accumulate (this is the practice → graph
 * feedback loop). Unknown concept IDs are skipped server-side.
 */
export interface OutcomeInput {
  conceptId: string
  // Per-question substrate. score = raw pass rate [0,1] (single question = 1/0).
  // formatId = canonical representation/vessel id (omit if untagged). succeeded
  // is the deprecated fallback kept for callers not yet sending score.
  score?: number
  formatId?: string
  level?: 1 | 2 | 3
  questionId?: string
  succeeded?: boolean
  selectedChoiceIndex?: number
  misconceptionId?: string
  errorType?: string
}

export async function recordOutcomes(
  studentId: string,
  outcomes: OutcomeInput[],
): Promise<{ recordedConcepts: string[]; skippedConcepts: string[]; eventsCreated: number } | null> {
  if (!outcomes.length) return null
  try {
    const res = await fetch(`${ML_BASE}/record-outcomes`, {
      method: 'POST',
      headers: await mlAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        student_id: studentId,
        outcomes: outcomes.map(o => ({
          concept_id: o.conceptId,
          score: o.score,
          format_id: o.formatId,
          level: o.level,
          question_id: o.questionId,
          succeeded: o.succeeded,
          selected_choice_index: o.selectedChoiceIndex,
          misconception_id: o.misconceptionId,
          error_type: o.errorType,
        })),
      }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function getStudentProfile(
  studentId: string,
): Promise<StudentProfileResult | null> {
  try {
    const res = await fetch(`${ML_BASE}/student-profile/${studentId}`, {
      headers: await mlAuthHeaders(),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function checkWork(
  studentId: string,
  lines: Array<{ latex: string }>,
  problemText?: string,
): Promise<CheckWorkResult | null> {
  if (lines.length < 2) return null
  try {
    const res = await fetch(`${ML_BASE}/check-work`, {
      method: 'POST',
      headers: await mlAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        student_id: studentId,
        problem_text: problemText ?? null,
        lines,
      }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function recordWorkEvidence(req: RecordWorkEvidenceRequest): Promise<boolean> {
  if (!req.steps.length) return false
  try {
    const res = await fetch(`${ML_BASE}/record-work-evidence`, {
      method: 'POST',
      headers: await mlAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(req),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Learning events (diagnostic kickstart) ──────────────────────────────────

export interface LearningEventInput {
  studentId: string
  subjectId: string
  conceptId: string
  eventType:
    | 'confidence_report'
    | 'answer_submitted'
    | 'correct_answer'
    | 'wrong_answer'
    | 'diagnostic_complete'
  outcome?: number | null
  durationMs?: number
  source?: string
  metadata?: Record<string, unknown>
}

/**
 * Emit a single learning event to the engine. This is the ingestion point that
 * starts building the student's knowledge graph from their first diagnostic.
 * Non-blocking: returns true/false, never throws.
 */
/**
 * @deprecated Orphan endpoint — no handler in serve.py. Diagnostic.tsx now uses
 * /seed-assessment + /record-outcomes. Left for legacy world2 mc-diagnostic.js.
 */
export async function sendLearningEvent(ev: LearningEventInput): Promise<boolean> {
  try {
    const res = await fetch(`${ML_BASE}/learning-event`, {
      method: 'POST',
      headers: await mlAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        student_id: ev.studentId,
        subject_id: ev.subjectId,
        concept_id: ev.conceptId,
        event_type: ev.eventType,
        outcome: ev.outcome ?? null,
        duration_ms: ev.durationMs ?? null,
        source: ev.source ?? 'diagnostic',
        metadata: ev.metadata ?? {},
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Pretty-print a concept_id like "quadratic_equations" → "Quadratic Equations" */
export function conceptLabel(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Agent check-in ─────────────────────────────────────────────────────────

export const WEBHOOK_BASE =
  import.meta.env.VITE_WEBHOOK_URL ?? 'https://mindcraft-webhook.vercel.app'

export interface AffectiveState {
  stress: number
  motivation: number
  confidence_by_concept: Record<string, number>
  explicit_struggles: string[]
  captured_at: number
}

/**
 * Optional pre-session check-in. Student writes 2–3 sentences; Claude Haiku
 * extracts stress/motivation/struggles and stores them in Firestore so the
 * next /recommend call can adjust weights and difficulty automatically.
 * Fire-and-forget — never throws, returns null on failure.
 */
export async function agentCheckIn(
  studentId: string,
  text: string,
): Promise<AffectiveState | null> {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return null
    const res = await fetch(`${WEBHOOK_BASE}/api/agent-check-in`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ student_id: studentId, text }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
