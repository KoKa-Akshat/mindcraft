/**
 * lib/firebase.ts
 *
 * Shared Firebase Admin SDK initialization for all webhook handlers.
 * Vercel may reuse the same Node.js instance across requests (warm starts),
 * so we guard against double-initialization with getApps().length.
 *
 * Import `db` from here instead of initializing in every handler.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
  })
}

export const db = getFirestore()
