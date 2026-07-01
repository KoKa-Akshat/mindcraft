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

/** Browser signals the 3D world reads to skip the intro diagnostic. */
export function persistDiagnosticDoneLocal(): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem('mc-diag-done', '1') } catch { /* ignore */ }
  const domain = window.location.hostname.endsWith('.web.app') ? '; domain=.web.app' : ''
  document.cookie = `mc_diag_done=1${domain}; path=/; max-age=31536000; SameSite=Lax`
}

export async function markDiagnosticComplete(
  uid: string,
  data: {
    exam: string | null
    confidenceMap: Record<string, string>
    excludedConcepts?: string[]
  },
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        diagnosticCompleted: true,
        diagnostic: {
          exam: data.exam ?? null,
          confidenceMap: data.confidenceMap,
          excludedConcepts: data.excludedConcepts ?? [],
          completedAt: serverTimestamp(),
        },
      },
      { merge: true },
    )
    persistDiagnosticDoneLocal()
  } catch { /* fail soft */ }
}

export async function loadDiagnostic(
  uid: string,
): Promise<{
  exam: string | null
  confidenceMap: Record<string, string>
  excludedConcepts: string[]
} | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const diagnostic = snap.data()?.diagnostic as {
      exam?: string | null
      confidenceMap?: Record<string, string>
      excludedConcepts?: string[]
    } | undefined
    if (!diagnostic) return null
    return {
      exam: diagnostic.exam ?? null,
      confidenceMap: diagnostic.confidenceMap ?? {},
      excludedConcepts: diagnostic.excludedConcepts ?? [],
    }
  } catch {
    return null
  }
}

export async function getUserRole(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    return snap.data()?.role ?? null
  } catch {
    return null
  }
}

export async function isDiagnosticComplete(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const data = snap.data()
    // Tutors/admins never take the diagnostic — never gate them into it.
    if (data?.role === 'tutor' || data?.role === 'admin') return true
    // Two diagnostic flows write different fields: the practice gap-scan sets the
    // boolean `diagnosticCompleted`, the newer ACT Diagnostic sets the timestamp
    // `diagnosticCompletedAt`. Accept EITHER, or a user who finished the ACT
    // diagnostic gets bounced /dashboard → /practice forever.
    return !!(data?.diagnosticCompleted || data?.diagnosticCompletedAt)
  } catch {
    return false
  }
}

// Drafts live on the user's own doc (already writable per security rules), now
// keyed by mission type so a weakness AND a learn mission can resume independently
// — users/{uid}.practiceDrafts = { weakness?, learn?, gapscan? }. Firestore's
// merge:true deep-merges the map, so writing one slot preserves the others. JSON
// round-trip strips `undefined`, which Firestore rejects.
export async function savePracticeDraftRemote(
  uid: string, missionType: string, draft: unknown,
): Promise<void> {
  try {
    const clean = draft === null ? null : JSON.parse(JSON.stringify(draft))
    await setDoc(
      doc(db, 'users', uid),
      { practiceDrafts: { [missionType]: clean }, practiceDraftAt: serverTimestamp() },
      { merge: true },
    )
  } catch { /* fail soft */ }
}

export async function loadPracticeDraftsRemote(uid: string): Promise<Record<string, unknown>> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const data = snap.data()
    const map = (data?.practiceDrafts as Record<string, unknown>) ?? {}
    // Legacy single-draft migration → gap-scan slot.
    if (Object.keys(map).length === 0 && data?.practiceDraft) {
      return { gapscan: data.practiceDraft }
    }
    // Drop nulled (cleared) slots.
    return Object.fromEntries(Object.entries(map).filter(([, v]) => v))
  } catch {
    return {}
  }
}
