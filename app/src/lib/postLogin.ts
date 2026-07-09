/**
 * Post-login routing — shared path resolution + guarded navigation.
 *
 * Sets a short-lived session handoff flag so AuthGuard does not treat a
 * freshly signed-in user as logged out while Firebase persistence settles.
 * Prefer client-side navigate (no full reload) once authStateReady resolves.
 */
import { auth } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { isDiagnosticComplete } from './practiceState'
import {
  clearStudentDiagnosticState,
  isDevBypassEmail,
  isDiagResetEmail,
  isTestProfileEmail,
  purgeStudentLearningHistory,
} from './testProfile'

export type PostLoginOpts = {
  returnTo: string | null
  grantAdmin: boolean
}

const AUTH_HANDOFF_KEY = 'mc-auth-handoff'
const AUTH_HANDOFF_MS = 10_000

/** Set while routing away from /login so AuthGuard waits instead of bouncing. */
export function markAuthHandoff(): void {
  try { sessionStorage.setItem(AUTH_HANDOFF_KEY, String(Date.now())) } catch { /* ignore */ }
}

export function clearAuthHandoff(): void {
  try { sessionStorage.removeItem(AUTH_HANDOFF_KEY) } catch { /* ignore */ }
}

export function isAuthHandoffActive(): boolean {
  try {
    const raw = sessionStorage.getItem(AUTH_HANDOFF_KEY)
    if (!raw) return false
    return Date.now() - Number(raw) < AUTH_HANDOFF_MS
  } catch {
    return false
  }
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

  // Dev accounts skip the diagnostic gate entirely.
  if (isDevBypassEmail(email)) return opts.returnTo ?? '/dashboard'

  // Diag-reset accounts re-run the gap scan on every login (diagnostic only —
  // KG and practice history are preserved so you can compare dashboard effects).
  if (isDiagResetEmail(email)) {
    await clearStudentDiagnosticState(uid)
    return '/onboard?entry=1'
  }

  // Always gate students on diagnostic — ignore ?next= when scan isn't done.
  const done = await isDiagnosticComplete(uid)
  if (!done) return '/onboard?entry=1'

  return opts.returnTo ?? '/dashboard'
}

/** Wait for auth persistence, then navigate without racing AuthGuard. */
export async function completePostLoginNavigate(
  path: string,
  navigate?: (path: string, opts?: { replace?: boolean }) => void,
): Promise<void> {
  markAuthHandoff()
  await auth.authStateReady()
  if (!auth.currentUser) {
    clearAuthHandoff()
    throw new Error('auth/missing-user')
  }
  await auth.currentUser.getIdToken()
  if (navigate) {
    navigate(path, { replace: true })
    return
  }
  window.location.replace(path)
}
