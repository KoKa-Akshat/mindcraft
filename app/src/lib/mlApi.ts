/**
 * mlApi.ts — typed client for the MindCraft ML server.
 *
 * The ML_BASE env var points at the running FastAPI instance.
 * In development this is http://localhost:8000.
 * In production it will be the Cloud Run URL.
 */

export const ML_BASE =
  import.meta.env.VITE_ML_API_URL ??
  import.meta.env.VITE_ML_URL ??
  'http://localhost:8000'

// ── Types ─────────────────────────────────────────────────────────────────

export interface ConceptRecommendation {
  conceptId: string
  reason: string
  positionInChain: number | null
  isSupplement: boolean
  supplementFor: string | null
  alignmentScore: number | null
  pcaProfile: Record<string, number>
}

export interface StudentProfile {
  masteryProjection: Record<string, number>
  strengthProjection: Record<string, number>
  displacementMagnitude: number
  displacementDirection: Record<string, number>
  topStrengths: Array<{ conceptId: string; strength: number }>
  topWeaknesses: Array<{ conceptId: string; strength: number }>
}

export interface RecommendResult {
  mode: string
  targetConcepts: string[]
  canonicalChain: string[]
  recommendations: ConceptRecommendation[]
  studentProfile: StudentProfile
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

// ── API calls ──────────────────────────────────────────────────────────────

export async function getRecommendations(
  studentId: string,
  targetConcepts: string[],
  mode: 'curriculum' | 'exam' | 'explore' = 'curriculum',
): Promise<RecommendResult | null> {
  try {
    const res = await fetch(`${ML_BASE}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, target_concepts: targetConcepts, mode }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
export async function recordOutcomes(
  studentId: string,
  outcomes: { conceptId: string; succeeded: boolean }[],
): Promise<{ recordedConcepts: string[]; skippedConcepts: string[]; eventsCreated: number } | null> {
  if (!outcomes.length) return null
  try {
    const res = await fetch(`${ML_BASE}/record-outcomes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        outcomes: outcomes.map(o => ({ concept_id: o.conceptId, succeeded: o.succeeded })),
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
    const res = await fetch(`${ML_BASE}/student-profile/${studentId}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
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
export async function sendLearningEvent(ev: LearningEventInput): Promise<boolean> {
  try {
    const res = await fetch(`${ML_BASE}/learning-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
