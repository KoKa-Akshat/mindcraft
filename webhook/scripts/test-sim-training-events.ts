/**
 * scripts/test-sim-training-events.ts — real assertions against the actual
 * sim_training_events write path (lib/simTrainingEvents.ts), run through
 * captureSimTrainingEvents with a fake Firestore that records exactly what
 * would hit the wire. No credentials needed (the lib deliberately never
 * imports ../lib/firebase — see its header), so this runs anywhere:
 *
 *   npm run test-sim-training-events --prefix webhook
 *
 * Covers the PR1 acceptance list:
 *   1. Idempotent capture — two polls of one finished standalone job
 *      produce exactly ONE doc (same deterministic ID, .set() semantics).
 *   2. Book-path completeness — 2 passed + 1 rubric-failed sims produce 2
 *      fully-populated gatePassed docs and 1 failStage="rubric" doc.
 *   3. Privacy — no uid/student-identifying key appears anywhere in any
 *      written doc or doc path, asserted on the writes themselves.
 *   4. gatePassed is a real boolean on EVERY doc (PR2's filter key).
 *   5. createdAt is the server-timestamp sentinel, never a client string.
 */

import assert from 'node:assert/strict'
import { FieldValue } from 'firebase-admin/firestore'
import {
  SIM_TRAINING_EVENTS_COLLECTION,
  ServiceJobPayloadPR1,
  buildBackfillTrainingEvent,
  buildBookTrainingEvents,
  buildStandaloneTrainingEvent,
  captureSimTrainingEvents,
} from '../lib/simTrainingEvents'

class FakeDb {
  store = new Map<string, Record<string, unknown>>()
  setCalls: string[] = []
  collection(name: string) {
    return {
      doc: (id: string) => ({
        set: async (data: Record<string, unknown>) => {
          this.setCalls.push(`${name}/${id}`)
          this.store.set(`${name}/${id}`, data)
        },
      }),
    }
  }
}

const FORBIDDEN_KEYS = ['uid', 'userid', 'user_id', 'studentid', 'student_id', 'email', 'displayname']

function assertNoStudentIdentifiers(docPath: string, value: unknown, keyPath = ''): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoStudentIdentifiers(docPath, v, `${keyPath}[${i}]`))
    return
  }
  if (value && typeof value === 'object' && !(value instanceof FieldValue)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assert.ok(
        !FORBIDDEN_KEYS.includes(k.toLowerCase()),
        `student-identifying key "${keyPath}.${k}" written to ${docPath}`,
      )
      assertNoStudentIdentifiers(docPath, v, keyPath ? `${keyPath}.${k}` : k)
    }
  }
}

const pass = (label: string) => console.log(`[PASS] ${label}`)

// --------------------------------------------------------------- fixtures

const STANDALONE_PASSED: ServiceJobPayloadPR1 = {
  status: 'passed',
  phase: 'vision_gate',
  topic: 'how a lever amplifies force',
  usage: { input_tokens: 2459, output_tokens: 26374, input_price_per_mtok: 2, output_price_per_mtok: 10 },
  prompt_template_version: 'v1',
  generator_model: 'claude-sonnet-5',
  result: {
    title: 'Lever Balance',
    description: 'Interactive lever balance.',
    learning_objectives: ['Predict balance from torque'],
    lesson_plan: 'Warm-up, exploration, exit ticket.',
    references: ['https://en.wikipedia.org/wiki/Lever'],
    html: '<html>sim</html>',
    js: 'function setup(){}',
    concept_id: 'student_request::how_a_lever_amplifies_force',
    concept_label: 'how a lever amplifies force',
    rubric_percentage: 95,
    quality_gate_score: 85,
    prompt_template_version: 'v1',
    generator_model: 'claude-sonnet-5',
  },
}

const STANDALONE_RUBRIC_FAIL: ServiceJobPayloadPR1 = {
  status: 'no_good_result',
  phase: 'scoring',
  topic: 'quantum entanglement for toddlers',
  reason: "Generated but didn't clear the structural quality bar (61%, needs 85%).",
  fail_stage: 'rubric',
  rubric_percentage: 61,
  usage: { input_tokens: 2400, output_tokens: 18000, input_price_per_mtok: 2, output_price_per_mtok: 10 },
  prompt_template_version: 'v1',
  generator_model: 'claude-sonnet-5',
}

function bookPayload(): ServiceJobPayloadPR1 {
  const entry = (slug: string, label: string) => ({
    passed: true,
    concept_id: `student_request::${slug}`,
    concept_slug: slug,
    concept_label: label,
    subject_id: 'on_demand_test_topic',
    title: `${label} Sim`,
    description: 'd',
    learning_objectives: ['lo'],
    lesson_plan: 'lp',
    references: ['r'],
    html: `<html>${slug}</html>`,
    js: `// ${slug}`,
    rubric_percentage: 92,
    quality_gate_score: 86,
    generator_model: 'claude-sonnet-5',
  })
  return {
    status: 'passed',
    topic: 'test topic',
    estimated_cost_usd: 2.1,
    result: {
      title: 'Test Topic',
      html: '',
      chapters: [],
      generated_sims: [entry('intro', 'Intro'), entry('apply', 'Applying It')],
      failed_sims: [
        {
          passed: false,
          concept_id: 'student_request::core',
          concept_slug: 'core',
          concept_label: 'Core Idea',
          subject_id: 'on_demand_test_topic',
          fail_stage: 'rubric',
          fail_reason: 'Structural rubric 70%, needs 85%.',
          rubric_percentage: 70,
          generator_model: 'claude-sonnet-5',
        },
      ],
      prompt_template_version: 'v1',
    } as ServiceJobPayloadPR1['result'],
  }
}

// ------------------------------------------------------------------ tests

async function testIdempotentStandaloneCapture(): Promise<FakeDb> {
  const db = new FakeDb()
  const jobId = 'abc123job'
  // Two polls of the SAME finished job — the real repeat-poll scenario.
  for (let poll = 0; poll < 2; poll++) {
    const doc = buildStandaloneTrainingEvent(STANDALONE_PASSED, jobId)
    assert.ok(doc, 'terminal passed payload must build a doc')
    await captureSimTrainingEvents(db, [doc])
  }
  assert.equal(db.store.size, 1, `expected exactly ONE doc after two polls, got ${db.store.size}`)
  assert.equal(db.setCalls.length, 2, 'both polls must write (set-overwrite), proving .set() not .add()')
  assert.equal(db.setCalls[0], db.setCalls[1], 'both polls must target the SAME doc path')
  assert.equal(db.setCalls[0], `${SIM_TRAINING_EVENTS_COLLECTION}/${jobId}`, 'doc ID must be the jobId')
  pass('idempotent capture: two polls of one finished standalone job -> exactly one doc')

  const data = db.store.get(db.setCalls[0])!
  assert.equal(data.kind, 'standalone')
  assert.equal(data.gatePassed, true)
  assert.equal(data.lessonPlan, 'Warm-up, exploration, exit ticket.')
  assert.deepEqual(data.references, ['https://en.wikipedia.org/wiki/Lever'])
  assert.equal(data.js, 'function setup(){}', 'js must be captured as its own field')
  assert.equal(data.generatorModel, 'claude-sonnet-5')
  assert.equal(data.promptTemplateVersion, 'v1')
  assert.deepEqual(data.usage, { inputTokens: 2459, outputTokens: 26374 })
  assert.equal(data.source, 'live_student_request')
  pass('standalone passed doc carries full metadata (lessonPlan/references/js/usage/provenance)')

  // Failure capture, same jobId scheme.
  const failDoc = buildStandaloneTrainingEvent(STANDALONE_RUBRIC_FAIL, 'failjob1')
  assert.ok(failDoc)
  await captureSimTrainingEvents(db, [failDoc])
  const failData = db.store.get(`${SIM_TRAINING_EVENTS_COLLECTION}/failjob1`)!
  assert.equal(failData.gatePassed, false)
  assert.equal(failData.failStage, 'rubric')
  assert.equal(failData.rubricPercentage, 61)
  assert.ok(String(failData.failReason).includes('quality bar'))
  pass('standalone gate-fail doc captured with failStage/failReason/rubricPercentage')

  // Pre-PR1 engine payload (no fail_stage field) still maps a stage from phase.
  const legacy = buildStandaloneTrainingEvent(
    { ...STANDALONE_RUBRIC_FAIL, fail_stage: undefined },
    'failjob2',
  )
  assert.ok(legacy)
  assert.equal(legacy.data.failStage, 'rubric', 'phase "scoring" must map to failStage "rubric"')
  pass('legacy payload without fail_stage falls back to phase mapping')

  // Non-terminal and error payloads build nothing.
  assert.equal(buildStandaloneTrainingEvent({ status: 'running', phase: 'generating' }, 'x'), null)
  assert.equal(buildStandaloneTrainingEvent({ status: 'error', detail: 'boom' }, 'x'), null)
  pass('running/error payloads are not captured')
  return db
}

async function testBookPathCompleteness(): Promise<FakeDb> {
  const db = new FakeDb()
  const jobId = 'bookjob99'
  const docs = buildBookTrainingEvents(bookPayload(), jobId)
  assert.equal(docs.length, 3, `2 passed + 1 failed must yield 3 docs, got ${docs.length}`)
  await captureSimTrainingEvents(db, docs)
  // Repeat poll — same payload, same jobId — must NOT add docs.
  await captureSimTrainingEvents(db, buildBookTrainingEvents(bookPayload(), jobId))
  assert.equal(db.store.size, 3, 'repeat poll must rewrite the same 3 docs, not duplicate')
  pass('book path: repeat poll rewrites the same {jobId}_{conceptSlug} docs')

  const intro = db.store.get(`${SIM_TRAINING_EVENTS_COLLECTION}/${jobId}_intro`)!
  const apply = db.store.get(`${SIM_TRAINING_EVENTS_COLLECTION}/${jobId}_apply`)!
  const core = db.store.get(`${SIM_TRAINING_EVENTS_COLLECTION}/${jobId}_core`)!
  assert.ok(intro && apply && core, 'doc IDs must be {jobId}_{conceptSlug}')

  for (const [name, doc] of [['intro', intro], ['apply', apply]] as const) {
    assert.equal(doc.kind, 'book_section')
    assert.equal(doc.gatePassed, true)
    assert.equal(doc.subjectId, 'on_demand_test_topic')
    for (const field of ['title', 'description', 'html', 'js', 'lessonPlan', 'conceptId',
                         'conceptLabel', 'rubricPercentage', 'qualityGateScore',
                         'generatorModel', 'promptTemplateVersion'] as const) {
      assert.ok(doc[field] !== null && doc[field] !== undefined && doc[field] !== '',
        `passed book sim "${name}" missing ${field}`)
    }
    assert.ok(Array.isArray(doc.learningObjectives) && (doc.learningObjectives as unknown[]).length > 0)
    assert.equal(doc.failStage, undefined, 'passed docs must not carry failStage')
  }
  pass('book path: 2 passed entries fully populated (all metadata fields present)')

  assert.equal(core.gatePassed, false)
  assert.equal(core.failStage, 'rubric')
  assert.equal(core.rubricPercentage, 70)
  assert.ok(String(core.failReason).includes('70%'))
  pass('book path: 1 failed entry carries failStage="rubric" + reason + score')
  return db
}

async function testBackfillBuilder(): Promise<FakeDb> {
  const db = new FakeDb()
  const doc = buildBackfillTrainingEvent('the_pythagorean_theorem', {
    title: 'Pythagorean Explorer',
    description: 'd',
    html: '<html>x</html>',
    conceptId: 'student_request::the_pythagorean_theorem',
    conceptLabel: 'the pythagorean theorem',
    learningObjectives: ['lo'],
    rubricPercentage: 95,
    qualityGateScore: 85,
    topic: 'the pythagorean theorem',
    topicSlug: 'the_pythagorean_theorem',
    jobId: 'histjob1',
    createdAt: '2026-08-19T12:00:00.000Z',
    source: 'mindcraft-content-engine',
  })
  assert.ok(doc)
  assert.equal(doc.docId, 'histjob1', 'backfill must reuse the jobId so live capture converges on it')
  await captureSimTrainingEvents(db, [doc])
  const data = db.store.get(`${SIM_TRAINING_EVENTS_COLLECTION}/histjob1`)!
  assert.equal(data.gatePassed, true)
  assert.equal(data.lessonPlan, null, 'unrecoverable fields must be honest nulls, not fabricated')
  assert.equal(data.js, null)
  assert.equal(data.backfilledFrom, 'generated_sims')
  assert.equal(data.originalCreatedAt, '2026-08-19T12:00:00.000Z')
  assert.equal(buildBackfillTrainingEvent('empty', { title: 'no html' }), null,
    'library docs without html are skipped')
  pass('backfill builder: converges on jobId doc, honest nulls, skips html-less docs')
  return db
}

function testEveryWrittenDoc(dbs: FakeDb[]): void {
  let checked = 0
  for (const db of dbs) {
    for (const [path, data] of db.store.entries()) {
      // Privacy: asserted on the actual write payloads and paths.
      assertNoStudentIdentifiers(path, data)
      assert.ok(!/uid/i.test(path), `doc path must never encode a uid: ${path}`)
      // gatePassed must be a real boolean on every doc — PR2 filters on it.
      assert.equal(typeof data.gatePassed, 'boolean', `${path} gatePassed must be boolean`)
      // createdAt must be the server-timestamp sentinel, never a string.
      assert.ok(data.createdAt instanceof FieldValue, `${path} createdAt must be FieldValue.serverTimestamp()`)
      assert.ok(
        (data.createdAt as FieldValue).isEqual(FieldValue.serverTimestamp()),
        `${path} createdAt must be the serverTimestamp sentinel specifically`,
      )
      checked++
    }
  }
  // 2 standalone (pass + rubric-fail) + 3 book (2 pass + 1 fail) + 1 backfill
  assert.equal(checked, 6, `expected to have checked all 6 written docs, got ${checked}`)
  pass(`privacy + gatePassed + server-authoritative createdAt verified on all ${checked} written docs`)
}

async function main() {
  const dbs = [
    await testIdempotentStandaloneCapture(),
    await testBookPathCompleteness(),
    await testBackfillBuilder(),
  ]
  testEveryWrittenDoc(dbs)
  console.log('\nALL PASS')
}

main().catch((e) => {
  console.error('\n[FAIL]', e)
  process.exit(1)
})
