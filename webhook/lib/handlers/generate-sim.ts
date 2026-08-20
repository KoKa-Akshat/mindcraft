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
 *   { topic }  -> start: library check -> budget check -> enqueue on the
 *                 service -> { status: "running", jobId }
 *   { jobId }  -> poll: relay the service's verdict; on a gate-passed
 *                 terminal result, persist it to the generated_sims
 *                 library so the next student asking about the same topic
 *                 reuses it instead of paying for regeneration.
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

async function handleStart(uid: string, rawTopic: string, res: VercelResponse) {
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

  // Platform-wide dollar ceiling checked first: a global stop doesn't need
  // to know or care which student is asking, and checking it before the
  // per-student counter means a request that's going to be refused anyway
  // never consumes one of that student's limited daily attempts.
  const platformBudget = await checkPlatformBudget()
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
      body: JSON.stringify({ topic, topic_slug: topicSlug }),
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

  const body = (req.body || {}) as { topic?: string; jobId?: string }
  if (typeof body.jobId === 'string' && body.jobId) {
    return handlePoll(body.jobId, res)
  }
  if (typeof body.topic === 'string' && body.topic) {
    return handleStart(uid, body.topic, res)
  }
  return res.status(400).json({ error: 'topic (start) or jobId (poll) required' })
}
