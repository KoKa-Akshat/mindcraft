/**
 * extractPlottablePoints — for questions whose figure is nothing more than a
 * handful of labeled points on a set of axes, pull the real (x, y) pairs out
 * of the question/diagram text so GraphBox can plot THOSE points instead of
 * defaulting to an unrelated generic curve.
 *
 * Root cause this fixes: GraphBox always opened to `x^2+5x+6` for any
 * concept in `GRAPHABLE_CONCEPT_IDS`, regardless of what the specific
 * question was actually about. The reported bug (eedi_203, linear_equations):
 * "Mark is working out the distance between these two points... (Diagram:
 * Axes with not scales drawn on. Two points are marked, (4,10) and (9,2))" —
 * GraphBox showed a parabola with no relationship to the real points.
 *
 * Deliberately conservative — this is NOT a general diagram parser. It only
 * fires when:
 *   1. the text explicitly describes points marked/plotted on axes (not a
 *      Venn diagram region, a dimensioned shape, a function machine, etc — see
 *      NOT_POINT_PLOT_RE), and
 *   2. it finds 2-6 real coordinate pairs.
 * Anything else returns null — callers should fall back to the existing
 * caption/diagram treatment rather than force a bad-fit plot. See
 * `docs`/ACTIVE_TASK.md for the audited list of diagram shapes that still
 * need a real generated image asset instead (geometric shapes, Venn
 * diagrams, function machines, curve-shaped real-world graphs, circles
 * through points).
 */
import { splitAltDiagramSegments } from './altDiagram'
import { parsePolynomial } from './polynomialExpression'

export interface PlottablePoint {
  x: number
  y: number
}

const COORD_RE = /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g

/** Phrasing that means "discrete points marked/plotted on axes" — the one
 * figure shape GraphBox's point-marker mode can faithfully stand in for. */
const POINT_CONTEXT_RE = /\baxes\b|\baxis\b|\bpoints?\b|\bcoordinate grid\b|\bintercepts?\b|\bgraph\b/i

/** Phrasing that means the figure is a different kind of diagram entirely
 * (a dimensioned shape, a Venn diagram, a function machine, a real-world
 * rate/behavior graph, a circle) — never force these through a point plot
 * even if a stray coordinate-shaped token appears in the text. */
const NOT_POINT_PLOT_RE =
  /venn diagram|function machine|number line|percentage number line|circle (?:through|goes)|depth-time|glass|cost changes|graph showing how/i

/** True when a single `(Diagram: ...)` alt segment describes the same kind of
 * "points/line/curve on axes" figure that GraphBox's point-marker or
 * expression mode can plot — i.e. exactly the phrasing extractPlottablePoints/
 * extractGraphableExpression key off. Callers (MathText, HighlightedStem) use
 * this to suppress a redundant second rendering of the SAME figure as a
 * "Picture: ..." caption or parsed inline diagram once GraphBox is already
 * showing it — the reported bug where a coordinate-grid caption and the
 * GraphBox panel both plot identical points for one question. */
export function isGraphShapedAlt(alt: string): boolean {
  return POINT_CONTEXT_RE.test(alt) && !NOT_POINT_PLOT_RE.test(alt)
}

export function extractPlottablePoints(text: string): PlottablePoint[] | null {
  const segments = splitAltDiagramSegments(text)
  const diagramAlts = segments.filter(s => s.kind === 'diagram').map(s => s.alt)
  // A few non-Eedi sources may describe points directly with no Diagram
  // callout wrapper — fall back to scanning the raw text in that case.
  const candidates = diagramAlts.length ? diagramAlts : [text]

  for (const alt of candidates) {
    if (NOT_POINT_PLOT_RE.test(alt)) continue
    if (!POINT_CONTEXT_RE.test(alt)) continue

    COORD_RE.lastIndex = 0
    const points: PlottablePoint[] = []
    let m: RegExpExecArray | null
    while ((m = COORD_RE.exec(alt)) !== null) {
      const x = parseFloat(m[1])
      const y = parseFloat(m[2])
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y })
    }
    if (points.length >= 2 && points.length <= 6) return points
  }
  return null
}

/** "y = <expr> [drawn/is drawn/on]" — several diagram descriptions state the
 * plotted curve's equation directly (e.g. "A set of axes with the quadratic
 * graph y=x^2+4x-1 drawn on."). When present and parseable by GraphBox's own
 * polynomial grammar, that is a strictly better default than a generic
 * curve — same GraphBox rendering path, just a real expression instead of
 * `x^2+5x+6`. Returns the bare expression (no leading "y="), ready for
 * GraphBox's `initialExpression` prop. */
// Note: '.' is deliberately allowed inside the captured group (decimal
// coefficients like "0.4x-3" need it) — only a trailing sentence period gets
// excluded, via the lookahead stopping at "drawn"/"on" first wherever present.
const Y_EQUALS_RE = /\by\s*=\s*([^,;]+?)(?=\s*(?:is\s+drawn|drawn|on\b|,|;|$))/i

// Rounds away binary floating-point noise (e.g. a slope of 1/3 computed as
// 0.33333333333333337) and drops a trailing ".0" so the formatted expression
// reads the way a person would write it.
function fmtNum(n: number): string {
  const rounded = Math.round(n * 10000) / 10000
  return String(rounded)
}

/** Builds a `y = mx + b` string from an exact slope/intercept — used only
 * when both were computed from real coordinates, never guessed. */
function formatLinear(slope: number, intercept: number): string {
  const parts: string[] = []
  if (slope !== 0) {
    if (slope === 1) parts.push('x')
    else if (slope === -1) parts.push('-x')
    else parts.push(`${fmtNum(slope)}x`)
  }
  if (intercept !== 0 || parts.length === 0) {
    const sign = intercept > 0 && parts.length > 0 ? '+' : ''
    parts.push(`${sign}${fmtNum(intercept)}`)
  }
  return parts.join('')
}

function formatQuadratic(a: number, b: number, c: number): string {
  const parts: string[] = []
  if (a === 1) parts.push('x^2')
  else if (a === -1) parts.push('-x^2')
  else parts.push(`${fmtNum(a)}x^2`)
  if (b !== 0) {
    const sign = b > 0 ? '+' : '-'
    const mag = Math.abs(b)
    parts.push(`${sign}${mag === 1 ? '' : fmtNum(mag)}x`)
  }
  if (c !== 0) {
    const sign = c > 0 ? '+' : '-'
    parts.push(`${sign}${fmtNum(Math.abs(c))}`)
  }
  return parts.join('')
}

/** A straight line is fully determined by ANY two of its points — if 3+ are
 * given (e.g. a stated tangent line passing through 3 named points), they
 * must all fall on the exact same line or this returns null rather than
 * force-fitting a line that doesn't actually match the third point. */
function deriveLinearExpression(points: PlottablePoint[]): string | null {
  const distinct = points.filter((p, i) => points.findIndex(q => q.x === p.x && q.y === p.y) === i)
  if (distinct.length < 2) return null
  const [p1, p2] = distinct
  if (p1.x === p2.x) return null // vertical — not expressible as y = f(x)
  const slope = (p2.y - p1.y) / (p2.x - p1.x)
  for (const p of distinct.slice(2)) {
    // Cross-multiplied collinearity check — avoids float division noise.
    const lhs = (p.y - p1.y) * (p2.x - p1.x)
    const rhs = (p.x - p1.x) * (p2.y - p1.y)
    if (Math.abs(lhs - rhs) > 1e-6) return null
  }
  const intercept = p1.y - slope * p1.x
  return formatLinear(slope, intercept)
}

/** A parabola is fully determined by its two x-intercepts (roots) plus one
 * more point — here, the y-intercept, which real alt-text almost always
 * states alongside the roots ("crosses the x axis at (-2,0) and (3,0) and
 * crosses the y axis at (0,-6)"). Solves y = a(x-r1)(x-r2) for the exact `a`
 * that passes through the stated y-intercept, then expands — never assumes
 * a=1. Requires exactly 2 distinct roots (y=0) and exactly 1 y-intercept
 * (x=0) among the given points; anything else returns null. */
function deriveQuadraticFromRootsAndIntercept(points: PlottablePoint[]): string | null {
  const roots = points.filter(p => p.y === 0 && p.x !== 0)
  const yIntercepts = points.filter(p => p.x === 0)
  if (roots.length !== 2 || yIntercepts.length !== 1) return null
  const [r1, r2] = roots
  if (r1.x === r2.x) return null
  const c = yIntercepts[0].y
  const denom = r1.x * r2.x
  if (denom === 0) return null
  const a = c / denom
  if (a === 0 || !Number.isFinite(a)) return null
  const b = -a * (r1.x + r2.x)
  const cCoeff = a * r1.x * r2.x
  return formatQuadratic(a, b, cCoeff)
}

/** "A graph of a horizontal line going through 3 on the y axis." — a single
 * stated y-value with no coordinate pairs at all (COORD_RE finds nothing
 * here), so this needs its own extraction rather than routing through
 * extractPlottablePoints. */
const HORIZONTAL_LINE_RE = /horizontal line[^.]*?(-?\d+(?:\.\d+)?)\s*on\s*the\s*y[\s-]*axis/i

export function extractGraphableExpression(text: string): string | null {
  const segments = splitAltDiagramSegments(text)
  const diagramAlts = segments.filter(s => s.kind === 'diagram').map(s => s.alt)
  const candidates = diagramAlts.length ? diagramAlts : [text]

  for (const alt of candidates) {
    const m = alt.match(Y_EQUALS_RE)
    if (m) {
      const expr = m[1].trim()
      if (expr) {
        try {
          parsePolynomial(expr)
          return expr
        } catch {
          // fall through to the derivations below
        }
      }
    }

    const horizontalM = alt.match(HORIZONTAL_LINE_RE)
    if (horizontalM) {
      const value = parseFloat(horizontalM[1])
      if (Number.isFinite(value)) return fmtNum(value)
    }

    if (NOT_POINT_PLOT_RE.test(alt) || !POINT_CONTEXT_RE.test(alt)) continue
    COORD_RE.lastIndex = 0
    const points: PlottablePoint[] = []
    let cm: RegExpExecArray | null
    while ((cm = COORD_RE.exec(alt)) !== null) {
      const x = parseFloat(cm[1])
      const y = parseFloat(cm[2])
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y })
    }
    if (points.length < 2 || points.length > 6) continue

    if (/quadratic|parabol/i.test(alt)) {
      const quad = deriveQuadraticFromRootsAndIntercept(points)
      if (quad) return quad
    }
    if (/\bline\b|\bstraight\b|\btangent\b/i.test(alt)) {
      const line = deriveLinearExpression(points)
      if (line) return line
    }
  }
  return null
}
