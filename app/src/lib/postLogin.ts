/**
 * Post-login routing — shared path resolution + guarded navigation.
 *
 * Sets a short-lived session handoff flag so AuthGuard does not treat a
 * freshly signed-in user as logged out while Firebase persistence settles.
 * Prefer client-side navigate (no full reload) once authStateReady resolves.
 */
import { auth } from '../firebase'
import { signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { isDiagnosticComplete } from './practiceState'
import { lookupAllowlistRole, type AllowlistRole } from './loginAllowlist'
import { WEBHOOK_BASE } from './mlApi'
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
// Widened from 10s: on iPad/Safari (and Mac trackpad devices, which trigger
// the same forced signInWithRedirect path), the redirect round-trip through
// accounts.google.com back to this origin can genuinely take longer than 10s
// to rehydrate auth.currentUser, and AuthGuard was bouncing back to /login
// before that finished. This alone won't fix a hard case where Safari ITP
// wiped the pending-redirect state entirely (nothing arrives, ever, no matter
// how long we wait) -- only a same-origin authDomain fixes that, which needs
// the .web.app callback URL manually added to the OAuth client in Google
// Cloud Console first. This is the safe, no-downside half of the fix.
const AUTH_HANDOFF_MS = 25_000

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
  await ensureRoleDoc(email, displayName, uid, 'student')
}

async function ensureRoleDoc(
  email: string | null | undefined,
  displayName: string | null | undefined,
  uid: string,
  role: AllowlistRole,
) {
  await setDoc(doc(db, 'users', uid), {
    role,
    email: email ?? '',
    displayName: displayName ?? '',
    createdAt: new Date().toISOString(),
  }, { merge: true })
}

/** Same job as ensureRoleDoc, but for 'tutor'/'parent' — firebase/firestore.rules
 * only permits role to be absent or 'student' on a Firestore CREATE, so a
 * direct client setDoc for those two roles is rejected by the rules (which
 * are correctly doing their job). Routes through claim-invited-role.ts
 * instead, which does the same write server-side via the Admin SDK after
 * re-confirming the caller's email is genuinely in login_allowlist — the
 * endpoint can't grant a role nobody pre-approved, it just moves an
 * already-approved write out of the unprivileged client context. */
async function claimInvitedRole(role: 'tutor' | 'parent'): Promise<void> {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('auth/missing-user')
  const res = await fetch(`${WEBHOOK_BASE}/api/claim-invited-role`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `claim-invited-role failed (${res.status})`)
  }
  void role // role is already re-derived server-side from login_allowlist; the
  // param here only picks which branch called this, not what gets written.
}

/** Thrown by resolvePostLoginPath when a brand-new email has no admin-added
 * login_allowlist entry. Login.tsx matches this via friendlyError(). */
export class NotAllowlistedError extends Error {
  code = 'mc/not-allowlisted'
  constructor() { super('This email has not been added by an admin yet.') }
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
    return '/diagnostic'
  }

  if (opts.grantAdmin) return '/admin'
  if (existingRole === 'admin') return '/admin'
  if (existingRole === 'tutor') return '/tutor'
  if (existingRole === 'parent') return '/parent'

  if (!snap.exists() || !existingRole) {
    // Invite-only: a brand-new email must already be in the admin-managed
    // allowlist (Admin -> Links), and lands in whichever role it was added
    // under. Existing accounts (handled by the early returns above) are
    // never subject to this — only first-time account creation is gated.
    const exempt = isTestProfileEmail(email) || isDevBypassEmail(email) || isDiagResetEmail(email)
    const allowedRole: AllowlistRole | null = exempt ? 'student' : await lookupAllowlistRole(email)
    if (!allowedRole) {
      await signOut(auth)
      throw new NotAllowlistedError()
    }
    if (allowedRole === 'tutor' || allowedRole === 'parent') {
      // Rules block a client-created 'tutor'/'parent' role doc (see
      // claimInvitedRole's doc comment) — must go through the webhook.
      await claimInvitedRole(allowedRole)
      return allowedRole === 'tutor' ? '/tutor' : '/parent'
    }
    await ensureRoleDoc(email, currentUser?.displayName, uid, allowedRole)
  }

  // Dev accounts skip the diagnostic gate entirely.
  if (isDevBypassEmail(email)) return opts.returnTo ?? '/dashboard'

  // Diag-reset accounts re-run the gap scan on every login (diagnostic only —
  // KG and practice history are preserved so you can compare dashboard effects).
  if (isDiagResetEmail(email)) {
    await clearStudentDiagnosticState(uid)
    return '/diagnostic'
  }

  // Always gate students on diagnostic — ignore ?next= when scan isn't done.
  const done = await isDiagnosticComplete(uid)
  if (!done) return '/diagnostic'

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
  // Fresh login → show cover before Contents (session flag from an earlier
  // open / Find a Tutor would otherwise skip straight to the dashboard).
  if (path === '/dashboard' || path.startsWith('/dashboard?')) {
    try { sessionStorage.removeItem('mc-cover-seen-session') } catch { /* ignore */ }
  }
  if (navigate) {
    navigate(path, { replace: true })
    return
  }
  window.location.replace(path)
}
