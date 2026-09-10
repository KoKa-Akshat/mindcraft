/**
 * lib/simTrainingEvents.ts
 *
 * PR1 of the live-sim -> training-data plan: every generation attempt that
 * reaches a terminal verdict (gate-passed AND gate-failed — failures are
 * the majority outcome and until now were persisted nowhere) becomes one
 * durable, provenance-tagged doc in the `sim_training_events` Firestore
 * collection.
 *
 * DELIBERATELY a separate collection from `generated_sims`: that one is a
 * topic-keyed serving cache with overwrite-on-set semantics (correct for
 * serving — the newest gate-passed result for a topic wins), which is
 * exactly wrong for training provenance, where every attempt and its
 * scores must survive as history. The nightly export job (PR2) reads this
 * collection ordered by `createdAt`, which is why createdAt is ALWAYS
 * FieldValue.serverTimestamp() — server-authoritative, never a
 * client-supplied ISO string a clock-skewed function could scramble the
 * export watermark with.
 *
 * PRIVACY INVARIANT (hard requirement from the approved plan, not style):
 * no `uid` and no student-identifying data of any kind is ever written
 * here. These functions never even receive a uid — the doc describes what
 * the pipeline produced for a topic, not who asked. Enforced by
 * scripts/test-sim-training-events.ts against the actual written payloads.
 *
 * Idempotency: doc IDs are deterministic — `jobId` for a standalone sim,
 * `{jobId}_{conceptSlug}` per sim on the book path — and writes go through
 * `.set()`, so a repeat poll of the same finished job rewrites the SAME
 * doc instead of duplicating it.
 *
 * Like generatedSimContract.ts, the builders here are pure (no ../firebase
 * import, no credentials) so they can be exercised in a local harness; the
 * only firebase-admin dependency is the FieldValue sentinel, which needs
 * no initialized app. Callers pass the real `db` in.
 */

import { FieldValue } from 'firebase-admin/firestore'
import { ServiceJobPayload, slugifyTopic } from './generatedSimContract'

export const SIM_TRAINING_EVENTS_COLLECTION = 'sim_training_events'

/** What the engine reports today (serve.py PROMPT_TEMPLATE_VERSION). Used
 * only as a fallback for payloads from an engine deploy that predates the
 * field — which IS v1, so the fallback is accurate, not a guess. */
const PROMPT_TEMPLATE_VERSION_FALLBACK = 'v1'

/** serve.py's ApiGenerator default — the fallback for older payloads that
 * don't echo generator_model. Matches the model string the engine actually
 * bills against (see simulation_generator.py ApiGenerator.__init__). */
const GENERATOR_MODEL_FALLBACK = 'claude-sonnet-5'

/** The additive terminal-payload fields serve.py reports since PR1, on top
 * of the pre-existing ServiceJobPayload contract. */
export interface ServiceJobPayloadPR1 extends ServiceJobPayload {
  fail_stage?: string
  rubric_percentage?: number
  prompt_template_version?: string
  generator_model?: string
  /** Book jobs only — the engine's flat spend estimate (no real per-call
   * token usage exists on that path; see generate-book.ts header). */
  estimated_cost_usd?: number
  result?: NonNullable<ServiceJobPayload['result']> & {
    lesson_plan?: string | null
    references?: string[]
    prompt_template_version?: string
    generator_model?: string
    generated_sims?: EngineBookSimEntry[]
    failed_sims?: EngineBookSimEntry[]
  }
}

/** One entry of the book path's result.generated_sims / result.failed_sims
 * (serve.py `_maybe_generate_sim`'s outcome dict). */
export interface EngineBookSimEntry {
  passed?: boolean
  concept_id?: string
  concept_slug?: string
  concept_label?: string
  subject_id?: string
  title?: string
  description?: string
  learning_objectives?: string[]
  lesson_plan?: string | null
  references?: string[]
  html?: string
  js?: string
  rubric_percentage?: number
  quality_gate_score?: number
  fail_stage?: string
  fail_reason?: string
  generator_model?: string
}

/** Minimal structural view of Firestore — what capture actually needs. The
 * real `db` satisfies it; a test harness can hand in a fake and assert on
 * the exact payloads that would hit the wire. */
export interface TrainingEventDb {
  collection(name: string): {
    doc(id: string): { set(data: Record<string, unknown>): Promise<unknown> }
  }
}

export interface TrainingEventDoc {
  docId: string
  data: Record<string, unknown>
}

const VALID_FAIL_STAGES = new Set(['fit_check', 'render', 'rubric', 'vision_gate'])

/** Older engine payloads carry only `phase`; map it to the failStage vocab
 * so pre-PR1 failures polled against a not-yet-redeployed engine still get
 * an honest (if coarser) stage. `scoring` covered both render and rubric
 * fails pre-PR1 — rubric is the overwhelmingly more common of the two. */
function failStageFromPhase(phase: unknown): string | null {
  const p = String(phase ?? '')
  if (p === 'fit_check') return 'fit_check'
  if (p === 'rendering') return 'render'
  if (p === 'scoring') return 'rubric'
  if (p === 'vision_gate') return 'vision_gate'
  return null
}

/** NUL bytes stripped (Firestore rejects them — same defense as
 * generatedSimContract.clip), but deliberately NO truncation: html/js/
 * lesson plans ARE the training payload, clipping them would corrupt it. */
function str(value: unknown): string {
  return String(value ?? '').split(String.fromCharCode(0)).join('')
}

function strOrNull(value: unknown): string | null {
  const s = str(value)
  return s ? s : null
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => str(v)).filter(Boolean) : []
}

function usageOrNull(usage: ServiceJobPayload['usage']): Record<string, number> | null {
  if (!usage) return null
  return {
    inputTokens: Number(usage.input_tokens) || 0,
    outputTokens: Number(usage.output_tokens) || 0,
  }
}

/**
 * Standalone /api/generate-sim path: one terminal poll payload -> one doc,
 * keyed by jobId. Returns null for non-capturable statuses (running polls,
 * and `error` — an infra crash isn't a gate verdict and has no honest
 * failStage in the fit_check|render|rubric|vision_gate vocabulary).
 */
export function buildStandaloneTrainingEvent(
  raw: ServiceJobPayloadPR1,
  jobId: string,
): TrainingEventDoc | null {
  const status = String(raw?.status ?? '')
  if (status !== 'passed' && status !== 'no_good_result') return null

  const topic = str(raw.topic)
  const topicSlug = slugifyTopic(topic)
  const common: Record<string, unknown> = {
    kind: 'standalone',
    topic,
    topicSlug,
    gatePassed: status === 'passed',
    generatorModel: str(raw.generator_model) || GENERATOR_MODEL_FALLBACK,
    promptTemplateVersion: str(raw.prompt_template_version) || PROMPT_TEMPLATE_VERSION_FALLBACK,
    usage: usageOrNull(raw.usage),
    createdAt: FieldValue.serverTimestamp(),
    source: 'live_student_request',
  }

  if (status === 'passed') {
    const r = raw.result
    if (!r) return null // "passed" without a result is the contract violation normalizeJobPayload already downgrades — nothing real to capture
    return {
      docId: jobId,
      data: {
        ...common,
        conceptId: str(r.concept_id) || `student_request::${topicSlug}`,
        conceptLabel: str(r.concept_label) || topic,
        title: str(r.title),
        description: str(r.description),
        learningObjectives: strArray(r.learning_objectives),
        lessonPlan: strOrNull(r.lesson_plan),
        references: strArray(r.references),
        html: str(r.html),
        js: str(r.js),
        rubricPercentage: numOrNull(r.rubric_percentage),
        qualityGateScore: numOrNull(r.quality_gate_score),
        generatorModel: str(r.generator_model) || str(raw.generator_model) || GENERATOR_MODEL_FALLBACK,
      },
    }
  }

  // no_good_result — the fit-check/render/rubric/vision-gate failures that
  // were persisted nowhere before PR1.
  const reported = str(raw.fail_stage)
  const failStage = VALID_FAIL_STAGES.has(reported) ? reported : failStageFromPhase(raw.phase)
  return {
    docId: jobId,
    data: {
      ...common,
      conceptId: `student_request::${topicSlug}`,
      conceptLabel: topic,
      failStage: failStage,
      failReason: str(raw.reason),
      rubricPercentage: numOrNull(raw.rubric_percentage),
    },
  }
}

/**
 * Book /api/generate-book path: one doc PER SIM ATTEMPT from the passed
 * job's result.generated_sims + result.failed_sims, keyed
 * `{jobId}_{conceptSlug}`. (A book job's no_good_result means zero sims
 * were ever attempted — prose gating happens first — so only `passed`
 * payloads carry sim attempts to capture.)
 */
export function buildBookTrainingEvents(
  raw: ServiceJobPayloadPR1,
  jobId: string,
): TrainingEventDoc[] {
  if (String(raw?.status ?? '') !== 'passed' || !raw.result) return []
  const topic = str(raw.topic)
  const topicSlug = slugifyTopic(topic)
  const promptTemplateVersion =
    str(raw.result.prompt_template_version) || str(raw.prompt_template_version) || PROMPT_TEMPLATE_VERSION_FALLBACK
  const generated = Array.isArray(raw.result.generated_sims) ? raw.result.generated_sims : []
  const failed = Array.isArray(raw.result.failed_sims) ? raw.result.failed_sims : []

  const docs: TrainingEventDoc[] = []
  for (const entry of [...generated, ...failed]) {
    const passed = entry.passed === true
    const conceptSlug = str(entry.concept_slug) || slugifyTopic(str(entry.concept_label))
    const data: Record<string, unknown> = {
      kind: 'book_section',
      topic,
      topicSlug,
      subjectId: str(entry.subject_id) || `on_demand_${topicSlug}`,
      conceptId: str(entry.concept_id) || `student_request::${conceptSlug}`,
      conceptLabel: str(entry.concept_label),
      title: strOrNull(entry.title),
      description: strOrNull(entry.description),
      learningObjectives: strArray(entry.learning_objectives),
      lessonPlan: strOrNull(entry.lesson_plan),
      references: strArray(entry.references),
      html: strOrNull(entry.html),
      js: strOrNull(entry.js),
      rubricPercentage: numOrNull(entry.rubric_percentage),
      qualityGateScore: numOrNull(entry.quality_gate_score),
      gatePassed: passed,
      generatorModel: str(entry.generator_model) || GENERATOR_MODEL_FALLBACK,
      promptTemplateVersion,
      // Real per-sim token usage does not exist on the book path (the
      // engine only tracks a flat estimated_cost_usd for the whole job) —
      // null is the honest value, not a zero that looks measured.
      usage: null,
      createdAt: FieldValue.serverTimestamp(),
      source: 'live_student_request',
    }
    if (!passed) {
      const reported = str(entry.fail_stage)
      data.failStage = VALID_FAIL_STAGES.has(reported) ? reported : null
      data.failReason = str(entry.fail_reason)
    }
    docs.push({ docId: `${jobId}_${conceptSlug}`, data })
  }
  return docs
}

/**
 * Backfill builder for one historical `generated_sims` library doc (all of
 * which are gate-passed by construction — that collection only ever stored
 * passes). Kept here rather than inline in the backfill script so the
 * privacy test covers backfilled docs with the same rigor as live ones.
 * Book-path history is NOT reconstructable (it was never stored per-sim,
 * only inlined into assembled_books) — a known, accepted gap.
 */
export function buildBackfillTrainingEvent(
  librarySnapshotId: string,
  libraryDoc: Record<string, unknown>,
): TrainingEventDoc | null {
  const html = str(libraryDoc.html)
  if (!html) return null
  const topic = str(libraryDoc.topic)
  const topicSlug = str(libraryDoc.topicSlug) || librarySnapshotId
  const jobId = str(libraryDoc.jobId)
  return {
    // Same ID a live capture of that job would have used, so if the live
    // writer already recorded it, backfill converges on the same doc
    // instead of duplicating it.
    docId: jobId || `backfill_${topicSlug}`,
    data: {
      kind: 'standalone',
      topic,
      topicSlug,
      conceptId: str(libraryDoc.conceptId) || `student_request::${topicSlug}`,
      conceptLabel: str(libraryDoc.conceptLabel) || topic,
      title: str(libraryDoc.title),
      description: str(libraryDoc.description),
      learningObjectives: strArray(libraryDoc.learningObjectives),
      // Not recoverable from the serving cache: it stored neither of these
      // (that omission is exactly what PR1 fixes at the source), and js was
      // already inlined into html before persisting. Null over guessing.
      lessonPlan: null,
      references: [],
      html,
      js: null,
      rubricPercentage: numOrNull(libraryDoc.rubricPercentage),
      qualityGateScore: numOrNull(libraryDoc.qualityGateScore),
      gatePassed: true,
      generatorModel: GENERATOR_MODEL_FALLBACK,
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION_FALLBACK,
      usage: null,
      createdAt: FieldValue.serverTimestamp(),
      // These WERE live student requests — backfilledFrom marks the
      // capture path honestly without inventing a new source vocabulary.
      source: 'live_student_request',
      backfilledFrom: 'generated_sims',
      originalCreatedAt: strOrNull(libraryDoc.createdAt),
    },
  }
}

/**
 * Writes the docs. Callers fire-and-forget with .catch(console.error) —
 * the same discipline recordActualSpend already established: a capture
 * failure is logged and must never fail or delay the student's response.
 */
export async function captureSimTrainingEvents(
  db: TrainingEventDb,
  docs: TrainingEventDoc[],
): Promise<void> {
  for (const d of docs) {
    // .set(), never .add(): deterministic IDs make repeat polls rewrite
    // the same doc — the idempotency contract of this collection.
    await db.collection(SIM_TRAINING_EVENTS_COLLECTION).doc(d.docId).set(d.data)
  }
}
