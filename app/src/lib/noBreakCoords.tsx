/**
 * renderNoBreakCoordinates — wraps coordinate-pair tokens like "(4,10)" or
 * "(-3, 2.5)" in a non-breaking span so the browser never line-wraps mid
 * parenthesis (e.g. "(4,10" on one line, "and (9,2))" on the next — the
 * exact garbled break reported against eedi_203 / linear_equations).
 * Plain text in, plain text/spans out; safe to call on any string, it is a
 * no-op when no coordinate-shaped token is present.
 */
import type { ReactNode } from 'react'

const COORD_RE = /\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/g

export function renderNoBreakCoordinates(text: string, keyPrefix = 'coord'): ReactNode {
  if (!text) return text
  COORD_RE.lastIndex = 0
  if (!COORD_RE.test(text)) return text
  COORD_RE.lastIndex = 0

  const parts: ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = COORD_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(
      <span key={`${keyPrefix}-${i++}`} style={{ whiteSpace: 'nowrap' }}>
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
