#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(__dirname, '..')
const questionBankPath = resolve(appRoot, 'src/lib/questionBank.ts')
const backlogPath = resolve(appRoot, 'content/generatedQuestions.json')
const apiKey = process.env.GEMINI_API_KEY

const CONCEPTS = [
  'linear_equations',
  'linear_inequalities',
  'absolute_value',
  'quadratic_equations',
  'functions_basics',
  'systems_of_linear_equations',
  'exponent_rules',
  'polynomials',
  'rational_expressions',
  'function_transformations',
  'number_properties',
  'word_problems',
  'percent_ratio',
  'descriptive_statistics',
  'basic_probability',
]

const LEVELS = [1, 2, 3]
const QUESTIONS_PER_RUN = 5

if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in environment.')
  process.exit(1)
}

function collectExistingIds(questionBankSource, backlog) {
  const ids = new Set([...questionBankSource.matchAll(/id:\s*['"]([^'"]+)['"]/g)].map(match => match[1]))
  for (const batch of backlog.batches ?? []) {
    for (const question of batch.questions ?? []) {
      if (typeof question.id === 'string') ids.add(question.id)
    }
  }
  return ids
}

function nextTarget(backlog) {
  const completedRuns = Array.isArray(backlog.batches) ? backlog.batches.length : 0
  const concept = CONCEPTS[completedRuns % CONCEPTS.length]
  const level = LEVELS[Math.floor(completedRuns / CONCEPTS.length) % LEVELS.length]
  return { conceptId: concept, level }
}

function assertQuestionShape(question, index, conceptId, level, existingIds) {
  const prefix = `Question ${index + 1}`
  if (typeof question !== 'object' || question === null || Array.isArray(question)) {
    throw new Error(`${prefix} is not an object.`)
  }
  if (typeof question.id !== 'string' || question.id.length < 4) {
    throw new Error(`${prefix} has an invalid id.`)
  }
  if (existingIds.has(question.id)) throw new Error(`${prefix} id already exists: ${question.id}`)
  if (question.conceptId !== conceptId) throw new Error(`${prefix} has the wrong conceptId.`)
  if (question.level !== level) throw new Error(`${prefix} has the wrong level.`)
  if (typeof question.question !== 'string' || question.question.length < 12) {
    throw new Error(`${prefix} has an invalid question.`)
  }
  if (!Array.isArray(question.choices) || question.choices.length !== 4 || !question.choices.every(choice => typeof choice === 'string')) {
    throw new Error(`${prefix} must have exactly 4 string choices.`)
  }
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex > 3) {
    throw new Error(`${prefix} has an invalid correctIndex.`)
  }
  if (typeof question.explanation !== 'string' || question.explanation.length < 40) {
    throw new Error(`${prefix} explanation is too short.`)
  }
  if (!Array.isArray(question.hints) || question.hints.length !== 3 || !question.hints.every(hint => typeof hint === 'string')) {
    throw new Error(`${prefix} must have exactly 3 string hints.`)
  }
  if (question.examTag !== undefined && !['ACT', 'SAT', 'IB', 'AP'].includes(question.examTag)) {
    throw new Error(`${prefix} has an invalid examTag.`)
  }
}

async function generateQuestions(conceptId, level, existingIds) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: `You generate original MindCraft math exam-prep questions.

Return exactly ${QUESTIONS_PER_RUN} questions as valid JSON only.
Each object must match:
{
  "id": "concept-abbrev-level-number",
  "conceptId": string,
  "level": 1 | 2 | 3,
  "question": string,
  "choices": string[],
  "correctIndex": number,
  "explanation": string,
  "hints": string[],
  "examTag": "ACT" | "SAT" | "IB" | "AP"
}

Rules:
- Use conceptId exactly: ${conceptId}
- Use level exactly: ${level}
- choices has exactly 4 choices and exactly one correct answer.
- correctIndex is 0, 1, 2, or 3.
- hints has exactly 3 progressive hints.
- explanation shows full working.
- Original only. Do not copy released or commercial exams.
- Avoid ambiguous wording and avoid "none of the above."
- IDs must be unique and must not be any of these existing IDs: ${[...existingIds].slice(-250).join(', ')}
`,
  })

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `Generate ${QUESTIONS_PER_RUN} ${conceptId} questions at level ${level}.` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.75,
    },
  })

  const parsed = JSON.parse(result.response.text().trim())
  if (!Array.isArray(parsed) || parsed.length !== QUESTIONS_PER_RUN) {
    throw new Error(`Expected ${QUESTIONS_PER_RUN} questions.`)
  }

  parsed.forEach((question, index) => assertQuestionShape(question, index, conceptId, level, existingIds))
  return parsed
}

const [questionBankSource, backlogRaw] = await Promise.all([
  readFile(questionBankPath, 'utf8'),
  readFile(backlogPath, 'utf8'),
])

const backlog = JSON.parse(backlogRaw)
if (!Array.isArray(backlog.batches)) backlog.batches = []

const target = nextTarget(backlog)
const existingIds = collectExistingIds(questionBankSource, backlog)
const questions = await generateQuestions(target.conceptId, target.level, existingIds)

backlog.batches.push({
  id: `batch-${new Date().toISOString()}`,
  createdAt: new Date().toISOString(),
  status: 'needs_review',
  source: 'gemini-1.5-flash',
  conceptId: target.conceptId,
  level: target.level,
  questions,
})

await writeFile(backlogPath, `${JSON.stringify(backlog, null, 2)}\n`)
console.log(`Stored ${questions.length} ${target.conceptId} L${target.level} questions in ${backlogPath}`)
