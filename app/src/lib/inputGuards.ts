/**
 * inputGuards — client-side abuse hardening for free-text surfaces.
 *
 * Covers the attack surfaces flagged in the security pass:
 *  - essay-pasting / control-character junk in answer fields
 *  - oversized problem text hammering the LLM webhooks
 *  - brute-force login attempts (client cooldown on top of
 *    Firebase's server-side `auth/too-many-requests` throttle)
 *
 * These are UX-layer guards; the real enforcement lives server-side
 * (Firebase Auth throttling, webhook body caps, Firestore rules).
 */

export const MAX_ANSWER_CHARS = 64
export const MAX_PROBLEM_CHARS = 1200

/* eslint-disable no-control-regex */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** Strip control chars and collapse runs of whitespace. */
function cleanText(text: string): string {
  return text.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ')
}

/**
 * Sanitize an inline SVG string before injecting via dangerouslySetInnerHTML.
 * Returns the original string only if it passes all safety checks, empty otherwise.
 * Rejects: script tags, foreignObject, javascript:/data: URIs, inline event handlers.
 */
export function safeSvgHtml(svg: string | undefined | null): string {
  if (!svg) return ''
  const trimmed = svg.trim()
  if (!trimmed.startsWith('<svg') || !trimmed.endsWith('</svg>') || trimmed.length > 4500) return ''
  if (/(<script|<foreignObject|javascript:|data:|on\w+=)/i.test(trimmed)) return ''
  return trimmed
}

/** A typed math answer: short, single-line, no markup. */
export function sanitizeAnswer(text: string): string {
  return cleanText(text).slice(0, MAX_ANSWER_CHARS)
}

/** A pasted problem: bounded length, control chars stripped, newlines kept. */
export function sanitizeProblemText(text: string): string {
  return text.replace(CONTROL_CHARS, '').slice(0, MAX_PROBLEM_CHARS)
}

// ── login attempt cooldown ──────────────────────────────────────

const LOGIN_FAIL_KEY = 'mc-login-fails'
const FAIL_WINDOW_MS = 10 * 60 * 1000
const MAX_FAILS = 5
const COOLDOWN_MS = 60 * 1000

type FailLog = { times: number[] }

function readFailLog(): FailLog {
  try {
    const raw = localStorage.getItem(LOGIN_FAIL_KEY)
    if (!raw) return { times: [] }
    const parsed = JSON.parse(raw) as FailLog
    return { times: Array.isArray(parsed.times) ? parsed.times : [] }
  } catch {
    return { times: [] }
  }
}

function writeFailLog(log: FailLog): void {
  try { localStorage.setItem(LOGIN_FAIL_KEY, JSON.stringify(log)) } catch { /* ignore */ }
}

/** Record a failed sign-in attempt. */
export function recordLoginFailure(): void {
  const now = Date.now()
  const log = readFailLog()
  log.times = [...log.times.filter(t => now - t < FAIL_WINDOW_MS), now]
  writeFailLog(log)
}

/** Clear the failure log after a successful sign-in. */
export function clearLoginFailures(): void {
  try { localStorage.removeItem(LOGIN_FAIL_KEY) } catch { /* ignore */ }
}

/**
 * Milliseconds until the next sign-in attempt is allowed.
 * 0 when not blocked. Blocks for 60s once 5 failures land
 * inside a 10-minute window.
 */
export function loginBlockedForMs(): number {
  const now = Date.now()
  const recent = readFailLog().times.filter(t => now - t < FAIL_WINDOW_MS)
  if (recent.length < MAX_FAILS) return 0
  const lastFail = Math.max(...recent)
  const remaining = COOLDOWN_MS - (now - lastFail)
  return remaining > 0 ? remaining : 0
}
