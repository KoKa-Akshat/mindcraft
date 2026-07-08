/**
 * studyPathConfig — mastery exit + diagnostic knobs.
 * Tutor writes to students/{uid}.studyPathConfig; defaults apply when absent.
 */
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

export interface StudyPathConfig {
  /** Min first-try trials before early mastery exit (Practice). */
  masteryExitMin: number
  masteryExitAcc: number
  masteryExitStreak: number
  /** Probes in Jesse's Kitchen diagnostic. */
  diagnosticProbeCount: number
  /** Inject same-concept follow-up after a wrong probe. */
  diagnosticFollowUps: boolean
}

export const DEFAULT_STUDY_PATH: StudyPathConfig = {
  masteryExitMin: 5,
  masteryExitAcc: 0.8,
  masteryExitStreak: 3,
  diagnosticProbeCount: 10,
  diagnosticFollowUps: true,
}

export function resolveStudyPathConfig(
  raw?: Partial<StudyPathConfig> | null,
): StudyPathConfig {
  if (!raw) return { ...DEFAULT_STUDY_PATH }
  return {
    masteryExitMin: raw.masteryExitMin ?? DEFAULT_STUDY_PATH.masteryExitMin,
    masteryExitAcc: raw.masteryExitAcc ?? DEFAULT_STUDY_PATH.masteryExitAcc,
    masteryExitStreak: raw.masteryExitStreak ?? DEFAULT_STUDY_PATH.masteryExitStreak,
    diagnosticProbeCount: raw.diagnosticProbeCount ?? DEFAULT_STUDY_PATH.diagnosticProbeCount,
    diagnosticFollowUps: raw.diagnosticFollowUps ?? DEFAULT_STUDY_PATH.diagnosticFollowUps,
  }
}

export interface StudentPathContext {
  pathConfig: StudyPathConfig
  goals: { tags: string[]; text: string }
  tutorFocusConcepts: string[]
}

export async function loadStudentPathContext(uid: string): Promise<StudentPathContext> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const d = snap.data()
    const goals = d?.goals as { tags?: string[]; text?: string } | undefined
    return {
      pathConfig: resolveStudyPathConfig(d?.studyPathConfig),
      goals: { tags: goals?.tags ?? [], text: goals?.text ?? '' },
      tutorFocusConcepts: Array.isArray(d?.tutorFocusConcepts) ? d.tutorFocusConcepts : [],
    }
  } catch {
    return {
      pathConfig: { ...DEFAULT_STUDY_PATH },
      goals: { tags: [], text: '' },
      tutorFocusConcepts: [],
    }
  }
}
