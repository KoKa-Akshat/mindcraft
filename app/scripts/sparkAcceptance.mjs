#!/usr/bin/env node
/**
 * sparkAcceptance.mjs — First Spark offline-weave acceptance matrix.
 *
 * Runs the 12-pair brief matrix (FIRST_SPARK_FABLE5_BRIEF.md §F) plus
 * thin-lexicon / regression pairs through the deterministic engine and
 * checks, per pair:
 *   1. the woven intro references BOTH interests (raw word or scene noun)
 *   2. a flagship-quality cell was chosen (has templates + protagonist)
 *   3. world feedback exists for both outcomes, with no em dashes anywhere
 *
 * Mechanic authenticity (the situation/task/action/result bar — see
 * agent_work/product/STORY_QUESTION_QUALITY_GUIDE.md) can't be asserted by
 * string checks: the script prints cell + concept per pair for eyeballing.
 *
 * Run: node app/scripts/sparkAcceptance.mjs
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fuse, normalize } from '../public/demo/v2/spark-engine.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const bank = JSON.parse(readFileSync(join(here, '..', 'public', 'demo', 'v2', 'spark-bank.json'), 'utf8'))

const MATRIX = [
  ['cooking', 'economics'],
  ['music', 'basketball'],
  ['fashion', 'math'],
  ['gaming', 'space'],
  ['nursing', 'science'],
  ['soccer', 'travel'],
  ['art', 'building'],
  ['cars', 'money'],
  ['dance', 'film'],
  ['animals', 'nature'],
  ['coding', 'gaming'],
  ['books', 'politics'],
]

const EXTRA = [
  ['chemistry', 'math'],       // the reported failure: must NOT be a blind-draw
  ['math', 'chemistry'],       // order flip
  ['science', 'math'],         // thin entry + broad entry
  ['space', 'travel'],         // two discovery interests, measurement-native
  ['knitting', 'math'],        // unmatched input + thin entry (graceful fallback)
]

function mentions(intro, resolvedRaw, sceneNoun) {
  const hay = normalize(intro)
  return hay.includes(normalize(resolvedRaw)) || (sceneNoun && hay.includes(normalize(sceneNoun)))
}

let failures = 0
for (const pair of [...MATRIX, ...EXTRA]) {
  const p = fuse(pair, bank)
  const cell = bank.questions.find(q => q.id === p.questionId)
  const lex = bank.lexicon
  const nounOf = raw => {
    const key = Object.keys(lex).find(k => normalize(k) === normalize(raw)
      || (lex[k].aliases ?? []).some(a => normalize(a) === normalize(raw)))
    return key ? lex[key].scene_noun : `the world of ${normalize(raw)}`
  }
  const problems = []
  if (!mentions(p.storyIntro, pair[0], nounOf(pair[0]))) problems.push(`intro misses "${pair[0]}"`)
  if (!mentions(p.storyIntro, pair[1], nounOf(pair[1]))) problems.push(`intro misses "${pair[1]}"`)
  if (!(cell.introTemplates ?? []).length) problems.push('non-flagship cell (no templates)')
  if (!cell.protagonist) problems.push('cell has no protagonist')
  if (!p.worldFeedback?.correct || !p.worldFeedback?.incorrect) problems.push('missing world feedback')
  const visible = [p.storyIntro, p.storyStem, ...p.choices, p.worldFeedback.correct, p.worldFeedback.incorrect].join(' ')
  if (visible.includes('—')) problems.push('em dash in visitor-visible text')

  const status = problems.length ? 'FAIL' : 'ok'
  if (problems.length) failures++
  console.log(`[${status}] ${pair.join(' + ')} -> ${p.clusterId} / ${p.questionId} (${p.conceptId})`)
  console.log(`       intro: ${p.storyIntro}`)
  if (problems.length) console.log(`       problems: ${problems.join('; ')}`)
}
console.log(failures ? `\n${failures} pair(s) failed` : '\nall pairs passed')
process.exit(failures ? 1 : 0)
