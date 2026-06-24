/**
 * practiceState.ts
 *
 * Firestore persistence for the ACT-help diagnostic + practice progress.
 *  - users/{uid}.diagnosticCompleted  — gates the "diagnostic first" entry flow
 *  - practiceDrafts/{uid}             — full in-progress draft (durable, cross-device)
 *
 * All calls fail soft (return defaults) so the UI never blocks on Firestore.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export async function markDiagnosticComplete(
  uid: string,
  data: { exam: string | null; confidenceMap: Record<string, string> },
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        diagnosticCompleted: true,
        diagnostic: {
          exam: data.exam ?? null,
          confidenceMap: data.confidenceMap,
          completedAt: serverTimestamp(),
        },
      },
      { merge: true },
    )
  } catch { /* fail soft */ }
}

export async function isDiagnosticComplete(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const data = snap.data()
    // Tutors/admins never take the diagnostic — never gate them into it.
    if (data?.role === 'tutor' || data?.role === 'admin') return true
    return !!data?.diagnosticCompleted
  } catch {
    return false
  }
}

// The draft lives on the user's own doc (already writable per security rules) to
// avoid a separate collection that would need a new rule. JSON round-trip strips
// any `undefined` values, which Firestore rejects.
export async function savePracticeDraftRemote(uid: string, draft: unknown): Promise<void> {
  try {
    const clean = JSON.parse(JSON.stringify(draft))
    await setDoc(
      doc(db, 'users', uid),
      { practiceDraft: clean, practiceDraftAt: serverTimestamp() },
      { merge: true },
    )
  } catch { /* fail soft */ }
}

export async function loadPracticeDraftRemote(uid: string): Promise<unknown | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    return snap.data()?.practiceDraft ?? null
  } catch {
    return null
  }
}
