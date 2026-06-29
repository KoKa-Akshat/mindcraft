import type { VercelRequest } from '@vercel/node'
import { auth } from './firebase'

/**
 * Verifies the Firebase ID token from the Authorization header.
 * Returns the caller's uid on success, null if missing or invalid.
 */
export async function verifyToken(req: VercelRequest): Promise<string | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  try {
    const decoded = await auth.verifyIdToken(header.slice(7))
    return decoded.uid
  } catch {
    return null
  }
}
