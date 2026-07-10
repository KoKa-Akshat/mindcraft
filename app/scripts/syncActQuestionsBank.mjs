#!/usr/bin/env node
/**
 * Lane B / B1 — sync ACT annotated bank → C5 Question[] for the frontend.
 *
 * Prefers ml/data/act/act_questions.bank.json when Lane A has emitted it;
 * otherwise converts ml/data/act/act_questions.json in-process (same contract).
 * Falls back to actMasterQuestionBank.generated.json for verified keys when the
 * raw bank's correct_answer text does not match normalized choices.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const laneAReady = resolve(repoRoot, 'ml/data/act/act_questions.bank.json')
const rawSrc = resolve(repoRoot, 'ml/data/act/act_questions.json')
const actMasterSrc = resolve(__dirname, '../src/data/actMasterQuestionBank.generated.json')
const dest = resolve(__dirname, '../src/data/actQuestionsBank.json')

const ACT_CHOICE_ORDER = 'ABCDEFGHJK'
const DISPLAY_LABELS = 'ABCDE'
const GAP = '__ontology_gap__'
const JUNK_CHOICES = new Set(['#', 'E.', 'D', 'E', '.', '-'])

const CONCEPT_ALIASES = {
  basic_equations: 'linear_equations',
}

function normText(s) {
  return String(s ?? '')
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'skill_gap'
}

function normalizeChoices(choices) {
  const ordered = Object.entries(choices ?? {}).sort(([a], [b]) => {
    const ai = ACT_CHOICE_ORDER.indexOf(a)
    const bi = ACT_CHOICE_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  const out = {}
  for (let i = 0; i < Math.min(5, ordered.length); i++) {
    out[[...DISPLAY_LABELS][i]] = ordered[i][1]
  }
  return out
}

function choiceTextsFromRaw(choices) {
  const normalized = normalizeChoices(choices)
  return [...DISPLAY_LABELS]
    .map(l => String(normalized[l] ?? '').trim())
    .filter(c => c && !JUNK_CHOICES.has(c))
}

function resolveCorrectIndex(correctAnswer, choiceTexts) {
  const ans = String(correctAnswer ?? '').trim()
  if (!ans) return -1

  const letter = ans.toUpperCase()
  if (letter.length === 1 && letter >= 'A' && letter <= 'E') {
    return [...DISPLAY_LABELS].indexOf(letter)
  }

  const nans = normText(ans)
  let idx = choiceTexts.findIndex(c => normText(c) === nans)
  if (idx >= 0) return idx

  idx = choiceTexts.findIndex(c => normText(c).replace(/ /g, '') === nans.replace(/ /g, ''))
  if (idx >= 0) return idx

  if (nans.includes('1.2') || nans.includes('6/5')) {
    idx = choiceTexts.findIndex(c => c.toLowerCase().includes('12 minutes'))
    if (idx >= 0) return idx
  }

  return -1
}

function difficultyToLevel(difficulty) {
  const d = String(difficulty ?? '').toLowerCase()
  if (d.includes('low') || d.includes('easy')) return 1
  return 2
}

function mintMisconceptionId(conceptId, skillGap) {
  const slug = slugify(skillGap.split(/[.;]/)[0] ?? 'skill_gap')
  return `mis_${conceptId}__${slug}`
}

function buildMasterStemIndex(master) {
  const byStem = new Map()
  for (const q of master) {
    const key = normText(q.question)
    if (key && !byStem.has(key)) byStem.set(key, q)
  }
  return byStem
}

function convertRawRecord(raw, masterByStem) {
  if (raw.concept_id === GAP) return null

  const stem = String(raw.stem ?? raw.summary ?? '').trim()
  if (stem.length < 12) return null
  if (stem.includes('value of ?') || stem.endsWith(' of ?')) return null

  const conceptId = CONCEPT_ALIASES[raw.concept_id] ?? raw.concept_id
  const skillGap = String(raw.skill_gap_if_wrong ?? '').trim()
  const misconceptionRisks = String(raw.misconception_risks ?? '').trim()
  const explanation = skillGap || misconceptionRisks || 'Review the solution steps for this ACT item.'
  const hints = [misconceptionRisks, skillGap].filter(Boolean).slice(0, 3)
  const misconception_id = skillGap ? mintMisconceptionId(conceptId, skillGap) : undefined

  const master = masterByStem.get(normText(stem))
  if (master?.choices?.length >= 4 && Number.isInteger(master.correctIndex)) {
    return {
      id: `act_ann_${raw.id}`,
      conceptId,
      level: master.level ?? difficultyToLevel(raw.difficulty),
      question: stem,
      choices: master.choices,
      correctIndex: master.correctIndex,
      explanation,
      hints,
      examTag: 'ACT',
      format: master.format,
      storyContext: master.storyContext,
      misconception_id,
    }
  }

  const choiceTexts = choiceTextsFromRaw(raw.choices)
  if (choiceTexts.length < 4) return null

  const correctIndex = resolveCorrectIndex(raw.correct_answer, choiceTexts)
  if (correctIndex < 0 || correctIndex >= choiceTexts.length) return null

  return {
    id: `act_ann_${raw.id}`,
    conceptId,
    level: difficultyToLevel(raw.difficulty),
    question: stem,
    choices: choiceTexts,
    correctIndex,
    explanation,
    hints,
    examTag: 'ACT',
    misconception_id,
  }
}

async function convertRawBank() {
  const raw = JSON.parse(await readFile(rawSrc, 'utf8'))
  const master = JSON.parse(await readFile(actMasterSrc, 'utf8'))
  const masterByStem = buildMasterStemIndex(master)
  const out = []
  const seenIds = new Set()

  for (const record of raw) {
    const q = convertRawRecord(record, masterByStem)
    if (!q || seenIds.has(q.id)) continue
    seenIds.add(q.id)
    out.push(q)
  }
  return out
}

async function main() {
  await mkdir(dirname(dest), { recursive: true })

  let questions
  try {
    await readFile(laneAReady, 'utf8')
    await copyFile(laneAReady, dest)
    questions = JSON.parse(await readFile(dest, 'utf8'))
    console.log(`synced Lane A bank ${laneAReady} → ${dest} (${questions.length} questions)`)
  } catch {
    questions = await convertRawBank()
    await writeFile(dest, `${JSON.stringify(questions, null, 2)}\n`)
    console.log(`converted ${rawSrc} → ${dest} (${questions.length} annotated C5 questions)`)
  }
}

await main()
