/**
 * quadratics.ts
 *
 * Pure math core for the Manjushree zone (The Sword of Wisdom).
 * Every quadratic in the zone is authored as y = a(x - r1)(x - r2) with a < 0
 * (a downward-opening ridge). All derived quantities (standard form, axis,
 * vertex, discriminant) are computed here, and every student answer is
 * validated and misconception-classified here.
 *
 * No Three.js, no React, no Firebase. Fully unit-testable.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ZoneQuadratic {
  /** Bank id, e.g. "mjz_q01". */
  id: string
  level: 1 | 2 | 3
  /** Which algebraic form the HUD displays. */
  displayForm: 'factored' | 'standard'
  /** y = a (x - r1)(x - r2), authored with r1 < r2 and a < 0. */
  a: number
  r1: number
  r2: number
  /**
   * Independently authored expected values. Tests assert these EQUAL the
   * computed values, so an authoring slip can never ship silently.
   */
  expected: {
    b: number
    c: number
    axis: number
    vertex: { x: number; y: number }
    discriminant: number
  }
}

/** Trajectory quadratic for the optional Discriminant Sight encounter. */
export interface TrajectoryQuadratic {
  id: string
  a: number
  b: number
  c: number
  expected: {
    discriminant: number
    intersections: 'two' | 'one' | 'none'
  }
}

export type EncounterId = 'roots' | 'axis' | 'vertex' | 'strike' | 'discriminant'

export interface AnswerCheck {
  correct: boolean
  /** Canonical misconception id (mis_quadratic_equations__*) when the wrong answer matches a known trap. */
  misconceptionId?: string
  /** True when the submission could not be interpreted at all. */
  unparsed?: boolean
}

// Placement snaps to a 0.5 grid, so anything within a quarter unit is "the
// same spot". Typed entries are held to the same tolerance.
export const MATCH_TOL = 0.26

// ── Misconception ids ──────────────────────────────────────────────────────
// Family format matches the repo convention: mis_{concept}__{slug}.
// Three ids are REUSED from the existing Eedi-minted set (see eediQuestions.json);
// the rest are newly minted in the same family for traps the bank did not cover.

export const MIS = {
  // Reused from the existing bank:
  signFlippedRoots: 'mis_quadratic_equations__forgets_swap_sign_roots_placing',
  yInterceptForVertex: 'mis_quadratic_equations__confuses_yintercept_with_turning_point',
  yInterceptForRoot: 'mis_quadratic_equations__finds_y_intercept_asked_read',
  // Minted for this zone:
  oneFactorOnly: 'mis_quadratic_equations__sets_only_one_factor_to_zero',
  wrongScale: 'mis_quadratic_equations__reads_coordinates_from_wrong_scale',
  coefficientsAsRoots: 'mis_quadratic_equations__reads_coefficients_as_roots',
  vertexAsRoot: 'mis_quadratic_equations__marks_vertex_as_root',
  vertexForAxis: 'mis_quadratic_equations__reports_vertex_for_axis',
  axisAsYEquals: 'mis_quadratic_equations__writes_axis_as_y_equals',
  axisSignError: 'mis_quadratic_equations__sign_error_in_axis_formula',
  halfWidthForAxis: 'mis_quadratic_equations__halves_root_distance_not_midpoint',
  maxForAxis: 'mis_quadratic_equations__confuses_axis_with_maximum',
  axisForVertex: 'mis_quadratic_equations__gives_axis_for_vertex',
  maxOnlyForVertex: 'mis_quadratic_equations__gives_maximum_not_ordered_pair',
  substitutionError: 'mis_quadratic_equations__substitutes_axis_incorrectly',
  swappedVertex: 'mis_quadratic_equations__swaps_vertex_coordinates',
  discriminantSign: 'mis_quadratic_equations__misreads_discriminant_sign',
} as const

/** Short amber "Common trap" labels, keyed by misconception id. Zero verdicts. */
export const MIS_LABELS: Record<string, string> = {
  [MIS.signFlippedRoots]: 'Common trap: (x - 1) = 0 gives x = 1, not x = -1. The sign inside the factor flips.',
  [MIS.yInterceptForVertex]: 'Common trap: the y-intercept is where the curve meets the y-axis, not its peak.',
  [MIS.yInterceptForRoot]: 'Common trap: that is the y-intercept. Roots live on the x-axis, at the waterline.',
  [MIS.oneFactorOnly]: 'Common trap: both factors can be zero. Each one gives its own root.',
  [MIS.wrongScale]: 'Common trap: check the scale marks. Each tick on the waterline is one unit.',
  [MIS.coefficientsAsRoots]: 'Common trap: coefficients are not roots. Factor first, then solve each factor.',
  [MIS.vertexAsRoot]: 'Common trap: the peak is not a root. Roots sit where the curve meets the waterline.',
  [MIS.vertexForAxis]: 'Common trap: that is the vertex, a point. The axis is a vertical line, x = a number.',
  [MIS.axisAsYEquals]: 'Common trap: y = 5 is a horizontal line. A vertical axis is written x = 5.',
  [MIS.axisSignError]: 'Common trap: the formula is x = -b / (2a). Watch the leading minus sign.',
  [MIS.halfWidthForAxis]: 'Common trap: that is half the distance between roots. The axis is their midpoint.',
  [MIS.maxForAxis]: 'Common trap: that is the height of the peak. The axis is the x-value beneath it.',
  [MIS.axisForVertex]: 'Common trap: x = 5 is the axis. The vertex is a full point, (x, y).',
  [MIS.maxOnlyForVertex]: 'Common trap: that is only the height. The vertex needs both coordinates.',
  [MIS.substitutionError]: 'Common trap: substitute the axis x-value into every factor, signs included.',
  [MIS.swappedVertex]: 'Common trap: the point reads (x, y). The axis value comes first.',
  [MIS.discriminantSign]: 'Common trap: the sign of b squared minus 4ac decides how many times it touches.',
}

// ── Derived quantities ─────────────────────────────────────────────────────

/** Expand y = a(x - r1)(x - r2) into standard form coefficients {a, b, c}. */
export function standardForm(q: Pick<ZoneQuadratic, 'a' | 'r1' | 'r2'>): { a: number; b: number; c: number } {
  return {
    a: q.a,
    b: -q.a * (q.r1 + q.r2),
    c: q.a * q.r1 * q.r2,
  }
}

export function axisOf(q: Pick<ZoneQuadratic, 'r1' | 'r2'>): number {
  return (q.r1 + q.r2) / 2
}

export function vertexOf(q: Pick<ZoneQuadratic, 'a' | 'r1' | 'r2'>): { x: number; y: number } {
  const x = axisOf(q)
  return { x, y: evaluate(q, x) }
}

export function evaluate(q: Pick<ZoneQuadratic, 'a' | 'r1' | 'r2'>, x: number): number {
  return q.a * (x - q.r1) * (x - q.r2)
}

export function discriminantOf(q: Pick<ZoneQuadratic, 'a' | 'r1' | 'r2'>): number {
  const { a, b, c } = standardForm(q)
  return b * b - 4 * a * c
}

/** One multiple-choice root pair: [left, right], sorted ascending. */
export type RootPair = readonly [number, number]

function sortedPair(a: number, b: number): RootPair {
  return a <= b ? [a, b] : [b, a]
}

/**
 * Two root-pair options for the click UI: the correct pair plus one trap
 * (sign-flip or off-by-one). Pure; grading still goes through checkRoots.
 */
export function rootPairCandidates(
  q: Pick<ZoneQuadratic, 'r1' | 'r2'>,
): [RootPair, RootPair] {
  const correct = sortedPair(q.r1, q.r2)
  const traps = [
    sortedPair(-q.r1, -q.r2),
    sortedPair(q.r1 + 1, q.r2 - 1),
    sortedPair(q.r1 - 1, q.r2 + 1),
    sortedPair(q.r1 + 1, q.r2 + 1),
  ]
  const wrong = traps.find(t => t[0] !== correct[0] || t[1] !== correct[1])
    ?? sortedPair(correct[0] - 1, correct[1] + 1)
  return [correct, wrong]
}

/**
 * Candidate x-values for a "state your computed axis before you can act"
 * selection UI (Encounter 3 pilot, 2026-07-21 makeover): the correct axis
 * plus known-trap values (the vertex height read as the axis, the sign-
 * flipped axis, half the root distance instead of the midpoint), deduped and
 * padded to at least `count` distinct options. Pure and quadratic-agnostic —
 * used by the axis encounter's rune-stone UI, not a change to `checkAxis`
 * itself, which still independently validates whatever the student picks.
 */
export function axisCandidates(
  q: Pick<ZoneQuadratic, 'a' | 'r1' | 'r2'>,
  count = 4,
): number[] {
  const axis = axisOf(q)
  const vy = vertexOf(q).y
  const halfWidth = (q.r2 - q.r1) / 2
  const set = new Set<number>([axis, vy, -axis, halfWidth])
  let offset = 2
  let guard = 0
  while (set.size < count && guard < 20) {
    set.add(axis + offset)
    if (set.size < count) set.add(axis - offset)
    offset += 2
    guard += 1
  }
  return [...set].slice(0, count)
}

/**
 * Candidate y-values for the vertex-height rune-stone step (2026-07-21 2D
 * pivot: the vertex encounter now runs as two sequential rune-stone picks,
 * axis first via axisCandidates, then height via this function). Includes
 * the correct height plus known traps: the y-intercept (a common
 * substitution error, MIS.yInterceptForVertex when paired with the axis as
 * a point), the axis value itself (confusing the axis number for the
 * height), and the negated height. Pure and quadratic-agnostic, padded to
 * `count` distinct values the same way axisCandidates is. The typed/rune
 * answer is composed as the point "(axis, height)" and still independently
 * validated by checkVertex, which is untouched by this selection UI.
 */
export function vertexHeightCandidates(
  q: Pick<ZoneQuadratic, 'a' | 'r1' | 'r2'>,
  count = 4,
): number[] {
  const v = vertexOf(q)
  const sf = standardForm(q)
  const axis = axisOf(q)
  const set = new Set<number>([v.y, sf.c, axis, -v.y])
  let offset = 2
  let guard = 0
  while (set.size < count && guard < 20) {
    set.add(v.y + offset)
    if (set.size < count) set.add(Math.max(0, v.y - offset))
    offset += 2
    guard += 1
  }
  return [...set].slice(0, count)
}

export function discriminantOfStandard(a: number, b: number, c: number): number {
  return b * b - 4 * a * c
}

export function intersectionClass(disc: number): 'two' | 'one' | 'none' {
  if (disc > 1e-9) return 'two'
  if (disc < -1e-9) return 'none'
  return 'one'
}

const near = (u: number, v: number, tol = MATCH_TOL) => Math.abs(u - v) <= tol

/** Format a number for display: integers plain, halves and quarters kept short. */
export function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n)
  const r = Math.round(n * 100) / 100
  return String(r)
}

/** Human-readable equation string for the HUD. */
export function equationText(q: ZoneQuadratic): string {
  if (q.displayForm === 'factored') {
    const f = (r: number) => (r === 0 ? 'x' : r > 0 ? `(x - ${fmt(r)})` : `(x + ${fmt(-r)})`)
    const coeff = q.a === -1 ? '-' : `${fmt(q.a)}`
    return `y = ${coeff}${f(q.r1)}${f(q.r2)}`
  }
  const { a, b, c } = standardForm(q)
  const bTerm = b === 0 ? '' : b > 0 ? ` + ${fmt(b)}x` : ` - ${fmt(-b)}x`
  const cTerm = c === 0 ? '' : c > 0 ? ` + ${fmt(c)}` : ` - ${fmt(-c)}`
  const aTxt = a === -1 ? '-' : `${fmt(a)}`
  return `y = ${aTxt}x^2${bTerm}${cTerm}`
}

// ── Answer parsing ─────────────────────────────────────────────────────────
// Tolerant text parsers for the accessibility entry path. Placement input
// arrives already numeric and skips parsing.

const NUM = '(-?\\d+(?:\\.\\d+)?)'

/** Extract every plain number in a string, honoring "x = 3" style prefixes. */
function extractNumbers(text: string): number[] {
  const out: number[] = []
  const re = new RegExp(NUM, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) out.push(parseFloat(m[1]))
  return out
}

export interface ParsedRoots {
  values: number[]
  /** The student framed the answer with "y =". */
  usedYEquals: boolean
  valid: boolean
}

/** Parse a typed root answer: "1 and 9", "x = 1, x = 9", "1, 9", "1 9". */
export function parseRoots(text: string): ParsedRoots {
  const t = text.trim().toLowerCase()
  if (!t) return { values: [], usedYEquals: false, valid: false }
  const usedYEquals = /(^|[^a-z])y\s*=/.test(t)
  const values = extractNumbers(t)
  return { values, usedYEquals, valid: values.length >= 1 && values.length <= 2 }
}

export interface ParsedLine {
  kind: 'x' | 'y' | 'number' | 'point' | 'invalid'
  value?: number
  point?: { x: number; y: number }
}

/** Parse a typed line answer: "x = 5", "y = 5", "5", "(5, 8)". */
export function parseLine(text: string): ParsedLine {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!t) return { kind: 'invalid' }
  const pointMatch = t.match(new RegExp(`^\\(?\\s*${NUM}\\s*[,;]\\s*${NUM}\\s*\\)?$`))
  if (pointMatch) {
    return { kind: 'point', point: { x: parseFloat(pointMatch[1]), y: parseFloat(pointMatch[2]) } }
  }
  const xMatch = t.match(new RegExp(`^x\\s*=\\s*${NUM}$`))
  if (xMatch) return { kind: 'x', value: parseFloat(xMatch[1]) }
  const yMatch = t.match(new RegExp(`^y\\s*=\\s*${NUM}$`))
  if (yMatch) return { kind: 'y', value: parseFloat(yMatch[1]) }
  const numMatch = t.match(new RegExp(`^${NUM}$`))
  if (numMatch) return { kind: 'number', value: parseFloat(numMatch[1]) }
  return { kind: 'invalid' }
}

export interface ParsedPoint {
  kind: 'point' | 'x' | 'y' | 'number' | 'invalid'
  value?: number
  point?: { x: number; y: number }
}

/** Parse a typed vertex answer: "(5, 8)", "5, 8", "x = 5", "8". */
export function parsePoint(text: string): ParsedPoint {
  const line = parseLine(text)
  return line as ParsedPoint
}

// ── Answer checking + misconception classification ─────────────────────────

/**
 * Encounter 2, Root Strike. `values` are the two marker positions (graph x),
 * or a typed pair. Classification order matters: the most specific known trap
 * wins.
 */
export function checkRoots(
  q: ZoneQuadratic,
  values: number[],
  opts: { usedYEquals?: boolean } = {},
): AnswerCheck {
  const roots = [q.r1, q.r2]
  const sf = standardForm(q)

  if (values.length === 0) return { correct: false, unparsed: true }

  const matchesBoth =
    values.length === 2 &&
    ((near(values[0], q.r1) && near(values[1], q.r2)) ||
      (near(values[0], q.r2) && near(values[1], q.r1)))
  if (matchesBoth) return { correct: true }

  // Sign-flipped pair: {-r1, -r2} (skip roots at 0, whose sign flip is itself).
  const flipped = roots.filter(r => r !== 0).map(r => -r)
  if (
    values.length === 2 &&
    flipped.length === 2 &&
    ((near(values[0], flipped[0]) && near(values[1], flipped[1])) ||
      (near(values[0], flipped[1]) && near(values[1], flipped[0])))
  ) {
    return { correct: false, misconceptionId: MIS.signFlippedRoots }
  }

  // y-intercept confusion: a marker at x = 0 paired with the c value, or the
  // pair {0, c} itself (student read the height where the curve crosses x = 0).
  if (
    values.length === 2 &&
    !roots.some(r => near(r, 0)) &&
    values.some(v => near(v, 0)) &&
    values.some(v => near(v, sf.c))
  ) {
    return { correct: false, misconceptionId: MIS.yInterceptForRoot }
  }

  // Doubled or halved placements: read from the wrong scale.
  const scaled = (k: number) =>
    values.length === 2 &&
    ((near(values[0], q.r1 * k) && near(values[1], q.r2 * k)) ||
      (near(values[0], q.r2 * k) && near(values[1], q.r1 * k)))
  if ((scaled(2) || scaled(0.5)) && !matchesBoth) {
    return { correct: false, misconceptionId: MIS.wrongScale }
  }

  // Coefficients used as roots (standard-form display): {b, c} or {-b, c}.
  if (q.displayForm === 'standard' && values.length === 2) {
    const coefPairs = [
      [sf.b, sf.c],
      [-sf.b, sf.c],
    ]
    for (const [p, r] of coefPairs) {
      if (
        (near(values[0], p) && near(values[1], r)) ||
        (near(values[0], r) && near(values[1], p))
      ) {
        return { correct: false, misconceptionId: MIS.coefficientsAsRoots }
      }
    }
  }

  const oneCorrect = values.some(v => roots.some(r => near(v, r)))

  // One correct root, the other at the vertex: peak mistaken for a root.
  if (oneCorrect && values.some(v => near(v, axisOf(q)) && !roots.some(r => near(v, r)))) {
    return { correct: false, misconceptionId: MIS.vertexAsRoot }
  }

  // One factor solved, the second missing or wrong (includes a duplicated root).
  if (oneCorrect) {
    return { correct: false, misconceptionId: MIS.oneFactorOnly }
  }

  if (opts.usedYEquals) {
    return { correct: false, misconceptionId: MIS.yInterceptForRoot }
  }

  return { correct: false }
}

/** Encounter 3, The Line of Symmetry. Beam placement arrives as {kind:'x'}. */
export function checkAxis(q: ZoneQuadratic, parsed: ParsedLine): AnswerCheck {
  const axis = axisOf(q)
  const v = vertexOf(q)

  if (parsed.kind === 'invalid') return { correct: false, unparsed: true }

  if (parsed.kind === 'point') {
    // The vertex (or any point) is not a line.
    if (near(parsed.point!.x, axis) && near(parsed.point!.y, v.y)) {
      return { correct: false, misconceptionId: MIS.vertexForAxis }
    }
    return { correct: false, misconceptionId: MIS.vertexForAxis }
  }

  const value = parsed.value!
  if (parsed.kind === 'y') {
    if (near(value, axis)) return { correct: false, misconceptionId: MIS.axisAsYEquals }
    if (near(value, v.y)) return { correct: false, misconceptionId: MIS.maxForAxis }
    return { correct: false, misconceptionId: MIS.axisAsYEquals }
  }

  // kind 'x' or bare number
  if (near(value, axis)) return { correct: true }
  if (near(value, -axis) && axis !== 0) {
    return { correct: false, misconceptionId: MIS.axisSignError }
  }
  const halfWidth = (q.r2 - q.r1) / 2
  if (near(value, halfWidth) && !near(halfWidth, axis)) {
    return { correct: false, misconceptionId: MIS.halfWidthForAxis }
  }
  if (near(value, v.y) && !near(v.y, axis)) {
    return { correct: false, misconceptionId: MIS.maxForAxis }
  }
  return { correct: false }
}

/** Encounter 4, Vertex Focus. */
export function checkVertex(q: ZoneQuadratic, parsed: ParsedPoint): AnswerCheck {
  const axis = axisOf(q)
  const v = vertexOf(q)
  const sf = standardForm(q)

  if (parsed.kind === 'invalid') return { correct: false, unparsed: true }

  if (parsed.kind === 'point') {
    const { x, y } = parsed.point!
    if (near(x, axis) && near(y, v.y)) return { correct: true }
    if (near(x, v.y) && near(y, axis) && !near(axis, v.y)) {
      return { correct: false, misconceptionId: MIS.swappedVertex }
    }
    if (near(x, axis)) {
      // Right axis, wrong height: which substitution trap?
      if (near(y, sf.c) && !near(sf.c, v.y)) {
        return { correct: false, misconceptionId: MIS.yInterceptForVertex }
      }
      return { correct: false, misconceptionId: MIS.substitutionError }
    }
    return { correct: false }
  }

  // A single value or "x =" style answer is not an ordered pair.
  const value = parsed.value!
  if (parsed.kind === 'x' || (parsed.kind === 'number' && near(value, axis) && !near(axis, v.y))) {
    return { correct: false, misconceptionId: MIS.axisForVertex }
  }
  if (near(value, v.y)) {
    return { correct: false, misconceptionId: MIS.maxOnlyForVertex }
  }
  return { correct: false }
}

/** Optional Discriminant Sight: classify a trajectory. */
export function checkDiscriminant(
  t: TrajectoryQuadratic,
  answer: 'two' | 'one' | 'none',
): AnswerCheck {
  const truth = intersectionClass(discriminantOfStandard(t.a, t.b, t.c))
  if (answer === truth) return { correct: true }
  return { correct: false, misconceptionId: MIS.discriminantSign }
}

// ── Hint ladders ───────────────────────────────────────────────────────────
// Level 1: conceptual nudge. Level 2: partial scaffold with the question's own
// numbers. Level 3: full assist that still requires the physical interaction.

export function hintsFor(q: ZoneQuadratic, encounter: EncounterId): [string, string, string] {
  const sf = standardForm(q)
  const axis = axisOf(q)
  const v = vertexOf(q)
  const f1 = q.r1 >= 0 ? `x - ${fmt(q.r1)}` : `x + ${fmt(-q.r1)}`
  const f2 = q.r2 >= 0 ? `x - ${fmt(q.r2)}` : `x + ${fmt(-q.r2)}`

  switch (encounter) {
    case 'roots': {
      const h1 = 'A root is where the curve meets the x-axis. Here, the x-axis is the waterline.'
      const h2 =
        q.displayForm === 'factored'
          ? `The rock yields where y = 0. Set each factor to zero: ${f1} = 0 gives one root, ${f2} = 0 gives the other.`
          : `Divide out ${fmt(q.a)} first. Then factor what remains: find two numbers that multiply to ${fmt(sf.c / q.a)} and add to ${fmt(sf.b / q.a)}. Each factor set to zero gives a root.`
      const h3 = `The roots are x = ${fmt(q.r1)} and x = ${fmt(q.r2)}. Place a marker on each, where the ridge meets the water.`
      return [h1, h2, h3]
    }
    case 'axis': {
      return [
        'The axis of symmetry is the vertical line that splits the parabola into two matching halves.',
        `It runs through the midpoint of the roots. Average them: (${fmt(q.r1)} + ${fmt(q.r2)}) / 2.`,
        `The axis is x = ${fmt(axis)}. Move the beam until it stands there, then set it.`,
      ]
    }
    case 'vertex': {
      return [
        'The vertex is the highest point of this ridge. It sits on the axis of symmetry.',
        `You already hold x = ${fmt(axis)}. Substitute it into the equation to find the height y.`,
        `The vertex is (${fmt(axis)}, ${fmt(v.y)}). Enter it, then hold your focus on the peak until the sight locks.`,
      ]
    }
    case 'strike':
      return [
        'Stand in the marked circle, face the ridge, and hold the strike to full charge.',
        'The cut travels the axis of symmetry and breaks at the vertex. Everything you solved shapes the path.',
        'Hold the strike key. When the charge rings close, release.',
      ]
    case 'discriminant':
      return [
        'The discriminant is b squared minus 4ac. Its sign tells how many times a curve crosses.',
        'Positive: two crossings. Zero: one touch. Negative: it never reaches.',
        'Compute b*b - 4*a*c for this arc and read its sign.',
      ]
  }
}
