/**
 * Account lifecycle helpers (testing + self-service delete).
 */
import { deleteUser } from 'firebase/auth'
import { deleteDoc, doc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const MISSION_TYPES = ['weakness', 'learn', 'gapscan'] as const

function clearLocalUserData(uid: string) {
  localStorage.removeItem(`mc-path-mastered-${uid}`)
  for (const t of MISSION_TYPES) {
    localStorage.removeItem(`mc-practice-draft-${uid}-${t}`)
  }
}

/**
 * Delete the signed-in Firebase Auth user and their `users/{uid}` profile.
 * ML collections (interactions, knowledge_graphs) may remain under the old uid;
 * a new sign-up with the same email gets a fresh uid.
 */
export async function deleteMyAccount(): Promise<{ ok: boolean; error?: string }> {
  const user = auth.currentUser
  if (!user) return { ok: false, error: 'Not signed in.' }

  const uid = user.uid
  try {
    await deleteDoc(doc(db, 'users', uid))
  } catch {
    // Profile may already be missing — still try to delete auth user.
  }

  clearLocalUserData(uid)

  try {
    await deleteUser(user)
    return { ok: true }
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'auth/requires-recent-login') {
      return {
        ok: false,
        error: 'For security, sign out, sign in again, then delete your account.',
      }
    }
    return { ok: false, error: 'Could not delete account. Try again or use Firebase Console.' }
  }
}
