#!/usr/bin/env node
/**
 * syncQuestionOntologyLayers.mjs
 *
 * Mirrors two READ-ONLY slices of the Engine lane's 5-layer ontology
 * (ml/data/5_level_ontology/**) into the Product lane (app/src/data/) so
 * nothing under app/** ever imports from ml/data/** directly (that would be
 * a soft lane dependency across the Engine/Product boundary in CLAUDE.md).
 *
 * This script only READS ml/data/5_level_ontology/*.json, it never writes
 * there. Re-run any time the Engine lane's Layer 2/3 files change:
 *
 *   node app/scripts/syncQuestionOntologyLayers.mjs
 *
 * Outputs:
 *   app/src/data/questionArchetypes.json
 *     Full mirror of Layer 2 (all 84 question archetypes, verbatim). Small
 *     file (~280KB source); kept complete so any concept can look up its
 *     archetypes later without re-running this script with a new filter.
 *
 *   app/src/data/questionArchetypeLinks.json
 *     A trimmed slice of Layer 3 (question_instance_bank): every question
 *     instance that carries a real `links.question_archetype_ids` link
 *     (342 of 450 in the seed bank, the rest have no archetype tag yet).
 *     Verbose tutor-annotation prose (`intelligence.*`) is dropped; only the
 *     fields useful for concept -> archetype -> question-instance linkage
 *     and light scene grounding are kept: id, source citation, the raw
 *     question text/choices, and the full `links` block (archetype ids,
 *     concept ids, ingredient ids, misconception ids). This is genuinely
 *     concept-agnostic: any concept can filter this same file by
 *     `links.primary_concept_ids` later; nothing here is fractions_decimals-
 *     specific.
 *
 * Both outputs are plain data mirrors, nothing in app/** should ever
 * import ml/data/** paths. If Layer 2/3 shapes change upstream, re-run this
 * script and diff the two JSON outputs before committing.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LAYER2_SRC = resolve(__dirname, '../../ml/data/5_level_ontology/02_question_archetype_ontology_v1_6_standardized.json')
const LAYER3_SRC = resolve(__dirname, '../../ml/data/5_level_ontology/03_question_instance_bank_schema_and_seed_v1_6.json')
const LAYER2_DEST = resolve(__dirname, '../src/data/questionArchetypes.json')
const LAYER3_DEST = resolve(__dirname, '../src/data/questionArchetypeLinks.json')

async function main() {
  const layer2 = JSON.parse(await readFile(LAYER2_SRC, 'utf8'))
  const layer3 = JSON.parse(await readFile(LAYER3_SRC, 'utf8'))

  const archetypesOut = {
    _meta: {
      mirroredFrom: 'ml/data/5_level_ontology/02_question_archetype_ontology_v1_6_standardized.json',
      mirroredAt: new Date().toISOString(),
      regenerate: 'node app/scripts/syncQuestionOntologyLayers.mjs',
      note: 'Full verbatim mirror of Layer 2 (all archetypes). Read-only copy, never import ml/data/** directly from app/**.',
    },
    archetypes: layer2.archetypes,
  }

  const linkedInstances = layer3.question_instances
    .filter(q => (q.links?.question_archetype_ids ?? []).length > 0)
    .map(q => ({
      question_instance_id: q.question_instance_id,
      source: {
        test_name: q.source?.test_name,
        question_number: q.source?.question_number,
      },
      raw_question: {
        text: q.raw_question?.text,
        choices: q.raw_question?.choices,
      },
      links: q.links,
    }))

  const linksOut = {
    _meta: {
      mirroredFrom: 'ml/data/5_level_ontology/03_question_instance_bank_schema_and_seed_v1_6.json',
      mirroredAt: new Date().toISOString(),
      regenerate: 'node app/scripts/syncQuestionOntologyLayers.mjs',
      note: `Trimmed slice of Layer 3: the ${linkedInstances.length} of ${layer3.question_instances.length} seed question instances that carry a real question_archetype_ids link. Verbose intelligence/tutor-annotation prose is dropped on purpose, only linkage fields (archetype/concept/ingredient/misconception ids) plus the raw question text/choices for grounding are kept. Concept-agnostic: filter by links.primary_concept_ids for any concept, not just fractions_decimals.`,
    },
    questionInstances: linkedInstances,
  }

  await mkdir(dirname(LAYER2_DEST), { recursive: true })
  await writeFile(LAYER2_DEST, JSON.stringify(archetypesOut, null, 2) + '\n')
  await writeFile(LAYER3_DEST, JSON.stringify(linksOut, null, 2) + '\n')

  console.log(`synced ${LAYER2_SRC} -> ${LAYER2_DEST} (${layer2.archetypes.length} archetypes)`)
  console.log(`synced ${LAYER3_SRC} -> ${LAYER3_DEST} (${linkedInstances.length} linked question instances)`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
