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

import type { VercelRequest, VercelResponse } from '@vercel/node'

export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export interface CorsAllowlistOptions {
  /** Origins allowed to receive a reflected Access-Control-Allow-Origin. */
  allowedOrigins: string[] | Set<string>
  /**
   * Origin to fall back to when the request's origin isn't in the
   * allowlist. Omit to leave Access-Control-Allow-Origin unset for a
   * disallowed origin (no CORS access) rather than falling back to a
   * fixed value.
   */
  fallbackOrigin?: string
  methods?: string
  headers?: string
}

/**
 * Stricter CORS for endpoints that need a real origin allowlist instead of
 * the wildcard `setCors()` default — e.g. Firestore-writing endpoints that
 * take a Firebase ID token and shouldn't accept it from an arbitrary page.
 * Three call shapes exist among today's callers, all expressible with this
 * one function:
 *   - allowlist + no fallback: disallowed origins get no ACAO header at all
 *     (browser blocks the response) — api/agent-check-in.ts's shape.
 *   - allowlist + fallback: disallowed origins still get a fixed default
 *     origin — api/story-module.ts's shape.
 *   - empty allowlist + fallback only: always sets one fixed origin,
 *     regardless of the request's actual origin — api/gemini.ts's shape.
 */
export function setCorsAllowlist(req: VercelRequest, res: VercelResponse, options: CorsAllowlistOptions) {
  const origin = String(req.headers.origin ?? '')
  const isAllowed = Array.isArray(options.allowedOrigins)
    ? options.allowedOrigins.includes(origin)
    : options.allowedOrigins.has(origin)

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (options.fallbackOrigin) {
    res.setHeader('Access-Control-Allow-Origin', options.fallbackOrigin)
  }

  res.setHeader('Access-Control-Allow-Methods', options.methods ?? 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', options.headers ?? 'Content-Type, Authorization')
}
