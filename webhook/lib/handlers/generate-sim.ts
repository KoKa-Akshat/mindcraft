/**
 * POST /api/generate-sim
 *
 * Live, gated MicroSim generation proxy (LIVE_GATED_GENERATION_TEST_SPEC.md).
 * A student asks for a topic; the mindcraft-content-engine pipeline runs it
 * through fit-check -> generate -> headless render -> structural rubric ->
 * visual/pedagogical vision gate, and NOTHING is shown until the full gate
 * clears. The pipeline stays Python in its own service (porting the
 * render/rubric/vision logic to TS would drift from the validated version);
 * this handler's job is: receive the request, enforce the per-student cost
 * cap, check the reuse library, relay to the service, normalize the verdict.
 *
 * Routed through app-actions (Hobby function cap). Requires a Firebase ID
 * token — unlike most handlers here, this one can spend real money per
 * call, so the student identity behind the budget check is the verified
 * uid, never a client-supplied id.
 *
 * LIVE as of 2026-08-19: Blake is looped in, the generation service is
 * deployed (https://joinmindcraft-mindcraft-content-engine.hf.space,
 * verified with two real end-to-end generations, both gate-passed), and
 * CONTENT_ENGINE_URL / CONTENT_ENGINE_SECRET are set in Vercel — do NOT
 * read this file's history as "still off," check `vercel env ls
 * production` for the real current state before trusting a comment here.
 * CONTENT_ENGINE_URL / CONTENT_ENGINE_SECRET (same env-var shape as
 * ML_API_URL / ML_SERVICE_SECRET, see jarvisTools.ts / ingest-lesson-graph)
 * still have NO *default* baked into the code — the off-switch is that an
 * unset env var answers an honest 503 "unavailable," not a special flag —
 * so if this service is ever un-deployed or the vars removed, this
 * handler safely goes quiet again with no code change needed.
 *
 * Two request shapes, one action (generation is genuinely async — 15-60+s
 * per attempt — so the client polls a job rather than blocking):
 *   { topic, studentGeminiKey? } -> start: library check -> budget check
 *                 (SKIPPED when studentGeminiKey is present, see below) ->
 *                 enqueue on the service -> { status: "running", jobId }
 *   { jobId }  -> poll: relay the service's verdict; on a gate-passed
 *                 terminal result, persist it to the generated_sims
 *                 library so the next student asking about the same topic
 *                 reuses it instead of paying for regeneration.
 *
 * BYOK (2026-08-25): when the iOS client sends the student's own saved
 * Gemini key (StudentAIKeyStore), it's forwarded to content-engine's
 * /generate as student_gemini_key and the platform budget checks are
 * skipped for the START of the job — the expensive fit_check + generate
 * calls spend the student's own free quota, not MindCraft's account. This
 * is a partial bypass, not total: vision_gate isn't ported yet and still
 * spends MindCraft's Anthropic key, so recordActualSpend on the terminal
 * poll still runs and still bills the platform budget for that smaller
 * remaining real cost. The key is relayed to content-engine for that one
 * job only — never persisted here, never logged.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { db } from '../firebase'
import {
  GeneratedSimResult,
  normalizeJobPayload,
  slugifyTopic,
} from '../generatedSimContract'
import { checkAndRecordAttempt, checkPlatformBudget, recordActualSpend } from '../generationBudget'
import {
  buildStandaloneTrainingEvent,
  captureSimTrainingEvents,
  ServiceJobPayloadPR1,
} from '../simTrainingEvents'

const CONTENT_ENGINE_BASE = process.env.CONTENT_ENGINE_URL ?? ''
const CONTENT_ENGINE_SECRET = process.env.CONTENT_ENGINE_SECRET ?? ''
const LIBRARY_COLLECTION = 'generated_sims'
const MAX_TOPIC = 200

function serviceConfigured(): boolean {
  return Boolean(CONTENT_ENGINE_BASE && CONTENT_ENGINE_SECRET)
}

/** The library doc IS the client-facing result shape plus bookkeeping —
 * stored post-gate only, so reading one back requires no re-verification. */
async function libraryLookup(topicSlug: string): Promise<GeneratedSimResult | null> {
  const snap = await db.collection(LIBRARY_COLLECTION).doc(topicSlug).get()
  if (!snap.exists) return null
  const data = snap.data() as (GeneratedSimResult & { html?: string }) | undefined
  if (!data?.html) return null
  return {
    title: data.title ?? '',
    description: data.description ?? '',
    html: data.html,
    conceptId: data.conceptId ?? topicSlug,
    conceptLabel: data.conceptLabel ?? '',
    learningObjectives: Array.isArray(data.learningObjectives) ? data.learningObjectives : [],
    rubricPercentage: typeof data.rubricPercentage === 'number' ? data.rubricPercentage : null,
    qualityGateScore: typeof data.qualityGateScore === 'number' ? data.qualityGateScore : null,
    topic: data.topic ?? '',
    topicSlug,
  }
}

async function persistToLibrary(result: GeneratedSimResult, jobId: string): Promise<void> {
  // Keyed by topicSlug: a repeat poll of the same finished job (or a second
  // student's job for the same topic) overwrites with an equivalent
  // gate-passed result rather than duplicating — set() is the idempotency.
  await db.collection(LIBRARY_COLLECTION).doc(result.topicSlug).set({
    ...result,
    jobId,
    createdAt: new Date().toISOString(),
    source: 'mindcraft-content-engine',
  })
}

async function handleStart(uid: string, rawTopic: string, res: VercelResponse, studentGeminiKey?: string) {
  const topic = rawTopic.trim().slice(0, MAX_TOPIC)
  if (!topic) return res.status(400).json({ error: 'topic required' })
  const topicSlug = slugifyTopic(topic)

  // Reuse before regenerate: a gate-passed result for this topic already in
  // the library costs nothing and returns instantly — the whole point of
  // treating gate-passed content as a growing library, not a per-request
  // expense. Checked BEFORE the budget so cache hits never consume a
  // student's limited attempts.
  const cached = await libraryLookup(topicSlug)
  if (cached) {
    return res.status(200).json({ status: 'passed', cached: true, result: cached })
  }

  // BYOK (2026-08-25, explicit ask: a student's own free Gemini key should
  // power live generation instead of always billing MindCraft's shared
  // Anthropic account, which can't scale to real student volume on a fixed
  // monthly cap). When a key is present, skip BOTH the platform-wide
  // dollar ceiling and the per-student daily attempt cap for the START of
  // this job — the expensive fit_check + generate calls will spend the
  // student's own quota, not MindCraft's. This is NOT a full bypass of
  // platform accounting: vision_gate still isn't ported (see
  // GeminiApiGenerator's own doc comment in the content-engine repo) and
  // still spends MindCraft's Anthropic account, so recordActualSpend on
  // the terminal poll below still runs and still bills the platform
  // budget for that real, smaller remaining cost — content-engine's
  // _Usage now tracks the two token buckets separately so that number is
  // correct or the fix has no teeth (see content-engine's own commit
  // fixing _Usage.to_payload from flat-pricing everything at Anthropic
  // rates regardless of provider).
  if (!studentGeminiKey) {
    const platformBudget = await checkPlatformBudget(uid)
    if (!platformBudget.allowed) {
      return res.status(429).json({
        status: 'rate_limited',
        reason: `This closed test's monthly generation budget is used up ($${platformBudget.spentThisMonthUsd.toFixed(2)}/$${platformBudget.capUsd}). It resets next month.`,
        platformBudgetExhausted: true,
      })
    }

    const budget = await checkAndRecordAttempt(uid)
    if (!budget.allowed) {
      return res.status(429).json({
        status: 'rate_limited',
        reason: `Daily generation limit reached (${budget.attemptsToday}/${budget.cap}).`,
        attemptsToday: budget.attemptsToday,
        cap: budget.cap,
      })
    }
  }

  if (!serviceConfigured()) {
    // The honest, expected answer until the content-engine service is
    // deployed WITH Blake's sign-off (see file header). Note the budget
    // attempt above was already recorded — deliberate: if this path is
    // ever hit in production it should still leave an auditable trace of
    // who tried to generate, and it costs the student nothing real since
    // nothing was billed.
    return res.status(503).json({
      status: 'unavailable',
      reason: 'The generation service is not deployed yet.',
    })
  }

  try {
    const serviceRes = await fetch(`${CONTENT_ENGINE_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': CONTENT_ENGINE_SECRET },
      body: JSON.stringify({
        topic,
        topic_slug: topicSlug,
        ...(studentGeminiKey ? { student_gemini_key: studentGeminiKey } : {}),
      }),
    })
    const data = (await serviceRes.json().catch(() => ({}))) as { job_id?: string }
    if (!serviceRes.ok || !data.job_id) {
      return res.status(502).json({
        status: 'unavailable',
        reason: `Generation service refused the job (${serviceRes.status}).`,
      })
    }
    return res.status(200).json({ status: 'running', jobId: String(data.job_id) })
  } catch (e) {
    return res.status(502).json({
      status: 'unavailable',
      reason: `Generation service unreachable: ${String(e)}`,
    })
  }
}

async function handlePoll(rawJobId: string, res: VercelResponse) {
  const jobId = rawJobId.trim()
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) {
    return res.status(400).json({ error: 'invalid jobId' })
  }
  if (!serviceConfigured()) {
    return res.status(503).json({
      status: 'unavailable',
      reason: 'The generation service is not deployed yet.',
    })
  }

  try {
    const serviceRes = await fetch(`${CONTENT_ENGINE_BASE}/jobs/${jobId}`, {
      headers: { 'X-Service-Key': CONTENT_ENGINE_SECRET },
    })
    const raw = await serviceRes.json().catch(() => ({}))
    if (!serviceRes.ok) {
      return res.status(502).json({
        status: 'error',
        detail: `Generation service returned ${serviceRes.status}.`,
      })
    }
    const normalized = normalizeJobPayload(raw, '')
    if (normalized.status === 'running') {
      return res.status(200).json(normalized)
    }
    // Every terminal status below spent real money getting here (the
    // service already made its Anthropic calls) — record it against the
    // platform budget regardless of which terminal branch this is. A
    // recording failure is logged, never surfaced to the student: a
    // billing-plumbing bug must not turn into a false "something went
    // wrong" on a result that's otherwise perfectly good.
    recordActualSpend(normalized.costUsd).catch((e) => {
      console.error('generate-sim: failed to record platform spend', e)
    })
    // PR1 training capture: passed AND gate-failed verdicts each become one
    // durable sim_training_events doc keyed by jobId (repeat polls rewrite
    // the same doc — idempotent by construction). Built from the RAW
    // payload, not `normalized`: the training doc needs fields the
    // client-facing shape deliberately drops (lesson_plan, references,
    // separate js, fail_stage). Fire-and-forget on error, same discipline
    // as recordActualSpend above — capture must never fail or delay the
    // student's response. NEVER pass uid into this call: the collection is
    // provenance about content, with a hard no-student-identifiers rule.
    const trainingEvent = buildStandaloneTrainingEvent(raw as ServiceJobPayloadPR1, jobId)
    if (trainingEvent) {
      captureSimTrainingEvents(db, [trainingEvent]).catch((e) => {
        console.error('generate-sim: failed to record sim training event', e)
      })
    }
    if (normalized.status === 'passed') {
      // Persist BEFORE responding so a client that crashes right after
      // seeing "passed" still leaves the library populated for reuse.
      // Library write failure downgrades to unavailable rather than
      // handing out a result the reuse path will silently regenerate
      // (and re-bill) next time.
      try {
        await persistToLibrary(normalized.result, jobId)
      } catch (e) {
        return res.status(502).json({
          status: 'error',
          detail: `Result passed the gate but could not be stored: ${String(e)}`,
        })
      }
      return res.status(200).json({ status: 'passed', cached: false, result: normalized.result })
    }
    if (normalized.status === 'no_good_result') {
      return res.status(200).json(normalized)
    }
    return res.status(502).json(normalized) // error
  } catch (e) {
    return res.status(502).json({ status: 'error', detail: `Generation service unreachable: ${String(e)}` })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body = (req.body || {}) as { topic?: string; jobId?: string; studentGeminiKey?: string }
  if (typeof body.jobId === 'string' && body.jobId) {
    return handlePoll(body.jobId, res)
  }
  if (typeof body.topic === 'string' && body.topic) {
    const studentGeminiKey = typeof body.studentGeminiKey === 'string' ? body.studentGeminiKey.trim() : ''
    return handleStart(uid, body.topic, res, studentGeminiKey || undefined)
  }
  return res.status(400).json({ error: 'topic (start) or jobId (poll) required' })
}
