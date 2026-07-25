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
const POINT_CONTEXT_RE = /\baxes\b|\baxis\b|\bpoints?\b|\bcoordinate grid\b/i

/** Phrasing that means the figure is a different kind of diagram entirely
 * (a dimensioned shape, a Venn diagram, a function machine, a real-world
 * rate/behavior graph, a circle) — never force these through a point plot
 * even if a stray coordinate-shaped token appears in the text. */
const NOT_POINT_PLOT_RE =
  /venn diagram|function machine|number line|percentage number line|circle (?:through|goes)|depth-time|glass|cost changes|graph showing how/i

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

export function extractGraphableExpression(text: string): string | null {
  const segments = splitAltDiagramSegments(text)
  const diagramAlts = segments.filter(s => s.kind === 'diagram').map(s => s.alt)
  const candidates = diagramAlts.length ? diagramAlts : [text]

  for (const alt of candidates) {
    const m = alt.match(Y_EQUALS_RE)
    if (!m) continue
    const expr = m[1].trim()
    if (!expr) continue
    try {
      parsePolynomial(expr)
      return expr
    } catch {
      continue
    }
  }
  return null
}
