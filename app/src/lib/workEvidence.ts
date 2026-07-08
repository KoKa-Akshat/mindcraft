import { recordWorkEvidence, type WorkEvidenceStep } from './mlApi'
import type { CheckWorkLineRule } from './mlApi'
import type { WorkLine, WorkLineRule } from '../types'

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
