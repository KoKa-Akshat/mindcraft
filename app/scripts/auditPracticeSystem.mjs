#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(__dirname, '..')
const questionBankPath = resolve(appRoot, 'src/lib/questionBank.ts')
const practicePath = resolve(appRoot, 'src/pages/Practice.tsx')

const LEVELS = [1, 2, 3]
const SESSION_LENGTH = 10
const ADVANCED_EXPECTATIONS = {
  ACT: ['linear_equations', 'quadratic_equations', 'functions_basics', 'percent_ratio', 'basic_probability', 'descriptive_statistics'],
  SAT: ['linear_equations', 'functions_basics', 'quadratic_equations', 'percent_ratio', 'descriptive_statistics'],
  IB: ['functions_basics', 'function_transformations', 'quadratic_equations', 'polynomials', 'rational_expressions', 'exponent_rules'],
  AP: ['functions_basics', 'function_transformations', 'polynomials', 'rational_expressions', 'exponent_rules'],
  General: ['linear_equations', 'quadratic_equations', 'functions_basics'],
}

function fail(message) {
  console.error(`FAIL ${message}`)
  process.exitCode = 1
}

function warn(message) {
  console.warn(`WARN ${message}`)
}

function pass(message) {
  console.log(`OK   ${message}`)
}

function extractPracticeConcepts(source) {
  const block = source.match(/export const PRACTICE_CONCEPTS[\s\S]*?=\s*\[([\s\S]*?)\n\]/)?.[1] ?? ''
  return [...block.matchAll(/id:\s*'([^']+)'/g)].map(match => match[1])
}

function extractExamMaps(source) {
  const block = source.match(/const EXAM_CONCEPT_IDS[\s\S]*?\n}/)?.[0] ?? ''
  const maps = {}
  for (const match of block.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
    maps[match[1]] = [...match[2].matchAll(/'([^']+)'/g)].map(item => item[1])
  }
  return maps
}

function extractQuestions(source) {
  const entries = []
  const objectPattern = /\{\s*id:\s*'([^']+)',\s*conceptId:\s*'([^']+)',\s*level:\s*([123]),?/g
  const matches = [...source.matchAll(objectPattern)]
  for (const [index, match] of matches.entries()) {
    const nextMatch = matches[index + 1]
    const raw = source.slice(match.index, nextMatch?.index ?? source.length)
    const tag = raw.match(/examTag:\s*'([^']+)'/)?.[1] ?? null
    entries.push({
      id: match[1],
      conceptId: match[2],
      level: Number(match[3]),
      examTag: tag,
    })
  }
  return entries
}

function countBy(items, keyFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

const [questionBankSource, practiceSource] = await Promise.all([
  readFile(questionBankPath, 'utf8'),
  readFile(practicePath, 'utf8'),
])

const practiceConcepts = extractPracticeConcepts(questionBankSource)
const practiceConceptSet = new Set(practiceConcepts)
const examMaps = extractExamMaps(practiceSource)
const activeExamConceptSet = new Set(Object.values(examMaps).flat())
const questions = extractQuestions(questionBankSource)

console.log('\nMindCraft Practice System Audit\n')

if (questions.length === 0) {
  fail('No static questions parsed from questionBank.ts')
} else {
  pass(`Parsed ${questions.length} static questions`)
}

const idCounts = countBy(questions, q => q.id)
const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1)
if (duplicateIds.length > 0) {
  fail(`Duplicate question IDs: ${duplicateIds.map(([id]) => id).join(', ')}`)
} else {
  pass('No duplicate static question IDs')
}

const invalidConceptQuestions = questions.filter(q => !practiceConceptSet.has(q.conceptId))
if (invalidConceptQuestions.length > 0) {
  fail(`Questions reference concepts missing from PRACTICE_CONCEPTS: ${[...new Set(invalidConceptQuestions.map(q => q.conceptId))].join(', ')}`)
} else {
  pass('All static question concepts exist in PRACTICE_CONCEPTS')
}

for (const conceptId of practiceConcepts) {
  for (const level of LEVELS) {
    const count = questions.filter(q => q.conceptId === conceptId && q.level === level).length
    if (count === 0 && activeExamConceptSet.has(conceptId)) fail(`${conceptId} L${level} has no static fallback questions`)
    else if (count === 0) warn(`${conceptId} L${level} has no static fallback questions yet (future concept, not in live exam maps)`)
    else if (count < 3) warn(`${conceptId} L${level} has only ${count} static fallback questions`)
  }
}
pass('Checked static fallback coverage by concept and level')

for (const [exam, concepts] of Object.entries(examMaps)) {
  const missing = concepts.filter(concept => !practiceConceptSet.has(concept))
  if (missing.length > 0) {
    fail(`${exam} map references missing concepts: ${missing.join(', ')}`)
  } else {
    pass(`${exam} concept map references valid practice concepts`)
  }

  const expected = ADVANCED_EXPECTATIONS[exam] ?? []
  const expectedMissing = expected.filter(concept => !concepts.includes(concept))
  if (expectedMissing.length > 0) {
    warn(`${exam} map is missing expected MVP concepts: ${expectedMissing.join(', ')}`)
  }

  for (const conceptId of concepts) {
    const byLevel = LEVELS.map(level => ({
      level,
      total: questions.filter(q => q.conceptId === conceptId && q.level === level).length,
      tagged: questions.filter(q => q.conceptId === conceptId && q.level === level && q.examTag === exam).length,
    }))
    const weakFallback = byLevel.filter(row => row.total < SESSION_LENGTH)
    if (weakFallback.length > 0) {
      warn(`${exam}/${conceptId} static fallback is below ${SESSION_LENGTH}: ${weakFallback.map(row => `L${row.level}=${row.total}`).join(', ')}`)
    }
    if (exam !== 'General') {
      const noTagged = byLevel.filter(row => row.tagged === 0)
      if (noTagged.length > 0) {
        warn(`${exam}/${conceptId} has no static ${exam}-tagged fallback at: ${noTagged.map(row => `L${row.level}`).join(', ')}`)
      }
    }
  }
}

if (process.env.RUN_REMOTE_QGEN === '1') {
  const endpoint = process.env.QGEN_ENDPOINT ?? 'https://mindcraft-webhook.vercel.app/api/generate-questions'
  const smoke = [
    { examType: 'ACT', conceptId: 'linear_equations', level: 1 },
    { examType: 'SAT', conceptId: 'functions_basics', level: 2 },
    { examType: 'IB', conceptId: 'quadratic_equations', level: 2 },
    { examType: 'AP', conceptId: 'function_transformations', level: 2 },
  ]
  for (const item of smoke) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, count: 3 }),
    })
    if (!res.ok) {
      fail(`Remote qgen ${item.examType}/${item.conceptId}/L${item.level} returned ${res.status}`)
      continue
    }
    const data = await res.json()
    const generated = Array.isArray(data.questions) ? data.questions : []
    const bad = generated.filter(q =>
      q.conceptId !== item.conceptId ||
      q.level !== item.level ||
      q.examTag !== item.examType ||
      !Array.isArray(q.choices) ||
      q.choices.length !== 4 ||
      !Number.isInteger(q.correctIndex) ||
      q.correctIndex < 0 ||
      q.correctIndex > 3
    )
    if (generated.length !== 3 || bad.length > 0) {
      fail(`Remote qgen ${item.examType}/${item.conceptId}/L${item.level} returned invalid shape`)
    } else {
      pass(`Remote qgen ${item.examType}/${item.conceptId}/L${item.level} shape OK`)
    }
  }
} else {
  console.log('\nRemote generation smoke test skipped. Run with RUN_REMOTE_QGEN=1 to hit /api/generate-questions.')
}

if (process.exitCode) {
  console.error('\nPractice audit failed.\n')
} else {
  console.log('\nPractice audit passed with warnings allowed.\n')
}
