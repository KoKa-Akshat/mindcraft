/**
 * altDiagram.ts — turns Eedi accessibility alt-text into a real diagram spec
 * where the pattern is recognizable, instead of leaving it as a raw sentence.
 *
 * Background: the Eedi ingestion pipeline (see CLAUDE.md "Question bank")
 * recovers otherwise-unusable questions by rewriting `![alt text]()` markdown
 * images as `(Diagram: alt text)` — a deliberate, documented tradeoff to keep
 * the question solvable in text form. That substitution was never meant to
 * be the FINAL rendering, just a safe intermediate string, but no renderer
 * ever consumed it, so students see the raw accessibility description
 * verbatim ("Line with 5 dashes spaced equally...") which reads like a bug
 * report, not a diagram.
 *
 * This module recognizes the two most common, most mechanically-describable
 * alt-text families in the bank (both keyed off `format: 'number_line'`
 * questions) and extracts a typed spec a real SVG can draw:
 *   - "dashline": N evenly-spaced dashes on a line, some labeled with a
 *     value, an arrow pointing at one of them. (The exact pattern from the
 *     reported bug.)
 *   - "inequalityray": a single point on a line, open/filled circle, an
 *     arrow ray running left or right (used by linear_inequalities number
 *     lines).
 * Anything else falls back to `humanizeAltCaption` — light cleanup only,
 * never inventing content — per the explicit fallback the brief allows.
 */

export type DashLineDiagram = {
  kind: 'dashline'
  count: number
  marks: { index: number; label: string }[] // 1-indexed dash position
  arrow?: { index: number; color?: string; direction: 'up' | 'down' }
}

export type InequalityRayDiagram = {
  kind: 'inequalityray'
  value: number
  filled: boolean
  direction: 'left' | 'right'
}

export type AltDiagram = DashLineDiagram | InequalityRayDiagram

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
}

function ordinalToIndex(word: string): number | null {
  const w = word.trim().toLowerCase()
  if (ORDINALS[w] != null) return ORDINALS[w]
  const n = parseInt(w, 10)
  return Number.isFinite(n) ? n : null
}

/** "Line with N dashes ... First dash marked with a X ... [color] arrow
 * pointing (up|down)wards towards the Kth dash." Real quote parsed against:
 * "Line with 5 dashes spaced equally. No dashes at the start and end of the
 * line. First dash marked with a 1 fourth dash marked with a 2. Blue arrow
 * pointing upwards towards the third dash." (eedi_696, fractions_decimals). */
function parseDashLine(alt: string): DashLineDiagram | null {
  const countM = alt.match(/(\d+)\s+dashes/i)
  if (!countM) return null
  const count = parseInt(countM[1], 10)
  if (!Number.isFinite(count) || count < 2 || count > 12) return null

  const marks: { index: number; label: string }[] = []
  const markRe = /(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+dash\s+(?:is\s+)?marked\s+with\s+(?:an?\s+)?([\w./¼½¾⅓⅔]+)/gi
  let m: RegExpExecArray | null
  while ((m = markRe.exec(alt)) !== null) {
    const idx = ordinalToIndex(m[1])
    const label = m[2].replace(/\.+$/, '')
    if (idx != null && idx <= count && label) marks.push({ index: idx, label })
  }

  let arrow: DashLineDiagram['arrow']
  const arrowRe = /(\w+)?\s*arrow\s+pointing\s+(up(?:wards)?|down(?:wards)?)\s+towards\s+the\s+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+)(?:st|nd|rd|th)?\s+dash/i
  const am = alt.match(arrowRe)
  if (am) {
    const idx = ordinalToIndex(am[3])
    if (idx != null && idx <= count) {
      arrow = {
        index: idx,
        direction: /up/i.test(am[2]) ? 'up' : 'down',
        color: am[1] && /^(blue|red|green|orange|purple|black|gold)$/i.test(am[1]) ? am[1].toLowerCase() : undefined,
      }
    }
  }

  // Require at least one mark OR an arrow — a bare dash count with nothing
  // else isn't confidently this pattern (could be a different diagram type
  // that happens to mention "dashes", e.g. "each side marked with a dash").
  if (!marks.length && !arrow) return null
  return { kind: 'dashline', count, marks, arrow }
}

/** "... At V there is a(n) (open/filled) ... circle ..., with an arrow
 * pointing to the (left/right) ..." — the inequality-solution number line
 * family (e.g. eedi_58, linear_inequalities). */
function parseInequalityRay(alt: string): InequalityRayDiagram | null {
  if (!/circle/i.test(alt) || !/arrow/i.test(alt)) return null
  const valueM = alt.match(/[Aa]t\s+(-?\d+(?:\.\d+)?)\s+there\s+is/)
  if (!valueM) return null
  const value = parseFloat(valueM[1])
  if (!Number.isFinite(value)) return null
  const filled = /\b(filled|solid|red)\b[^.]*circle/i.test(alt) && !/open|unfilled/i.test(alt)
  const dirM = alt.match(/pointing\s+to\s+the\s+(left|right)/i)
  if (!dirM) return null
  return { kind: 'inequalityray', value, filled, direction: dirM[1].toLowerCase() as 'left' | 'right' }
}

export function parseAltDiagram(alt: string): AltDiagram | null {
  return parseDashLine(alt) ?? parseInequalityRay(alt)
}

/** Fallback for alt text we can't confidently turn into a diagram: light
 * cleanup only (whitespace, trailing punctuation) — never invent content. */
export function humanizeAltCaption(alt: string): string {
  const cleaned = alt.replace(/\s+/g, ' ').trim()
  if (!cleaned) return cleaned
  const withPeriod = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
  return withPeriod.charAt(0).toUpperCase() + withPeriod.slice(1)
}
