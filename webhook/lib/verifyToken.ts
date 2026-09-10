import type { VercelRequest } from '@vercel/node'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { auth } from './firebase'

/**
 * Verifies the Firebase ID token from the Authorization header.
 * Returns the caller's uid on success, null if missing or invalid.
 */
export async function verifyToken(req: VercelRequest): Promise<string | null> {
  const decoded = await verifyTokenFull(req)
  return decoded?.uid ?? null
}

/**
 * Same verification as verifyToken(), but returns the full decoded token
 * instead of just uid — for handlers that also need email/email_verified/
 * name (grant-admin.ts, link-child.ts, admin-link.ts previously each
 * hand-rolled this same auth.verifyIdToken() call inline; consolidated
 * here 2026-08-21 so a future auth fix only has to land in one place).
 */
export async function verifyTokenFull(req: VercelRequest): Promise<DecodedIdToken | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  try {
    return await auth.verifyIdToken(header.slice(7))
  } catch {
    return null
  }
}
