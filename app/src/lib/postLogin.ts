/**
 * Post-login routing — shared path resolution + hard navigation.
 *
 * Uses window.location.replace (not React Router navigate) so Firebase auth
 * persistence is fully loaded before AuthGuard runs on the destination page.
 * Client-side navigate after signInWithPopup was racing AuthGuard and
 * bouncing all users back to /login.
 */
import { auth } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { isDiagnosticComplete } from './practiceState'
import {
  clearStudentDiagnosticState,
  isDevBypassEmail,
  isTestProfileEmail,
  purgeStudentLearningHistory,
} from './testProfile'

export type PostLoginOpts = {
  returnTo: string | null
  grantAdmin: boolean
}

async function ensureStudentDoc(email: string | null | undefined, displayName: string | null | undefined, uid: string) {
  await setDoc(doc(db, 'users', uid), {
    role: 'student',
    email: email ?? '',
    displayName: displayName ?? '',
    createdAt: new Date().toISOString(),
  }, { merge: true })
}

/** Resolve where a signed-in user should land. */
export async function resolvePostLoginPath(uid: string, opts: PostLoginOpts): Promise<string> {
  const currentUser = auth.currentUser
  const email = currentUser?.email
  const isTest = isTestProfileEmail(email)

  if (isTest) {
    sessionStorage.setItem('mc-test-reset', '1')
    await clearStudentDiagnosticState(uid)
    void purgeStudentLearningHistory(uid)
  }

  const snap = await getDoc(doc(db, 'users', uid))
  const existingRole = snap.data()?.role as string | undefined

  if (isTest && !opts.grantAdmin && existingRole !== 'admin' && existingRole !== 'tutor' && existingRole !== 'parent') {
    if (!snap.exists() || !existingRole) {
      await ensureStudentDoc(email, currentUser?.displayName, uid)
    }
    return '/onboard?entry=1'
  }

  if (opts.grantAdmin) return '/admin'
  if (existingRole === 'admin') return '/admin'
  if (existingRole === 'tutor') return '/tutor'
  if (existingRole === 'parent') return '/parent'

  if (!snap.exists() || !existingRole) {
    await ensureStudentDoc(email, currentUser?.displayName, uid)
  }

  // Dev accounts skip the diagnostic gate — their learning data is preserved.
  if (isDevBypassEmail(email)) return opts.returnTo ?? '/dashboard'

  // Always gate students on diagnostic — ignore ?next= when scan isn't done.
  const done = await isDiagnosticComplete(uid)
  if (!done) return '/onboard?entry=1'

  return opts.returnTo ?? '/dashboard'
}

/** Wait for auth persistence, then hard-navigate (full remount, no router race). */
export async function completePostLoginNavigate(path: string): Promise<void> {
  await auth.authStateReady()
  if (!auth.currentUser) throw new Error('auth/missing-user')
  window.location.replace(path)
}
