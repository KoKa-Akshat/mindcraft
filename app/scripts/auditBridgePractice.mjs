import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()

function loadTsModule(relativePath, replacements = {}) {
  let source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  for (const [from, to] of Object.entries(replacements)) {
    source = source.replaceAll(from, to)
  }

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  }).outputText

  const dataUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
  return import(dataUrl)
}

const conceptMap = await loadTsModule('src/lib/conceptMap.ts')
globalThis.__conceptMap = conceptMap

const bridge = await loadTsModule('src/lib/bridgePractice.ts', {
  "import { PREREQUISITES } from './conceptMap'": 'const { PREREQUISITES } = globalThis.__conceptMap',
})

const {
  getAtomicPrereqPath,
  buildBridgeRecommendations,
  getRecommendedLevel,
} = bridge

assert.deepEqual(getRecommendedLevel('hard'), 1, 'hard maps to Level 1')
assert.deepEqual(getRecommendedLevel('kinda'), 2, 'kinda maps to Level 2')
assert.deepEqual(getRecommendedLevel('easy'), 3, 'easy maps to Level 3')
assert.deepEqual(getRecommendedLevel(undefined), 3, 'unknown confidence defaults to challenge')

const direct = getAtomicPrereqPath('coordinate_geometry', new Set(['linear_equations']))
assert.equal(direct?.fromId, 'linear_equations', 'finds direct algebra -> coordinate geometry bridge')
assert.deepEqual(direct?.viaIds, ['linear_equations'], 'direct bridge keeps exact atomic path')

const multistep = getAtomicPrereqPath('trigonometry_basics', new Set(['functions_basics']))
assert.equal(multistep?.fromId, 'functions_basics', 'finds multi-step functions -> trig bridge')
assert.deepEqual(multistep?.viaIds, ['functions_basics'])

const deeper = getAtomicPrereqPath('derivatives', new Set(['linear_equations']))
assert.equal(deeper?.fromId, 'linear_equations', 'finds deeper algebra -> derivatives bridge')
assert.deepEqual(deeper?.viaIds, ['functions_basics', 'linear_equations'])

assert.equal(getAtomicPrereqPath('linear_equations', new Set(['descriptive_statistics'])), null, 'unrelated strength does not fake a bridge')
assert.equal(getAtomicPrereqPath('unknown_concept', new Set(['linear_equations'])), null, 'unknown target is safe')

const noneWithoutStrength = buildBridgeRecommendations({
  coordinate_geometry: 'hard',
  trigonometry_basics: 'kinda',
})
assert.deepEqual(noneWithoutStrength, [], 'no confident source means no bridge recommendations')

const recs = buildBridgeRecommendations({
  linear_equations: 'easy',
  coordinate_geometry: 'hard',
  systems_of_linear_equations: 'hard',
  word_problems: 'kinda',
}, 10)
assert.deepEqual(
  recs.map(r => `${r.fromId}->${r.toId}:L${r.level}`),
  [
    'linear_equations->coordinate_geometry:L1',
    'linear_equations->systems_of_linear_equations:L1',
    'linear_equations->word_problems:L2',
  ],
  'builds ordered bridge recommendations with level mapping',
)

const limited = buildBridgeRecommendations({
  linear_equations: 'easy',
  coordinate_geometry: 'hard',
  systems_of_linear_equations: 'hard',
  word_problems: 'kinda',
}, 2)
assert.equal(limited.length, 2, 'respects recommendation limit')

console.log('Bridge practice audit passed.')
