/**
 * loginAllowlist.ts
 *
 * Invite-only sign-in gate. A brand-new email (no existing users/{uid} doc)
 * may only create an account if an admin has already added it here — and the
 * role it lands as is whichever role the admin filed it under. Existing
 * accounts (already has a role) are never affected by this — the gate only
 * runs at first-time account creation (see postLogin.ts).
 *
 * Doc id is the lowercased email itself, so a lookup during sign-in is a
 * single getDoc, no query/index needed. Firestore rules restrict writes to
 * role === 'admin' (see firebase/firestore.rules), same admin-only pattern
 * as everything else in the Admin "Links" tab.
 */
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

export type AllowlistRole = 'student' | 'tutor' | 'parent'

export interface AllowlistEntry {
  email: string
  role: AllowlistRole
}

function docId(email: string): string {
  return email.trim().toLowerCase()
}

export async function lookupAllowlistRole(email: string | null | undefined): Promise<AllowlistRole | null> {
  if (!email) return null
  const snap = await getDoc(doc(db, 'login_allowlist', docId(email)))
  if (!snap.exists()) return null
  const role = snap.data()?.role
  return role === 'student' || role === 'tutor' || role === 'parent' ? role : null
}

export async function listAllowlist(): Promise<AllowlistEntry[]> {
  const snap = await getDocs(collection(db, 'login_allowlist'))
  return snap.docs.map(d => ({ email: (d.data().email as string) ?? d.id, role: d.data().role as AllowlistRole }))
}

export async function addToAllowlist(email: string, role: AllowlistRole): Promise<void> {
  const id = docId(email)
  await setDoc(doc(db, 'login_allowlist', id), { email: id, role })
}

export async function removeFromAllowlist(email: string): Promise<void> {
  await deleteDoc(doc(db, 'login_allowlist', docId(email)))
}
