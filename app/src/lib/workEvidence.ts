import { recordWorkEvidence, type WorkEvidenceStep } from './mlApi'
import type { CheckWorkLineRule } from './mlApi'
import type { WorkLine, WorkLineRule } from '../types'

export interface ConceptWorkGroup<T> {
  conceptId: string
  conceptName: string
  lastWorkedAt: number
  entries: T[]
}

export function mapCheckWorkRule(rule?: CheckWorkLineRule | null): WorkLineRule | undefined {
  if (!rule?.id) return undefined
  return {
    id: rule.id,
    label: rule.label || rule.id.replace(/_/g, ' '),
    ingredientIds: rule.ingredientIds ?? [],
  }
}

export function workLinesToEvidenceSteps(workLines: WorkLine[]): WorkEvidenceStep[] {
  const steps: WorkEvidenceStep[] = []
  for (let i = 1; i < workLines.length; i++) {
    const line = workLines[i]
    if (!line.verdict || line.verdict === 'unparsed' || !line.rule?.id) continue
    steps.push({
      rule_id: line.rule.id,
      verdict: line.verdict,
      rule: {
        id: line.rule.id,
        label: line.rule.label,
        ingredientIds: line.rule.ingredientIds,
      },
    })
  }
  return steps
}

const submittedEvidenceKeys = new Set<string>()

export async function submitWorkEvidenceIfReady(params: {
  studentId: string
  questionId: string
  conceptId: string
  workLines: WorkLine[]
}): Promise<void> {
  const steps = workLinesToEvidenceSteps(params.workLines)
  if (!steps.length) return

  const key = `${params.studentId}:${params.questionId}:${steps.map(step => `${step.rule_id}:${step.verdict}`).join('|')}`
  if (submittedEvidenceKeys.has(key)) return
  submittedEvidenceKeys.add(key)

  await recordWorkEvidence({
    student_id: params.studentId,
    question_id: params.questionId,
    concept_id: params.conceptId,
    steps,
  })
}

/** Newest entry per questionId; session prompts without questionId pass through. */
export function groupStudentWorkLedger<T extends {
  id: string
  questionId?: string
  updatedAt?: number
  createdAt: number
}>(
  entries: T[],
  cap = 50,
): T[] {
  const seenQuestions = new Set<string>()
  const grouped: T[] = []

  for (const entry of entries) {
    if (entry.questionId) {
      if (seenQuestions.has(entry.questionId)) continue
      seenQuestions.add(entry.questionId)
    }
    grouped.push(entry)
    if (grouped.length >= cap) break
  }

  return grouped
}

export function humanizeConceptId(conceptId?: string): string {
  if (!conceptId || conceptId === 'general') return 'General work'
  return conceptId
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function cleanStemForRecall(stem?: string): string {
  if (!stem) return ''
  const firstThought = stem
    .replace(/\s+/g, ' ')
    .replace(/\$+/g, '')
    .trim()
    .split(/[?.!]/)[0]
    ?.trim() ?? ''

  return firstThought
    .replace(/^(what is|what are|which of the following is|which expression is|find|solve for|calculate|determine|evaluate)\s+/i, '')
    .replace(/^(the value of|the measure of)\s+/i, '')
    .trim()
}

export function deriveRecallTag(conceptName: string, stem?: string): string {
  const cleaned = cleanStemForRecall(stem)
  if (!cleaned) return conceptName

  const phrase = cleaned.length > 54 ? `${cleaned.slice(0, 51).trim()}...` : cleaned
  if (phrase.toLowerCase().includes(conceptName.toLowerCase())) return phrase
  return `${conceptName}: ${phrase}`
}

export function groupWorkByConcept<T extends {
  id: string
  questionId?: string
  conceptId?: string
  updatedAt?: number
  createdAt: number
  recallTag?: string
}>(
  entries: T[],
  options: {
    cap?: number
    getConceptName?: (conceptId: string, entry: T) => string | undefined
    getQuestionStem?: (entry: T) => string | undefined
  } = {},
): ConceptWorkGroup<T>[] {
  const ledger = groupStudentWorkLedger(entries, options.cap ?? 50)
  const groups = new Map<string, ConceptWorkGroup<T>>()

  for (const entry of ledger) {
    const conceptId = entry.conceptId ?? 'general'
    const conceptName = options.getConceptName?.(conceptId, entry) ?? humanizeConceptId(conceptId)
    const lastWorkedAt = entry.updatedAt ?? entry.createdAt
    const enriched = entry.recallTag
      ? entry
      : { ...entry, recallTag: deriveRecallTag(conceptName, options.getQuestionStem?.(entry)) }

    const existing = groups.get(conceptId)
    if (existing) {
      existing.entries.push(enriched)
      existing.lastWorkedAt = Math.max(existing.lastWorkedAt, lastWorkedAt)
    } else {
      groups.set(conceptId, {
        conceptId,
        conceptName,
        lastWorkedAt,
        entries: [enriched],
      })
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.lastWorkedAt - a.lastWorkedAt)
}
