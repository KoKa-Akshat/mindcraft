#!/usr/bin/env node
/**
 * bake-themed-stems-local.mjs
 *
 * Offline themed-stem bake WITHOUT Groq — agent/local compositor.
 * Uses conceptStories + questionContextFrames (+ scenes when present) to
 * weave each plain bank stem into its story world while keeping every
 * digit-run from the original (C-3).
 *
 * Key: {conceptId}__{storyId}__{questionId}  (storyId === conceptId for chapter stories)
 *
 *   node app/scripts/bakeThemedStemsLocal.mjs
 *   node app/scripts/bakeThemedStemsLocal.mjs --force   # overwrite existing stems
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = resolve(__dirname, '../src/data')
const OUT = resolve(DATA, 'themedStems.generated.json')
const BAKE_VERSION = 2
const MODEL = 'cursor-local-baker-v1'

const force = process.argv.includes('--force')

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

function asQuestions(raw) {
  if (Array.isArray(raw)) return raw
  if (raw?.questions && Array.isArray(raw.questions)) return raw.questions
  return []
}

function loadBank() {
  const files = [
    'generatedQuestions.json',
    'actMasterQuestionBank.generated.json',
    'actQuestionsBank.json',
    'eediQuestions.json',
    'openstaxQuestions.json',
    'openstaxMCQ.json',
    'khanQuestions.json',
  ]
  const byId = new Map()
  for (const f of files) {
    const p = resolve(DATA, f)
    if (!existsSync(p)) continue
    for (const q of asQuestions(readJson(p))) {
      if (!q?.id || !q.conceptId || !q.question || !Array.isArray(q.choices)) continue
      if (!Number.isInteger(q.correctIndex) || typeof q.explanation !== 'string') continue
      if (q.choices.length < 2) continue
      if (q.correctIndex < 0 || q.correctIndex >= q.choices.length) continue
      if (!byId.has(q.id)) byId.set(q.id, q)
    }
  }
  return [...byId.values()]
}

function bankHash(questions) {
  const h = createHash('sha256')
  for (const q of [...questions].sort((a, b) => a.id.localeCompare(b.id))) {
    h.update(`${q.conceptId}\0${q.id}\0${q.question}\n`)
  }
  return h.digest('hex').slice(0, 16)
}

function safeIdPart(s) {
  return String(s).replace(/\//g, '_').slice(0, 180)
}

function themedStemKey(conceptId, questionId, storyId) {
  const cid = conceptId === 'diagnostic_mixed' ? 'mixed' : conceptId
  const sid = storyId || cid
  return `${safeIdPart(cid)}__${safeIdPart(sid)}__${safeIdPart(questionId)}`
}

function numbersPreserved(original, story) {
  const nums = original.match(/\d+(?:\.\d+)?/g) ?? []
  return nums.every(n => story.includes(n))
}

function stripVoice(s) {
  return String(s || '')
    .replace(/—/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
}

function hashPick(id, n) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % Math.max(1, n)
}

const OPENERS = [
  (p, setting) => `${setting}. ${p} needs a clean answer before moving on.`,
  (p, setting) => `At ${setting.replace(/^At\s+/i, '')}, ${p} stops at a problem that will not wait.`,
  (p, setting) => `${setting}. ${p} sets the page straight and reads the ask aloud.`,
  (p, setting) => `${setting}. For ${p}, this is not drill: the numbers decide the next step.`,
  (p, setting) => `${setting}. ${p} encounters the following exact question in the work at hand.`,
]

/**
 * Weave: story-world scene + optional bridge + the original stem verbatim.
 * Verbatim ask guarantees numeric preservation (C-3) while the scene puts it
 * inside the concept's story (story-first convention).
 */
function composeStem(q, storyEntry, frame) {
  const protagonist = stripVoice(frame?.protagonist || storyEntry.conceptName || 'The scholar')
  const scenes = Array.isArray(storyEntry.scenes) ? storyEntry.scenes : []
  const scene = scenes.length ? scenes[hashPick(q.id, scenes.length)] : null
  const setting = stripVoice(
    scene?.settingLine || frame?.settingLine || `In the world of ${protagonist}`,
  )
  const bridge = stripVoice(
    scene?.questionBridge || frame?.questionBridge || `${protagonist} needs this solved.`,
  )
  const opener = OPENERS[hashPick(q.id + 'op', OPENERS.length)](protagonist, setting)
  const ask = stripVoice(q.question)

  // Avoid duplicating if bridge already ends into the ask awkwardly — join cleanly.
  let stem = `${opener} ${bridge} ${ask}`
  stem = stem.replace(/\s+/g, ' ').trim()

  // Soft length clamp: keep the ask intact; trim opener/bridge if needed.
  if (stem.length > 2200) {
    const room = 2200 - ask.length - 1
    const head = `${opener} ${bridge}`.trim().slice(0, Math.max(40, room))
    stem = `${head} ${ask}`.replace(/\s+/g, ' ').trim()
  }
  if (stem.length < 20) stem = ask
  return stem
}

function isValidStem(original, stem) {
  if (typeof stem !== 'string' || stem.trim().length < 20) return false
  if (stem.length > 2200) return false
  if (/<script|<svg|<iframe|javascript:|on\w+=/i.test(stem)) return false
  if (stem.includes('—')) return false
  return numbersPreserved(original, stem)
}

const stories = readJson(resolve(DATA, 'conceptStories.json'))
const frames = readJson(resolve(DATA, 'questionContextFrames.json'))
const bank = loadBank()
const hash = bankHash(bank)

let existing = { stems: {}, drops: [] }
if (existsSync(OUT)) {
  try { existing = readJson(OUT) } catch { /* fresh */ }
}

const stems = { ...(existing.stems || {}) }
const drops = []
let baked = 0
let skipped = 0
let dropped = 0
let skippedNoStory = 0

const liveKeys = new Set()
for (const q of bank) {
  if (!stories[q.conceptId]?.story) {
    skippedNoStory++
    continue
  }
  const storyId = q.conceptId
  const key = themedStemKey(q.conceptId, q.id, storyId)
  liveKeys.add(key)

  if (!force && stems[key]) {
    skipped++
    continue
  }

  const storyEntry = stories[q.conceptId]
  const frame = frames[q.conceptId]
  const stem = composeStem(q, storyEntry, frame)
  if (isValidStem(q.question, stem)) {
    stems[key] = stem
    baked++
  } else {
    drops.push({
      key,
      questionId: q.id,
      storyId,
      reason: numbersPreserved(q.question, stem) ? 'validation_failed' : 'numeric_preservation',
    })
    dropped++
    delete stems[key]
  }
}

let prunedStale = 0
for (const key of Object.keys(stems)) {
  if (!liveKeys.has(key)) {
    delete stems[key]
    prunedStale++
  }
}

const artifact = {
  bakeVersion: BAKE_VERSION,
  sourceBankHash: hash,
  generatedAt: new Date().toISOString(),
  model: MODEL,
  stems,
  drops: drops.slice(-500),
  stats: {
    bankSize: bank.length,
    eligible: bank.length - skippedNoStory,
    attempted: baked + dropped,
    baked: Object.keys(stems).length,
    dropped,
    skippedNoStory,
    prunedStale,
    skippedExisting: skipped,
  },
}

writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(`Wrote ${OUT}`)
console.log(`Stems: ${Object.keys(stems).length} | newly baked ${baked}, dropped ${dropped}, kept existing ${skipped}, pruned ${prunedStale}`)
