#!/usr/bin/env node
/**
 * Merge true-reskin chunk outputs into themedStems.generated.json
 * Usage: node app/scripts/mergeThemedReskins.mjs [/tmp/reskin-out]
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = resolve(__dirname, '../src/data')
const OUT = resolve(DATA, 'themedStems.generated.json')
const IN_DIR = resolve(process.argv[2] || '/tmp/reskin-out')

function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')) }

function numbersPreserved(original, story) {
  const nums = original.match(/\d+(?:\.\d+)?/g) ?? []
  return nums.every(n => story.includes(n))
}

function isValid(original, stem) {
  if (typeof stem !== 'string' || stem.trim().length < 20 || stem.length > 2200) return false
  if (/<script|<svg|<iframe|javascript:|on\w+=/i.test(stem)) return false
  if (stem.includes('—')) return false
  return numbersPreserved(original, stem)
}

function loadBankById() {
  const files = [
    'generatedQuestions.json', 'actMasterQuestionBank.generated.json',
    'actQuestionsBank.json', 'eediQuestions.json',
    'openstaxQuestions.json', 'openstaxMCQ.json', 'khanQuestions.json',
  ]
  const byId = new Map()
  for (const f of files) {
    const p = resolve(DATA, f)
    if (!existsSync(p)) continue
    const raw = readJson(p)
    const arr = Array.isArray(raw) ? raw : (raw.questions || [])
    for (const q of arr) if (q?.id && !byId.has(q.id)) byId.set(q.id, q)
  }
  return byId
}

const byId = loadBankById()
const art = existsSync(OUT) ? readJson(OUT) : { stems: {}, drops: [], stats: {} }
const stems = { ...(art.stems || {}) }

let accepted = 0
let rejected = 0
const drops = []

const files = existsSync(IN_DIR)
  ? readdirSync(IN_DIR).filter(f => f.endsWith('.json'))
  : []

for (const f of files) {
  const payload = readJson(join(IN_DIR, f))
  const items = payload.stems || payload.items || payload
  const entries = Array.isArray(items)
    ? items.map(x => [x.key || `${x.conceptId}__${x.storyId || x.conceptId}__${x.id || x.questionId}`, x.stem || x.storyStem])
    : Object.entries(items)

  for (const [key, stem] of entries) {
    const parts = String(key).split('__')
    const qid = parts.length >= 3 ? parts.slice(2).join('__') : parts[parts.length - 1]
    const q = byId.get(qid)
    if (!q) {
      drops.push({ key, questionId: qid, reason: 'orphan' })
      rejected++
      continue
    }
    const clean = String(stem).replace(/—/g, ',').trim()
    if (!isValid(q.question, clean)) {
      drops.push({
        key,
        questionId: qid,
        storyId: parts[1],
        reason: numbersPreserved(q.question, clean) ? 'validation_failed' : 'numeric_preservation',
      })
      rejected++
      continue
    }
    stems[key] = clean
    accepted++
  }
}

const artifact = {
  bakeVersion: 2,
  sourceBankHash: art.sourceBankHash || 'pending',
  generatedAt: new Date().toISOString(),
  model: 'cursor-true-reskin-v1',
  stems,
  drops: [...(art.drops || []).slice(-200), ...drops].slice(-500),
  stats: {
    ...(art.stats || {}),
    baked: Object.keys(stems).length,
    trueReskinAccepted: accepted,
    trueReskinRejected: rejected,
    mergeFiles: files.length,
  },
}

writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(`Merged from ${files.length} files → accepted ${accepted}, rejected ${rejected}, total stems ${Object.keys(stems).length}`)
