/**
 * Post-login routing: shared path resolution + guarded navigation.
 *
 * Sets a short-lived session handoff flag so AuthGuard does not treat a
 * freshly signed-in user as logged out while Firebase persistence settles.
 * Prefer client-side navigate (no full reload) once authStateReady resolves.
 */
import { auth } from '../firebase'
import { signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { lookupAllowlistRole, type AllowlistRole } from './loginAllowlist'
import { WEBHOOK_BASE } from './mlApi'
import { languageHasVoiceOptions } from './studentPreferences'
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
// how long we wait); only a same-origin authDomain fixes that, which needs
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

/**
 * Validates a `?next=` redirect target so it can't escape the app or bounce
 * back into /login. Shared by Login.tsx and the post-login preference gates
 * (LanguageChoice.tsx, VoiceChoice.tsx): each gate screen re-resolves the
 * post-login path when the student finishes it, and needs the same
 * validated returnTo carried through so a deep link (?next=/practice, say)
 * survives the gate instead of getting dropped.
 */
export function safeReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/login')) return null
  return raw
}

/** Appends a validated returnTo as `?next=` onto a gate path. */
function withReturnTo(path: string, returnTo: string | null): string {
  return returnTo ? `${path}?next=${encodeURIComponent(returnTo)}` : path
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

/** Same job as ensureRoleDoc, but for 'tutor'/'parent': firebase/firestore.rules
 * only permits role to be absent or 'student' on a Firestore CREATE, so a
 * direct client setDoc for those two roles is rejected by the rules (which
 * are correctly doing their job). Routes through claim-invited-role.ts
 * instead, which does the same write server-side via the Admin SDK after
 * re-confirming the caller's email is genuinely in login_allowlist: the
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
    return '/desk'
  }

  if (opts.grantAdmin) return '/admin'
  if (existingRole === 'admin') return '/admin'
  if (existingRole === 'tutor') return '/tutor'
  if (existingRole === 'parent') return '/parent'

  if (!snap.exists() || !existingRole) {
    // Invite-only: a brand-new email must already be in the admin-managed
    // allowlist (Admin -> Links), and lands in whichever role it was added
    // under. Existing accounts (handled by the early returns above) are
    // never subject to this, only first-time account creation is gated.
    const exempt = isTestProfileEmail(email) || isDevBypassEmail(email) || isDiagResetEmail(email)
    const allowedRole: AllowlistRole | null = exempt ? 'student' : await lookupAllowlistRole(email)
    if (!allowedRole) {
      await signOut(auth)
      throw new NotAllowlistedError()
    }
    if (allowedRole === 'tutor' || allowedRole === 'parent') {
      // Rules block a client-created 'tutor'/'parent' role doc (see
      // claimInvitedRole's doc comment), must go through the webhook.
      await claimInvitedRole(allowedRole)
      return allowedRole === 'tutor' ? '/tutor' : '/parent'
    }
    await ensureRoleDoc(email, currentUser?.displayName, uid, allowedRole)
  }

  // Student-only language + voice gate (2026-08-31 ask): mirrors the iOS
  // prototype's onboarding gate shape (one gate at a time, ahead of the
  // real destination, see ios-prototype/.../MindCraftNotesApp.swift's own
  // gate cascade). Every branch above that resolves to admin/tutor/parent
  // has already returned by this point, so uid here is guaranteed a
  // student: this gate can never reach a tutor/parent/admin account.
  // `snap` still reflects users/{uid} as fetched at the top of this
  // function: unchanged for a returning student (the block above only
  // wrote a fresh doc for a brand-new account, whose prefs are correctly
  // unset either way). This is a one-time Firestore flag, not a per-login
  // flow, so every student genuinely sees it exactly once.
  const prefs = snap.data() ?? {}
  if (!prefs.languageChosen) {
    return withReturnTo('/welcome/language', opts.returnTo)
  }
  if (languageHasVoiceOptions(prefs.language as string | undefined) && !prefs.voiceChosen) {
    return withReturnTo('/welcome/voice', opts.returnTo)
  }

  // The diagnostic gate (Jesse's Kitchen + the ACT math probe) is retired
  // from the post-login sequence (2026-09-01 ask): Desk OS's own Mastery
  // check-in and goal-setting now cover what the diagnostic used to
  // establish, and forcing every student through both was exactly the kind
  // of legacy-page pile-up this whole redesign was meant to remove. The
  // /diagnostic route and Diagnostic.tsx itself are untouched and still
  // directly reachable (nothing here deletes the page), this just stops
  // gating the default landing on it.

  // Desk OS is now the real post-login landing for students (2026-08-31),
  // replacing the old default of /dashboard. /dashboard itself is untouched
  // and still reachable directly, this only changes where a student with
  // no explicit ?next= lands. Reuses the existing /desk alias (App.tsx's
  // DeskOsRedirect) rather than duplicating its redirect target here.
  return opts.returnTo ?? '/desk'
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
  // Heading to Desk OS: paint the body this exact moment, synchronously,
  // before React Router even starts unmounting the current page (2026-09-01
  // ask). DeskOsRedirect's own DeskHandoffBackground overlay only exists
  // once it mounts, and global.css's body default (--bg, a dark teal-blue,
  // #102F35) shows through for a frame in the gap between the old page
  // unmounting and that overlay committing, a visible blue flash. Setting
  // it here removes the gap entirely rather than racing it.
  if (path === '/desk' || path.startsWith('/desk?') || path.startsWith('/desk-os')) {
    document.body.style.background = '#060c09'
  }
  if (navigate) {
    navigate(path, { replace: true })
    return
  }
  window.location.replace(path)
}
