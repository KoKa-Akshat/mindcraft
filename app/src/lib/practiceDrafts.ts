import { mlIdToLabel } from './conceptMap'
import { loadPracticeDraftsRemote } from './practiceState'

export type PracticeMissionType = 'weakness' | 'learn' | 'gapscan'

export const PRACTICE_DRAFT_VERSION = 1

export const MISSION_LABELS: Record<PracticeMissionType, string> = {
  weakness: 'Weakness practice',
  learn:    'New concept',
  gapscan:  'Gap scan',
}

export interface StoredPracticeDraft {
  version: number
  missionType?: PracticeMissionType
  concept?: string | null
  pPhase?: string
  qIndex?: number
  questions?: unknown[]
  assessConceptIds?: string[]
  confidenceStep?: number
}

export function practiceDraftKey(uid: string, type: PracticeMissionType) {
  return `mindcraft:exam-help:${uid}:${type}`
}

function legacyPracticeDraftKey(uid: string) {
  return `mindcraft:exam-help:${uid}:process-1`
}

function readLocalDraft(uid: string, type: PracticeMissionType): StoredPracticeDraft | null {
  const raw = localStorage.getItem(practiceDraftKey(uid, type))
  if (!raw) return null
  try {
    const draft = JSON.parse(raw) as StoredPracticeDraft
    if (draft.version !== PRACTICE_DRAFT_VERSION) return null
    return { ...draft, missionType: draft.missionType ?? type }
  } catch {
    return null
  }
}

/** Local weakness + learn slots for dashboard resume buttons. */
export function loadWeaknessAndLearnDrafts(uid: string): Partial<Record<'weakness' | 'learn', StoredPracticeDraft>> {
  const legacy = localStorage.getItem(legacyPracticeDraftKey(uid))
  if (legacy) {
    try {
      const d = JSON.parse(legacy) as StoredPracticeDraft
      localStorage.setItem(
        practiceDraftKey(uid, 'gapscan'),
        JSON.stringify({ ...d, missionType: 'gapscan' }),
      )
    } catch { /* ignore */ }
    localStorage.removeItem(legacyPracticeDraftKey(uid))
  }

  const found: Partial<Record<'weakness' | 'learn', StoredPracticeDraft>> = {}
  for (const t of ['weakness', 'learn'] as const) {
    const draft = readLocalDraft(uid, t)
    if (draft) found[t] = draft
  }
  return found
}

/** Merge in Firestore drafts when nothing is saved locally. */
export async function hydrateWeaknessAndLearnDrafts(
  uid: string,
): Promise<Partial<Record<'weakness' | 'learn', StoredPracticeDraft>>> {
  const local = loadWeaknessAndLearnDrafts(uid)
  if (Object.keys(local).length > 0) return local

  const remote = await loadPracticeDraftsRemote(uid)
  const found: Partial<Record<'weakness' | 'learn', StoredPracticeDraft>> = {}
  for (const t of ['weakness', 'learn'] as const) {
    const raw = remote[t]
    if (!raw || typeof raw !== 'object') continue
    const draft = raw as StoredPracticeDraft
    if (draft.version !== PRACTICE_DRAFT_VERSION) continue
    const typed = { ...draft, missionType: t }
    found[t] = typed
    localStorage.setItem(practiceDraftKey(uid, t), JSON.stringify(typed))
  }
  return found
}

export function formatDraftStatus(draft: StoredPracticeDraft): string {
  const type = draft.missionType ?? 'weakness'
  const prefix = MISSION_LABELS[type]
  const conceptLabel = draft.concept ? mlIdToLabel(draft.concept) : ''
  if (draft.pPhase === 'session' && Array.isArray(draft.questions) && draft.questions.length > 0) {
    const qIndex = draft.qIndex ?? 0
    return `${prefix} · ${conceptLabel} · Question ${Math.min(qIndex + 1, draft.questions.length)} of ${draft.questions.length}`
  }
  if (draft.pPhase === 'level' && conceptLabel) {
    return `${prefix} · ${conceptLabel} · Pick a level`
  }
  if (draft.pPhase === 'confidence' && Array.isArray(draft.assessConceptIds)) {
    const step = draft.confidenceStep ?? 0
    return `${prefix} · Gap scan ${Math.min(step + 1, draft.assessConceptIds.length)} of ${draft.assessConceptIds.length}`
  }
  return `${prefix} · ${conceptLabel || 'Ready'}`
}
