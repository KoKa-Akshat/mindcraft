#!/usr/bin/env node
import { GoogleGenerativeAI } from '@google/generative-ai'

const VALID_LEVELS = new Set(['1', '2', '3'])
const [conceptId, levelArg] = process.argv.slice(2)
const apiKey = process.env.GEMINI_API_KEY

if (!conceptId || !VALID_LEVELS.has(levelArg ?? '')) {
  console.error('Usage: GEMINI_API_KEY=... node scripts/generateQuestions.mjs <conceptId> <level: 1|2|3>')
  process.exit(1)
}

if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in environment.')
  process.exit(1)
}

const level = Number(levelArg)
const levelGuide = {
  1: 'L1 Foundation: direct substitution, one core skill, minimal context.',
  2: 'L2 Applied: two-step reasoning, light context, one common trap.',
  3: 'L3 Exam Ready: multi-step ACT/SAT/IB style, realistic wording, requires setup before solving.',
}

const systemPrompt = `
You are generating original math exam-prep multiple-choice questions for MindCraft.

Return exactly 5 questions as valid JSON only. Do not wrap the response in markdown.
The JSON must be an array of objects matching this TypeScript interface:

interface Question {
  id: string
  conceptId: string
  level: 1 | 2 | 3
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
  hints: string[]
  examTag?: 'ACT' | 'SAT' | 'IB' | 'AP'
}

Quality rules:
- Questions must be original, not copied from released ACT, SAT, IB, or commercial question banks.
- Use the requested conceptId exactly: "${conceptId}".
- Use the requested level exactly: ${level}.
- Difficulty target: ${levelGuide[level]}.
- choices must contain exactly 4 plausible options and exactly one correct answer.
- correctIndex must be the zero-based index of the correct choice.
- explanation must show full working, including setup and arithmetic.
- hints must be a progressive ladder:
  1. Vague strategic nudge.
  2. More specific setup or rule.
  3. Almost gives away the solving step without stating the final choice.
- examTag must be one of "ACT", "SAT", "IB", or "AP".
- Use concise student-facing wording and avoid trick ambiguity.
- IDs must be unique and start with "${conceptId}-${level}-ai-".
`

const userPrompt = `Generate 5 new ${conceptId} questions at level ${level}.`

const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  systemInstruction: systemPrompt,
})

function assertQuestionShape(question, index) {
  const prefix = `Question ${index + 1}`
  if (typeof question !== 'object' || question === null || Array.isArray(question)) {
    throw new Error(`${prefix} is not an object.`)
  }
  if (typeof question.id !== 'string' || !question.id.startsWith(`${conceptId}-${level}-ai-`)) {
    throw new Error(`${prefix} has an invalid id.`)
  }
  if (question.conceptId !== conceptId) throw new Error(`${prefix} has the wrong conceptId.`)
  if (question.level !== level) throw new Error(`${prefix} has the wrong level.`)
  if (typeof question.question !== 'string' || question.question.length < 12) {
    throw new Error(`${prefix} has an invalid question.`)
  }
  if (!Array.isArray(question.choices) || question.choices.length !== 4 || !question.choices.every(choice => typeof choice === 'string')) {
    throw new Error(`${prefix} must have exactly 4 string choices.`)
  }
  if (![0, 1, 2, 3].includes(question.correctIndex)) {
    throw new Error(`${prefix} has an invalid correctIndex.`)
  }
  if (typeof question.explanation !== 'string' || question.explanation.length < 30) {
    throw new Error(`${prefix} explanation is too short.`)
  }
  if (!Array.isArray(question.hints) || question.hints.length !== 3 || !question.hints.every(hint => typeof hint === 'string')) {
    throw new Error(`${prefix} must have exactly 3 string hints.`)
  }
  if (question.examTag !== undefined && !['ACT', 'SAT', 'IB', 'AP'].includes(question.examTag)) {
    throw new Error(`${prefix} has an invalid examTag.`)
  }
}

try {
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.75,
    },
  })

  const text = result.response.text().trim()
  const questions = JSON.parse(text)

  if (!Array.isArray(questions) || questions.length !== 5) {
    throw new Error('Model response must be an array of exactly 5 questions.')
  }

  questions.forEach(assertQuestionShape)
  console.log(JSON.stringify(questions, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Question generation failed.')
  process.exit(1)
}
