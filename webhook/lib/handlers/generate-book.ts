/**
 * POST /api/generate-book
 *
 * On-demand, gated multi-chapter book generation — closes Tier 3 of
 * Jesse's lesson lookup (askJesseWorkDashboard in JesseCallSession.swift):
 * when a topic isn't in the pre-built Chapter Library, the 5 bundled book
 * graphs, or the archive, this used to fall through to a single raw,
 * ungated LLM call with zero sims and thin text — the exact garbage a real
 * student hit asking about "enterprise technology equity research."
 *
 * This runs the SAME real, gated pipeline the overnight cron uses
 * (generate_concept_prose.generate/run_gate, AnchoredLLMJudge,
 * book_assembler.assemble_book), on an ad-hoc concept graph decomposed
 * from the topic on the spot — see mindcraft-content-engine/src/
 * mindcraft_content_engine/serve.py's `/generate-book` + `_run_book_job`.
 * Verified live, 2026-08-21: real end-to-end run on "enterprise technology
 * equity research" produced 3 gate-passed chapters (90-94% quality) with 2
 * real embedded sims, ~4 minutes, $3.60.
 *
 * Mirrors generate-sim.ts's exact start/poll shape (see that file for the
 * fuller design rationale — async job, library-check-before-generating,
 * persist-before-responding). Differences specific to books:
 *
 *   - Library key is `on_demand_{slugifyTopic(topic)}` in the SAME
 *     `assembled_books` collection the cron's own real subjects live in
 *     (get-book.ts has no constraint tying subjectId to a pre-existing
 *     graph — confirmed by reading it directly). The `on_demand_` prefix
 *     is the collision guard the architecture plan called for: no real
 *     McCreary subject_id the cron produces is ever prefixed that way, so
 *     an on-demand write can never clobber a curated cron entry, by
 *     construction — no runtime existence check needed.
 *   - Cost isn't from real per-call token usage (generate_concept_prose's
 *     generate()/run_gate() don't return it — a known, stated gap) but a
 *     conservative flat estimate the service itself computes
 *     (`estimated_cost_usd` in the poll payload) — read directly rather
 *     than run through usageCostUsd, which expects real token counts this
 *     job doesn't have.
 *   - Budget-gated through generationBudget.ts (checkPlatformBudget +
 *     checkAndRecordAttempt) per the approved architecture plan, NOT the
 *     content-engine's own spend_guard.py — that module is explicitly not
 *     safe for concurrent writers (its own docstring says so), and this
 *     job runs 4-6 concepts concurrently within itself before a second
 *     student even shows up.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import { verifyToken } from '../verifyToken'
import { db } from '../firebase'
import { slugifyTopic } from '../generatedSimContract'
import { checkAndRecordAttempt, checkPlatformBudget, recordActualSpend } from '../generationBudget'
import {
  buildBookTrainingEvents,
  captureSimTrainingEvents,
  ServiceJobPayloadPR1,
} from '../simTrainingEvents'

const CONTENT_ENGINE_BASE = process.env.CONTENT_ENGINE_URL ?? ''
const CONTENT_ENGINE_SECRET = process.env.CONTENT_ENGINE_SECRET ?? ''
const LIBRARY_COLLECTION = 'assembled_books'
const MAX_TOPIC = 200

function serviceConfigured(): boolean {
  return Boolean(CONTENT_ENGINE_BASE && CONTENT_ENGINE_SECRET)
}

function onDemandSubjectId(topic: string): string {
  return `on_demand_${slugifyTopic(topic)}`
}

async function libraryLookup(subjectId: string): Promise<Record<string, unknown> | null> {
  const snap = await db.collection(LIBRARY_COLLECTION).doc(subjectId).get()
  if (!snap.exists) return null
  const data = snap.data()
  if (!data || !Array.isArray(data.chapters) || data.chapters.length === 0) return null
  return data
}

interface BookServiceJobPayload {
  status?: string // queued | running | passed | no_good_result | error
  phase?: string
  topic?: string
  chapters_ready?: number
  total_chapters?: number
  result?: Record<string, unknown>
  reason?: string
  detail?: string
  estimated_cost_usd?: number
}

async function handleStart(uid: string, rawTopic: string, res: VercelResponse, studentGeminiKey?: string) {
  const topic = rawTopic.trim().slice(0, MAX_TOPIC)
  if (!topic) return res.status(400).json({ error: 'topic required' })
  const subjectId = onDemandSubjectId(topic)

  // Reuse before regenerate, same discipline as generate-sim.ts's own
  // libraryLookup — checked BEFORE the budget so a cache hit never
  // consumes a student's limited daily attempts.
  const cached = await libraryLookup(subjectId)
  if (cached) {
    return res.status(200).json({ status: 'passed', cached: true, book: cached })
  }

  // BYOK (2026-08-25) — same partial bypass as generate-sim.ts: when the
  // student's own Gemini key is present, skip the platform checks for the
  // START of this job (the expensive per-chapter prose/sim/discussion
  // generation spends their quota, not ours), but every judge/gate call
  // still runs on MindCraft's Anthropic account regardless (see
  // content-engine's _run_book_job doc comment on the deliberate "one
  // calibrated grader for everyone" line), so recordActualSpend on the
  // terminal poll below still runs and still bills the platform budget
  // for that real, smaller remaining cost.
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
    return res.status(503).json({
      status: 'unavailable',
      reason: 'The generation service is not deployed yet.',
    })
  }

  try {
    const serviceRes = await fetch(`${CONTENT_ENGINE_BASE}/generate-book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': CONTENT_ENGINE_SECRET },
      body: JSON.stringify({
        topic,
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
    return res.status(503).json({ status: 'unavailable', reason: 'The generation service is not deployed yet.' })
  }

  try {
    const serviceRes = await fetch(`${CONTENT_ENGINE_BASE}/jobs/${jobId}`, {
      headers: { 'X-Service-Key': CONTENT_ENGINE_SECRET },
    })
    const raw = (await serviceRes.json().catch(() => ({}))) as BookServiceJobPayload
    if (!serviceRes.ok) {
      return res.status(502).json({ status: 'error', detail: `Generation service returned ${serviceRes.status}.` })
    }
    const status = String(raw?.status ?? '')

    if (status === 'queued' || status === 'running') {
      return res.status(200).json({
        status: 'running',
        phase: raw.phase ?? 'running',
        chaptersReady: raw.chapters_ready ?? 0,
        totalChapters: raw.total_chapters ?? 0,
      })
    }

    // Every terminal status below spent real money getting here — record
    // it against the platform budget regardless of which branch. Uses the
    // service's own conservative estimate directly (this pipeline doesn't
    // return real per-call token usage yet — see file header) rather than
    // usageCostUsd, which expects real token counts.
    const costUsd = typeof raw.estimated_cost_usd === 'number' ? raw.estimated_cost_usd : 0
    recordActualSpend(costUsd).catch((e) => {
      console.error('generate-book: failed to record platform spend', e)
    })

    if (status === 'passed') {
      if (!raw.result || !Array.isArray((raw.result as { chapters?: unknown[] }).chapters)) {
        return res.status(502).json({ status: 'error', detail: 'service reported passed without a renderable book' })
      }
      // PR1: the engine now ships training-capture data ALONGSIDE the book
      // inside result (generated_sims/failed_sims/prompt_template_version).
      // 2026-08-22: generated_discussions/failed_discussions joined the
      // same ride-along shape when discussion generation was wired in
      // (mindcraft-content-engine's serve.py `_maybe_generate_discussion`)
      // — same discipline, strip before persisting or responding so the
      // assembled_books doc and the client-visible book stay byte-identical
      // to pre-PR1 — students must see zero change from this capture.
      const {
        generated_sims: _generatedSims,
        failed_sims: _failedSims,
        generated_discussions: _generatedDiscussions,
        failed_discussions: _failedDiscussions,
        prompt_template_version: _promptTemplateVersion,
        ...book
      } = raw.result
      // One sim_training_events doc per sim ATTEMPT (passed and failed),
      // keyed {jobId}_{conceptSlug} — repeat polls rewrite the same docs.
      // Fire-and-forget, same discipline as recordActualSpend above: a
      // capture failure is logged, never surfaced to the student. No uid
      // is ever passed in — hard privacy rule of this collection.
      captureSimTrainingEvents(db, buildBookTrainingEvents(raw as ServiceJobPayloadPR1, jobId)).catch((e) => {
        console.error('generate-book: failed to record sim training events', e)
      })
      // Real bug caught before deploy: this must slug the ORIGINAL
      // requested topic (echoed back as raw.topic, same field _run_job's
      // own poll payload already includes), NOT the book's own re-titled
      // `title` (the LLM-decomposed subject title, e.g. "Enterprise
      // Technology Equity Research" for a raw topic phrased differently) -
      // handleStart's cache lookup slugs the original topic, so writing
      // under a title-derived slug here would almost never match a future
      // lookup for the same request, defeating the whole cache. Falls
      // back to jobId only if the service somehow didn't echo topic back.
      const subjectId = onDemandSubjectId(raw.topic || jobId)
      try {
        await db.collection(LIBRARY_COLLECTION).doc(subjectId).set({
          ...book,
          synced_at: new Date().toISOString(),
          source: 'on_demand',
        })
      } catch (e) {
        return res.status(502).json({ status: 'error', detail: `Book passed the gate but could not be stored: ${String(e)}` })
      }
      return res.status(200).json({ status: 'passed', cached: false, book, costUsd })
    }
    if (status === 'no_good_result') {
      return res.status(200).json({ status: 'no_good_result', reason: raw.reason ?? '' })
    }
    return res.status(502).json({ status: 'error', detail: raw.detail ?? `unrecognized service status: ${status}` })
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
