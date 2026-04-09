/**
 * utils/format.ts
 *
 * Date/time formatting helpers used across the app.
 * One place to change display format for the entire product.
 */

/**
 * "Wed, Apr 9 · 9:00 AM"
 * Used in session row lists throughout the tutor and admin dashboards.
 */
export function fmtDateTime(ms: number): string {
  const d = new Date(ms)
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time}`
}

/**
 * "in 2h 30m" / "in 3d" / "Now"
 * Used in upcoming session countdown badges.
 */
export function timeUntil(ms: number): string {
  const diff = ms - Date.now()
  if (diff <= 0) return 'Now'
  const totalHours = Math.floor(diff / 3_600_000)
  const minutes    = Math.floor((diff % 3_600_000) / 60_000)
  if (totalHours > 24) return `in ${Math.floor(totalHours / 24)}d`
  if (totalHours > 0)  return `in ${totalHours}h ${minutes}m`
  return `in ${minutes}m`
}

/**
 * "Apr 9" — short date label used in session summary cards.
 */
export function fmtShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
