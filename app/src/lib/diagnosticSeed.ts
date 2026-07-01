import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { seedAssessment } from './mlApi'
import { seedFoundationalConfidence } from './examCurricula'
import { invalidateKnowledgeGraph } from './graphCache'
import { toOntologyId } from './conceptMap'
import { markDiagnosticComplete } from './practiceState'
import { notifyPracticePathUpdated } from './practicePathQueue'
import type { Confidence } from './bridgePractice'

/** Map raw {rawId: conf} → ontology ids, seed foundational, persist to ML + Firestore. */
export async function applyDiagnosticConfidence(
  uid: string,
  exam: string,
  rawConfidence: Record<string, Confidence>,
  goals?: { tags: string[]; text: string },
  options?: { diagnosticVersion?: string; excludedConcepts?: string[] },
): Promise<void> {
  const canonical: Record<string, Confidence> = {}
  for (const [id, v] of Object.entries(rawConfidence)) {
    canonical[toOntologyId(id)] = v
  }
  const excluded = (options?.excludedConcepts ?? []).map(toOntologyId)
  const seeded = seedFoundationalConfidence(canonical)
  await seedAssessment(uid, seeded)
  await markDiagnosticComplete(uid, {
    exam,
    confidenceMap: seeded,
    excludedConcepts: excluded,
  })
  invalidateKnowledgeGraph(uid)
  notifyPracticePathUpdated()

  if (goals || options?.diagnosticVersion) {
    try {
      const patch: Record<string, unknown> = {}
      if (goals) patch.goals = goals
      if (options?.diagnosticVersion) {
        patch.diagnosticCompletedAt = new Date().toISOString()
        patch.diagnosticVersion = options.diagnosticVersion
      }
      await setDoc(doc(db, 'users', uid), patch, { merge: true })
    } catch { /* non-blocking */ }
  }
}
