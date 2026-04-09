/**
 * lib/cors.ts
 *
 * CORS header helper for public-facing API endpoints (called from the browser).
 * Internal webhook receivers (Calendly, Fireflies) don't need this.
 *
 * Usage:
 *   setCors(res)
 *   if (req.method === 'OPTIONS') return res.status(200).send('')
 */

import type { VercelResponse } from '@vercel/node'

export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}
