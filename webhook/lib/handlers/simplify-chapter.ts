/**
 * POST /api/simplify-chapter
 *
 * Auto-simplify: a shorter, plainer default reading of a chapter, pitched at
 * how the student phrased their own question, and NOT shown unless a second,
 * independent call confirms no fact, number, formula, or conclusion was lost.
 *
 * This is the production port of the discipline validated locally this session
 * in generate_check_server.py's /simplify route (SAFE-GENQ's rule: never ship
 * generated text straight to a student). Two calls, two different model
 * families, the second with no stake in the first's output:
 *
 *   1. qwen/qwen3.8-27b   prunes the lesson down
 *   2. openai/gpt-oss-20b  checks the rewrite against the original
 *
 * Model choice, and one deliberate change from the local prototype: the
 * prototype paired qwen3.8-27b with groq/compound-mini. compound-mini is
 * confirmed present on this project's real Groq key (checked live against
 * GET /openai/v1/models, not assumed), but Groq publishes no per-million-token
 * price for it — the models page shows "-" in its price column, because it is
 * an agentic compound system rather than a plain per-token model. A checker
 * whose real cost cannot be computed cannot be billed honestly to the platform
 * budget, and a made-up rate would silently corrupt the one number that tells
 * Akshat how much of the $25 is left. gpt-oss-20b keeps the cross-model
 * property (a different family from qwen, so nothing grades its own homework),
 * has a real published rate this file can price exactly, and sits in its own
 * per-day token bucket — see the CHECK_MODEL comment below for why that last
 * point turned out to matter more than any of the others.
 *
 * Cost control: this DOES spend real money, so it goes through the full
 * generationBudget path in the same order generate-questions.ts uses —
 * cache -> checkPlatformBudget(uid) -> checkAndRecordAttempt(uid) -> generate
 * -> recordActualSpend(real token usage). No new uncounted spend path.
 *
 * A real tension worth naming rather than quietly working around: auto-simplify
 * fires on every chapter load, while PLACEHOLDER_DAILY_ATTEMPT_CAP is 3/day
 * per student — a rail sized for $0.18 sim generation, not for a ~$0.005 text
 * rewrite. A student walking a seven-step guided path will therefore hit the
 * cap partway up and see the ORIGINAL chapter text for the remaining steps,
 * with an honest note saying so. That is a real product decision for Akshat to
 * make (raise the cap, or exempt cheap text calls from it), not something this
 * handler should decide by bypassing a budget rail it was explicitly told not
 * to bypass. The 24h cache below is what keeps it from biting often: a repeat
 * of the same concept + same phrasing costs nothing and never touches the cap.
 * That cache holds settled REJECTIONS as well as verified rewrites (see
 * cacheVerdict), so a chapter whose rewrite failed the faithfulness check
 * stops burning spend and capped attempts on every revisit.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'
import { ChatGroq } from '@langchain/groq'
import { setCorsAllowlist } from '../cors'
import { verifyToken } from '../verifyToken'
import { db } from '../firebase'
import { checkAndRecordAttempt, checkPlatformBudget, recordActualSpend } from '../generationBudget'

const ALLOWED_ORIGINS = [
  'https://mindcraft-93858.web.app',
  'https://mindcraft-93858.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

const SIMPLIFY_MODEL = 'qwen/qwen3.8-27b'
/** The checker. gpt-oss-20b rather than gpt-oss-120b, and the reason is
 * operational, found live: Groq meters tokens PER DAY PER MODEL on this
 * project's on_demand tier, and gpt-oss-120b's 200,000/day bucket is the one
 * api/generate-questions.ts already spends all day on. Measured live on
 * 2026-08-30 at 198,255/200,000 used, at which point generate-questions began
 * returning FUNCTION_INVOCATION_TIMEOUT (Groq queues rather than failing fast,
 * so the call just never came back inside the function's limit). Putting the
 * simplify check in that same bucket would have made two independent student
 * features fail together, every day, once either one drained it. gpt-oss-20b
 * is a separate bucket, is still a different model family from the qwen
 * simplifier (so the check stays genuinely cross-model rather than a model
 * grading its own homework), is 4x cheaper, and measured ~540ms against
 * ~4s. Verified on both directions of the real task before switching: it
 * passes a rewrite that drops a researcher attribution (which the simplify
 * prompt explicitly asks for) and fails one that drops an "at sea level"
 * qualifying condition. */
const CHECK_MODEL = 'openai/gpt-oss-20b'

// Groq published rates, confirmed live against console.groq.com/docs/models
// (2026-08-30). The same page's gpt-oss-120b numbers match the ones
// generate-questions.ts already carries, which is a useful cross-check that
// this is the same price table and not a remembered one.
const SIMPLIFY_INPUT_USD_PER_MTOK = 0.80   // qwen/qwen3.8-27b
const SIMPLIFY_OUTPUT_USD_PER_MTOK = 4.00
const CHECK_INPUT_USD_PER_MTOK = 0.075     // openai/gpt-oss-20b
const CHECK_OUTPUT_USD_PER_MTOK = 0.30

const CACHE_COLLECTION = 'simplify_cache'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
/** Below this there is nothing to prune and a rewrite would add risk for no
 * benefit. Same floor the local prototype settled on. */
const MIN_BODY_CHARS = 700
const MAX_BODY_CHARS = 6000
const MAX_QUERY_CHARS = 400

/** Token ceiling for the faithfulness check, and it has to be this generous
 * for a real reason rather than a guessed one: gpt-oss-120b is a reasoning
 * model, and a live Groq call on a two-sentence example measured 502 of its
 * 522 completion tokens spent on internal reasoning before any JSON was
 * emitted. At the original 600 the check on a real 3000-character chapter ran
 * out of budget mid-reasoning and returned no parseable JSON at all, which
 * this handler then correctly (but uselessly) reported as "faithfulness check
 * did not return valid structured output" and fell back to the original
 * chapter every single time. Found by running it live against a real migrated
 * chapter, not by reading the prompt. 2400 leaves room for the reasoning plus
 * the small JSON verdict; the verdict itself is only a few dozen tokens, so
 * the real added cost is about a tenth of a cent per call. */
const CHECK_MAX_TOKENS = 2400
const SIMPLIFY_MAX_TOKENS = 3600

const SIMPLIFY_SYSTEM = [
  'You produce a SHORTER, PLAINER default reading of a lesson for a student, ',
  'using the way they phrased their own search as your only evidence of what ',
  'level they are at. A short, broad, plain-language query like "what is ',
  'calculus" means treat them as a beginner meeting the subject; a precise ',
  'technical query means keep more of the technical register.\n',
  'Your job is PRUNING, not paraphrasing. Actually cut: drop asides, hedges, ',
  'restatements, historical colour, and any sentence that is not load bearing ',
  'for understanding the idea. Split long sentences. Replace jargon with plain ',
  'words on first use. The result should be noticeably shorter than the ',
  'original, and should read as the simplest honest version of the same lesson.\n',
  'You must NOT change or drop: any definition, formula, number, symbol, ',
  'condition, or conclusion. Qualifying conditions especially: an "only when", ',
  'an "about three to five", an "at sea level" changes what the claim MEANS, ',
  'so it stays even when the sentence around it gets shorter. Every ',
  'mathematical or factual claim in the ',
  'original must still be present and still correct. If an idea is load bearing ',
  'but hard, keep it and explain it in smaller words, do not delete it. Do not ',
  'add new claims, new examples, or new numbers of your own.\n',
  'Output ONLY valid JSON: {"simplified_body": str}. Keep the paragraph breaks ',
  'as blank lines. No em dashes.',
].join('')

// The "not a problem" list here has to mirror what SIMPLIFY_SYSTEM actually
// TOLD the rewriter to remove, or the two prompts contradict each other and
// every rewrite fails review for doing exactly what it was asked to do. Found
// live, not in theory: the first real run against a migrated psychology
// chapter was rejected partly for dropping the Deutsch and Gerard attribution,
// which the simplify prompt explicitly instructs the model to cut as
// historical colour. Names, citations, dates and study attributions are
// therefore called out as droppable here. What stays load bearing is
// unchanged: formulas, numbers, symbols, definitions, CONDITIONS, and
// conclusions. (The same run also correctly caught a real condition drop, the
// "unanimous group of three to five" qualifier, which is the check earning its
// keep and must keep failing.)
const CHECK_SYSTEM = [
  'You are given an ORIGINAL lesson and a SHORTER rewrite of it. The rewrite ',
  'is SUPPOSED to be shorter and simpler, so brevity, plainer wording, and ',
  'removed asides are NOT problems and must not be flagged.\n',
  'The rewriter was explicitly instructed to cut asides, hedges, restatements, ',
  'historical colour, and researcher names, citations, dates and study ',
  'attributions. Removing any of those is CORRECT behaviour and must never be ',
  'flagged as an issue.\n',
  'Flag it only if the rewrite is actually WRONG or has LOST something load ',
  'bearing: a formula, number, symbol, definition, qualifying condition, or ',
  'conclusion that is missing, altered, or now stated incorrectly, or a new ',
  'claim that the original does not support. A dropped qualifying condition ',
  '(an "only when", "about three to five", "at sea level") IS load bearing and ',
  'must be flagged.\n',
  'Output ONLY valid JSON: {"faithful": bool, "issues": [str, ...]}. issues ',
  'must be empty when faithful is true.',
].join('')

interface Verdict {
  verified: boolean
  reason?: string
  simplifiedBody?: string
  originalChars?: number
  simplifiedChars?: number
  reductionPct?: number
  issues?: string[]
  cached?: boolean
}

/** Writes a settled verdict to the 24h cache. Used for verified rewrites AND
 * for real content rejections (not faithful, or longer than the original):
 * a rejection is just as much a settled answer about this exact chapter and
 * phrasing as a pass is, and before rejections were cached, every revisit of
 * a failing chapter re-spent both Groq calls plus one of the student's
 * capped daily attempts to re-reach the same "showing the original" outcome.
 * Transient failures (Groq unreachable, unparseable model output) are
 * deliberately NOT cached: those say nothing about the content and should be
 * retried. Cache write failure stays non-fatal, same as the read side. */
async function cacheVerdict(cacheKey: string, verdict: Verdict, conceptId: string, query: string): Promise<void> {
  try {
    await db.collection(CACHE_COLLECTION).doc(cacheKey).set({
      verdict,
      cachedAt: Date.now(),
      conceptId,
      query,
    })
  } catch {
    // Non-fatal: the verdict still goes back to the client.
  }
}

/** Models are told to emit JSON only, but a stray prose wrapper is a normal
 * failure mode, so the first balanced-looking object is extracted rather than
 * trusting the whole string to parse. */
function extractJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[0])
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function callGroq(model: string, system: string, user: string, maxTokens: number) {
  const chat = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY ?? '',
    model,
    temperature: 0.4,
    maxTokens,
  })
  const msg = await chat.invoke([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ])
  const content = typeof msg.content === 'string'
    ? msg.content
    : Array.isArray(msg.content)
      ? msg.content.map((c) => (typeof c === 'string' ? c : ((c as { text?: string }).text ?? ''))).join('')
      : ''
  return { content, usage: msg.usage_metadata }
}

/** The pieces a prompt eval needs, exported as one object so a test harness
 * always runs the file's REAL current prompts, models, and token budgets
 * instead of a copy that silently drifts. Grouped rather than exported
 * individually so the handler's public surface stays one default export. */
export const simplifyInternals = {
  SIMPLIFY_MODEL,
  CHECK_MODEL,
  SIMPLIFY_SYSTEM,
  CHECK_SYSTEM,
  SIMPLIFY_MAX_TOKENS,
  CHECK_MAX_TOKENS,
  SIMPLIFY_INPUT_USD_PER_MTOK,
  SIMPLIFY_OUTPUT_USD_PER_MTOK,
  CHECK_INPUT_USD_PER_MTOK,
  CHECK_OUTPUT_USD_PER_MTOK,
  MAX_BODY_CHARS,
  callGroq,
  extractJson,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsAllowlist(req, res, { allowedOrigins: ALLOWED_ORIGINS })
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Sign-in required' })

  const body = (req.body || {}) as { chapterBody?: string; query?: string; conceptId?: string }
  const chapterBody = typeof body.chapterBody === 'string' ? body.chapterBody.trim() : ''
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, MAX_QUERY_CHARS) : ''
  const conceptId = typeof body.conceptId === 'string' ? body.conceptId.slice(0, 120) : ''

  if (!chapterBody) {
    return res.status(400).json({ verified: false, reason: 'no chapter body to simplify' } as Verdict)
  }
  if (chapterBody.length < MIN_BODY_CHARS) {
    // Not an error. The honest answer is "the original is already the simplest
    // version worth showing", and the client renders the original.
    return res.status(200).json({ verified: false, reason: 'chapter is already short, showing the original' } as Verdict)
  }

  const trimmedBody = chapterBody.slice(0, MAX_BODY_CHARS)

  // ── 1. Cache ──────────────────────────────────────────────────────────────
  // Keyed on the exact text simplified AND the exact query it was pitched at,
  // so a content edit or a differently-phrased search never silently reuses a
  // rewrite that was aimed at something else.
  const cacheKey = createHash('sha256')
    .update(`${conceptId}␟${trimmedBody}␟${query.toLowerCase()}`)
    .digest('hex')
    .slice(0, 40)
  try {
    const doc = await db.collection(CACHE_COLLECTION).doc(cacheKey).get()
    if (doc.exists) {
      const data = doc.data() as { cachedAt?: number; verdict?: Verdict }
      if (data.verdict && Date.now() - (data.cachedAt ?? 0) < CACHE_TTL_MS) {
        return res.status(200).json({ ...data.verdict, cached: true })
      }
    }
  } catch {
    // Cache unavailable, fall through and generate.
  }

  // ── 2. Budget, in the same order generate-questions.ts checks it ──────────
  const platformBudget = await checkPlatformBudget(uid)
  if (!platformBudget.allowed) {
    return res.status(429).json({
      verified: false,
      reason: `This closed test's monthly generation budget is used up ($${platformBudget.spentThisMonthUsd.toFixed(2)}/$${platformBudget.capUsd}). It resets next month.`,
      platformBudgetExhausted: true,
    })
  }
  const studentBudget = await checkAndRecordAttempt(uid)
  if (!studentBudget.allowed) {
    return res.status(429).json({
      verified: false,
      reason: `Daily generation limit reached (${studentBudget.attemptsToday}/${studentBudget.cap}).`,
    })
  }

  // ── 3. Simplify ───────────────────────────────────────────────────────────
  let simplified = ''
  try {
    const { content, usage } = await callGroq(
      SIMPLIFY_MODEL,
      SIMPLIFY_SYSTEM,
      `The student searched: ${query || '(no query given)'}\n\nLesson to simplify:\n${trimmedBody}`,
      // Same reasoning-token headroom concern as CHECK_MAX_TOKENS above: qwen
      // has to fit its reasoning AND a rewrite of a chapter up to
      // MAX_BODY_CHARS long. A truncated response fails extractJson and falls
      // back to the original chapter, which is safe but wastes a paid call.
      SIMPLIFY_MAX_TOKENS,
    )
    if (usage) {
      recordActualSpend(
        (usage.input_tokens / 1_000_000) * SIMPLIFY_INPUT_USD_PER_MTOK +
        (usage.output_tokens / 1_000_000) * SIMPLIFY_OUTPUT_USD_PER_MTOK,
      ).catch((e) => console.error('simplify-chapter: failed to record platform spend', e))
    }
    const parsed = extractJson(content)
    const value = parsed?.simplified_body
    if (typeof value !== 'string' || !value.trim()) {
      return res.status(200).json({ verified: false, reason: 'simplify pass did not return valid structured output' } as Verdict)
    }
    simplified = value.trim()
  } catch (e) {
    return res.status(200).json({ verified: false, reason: `simplify call failed: ${String(e).slice(0, 160)}` } as Verdict)
  }

  // A "simplification" that grew is not one, and is the shape a drifting
  // rewrite takes. Rejected before anyone spends a check call on it, and the
  // rejection is cached so a revisit of this exact chapter and phrasing does
  // not pay for the same failed rewrite again.
  if (simplified.length > trimmedBody.length) {
    const verdict: Verdict = {
      verified: false,
      reason: 'rewrite came back longer than the original, so it is not a simplification',
    }
    await cacheVerdict(cacheKey, verdict, conceptId, query)
    return res.status(200).json(verdict)
  }

  // ── 4. Independent faithfulness check ─────────────────────────────────────
  let verdict: Verdict
  try {
    const { content, usage } = await callGroq(
      CHECK_MODEL,
      CHECK_SYSTEM,
      `ORIGINAL:\n${trimmedBody}\n\nSHORTER REWRITE:\n${simplified}`,
      CHECK_MAX_TOKENS,
    )
    if (usage) {
      recordActualSpend(
        (usage.input_tokens / 1_000_000) * CHECK_INPUT_USD_PER_MTOK +
        (usage.output_tokens / 1_000_000) * CHECK_OUTPUT_USD_PER_MTOK,
      ).catch((e) => console.error('simplify-chapter: failed to record platform spend', e))
    }
    const parsed = extractJson(content)
    if (!parsed || typeof parsed.faithful !== 'boolean') {
      return res.status(200).json({ verified: false, reason: 'faithfulness check did not return valid structured output' } as Verdict)
    }
    if (!parsed.faithful) {
      const issues = Array.isArray(parsed.issues) && parsed.issues.length
        ? parsed.issues.map((i) => String(i))
        : ['unspecified']
      // Cached like a pass: this is a settled judgment about this exact
      // chapter + phrasing, and re-rolling it on every revisit costs two paid
      // calls and a capped attempt for an outcome that almost never flips
      // inside the 24h TTL.
      const rejection: Verdict = {
        verified: false,
        reason: 'simplified version dropped or altered content: ' + issues.join('; ').slice(0, 300),
        issues,
      }
      await cacheVerdict(cacheKey, rejection, conceptId, query)
      return res.status(200).json(rejection)
    }
    verdict = {
      verified: true,
      simplifiedBody: simplified,
      originalChars: trimmedBody.length,
      simplifiedChars: simplified.length,
      reductionPct: Math.round((1 - simplified.length / trimmedBody.length) * 100),
    }
  } catch (e) {
    return res.status(200).json({
      verified: false,
      reason: `could not run the faithfulness check, so not showing it: ${String(e).slice(0, 160)}`,
    } as Verdict)
  }

  // ── 5. Cache the verified result ──────────────────────────────────────────
  await cacheVerdict(cacheKey, verdict, conceptId, query)

  return res.status(200).json({ ...verdict, cached: false })
}
