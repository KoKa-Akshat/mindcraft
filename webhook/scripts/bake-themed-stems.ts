/**
 * bake-themed-stems.ts — offline bake of story-module stems into a checked-in
 * Product artifact (THEMED_QUESTION_BAKE_BUILD.md).
 *
 * Reuses the SAME composer as live `/story-module` (C-2). Neutral student
 * context so stems stay deterministic per {concept, question} (C-5).
 *
 * Groq free-tier limits for llama-3.3-70b-versatile
 * (https://console.groq.com/docs/rate-limits):
 *   RPM 30 | RPD 1,000 | TPM 12,000 | TPD 100,000
 * TPM/TPD dominate this workload (long system prompt + story + explanations).
 * Default `--tier free` = concurrency 1, batch 3, ~1 req / 55s, soft daily stop.
 *
 * Usage:
 *   npm run bake-themed-stems --prefix webhook
 *   npm run bake-themed-stems --prefix webhook -- --tier free
 *   npm run bake-themed-stems --prefix webhook -- --tier developer --concurrency 4
 *   npm run bake-themed-stems --prefix webhook -- --coverage-only
 *
 * Resume-safe: re-run skips keys already in themedStems.generated.json.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  composeStoryModuleItems,
  isValidBakedStem,
  STORY_MODULE_MODEL,
  themedStemKey,
  type IncomingQuestion,
} from '../lib/storyModuleComposer'

const ROOT = resolve(__dirname, '../..')
const DATA = resolve(ROOT, 'app/src/data')
const OUT = resolve(DATA, 'themedStems.generated.json')
const BAKE_VERSION = 2

/** Official free-plan caps for llama-3.3-70b-versatile (org-level). */
const FREE_70B = {
  rpm: 30,
  rpd: 1_000,
  tpm: 12_000,
  tpd: 100_000,
} as const

interface BankQuestion {
  id: string
  conceptId: string
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
  hints?: string[]
  level?: number
  format?: string
  misconception_label?: string
  storyContext?: string
  storyIntro?: string
}

interface ConceptStory {
  conceptName?: string
  story?: string
  protagonist?: string
}

interface RateLimitState {
  day: string // YYYY-MM-DD UTC
  requests: number
  estTokens: number
}

interface Artifact {
  bakeVersion: number
  sourceBankHash: string
  generatedAt: string
  model: string
  stems: Record<string, string>
  drops: Array<{ key: string; questionId: string; reason: string; storyId?: string }>
  stats: {
    bankSize: number
    eligible: number
    attempted: number
    baked: number
    dropped: number
    skippedNoStory: number
    prunedStale: number
  }
  rateLimit?: RateLimitState
}

type Tier = 'free' | 'developer'

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const tierRaw = (get('--tier') ?? 'free').toLowerCase()
  const tier: Tier = tierRaw === 'developer' ? 'developer' : 'free'
  const concurrencyRaw = get('--concurrency')
  const batchRaw = get('--batch-size')

  // Free defaults sized for 12K TPM / 100K TPD — not max RPM.
  const defaults = tier === 'free'
    ? { concurrency: 1, batchSize: 3, maxTokens: 3_000, minIntervalMs: 55_000 }
    : { concurrency: 4, batchSize: 12, maxTokens: 8_000, minIntervalMs: 1_500 }

  return {
    limit: get('--limit') ? Number(get('--limit')) : undefined,
    concept: get('--concept'),
    coverageOnly: argv.includes('--coverage-only'),
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    tier,
    concurrency: concurrencyRaw ? Math.max(1, Number(concurrencyRaw)) : defaults.concurrency,
    batchSize: batchRaw
      ? Math.max(1, Math.min(tier === 'free' ? 6 : 24, Number(batchRaw)))
      : defaults.batchSize,
    maxTokens: defaults.maxTokens,
    minIntervalMs: defaults.minIntervalMs,
    /** Soft stop before hard RPD/TPD (leave headroom for other app traffic). */
    softRpd: tier === 'free' ? Math.floor(FREE_70B.rpd * 0.9) : 50_000,
    softTpd: tier === 'free' ? Math.floor(FREE_70B.tpd * 0.9) : 5_000_000,
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadDotEnv(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function asQuestionArray(raw: unknown): BankQuestion[] {
  if (Array.isArray(raw)) return raw as BankQuestion[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { questions?: unknown }).questions)) {
    return (raw as { questions: BankQuestion[] }).questions
  }
  return []
}

function loadMergedBank(): BankQuestion[] {
  const files = [
    'generatedQuestions.json',
    'actMasterQuestionBank.generated.json',
    'actQuestionsBank.json',
    'eediQuestions.json',
    'openstaxQuestions.json',
    'openstaxMCQ.json',
    'khanQuestions.json',
    'storyCells.json',
  ]
  const byId = new Map<string, BankQuestion>()
  for (const file of files) {
    const path = resolve(DATA, file)
    if (!existsSync(path)) continue
    for (const q of asQuestionArray(readJson(path))) {
      if (!q?.id || !q.conceptId || !q.question || !Array.isArray(q.choices)) continue
      if (!Number.isInteger(q.correctIndex) || typeof q.explanation !== 'string') continue
      if (q.choices.length < 2) continue
      if (q.correctIndex < 0 || q.correctIndex >= q.choices.length) continue
      if (!byId.has(q.id)) byId.set(q.id, q)
    }
  }
  return [...byId.values()]
}

function bankHash(questions: BankQuestion[]): string {
  const h = createHash('sha256')
  const sorted = [...questions].sort((a, b) => a.id.localeCompare(b.id))
  for (const q of sorted) {
    h.update(`${q.conceptId}\0${q.id}\0${q.question}\n`)
  }
  return h.digest('hex').slice(0, 16)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Rough token estimate (~4 chars/token) for pacing against TPM/TPD. */
function estimateRequestTokens(
  storyChars: number,
  questions: IncomingQuestion[],
  maxOut: number,
): number {
  const inputChars =
    6_000 // system template ballpark
    + Math.min(storyChars, 2_000)
    + questions.reduce((n, q) => (
      n
      + q.question.length
      + (q.explanation?.length ?? 0)
      + q.choices.join('').length
      + 80
    ), 0)
  return Math.ceil(inputChars / 4) + Math.ceil(maxOut * 0.85)
}

function writeArtifact(partial: Artifact) {
  writeFileSync(OUT, `${JSON.stringify(partial, null, 2)}\n`, 'utf8')
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Serial pace gate for free-tier TPM/RPM.
 * Waits out minInterval; on rate-limit failure backs off ~TPM-reset window.
 */
class PaceGate {
  private lastCallAt = 0
  constructor(private minIntervalMs: number) {}

  async beforeCall(): Promise<void> {
    const elapsed = Date.now() - this.lastCallAt
    if (this.lastCallAt > 0 && elapsed < this.minIntervalMs) {
      const wait = this.minIntervalMs - elapsed
      console.log(`  pace: waiting ${Math.round(wait / 1000)}s (free-tier TPM/RPM)`)
      await sleep(wait)
    }
  }

  markCalled() {
    this.lastCallAt = Date.now()
  }

  async afterRateLimit() {
    // Free TPM window resets on the order of ~60s; retry-after is often a few seconds.
    const wait = Math.max(this.minIntervalMs, 65_000)
    console.log(`  rate-limited: backing off ${Math.round(wait / 1000)}s`)
    await sleep(wait)
    this.lastCallAt = Date.now()
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  loadDotEnv(resolve(ROOT, 'ml/.env.local'))
  loadDotEnv(resolve(ROOT, 'webhook/.env.local'))

  const stories = readJson<Record<string, ConceptStory>>(resolve(DATA, 'conceptStories.json'))
  const bank = loadMergedBank()
  const hash = bankHash(bank)

  let existing: Artifact | null = null
  if (existsSync(OUT)) {
    try { existing = readJson<Artifact>(OUT) } catch { existing = null }
  }

  const eligible = bank.filter(q => {
    if (args.concept && q.conceptId !== args.concept) return false
    const story = stories[q.conceptId]
    return Boolean(story?.story?.trim())
  })

  const missingKeys = eligible
    .map(q => themedStemKey(q.conceptId, q.id, q.conceptId))
    .filter(k => !existing?.stems?.[k])

  console.log(`Bank: ${bank.length} questions (JSON sources)`)
  console.log(`Eligible (has concept story${args.concept ? `, concept=${args.concept}` : ''}): ${eligible.length}`)
  console.log(`Missing from artifact: ${missingKeys.length}`)
  console.log(`sourceBankHash: ${hash}`)
  console.log(
    `Tier=${args.tier} | llama-3.3-70b free caps: `
    + `${FREE_70B.rpm} RPM / ${FREE_70B.rpd} RPD / ${FREE_70B.tpm} TPM / ${FREE_70B.tpd} TPD`,
  )

  if (args.coverageOnly) {
    const coverage = eligible.length === 0 ? 0 : ((eligible.length - missingKeys.length) / eligible.length) * 100
    console.log(`Coverage: ${coverage.toFixed(1)}% of eligible`)
    process.exit(missingKeys.length > 0 ? 1 : 0)
  }

  if (args.dryRun) {
    const jobsEst = Math.ceil((args.limit ?? missingKeys.length) / args.batchSize)
    const estTok = jobsEst * 6_500
    const days = Math.ceil(estTok / args.softTpd)
    console.log(`Would bake ~${args.limit ?? missingKeys.length} stems in ~${jobsEst} requests`)
    console.log(`Est ~${estTok.toLocaleString()} tokens → ~${days} free-tier day(s) at soft TPD ${args.softTpd}`)
    return
  }

  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY not set (checked env + ml/.env.local + webhook/.env.local)')
    process.exit(1)
  }

  const stems: Record<string, string> = { ...(existing?.stems ?? {}) }
  const liveKeys = new Set(bank.map(q => themedStemKey(q.conceptId, q.id, q.conceptId)))
  let prunedStale = 0
  for (const key of Object.keys(stems)) {
    if (!liveKeys.has(key)) {
      delete stems[key]
      prunedStale++
    }
  }

  const toBake = eligible.filter(q => {
    const key = themedStemKey(q.conceptId, q.id, q.conceptId)
    return args.force || !stems[key]
  })
  const capped = args.limit ? toBake.slice(0, args.limit) : toBake

  const drops: Artifact['drops'] = [...(existing?.drops ?? []).filter(d => liveKeys.has(d.key))]
  let attempted = 0
  let baked = 0
  let dropped = 0
  const skippedNoStory = bank.length - eligible.length

  const day = todayUtc()
  const rateLimit: RateLimitState =
    existing?.rateLimit?.day === day
      ? { ...existing.rateLimit }
      : { day, requests: 0, estTokens: 0 }

  const snapshot = (): Artifact => ({
    bakeVersion: BAKE_VERSION,
    sourceBankHash: hash,
    generatedAt: new Date().toISOString(),
    model: STORY_MODULE_MODEL,
    stems,
    drops: drops.slice(-500),
    stats: {
      bankSize: bank.length,
      eligible: eligible.length,
      attempted,
      baked: Object.keys(stems).length,
      dropped,
      skippedNoStory,
      prunedStale,
    },
    rateLimit,
  })

  type Job = {
    conceptId: string
    conceptName: string
    story: string
    protagonist?: string
    batch: BankQuestion[]
  }
  const jobs: Job[] = []
  const byConcept = new Map<string, BankQuestion[]>()
  for (const q of capped) {
    const list = byConcept.get(q.conceptId) ?? []
    list.push(q)
    byConcept.set(q.conceptId, list)
  }
  for (const [conceptId, qs] of byConcept) {
    const storyEntry = stories[conceptId]
    if (!storyEntry?.story) continue
    const conceptName = storyEntry.conceptName ?? conceptId.replace(/_/g, ' ')
    for (const batch of chunk(qs, args.batchSize)) {
      jobs.push({
        conceptId,
        conceptName,
        story: storyEntry.story,
        protagonist: storyEntry.protagonist,
        batch,
      })
    }
  }

  console.log(
    `Jobs: ${jobs.length} × ≤${args.batchSize} q | concurrency=${args.concurrency} `
    + `| interval≥${args.minIntervalMs}ms | soft budgets RPD=${args.softRpd} TPD=${args.softTpd}`,
  )
  console.log(`Today so far: ${rateLimit.requests} req / ~${rateLimit.estTokens} tokens`)

  if (args.concurrency !== 1 && args.tier === 'free') {
    console.warn('WARN: free tier — forcing concurrency=1 (TPM 12K cannot absorb parallel 70B calls)')
    args.concurrency = 1
  }

  const pace = new PaceGate(args.minIntervalMs)
  let stoppedForBudget = false

  for (let ji = 0; ji < jobs.length; ji++) {
    if (rateLimit.requests >= args.softRpd || rateLimit.estTokens >= args.softTpd) {
      console.log(
        `Soft daily budget hit (req ${rateLimit.requests}/${args.softRpd}, `
        + `tok ~${rateLimit.estTokens}/${args.softTpd}). Checkpointing — re-run tomorrow to resume.`,
      )
      stoppedForBudget = true
      break
    }

    const job = jobs[ji]
    const { conceptId, conceptName, story, protagonist, batch } = job

    // Trim payloads for TPD: short explanation + story slice (prompt unchanged).
    const storyTrim = story.slice(0, 2_000)
    const incoming: IncomingQuestion[] = batch.map(q => ({
      id: q.id,
      question: q.question,
      choices: q.choices,
      correctIndex: q.correctIndex,
      explanation: (q.explanation ?? '').slice(0, 500),
      hints: (q.hints ?? []).slice(0, 2),
      level: q.level,
      format: q.format,
      misconceptionLabel: q.misconception_label,
      conceptId: q.conceptId,
      conceptName,
      conceptStory: storyTrim,
      protagonist,
      storyContext: q.storyContext?.slice(0, 200),
      storyIntro: q.storyIntro?.slice(0, 400),
    }))

    const estTok = estimateRequestTokens(storyTrim.length, incoming, args.maxTokens)
    console.log(
      `Baking ${conceptId}: ${batch.length} q (job ${ji + 1}/${jobs.length}, est ~${estTok} tok)…`,
    )

    await pace.beforeCall()
    let result = await composeStoryModuleItems({
      conceptId,
      conceptName,
      story: storyTrim,
      questions: incoming,
      maxQuestions: args.batchSize,
      maxTokens: args.maxTokens,
      stemOnlyAccept: true,
      context: {
        sessionKind: 'practice',
        goals: { tags: [], text: '' },
        tutorFocusConcepts: [],
        priorOutcomes: [],
      },
    })
    pace.markCalled()
    rateLimit.requests += 1
    rateLimit.estTokens += estTok

    const allFailed = batch.every(q => !result.items[q.id])
    const groqFail = result.dropped.some(d => d.reason === 'groq_failure')
    if (allFailed && groqFail) {
      await pace.afterRateLimit()
      result = await composeStoryModuleItems({
        conceptId,
        conceptName,
        story: storyTrim,
        questions: incoming,
        maxQuestions: args.batchSize,
        maxTokens: args.maxTokens,
        stemOnlyAccept: true,
        context: {
          sessionKind: 'practice',
          goals: { tags: [], text: '' },
          tutorFocusConcepts: [],
          priorOutcomes: [],
        },
      })
      pace.markCalled()
      rateLimit.requests += 1
      rateLimit.estTokens += estTok
    }

    attempted += batch.length
    for (const q of batch) {
      const storyId = conceptId // concept-chapter story id (== conceptId today)
      const key = themedStemKey(q.conceptId, q.id, storyId)
      const item = result.items[q.id]
      if (item && isValidBakedStem(q.question, item.storyStem)) {
        stems[key] = item.storyStem
        baked++
      } else {
        const reason = result.dropped.find(d => d.questionId === q.id)?.reason
          ?? (item ? 'stem_recheck_failed' : 'missing')
        drops.push({ key, questionId: q.id, storyId, reason })
        dropped++
      }
    }

    writeArtifact(snapshot())
    console.log(
      `  checkpoint: ${Object.keys(stems).length} stems `
      + `(${ji + 1}/${jobs.length}) | day ${rateLimit.requests} req / ~${rateLimit.estTokens} tok`,
    )
  }

  writeArtifact(snapshot())
  console.log(`Wrote ${OUT}`)
  console.log(`Stems: ${Object.keys(stems).length} | this run baked ${baked}, dropped ${dropped}, pruned ${prunedStale}`)
  if (stoppedForBudget) {
    console.log('Stopped on free-tier soft budget — re-run the same command to continue.')
  }
  if (dropped > 0) {
    const byReason = drops.reduce<Record<string, number>>((acc, d) => {
      acc[d.reason] = (acc[d.reason] ?? 0) + 1
      return acc
    }, {})
    console.log('Drop reasons:', byReason)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
