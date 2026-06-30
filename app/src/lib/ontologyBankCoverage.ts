/**
 * ACT ontology vs static question bank coverage.
 * Data: app/src/data/actOntologyCoverage.json (regenerate via
 *   python3 ml/scripts/audit_act_ontology_question_bank.py)
 */
import coverageData from '../data/actOntologyCoverage.json'
import { questionCount } from './questionBank'
import { mlIdToLabel } from './conceptMap'

export type CoverageStatus =
  | 'full'
  | 'partial'
  | 'listed_no_questions'
  | 'ontology_only'
  | 'alias_only'

export type QuestionSource = {
  file: string
  count: number
  bankConceptId: string
}

export type ConceptCoverage = {
  conceptId: string
  name: string
  ontologyLevel: string
  actFrequency?: number
  status: CoverageStatus
  inPracticeConcepts: boolean
  questionCounts: { L1: number; L2: number; L3: number; total: number }
  staticQuestionCounts?: { L1: number; L2: number; L3: number; total: number }
  generatedQuestionCounts?: { L1: number; L2: number; L3: number; total: number }
  questionSources?: QuestionSource[]
  bankAlias?: string | null
  message: string
}

const byId = coverageData.byConceptId as Record<string, ConceptCoverage>
const gaps = coverageData.gapsNeedingContent as ConceptCoverage[]
const allAct = (coverageData as { actConcepts?: ConceptCoverage[] }).actConcepts

export function getConceptCoverage(conceptId: string): ConceptCoverage | null {
  return byId[conceptId] ?? null
}

export function listContentGaps(): ConceptCoverage[] {
  return [...gaps]
}

/** All ACT-tested concepts — banked and gaps — sorted as in the audit. */
export function listAllActConceptCoverage(): ConceptCoverage[] {
  if (allAct?.length) return [...allAct]
  return Object.values(byId).sort((a, b) => a.conceptId.localeCompare(b.conceptId))
}

export function formatQuestionSources(row: ConceptCoverage): string {
  if (!row.questionSources?.length) return ''
  return row.questionSources
    .map(src =>
      src.bankConceptId !== row.conceptId
        ? `${src.file} (${src.count} questions as ${src.bankConceptId})`
        : `${src.file} (${src.count} questions)`,
    )
    .join('\n')
}

/** Human-facing blocker when practice cannot load questions for a concept. */
export function buildNoContentMessage(
  conceptId: string,
  level?: 1 | 2 | 3,
  dynamicFailed = true,
): string {
  const row = getConceptCoverage(conceptId)
  const label = row?.name ?? mlIdToLabel(conceptId)
  const lines: string[] = []

  lines.push(`No practice session could be loaded for:`)
  lines.push('')
  lines.push(`  concept_id: ${conceptId}`)
  lines.push(`  name: ${label}`)
  if (row?.ontologyLevel) {
    lines.push(`  ontology level: ${row.ontologyLevel}`)
  }

  if (level) {
    const staticAtLevel = questionCount(conceptId, level)
    lines.push(`  requested level: ${level} (static bank: ${staticAtLevel} questions)`)
  }

  lines.push('')
  if (row) {
    lines.push(row.message)
    if (row.status === 'alias_only' && row.bankAlias) {
      lines.push('')
      lines.push(
        `Action: add questions under ontology id "${conceptId}" or rename bank id "${row.bankAlias}" → "${conceptId}".`,
      )
    } else if (row.status === 'ontology_only') {
      lines.push('')
      lines.push(
        `Action: add "${conceptId}" to PRACTICE_CONCEPTS in questionBank.ts, then author L1/L2/L3 static questions.`,
      )
    } else if (row.status === 'listed_no_questions') {
      lines.push('')
      lines.push(
        `Action: author static questions in questionBank.ts with conceptId: '${conceptId}' for levels 1–3.`,
      )
    } else if (row.status === 'partial' && level) {
      lines.push('')
      lines.push(`Action: add Level ${level} questions for "${conceptId}" in questionBank.ts.`)
    }
  } else {
    lines.push(
      'This concept_id is not in the current ACT coverage audit. ' +
      'Add it to the Layer 1 ontology and questionBank.ts, or check for a slug typo.',
    )
  }

  if (dynamicFailed) {
    lines.push('')
    lines.push('Dynamic question generation also returned nothing (Anthropic credits / qgen may be down).')
  }

  return lines.join('\n')
}

export function coverageSummaryLine(): string {
  const s = coverageData.summary as {
    actTestedConcepts: number
    fullCoverage: number
    listedNoQuestions: number
    ontologyOnly: number
    aliasOnly: number
    staticQuestionsTotal?: number
    generatedQuestionsTotal?: number
    playableQuestionsTotal?: number
  }
  const need = s.listedNoQuestions + s.ontologyOnly + s.aliasOnly
  const playable = s.playableQuestionsTotal ?? s.staticQuestionsTotal ?? 0
  const generated = s.generatedQuestionsTotal ?? 0
  const genNote = generated > 0 ? ` · ${generated} generated` : ''
  return (
    `${s.actTestedConcepts} ACT concepts · ${s.fullCoverage} fully banked · ` +
    `${need} need content · ${playable} playable static+generated${genNote}`
  )
}
