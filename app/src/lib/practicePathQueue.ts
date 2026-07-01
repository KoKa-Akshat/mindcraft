import { useEffect, useState } from 'react'
import { PRACTICE_CONCEPTS } from './questionBank'
import { mlIdToLabel } from './conceptMap'
import { loadPracticeDraftsRemote, loadDiagnostic } from './practiceState'
import { getRecommendations } from './mlApi'
import { chainSteps } from './recommendNextConcept'

export const PATH_SLOT_COUNT = 6
export const PRACTICE_PATH_UPDATED_EVENT = 'mc-practice-path-updated'

const PRACTICE_DRAFT_VERSION = 2
const MISSION_TYPES = ['weakness', 'learn', 'gapscan'] as const

type Confidence = 'easy' | 'kinda' | 'hard'
type MissionType = typeof MISSION_TYPES[number]

type PracticeDraft = {
  version: number
  assessConceptIds?: string[]
  confidenceMap?: Record<string, Confidence>
  exam?: string
}

export type PathConcept = { id: string; label: string }

export type PracticePathQueue = {
  loading: boolean
  exam: string
  pathConcepts: PathConcept[]
  pathQueue: PathConcept[]
  activeConceptId: string | null
  progressPct: number
  completedOnPath: number
}

export function pathMasteredStorageKey(uid: string) {
  return `mc-path-mastered-${uid}`
}

function practiceDraftKey(uid: string, type: MissionType) {
  return `mindcraft:exam-help:${uid}:${type}`
}

export function conceptsFromIds(ids: string[]): PathConcept[] {
  return ids.map(id => ({ id, label: mlIdToLabel(id) }))
}

function loadLocalDraft(uid: string): PracticeDraft | null {
  for (const type of MISSION_TYPES) {
    const raw = localStorage.getItem(practiceDraftKey(uid, type))
    if (!raw) continue
    try {
      const draft = JSON.parse(raw) as PracticeDraft
      if (draft.version !== PRACTICE_DRAFT_VERSION) continue
      if (type === 'gapscan' && (draft.assessConceptIds?.length ?? 0) > 0) return draft
      if (type !== 'gapscan' && draft.assessConceptIds?.length) return draft
    } catch { /* ignore */ }
  }
  return null
}

function loadMasteredIds(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(pathMasteredStorageKey(uid))
    if (!raw) return new Set()
    const ids = JSON.parse(raw) as string[]
    return new Set(Array.isArray(ids) ? ids : [])
  } catch {
    return new Set()
  }
}

function isPathMastered(
  conceptId: string,
  masteredIds: Set<string>,
  confidenceMap: Record<string, Confidence>,
): boolean {
  return masteredIds.has(conceptId) || confidenceMap[conceptId] === 'easy'
}

export function buildPracticePathQueue(
  assessConcepts: PathConcept[],
  confidenceMap: Record<string, Confidence>,
  masteredIds: Set<string>,
): Pick<PracticePathQueue, 'pathQueue' | 'pathConcepts' | 'activeConceptId' | 'progressPct' | 'completedOnPath'> {
  const pathQueue = assessConcepts.length > 0
    ? assessConcepts
    : conceptsFromIds([])

  const activePathQueue = pathQueue.filter(c => !isPathMastered(c.id, masteredIds, confidenceMap))
  const pathConcepts = activePathQueue.slice(0, PATH_SLOT_COUNT)
  const completedOnPath = pathQueue.filter(c => isPathMastered(c.id, masteredIds, confidenceMap)).length
  const progressPct = pathQueue.length
    ? Math.round((completedOnPath / pathQueue.length) * 100)
    : 0

  return {
    pathQueue,
    pathConcepts,
    activeConceptId: activePathQueue[0]?.id ?? null,
    progressPct,
    completedOnPath,
  }
}

const EMPTY: PracticePathQueue = {
  loading: false,
  exam: '',
  pathConcepts: [],
  pathQueue: [],
  activeConceptId: null,
  progressPct: 0,
  completedOnPath: 0,
}

export function notifyPracticePathUpdated() {
  window.dispatchEvent(new Event(PRACTICE_PATH_UPDATED_EVENT))
}

async function loadPracticePathData(userId: string): Promise<PracticePathQueue> {
  let draft = loadLocalDraft(userId)
  if (!draft) {
    const remote = await loadPracticeDraftsRemote(userId)
    const gapscan = remote.gapscan as PracticeDraft | undefined
    if (gapscan?.version === PRACTICE_DRAFT_VERSION) draft = gapscan
    else {
      for (const type of MISSION_TYPES) {
        const d = remote[type] as PracticeDraft | undefined
        if (d?.version === PRACTICE_DRAFT_VERSION && (d.assessConceptIds?.length ?? 0) > 0) {
          draft = d
          break
        }
      }
    }
  }

  let confidenceMap = draft?.confidenceMap ?? {}
  let exam = draft?.exam ?? 'ACT'
  let excludedConcepts: string[] = []

  const diagnostic = await loadDiagnostic(userId).catch(() => null)
  if (Object.keys(confidenceMap).length === 0 && diagnostic?.confidenceMap) {
    confidenceMap = diagnostic.confidenceMap as Record<string, Confidence>
    exam = diagnostic.exam ?? exam
  }
  excludedConcepts = diagnostic?.excludedConcepts ?? []

  let assessConcepts: PathConcept[] = []
  try {
    const examRec = await getRecommendations(userId, [], 'exam', exam, excludedConcepts)
    assessConcepts = conceptsFromIds(chainSteps(examRec).map(r => r.conceptId))
  } catch { /* fail soft */ }

  if (assessConcepts.length === 0) {
    assessConcepts = conceptsFromIds(draft?.assessConceptIds ?? Object.keys(confidenceMap))
  }

  const masteredIds = loadMasteredIds(userId)
  const built = buildPracticePathQueue(assessConcepts, confidenceMap, masteredIds)

  return {
    loading: false,
    exam,
    ...built,
  }
}

export function usePracticePathQueue(userId: string): PracticePathQueue {
  const [data, setData] = useState<PracticePathQueue>({
    ...EMPTY,
    loading: Boolean(userId),
  })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const bump = () => setRefreshKey(k => k + 1)
    window.addEventListener(PRACTICE_PATH_UPDATED_EVENT, bump)
    window.addEventListener('focus', bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(PRACTICE_PATH_UPDATED_EVENT, bump)
      window.removeEventListener('focus', bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      const fallback = PRACTICE_CONCEPTS.slice(0, PATH_SLOT_COUNT).map(c => ({ id: c.id, label: c.label }))
      setData({
        loading: false,
        exam: '',
        pathQueue: fallback,
        pathConcepts: fallback,
        activeConceptId: fallback[0]?.id ?? null,
        progressPct: 0,
        completedOnPath: 0,
      })
      return
    }

    let cancelled = false
    setData(prev => ({ ...prev, loading: prev.pathQueue.length === 0 }))

    void loadPracticePathData(userId).then(next => {
      if (!cancelled) setData(next)
    })

    return () => { cancelled = true }
  }, [userId, refreshKey])

  return data
}
