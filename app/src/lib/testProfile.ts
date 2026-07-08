/**
 * testProfile.ts
 *
 * Designated test accounts start from a clean slate on EVERY login:
 * diagnostic, practice drafts, knowledge graph, learning events — all wiped
 * before the user is routed into the app. Role/email/displayName survive.
 *
 * Shared by Login.tsx (auto-reset for TEST_PROFILE_EMAILS) and
 * QAToolbar.tsx (manual "Restart Fresh" for any account in QA mode).
 */
import {
  doc, setDoc, deleteField, deleteDoc,
  collection, query, where, getDocs, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { invalidateKnowledgeGraph } from './graphCache'

const TEST_PROFILE_EMAILS = new Set(['akshatkoirala@gmail.com'])

export function isTestProfileEmail(email: string | null | undefined): boolean {
  return !!email && TEST_PROFILE_EMAILS.has(email.trim().toLowerCase())
}

/** Remove per-user practice/diagnostic state from this browser. */
export function clearLocalStudentState(uid: string): void {
  try {
    localStorage.removeItem('mc-diag-done')
    localStorage.removeItem('dashboardView')
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key.startsWith('mc-story-seen-') || key.startsWith(`mindcraft:exam-help:${uid}:`)) {
        doomed.push(key)
      }
    }
    doomed.forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }

  try {
    const doomed: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith('qgen_v2_') || key?.startsWith('storymod_v1_')) doomed.push(key)
    }
    doomed.forEach(k => sessionStorage.removeItem(k))
    sessionStorage.removeItem('mc-clicked-me')
    sessionStorage.removeItem('mc-diag-just-completed')
  } catch { /* ignore */ }

  document.cookie = 'mc_diag_done=0; domain=.web.app; path=/; max-age=0; SameSite=Lax'
  document.cookie = 'mc_diag_done=0; path=/; max-age=0'
}

/** Fast path — clear diagnostic + draft flags before post-login routing. */
export async function clearStudentDiagnosticState(uid: string): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {
      diagnosticCompleted:   deleteField(),
      diagnosticCompletedAt: deleteField(),
      diagnostic:            deleteField(),
      goals:                 deleteField(),
      practiceDrafts:        deleteField(),
      practiceDraftAt:       deleteField(),
    }, { merge: true })
  } catch { /* fail soft */ }
  clearLocalStudentState(uid)
}

/** Slow path — purge interactions/events/kg (client rules may block deletes; fail soft). */
export async function purgeStudentLearningHistory(uid: string): Promise<void> {
  try {
    const [interSnap, learnSnap] = await Promise.all([
      getDocs(query(collection(db, 'interactions'),    where('studentId', '==', uid))),
      getDocs(query(collection(db, 'learning_events'), where('studentId', '==', uid))),
    ])
    const all = [...interSnap.docs, ...learnSnap.docs]
    for (let i = 0; i < all.length; i += 499) {
      const b = writeBatch(db)
      all.slice(i, i + 499).forEach(d => b.delete(d.ref))
      await b.commit()
    }
  } catch { /* fail soft */ }

  try {
    await deleteDoc(doc(db, 'knowledge_graphs', uid))
  } catch { /* fail soft */ }
  invalidateKnowledgeGraph(uid)
}

/**
 * Wipe a student's learning record: diagnostic flags, practice drafts,
 * interactions, learning events, and the knowledge graph doc. Each step
 * fails soft so a partial wipe never blocks login.
 */
export async function resetStudentProfile(uid: string): Promise<void> {
  await clearStudentDiagnosticState(uid)
  await purgeStudentLearningHistory(uid)
}
