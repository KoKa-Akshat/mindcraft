/**
 * quadratics.test.ts
 *
 * Mathematics proof for the Manjushree zone. Validates every authored
 * quadratic (coefficients, roots, axis, vertex, discriminant), the answer
 * parsers, every misconception classification, the hint ladders, and the
 * graph-to-terrain visual binding.
 */

import { describe, it, expect } from 'vitest'
import {
  standardForm, axisOf, vertexOf, evaluate, discriminantOf,
  discriminantOfStandard, intersectionClass, equationText, fmt,
  parseRoots, parseLine, parsePoint,
  checkRoots, checkAxis, checkVertex, checkDiscriminant,
  hintsFor, MIS, MIS_LABELS, MATCH_TOL, axisCandidates, vertexHeightCandidates,
  rootPairCandidates,
} from './quadratics'
import {
  QUADRATIC_BANK, TRAJECTORY_BANK, CONCEPT_ID, ENCOUNTER_INGREDIENTS,
  pickQuadratic, quadraticById,
} from './content'
import {
  graphXToPercent, percentToGraphX, graphYToPercent, visualPeakY,
  snapGraphX, graphRange, curvePoints, BASELINE_Y_PCT, PEAK_Y_PCT,
  RIDGE_X0_PCT, RIDGE_X1_PCT,
} from './mapping'

const LEGEND = quadraticById('mjz_q01')!

// ── Bank integrity ─────────────────────────────────────────────────────────

describe('quadratic bank integrity', () => {
  it('has at least 12 core quadratics across exactly 3 levels', () => {
    expect(QUADRATIC_BANK.length).toBeGreaterThanOrEqual(12)
    const byLevel = new Map<number, number>()
    for (const q of QUADRATIC_BANK) byLevel.set(q.level, (byLevel.get(q.level) ?? 0) + 1)
    expect([...byLevel.keys()].sort()).toEqual([1, 2, 3])
    for (const [, count] of byLevel) expect(count).toBeGreaterThanOrEqual(4)
  })

  it('has unique ids', () => {
    const ids = QUADRATIC_BANK.map(q => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every quadratic opens downward with ordered integer roots (no irrational or complex roots)', () => {
    for (const q of QUADRATIC_BANK) {
      expect(q.a).toBeLessThan(0)
      expect(q.r1).toBeLessThan(q.r2)
      expect(Number.isInteger(q.r1)).toBe(true)
      expect(Number.isInteger(q.r2)).toBe(true)
    }
  })

  it('authored expected values match computed values exactly', () => {
    for (const q of QUADRATIC_BANK) {
      const sf = standardForm(q)
      expect(sf.a, q.id).toBeCloseTo(q.a, 10)
      expect(sf.b, q.id).toBeCloseTo(q.expected.b, 10)
      expect(sf.c, q.id).toBeCloseTo(q.expected.c, 10)
      expect(axisOf(q), q.id).toBeCloseTo(q.expected.axis, 10)
      const v = vertexOf(q)
      expect(v.x, q.id).toBeCloseTo(q.expected.vertex.x, 10)
      expect(v.y, q.id).toBeCloseTo(q.expected.vertex.y, 10)
      expect(discriminantOf(q), q.id).toBeCloseTo(q.expected.discriminant, 10)
    }
  })

  it('roots really are zeros and the vertex really is the maximum', () => {
    for (const q of QUADRATIC_BANK) {
      expect(evaluate(q, q.r1), q.id).toBeCloseTo(0, 10)
      expect(evaluate(q, q.r2), q.id).toBeCloseTo(0, 10)
      const v = vertexOf(q)
      expect(evaluate(q, v.x - 0.25), q.id).toBeLessThan(v.y)
      expect(evaluate(q, v.x + 0.25), q.id).toBeLessThan(v.y)
    }
  })

  it('every vertex height stays in the visually calibrated band', () => {
    for (const q of QUADRATIC_BANK) {
      expect(q.expected.vertex.y).toBeGreaterThanOrEqual(3)
      expect(q.expected.vertex.y).toBeLessThanOrEqual(12)
    }
  })

  it('the canonical legend quadratic matches the design brief exactly', () => {
    expect(LEGEND.a).toBe(-0.5)
    expect(LEGEND.r1).toBe(1)
    expect(LEGEND.r2).toBe(9)
    expect(axisOf(LEGEND)).toBe(5)
    expect(vertexOf(LEGEND)).toEqual({ x: 5, y: 8 })
  })

  it('level 1 shows factored form, levels 2 and 3 show standard form', () => {
    for (const q of QUADRATIC_BANK) {
      expect(q.displayForm).toBe(q.level === 1 ? 'factored' : 'standard')
    }
  })

  it('equation text renders both forms correctly', () => {
    expect(equationText(LEGEND)).toBe('y = -0.5(x - 1)(x - 9)')
    expect(equationText(quadraticById('mjz_q05')!)).toBe('y = -x^2 + 6x - 5')
    expect(equationText(quadraticById('mjz_q06')!)).toBe('y = -x^2 + 2x + 8')
    expect(equationText(quadraticById('mjz_q10')!)).toBe('y = -0.5x^2 + 3x + 3.5')
    expect(equationText(quadraticById('mjz_q03')!)).toBe('y = -0.5(x + 2)(x - 6)')
    expect(equationText(quadraticById('mjz_q04')!)).toBe('y = -0.5x(x - 8)')
  })

  it('trajectory bank discriminants and classes are correct', () => {
    for (const t of TRAJECTORY_BANK) {
      const disc = discriminantOfStandard(t.a, t.b, t.c)
      expect(disc, t.id).toBeCloseTo(t.expected.discriminant, 10)
      expect(intersectionClass(disc), t.id).toBe(t.expected.intersections)
    }
    const classes = TRAJECTORY_BANK.map(t => t.expected.intersections).sort()
    expect(classes).toEqual(['none', 'one', 'two'])
  })

  it('pickQuadratic honors level and exclusion', () => {
    for (let i = 0; i < 20; i++) {
      const q = pickQuadratic(2, 'mjz_q05')
      expect(q.level).toBe(2)
      expect(q.id).not.toBe('mjz_q05')
    }
  })

  it('maps to real ontology ids', () => {
    expect(CONCEPT_ID).toBe('quadratic_equations')
    const allowed = new Set([
      'quadratics__solutions_as_x_intercepts',
      'quadratics__vertex_from_roots',
      'quadratics__factoring_method',
      'quadratics__quadratic_formula',
      'quadratics__discriminant_meaning',
    ])
    for (const ids of Object.values(ENCOUNTER_INGREDIENTS)) {
      for (const id of ids) expect(allowed.has(id), id).toBe(true)
    }
  })
})

// ── Parsers ────────────────────────────────────────────────────────────────

describe('answer parsing', () => {
  it('parses root answers in every accepted format', () => {
    expect(parseRoots('1 and 9').values).toEqual([1, 9])
    expect(parseRoots('x = 1, x = 9').values).toEqual([1, 9])
    expect(parseRoots('1,9').values).toEqual([1, 9])
    expect(parseRoots('9 1').values).toEqual([9, 1])
    expect(parseRoots('-2, 6').values).toEqual([-2, 6])
    expect(parseRoots('x=-2 and x=6').values).toEqual([-2, 6])
    expect(parseRoots('y = 4.5').usedYEquals).toBe(true)
    expect(parseRoots('').valid).toBe(false)
  })

  it('parses line answers in every accepted format', () => {
    expect(parseLine('x = 5')).toEqual({ kind: 'x', value: 5 })
    expect(parseLine('X=5')).toEqual({ kind: 'x', value: 5 })
    expect(parseLine('5')).toEqual({ kind: 'number', value: 5 })
    expect(parseLine('y = 5')).toEqual({ kind: 'y', value: 5 })
    expect(parseLine('(5, 8)')).toEqual({ kind: 'point', point: { x: 5, y: 8 } })
    expect(parseLine('5, 8')).toEqual({ kind: 'point', point: { x: 5, y: 8 } })
    expect(parseLine('x = 3.5')).toEqual({ kind: 'x', value: 3.5 })
    expect(parseLine('nonsense').kind).toBe('invalid')
  })

  it('parses vertex answers in every accepted format', () => {
    expect(parsePoint('(5, 8)')).toEqual({ kind: 'point', point: { x: 5, y: 8 } })
    expect(parsePoint('5, 8')).toEqual({ kind: 'point', point: { x: 5, y: 8 } })
    expect(parsePoint('5;8')).toEqual({ kind: 'point', point: { x: 5, y: 8 } })
    expect(parsePoint('x = 5')).toEqual({ kind: 'x', value: 5 })
    expect(parsePoint('8')).toEqual({ kind: 'number', value: 8 })
    expect(parsePoint('(3.5, 6.25)')).toEqual({ kind: 'point', point: { x: 3.5, y: 6.25 } })
  })

  it('formats numbers cleanly', () => {
    expect(fmt(5)).toBe('5')
    expect(fmt(-0.5)).toBe('-0.5')
    expect(fmt(6.25)).toBe('6.25')
  })
})

// ── Root Strike (Encounter 2) ──────────────────────────────────────────────

describe('checkRoots', () => {
  it('accepts both roots in either order, typed or placed', () => {
    expect(checkRoots(LEGEND, [1, 9]).correct).toBe(true)
    expect(checkRoots(LEGEND, [9, 1]).correct).toBe(true)
  })

  it('accepts placement within the snap tolerance and rejects beyond it', () => {
    expect(checkRoots(LEGEND, [1 + MATCH_TOL * 0.9, 9]).correct).toBe(true)
    expect(checkRoots(LEGEND, [1.5, 9]).correct).toBe(false)
  })

  it('classifies sign-flipped roots', () => {
    const res = checkRoots(LEGEND, [-1, -9])
    expect(res.correct).toBe(false)
    expect(res.misconceptionId).toBe(MIS.signFlippedRoots)
  })

  it('classifies the y-intercept confusion (marker at x = 0 with the c value)', () => {
    const q = quadraticById('mjz_q06')! // c = 8, roots -2 and 4
    const res = checkRoots(q, [0, 8])
    expect(res.misconceptionId).toBe(MIS.yInterceptForRoot)
  })

  it('classifies wrong-scale placements (doubled and halved)', () => {
    expect(checkRoots(LEGEND, [2, 18]).misconceptionId).toBe(MIS.wrongScale)
    expect(checkRoots(LEGEND, [0.5, 4.5]).misconceptionId).toBe(MIS.wrongScale)
  })

  it('classifies coefficients read as roots on standard-form questions', () => {
    const q = quadraticById('mjz_q05')! // y = -x^2 + 6x - 5, roots 1 and 5
    expect(checkRoots(q, [6, -5]).misconceptionId).toBe(MIS.coefficientsAsRoots)
    expect(checkRoots(q, [-6, -5]).misconceptionId).toBe(MIS.coefficientsAsRoots)
  })

  it('classifies the vertex mistaken for a root', () => {
    const res = checkRoots(LEGEND, [1, 5])
    expect(res.misconceptionId).toBe(MIS.vertexAsRoot)
  })

  it('classifies one solved factor (second root missing or duplicated)', () => {
    expect(checkRoots(LEGEND, [1, 1]).misconceptionId).toBe(MIS.oneFactorOnly)
    expect(checkRoots(LEGEND, [9, 3]).misconceptionId).toBe(MIS.oneFactorOnly)
    expect(checkRoots(LEGEND, [1]).misconceptionId).toBe(MIS.oneFactorOnly)
  })

  it('returns plain incorrect for unrecognized wrong answers', () => {
    const res = checkRoots(LEGEND, [3, 7])
    expect(res.correct).toBe(false)
    expect(res.misconceptionId).toBeUndefined()
  })

  it('never flags a correct pair as a misconception on any bank entry', () => {
    for (const q of QUADRATIC_BANK) {
      const res = checkRoots(q, [q.r1, q.r2])
      expect(res.correct, q.id).toBe(true)
      expect(res.misconceptionId, q.id).toBeUndefined()
    }
  })
})

// ── The Line of Symmetry (Encounter 3) ─────────────────────────────────────

describe('checkAxis', () => {
  it('accepts the axis as "x = value" or a bare number on every bank entry', () => {
    for (const q of QUADRATIC_BANK) {
      expect(checkAxis(q, parseLine(`x = ${q.expected.axis}`)).correct, q.id).toBe(true)
      expect(checkAxis(q, parseLine(`${q.expected.axis}`)).correct, q.id).toBe(true)
    }
  })

  it('classifies "y = axis" as the horizontal-line trap', () => {
    expect(checkAxis(LEGEND, parseLine('y = 5')).misconceptionId).toBe(MIS.axisAsYEquals)
  })

  it('classifies the vertex point given instead of the line', () => {
    expect(checkAxis(LEGEND, parseLine('(5, 8)')).misconceptionId).toBe(MIS.vertexForAxis)
  })

  it('classifies the sign error from b/(2a) instead of -b/(2a)', () => {
    expect(checkAxis(LEGEND, parseLine('x = -5')).misconceptionId).toBe(MIS.axisSignError)
  })

  it('classifies half the root distance instead of the midpoint', () => {
    // Legend roots 1 and 9: half-width 4, midpoint 5.
    expect(checkAxis(LEGEND, parseLine('4')).misconceptionId).toBe(MIS.halfWidthForAxis)
  })

  it('classifies the maximum height mistaken for the axis', () => {
    expect(checkAxis(LEGEND, parseLine('8')).misconceptionId).toBe(MIS.maxForAxis)
  })
})

// ── Vertex Focus (Encounter 4) ─────────────────────────────────────────────

describe('checkVertex', () => {
  it('accepts the vertex as an ordered pair on every bank entry', () => {
    for (const q of QUADRATIC_BANK) {
      const { x, y } = q.expected.vertex
      expect(checkVertex(q, parsePoint(`(${x}, ${y})`)).correct, q.id).toBe(true)
      expect(checkVertex(q, parsePoint(`${x}, ${y}`)).correct, q.id).toBe(true)
    }
  })

  it('classifies only the axis given (x alone is not a point)', () => {
    expect(checkVertex(LEGEND, parsePoint('x = 5')).misconceptionId).toBe(MIS.axisForVertex)
    expect(checkVertex(LEGEND, parsePoint('5')).misconceptionId).toBe(MIS.axisForVertex)
  })

  it('classifies only the maximum height given', () => {
    expect(checkVertex(LEGEND, parsePoint('8')).misconceptionId).toBe(MIS.maxOnlyForVertex)
  })

  it('classifies swapped coordinates', () => {
    expect(checkVertex(LEGEND, parsePoint('(8, 5)')).misconceptionId).toBe(MIS.swappedVertex)
  })

  it('classifies the y-intercept used as the vertex height', () => {
    const q = quadraticById('mjz_q06')! // vertex (1, 9), c = 8
    expect(checkVertex(q, parsePoint('(1, 8)')).misconceptionId).toBe(MIS.yInterceptForVertex)
  })

  it('classifies a substitution slip (right axis, wrong height)', () => {
    expect(checkVertex(LEGEND, parsePoint('(5, 10)')).misconceptionId).toBe(MIS.substitutionError)
  })

  it('rejects a wrong point without inventing a misconception', () => {
    const res = checkVertex(LEGEND, parsePoint('(3, 4)'))
    expect(res.correct).toBe(false)
    expect(res.misconceptionId).toBeUndefined()
  })
})

describe('rootPairCandidates', () => {
  it('returns the correct pair plus one distinct trap for every bank entry', () => {
    for (const q of QUADRATIC_BANK) {
      const [a, b] = rootPairCandidates(q)
      const pairs = [a, b]
      const correct = pairs.find(p => p[0] === q.r1 && p[1] === q.r2)
        || pairs.find(p => p[0] === q.r2 && p[1] === q.r1)
      expect(correct, q.id).toBeTruthy()
      expect(a[0] !== b[0] || a[1] !== b[1], q.id).toBe(true)
    }
  })
})

// ── Axis rune-stone candidates (Encounter 3 pilot, 2026-07-21) ─────────────

describe('axisCandidates', () => {
  it('always includes the correct axis and returns 4 distinct values, for every bank entry', () => {
    for (const q of QUADRATIC_BANK) {
      const candidates = axisCandidates(q)
      expect(candidates, q.id).toContain(q.expected.axis)
      expect(new Set(candidates).size, q.id).toBe(candidates.length)
      expect(candidates.length, q.id).toBe(4)
    }
  })

  it('matches the owner-specified pilot quadratic y = -0.5x(x - 8): axis 4, with the vertex-height and sign-flip traps present', () => {
    const q = quadraticById('mjz_q04')!
    expect(q.a).toBe(-0.5)
    expect(q.r1).toBe(0)
    expect(q.r2).toBe(8)
    expect(axisOf(q)).toBe(4)
    const candidates = axisCandidates(q)
    expect(candidates).toContain(4)   // correct
    expect(candidates).toContain(8)   // vertex height mistaken for axis
    expect(candidates).toContain(-4)  // sign-flipped axis
  })

  it('never silently duplicates the correct answer under a different label', () => {
    for (const q of QUADRATIC_BANK) {
      const candidates = axisCandidates(q)
      const matches = candidates.filter(c => Math.abs(c - q.expected.axis) < 1e-9)
      expect(matches.length, q.id).toBe(1)
    }
  })
})

// ── Vertex-height rune-stone candidates (2D pivot, 2026-07-21) ─────────────
// The vertex encounter now runs as two sequential rune-stone picks (axis via
// axisCandidates, then height via this function) instead of a single typed
// ordered pair, so both steps need their own validated candidate set.

describe('vertexHeightCandidates', () => {
  it('always includes the correct vertex height and returns 4 distinct values, for every bank entry', () => {
    for (const q of QUADRATIC_BANK) {
      const candidates = vertexHeightCandidates(q)
      expect(candidates, q.id).toContain(q.expected.vertex.y)
      expect(new Set(candidates).size, q.id).toBe(candidates.length)
      expect(candidates.length, q.id).toBe(4)
    }
  })

  it('includes the y-intercept trap for the pilot quadratic y = -0.5x(x - 8): vertex (4, 8), c = 0', () => {
    const q = quadraticById('mjz_q04')!
    const candidates = vertexHeightCandidates(q)
    expect(candidates).toContain(8) // correct height
    expect(candidates).toContain(0) // y-intercept (c) mistaken for the height
  })

  it('never silently duplicates the correct answer under a different label', () => {
    for (const q of QUADRATIC_BANK) {
      const candidates = vertexHeightCandidates(q)
      const matches = candidates.filter(c => Math.abs(c - q.expected.vertex.y) < 1e-9)
      expect(matches.length, q.id).toBe(1)
    }
  })
})

// ── Discriminant Sight (optional encounter) ────────────────────────────────

describe('checkDiscriminant', () => {
  it('accepts the true class and flags the trap otherwise', () => {
    for (const t of TRAJECTORY_BANK) {
      expect(checkDiscriminant(t, t.expected.intersections).correct).toBe(true)
      const wrong = t.expected.intersections === 'two' ? 'none' : 'two'
      const res = checkDiscriminant(t, wrong)
      expect(res.correct).toBe(false)
      expect(res.misconceptionId).toBe(MIS.discriminantSign)
    }
  })
})

// ── Hint ladders ───────────────────────────────────────────────────────────

describe('hint ladders', () => {
  it('provides exactly three escalating hints per math encounter, with the real numbers', () => {
    for (const q of QUADRATIC_BANK) {
      const roots = hintsFor(q, 'roots')
      expect(roots).toHaveLength(3)
      expect(roots[2]).toContain(`x = ${fmt(q.r1)}`)
      expect(roots[2]).toContain(`x = ${fmt(q.r2)}`)
      const axis = hintsFor(q, 'axis')
      expect(axis[1]).toContain(fmt(q.r1))
      expect(axis[1]).toContain(fmt(q.r2))
      expect(axis[2]).toContain(`x = ${fmt(q.expected.axis)}`)
      const vertex = hintsFor(q, 'vertex')
      expect(vertex[2]).toContain(`(${fmt(q.expected.vertex.x)}, ${fmt(q.expected.vertex.y)})`)
    }
  })

  it('scaffold hints for standard form give correct factoring targets', () => {
    const q = quadraticById('mjz_q05')! // -x^2+6x-5 = -(x^2-6x+5): multiply to 5, add to -6
    const h2 = hintsFor(q, 'roots')[1]
    expect(h2).toContain('multiply to 5')
    expect(h2).toContain('add to -6')
  })
})

// ── Misconception labels ───────────────────────────────────────────────────

describe('misconception labels', () => {
  it('every misconception id has an amber label and the family prefix', () => {
    for (const id of Object.values(MIS)) {
      expect(id.startsWith('mis_quadratic_equations__'), id).toBe(true)
      expect(MIS_LABELS[id], id).toBeTruthy()
    }
  })

  it('labels contain no em dashes and no exclamation marks', () => {
    for (const label of Object.values(MIS_LABELS)) {
      expect(label.includes('—')).toBe(false)
      expect(label.includes('!')).toBe(false)
    }
  })
})

// ── Visual binding: the overlay curve IS the same function as the answer key ──
// (2026-07-21 2D pivot: the ridge is now a fixed illustration, not procedural
// geometry derived from the quadratic -- see mapping.ts and LESSONS.md. The
// binding this suite now proves is narrower but just as real: the SVG curve
// the student sees is sampled from the exact same evaluate()/checkX functions
// that grade their answers, so the drawn curve can never silently disagree
// with what a "correct" answer means.)

describe('graph-to-overlay binding', () => {
  it('overlay percent x and graph x mappings are inverse', () => {
    for (const q of QUADRATIC_BANK) {
      for (const gx of [q.r1, q.expected.axis, q.r2, 0]) {
        expect(percentToGraphX(q, graphXToPercent(q, gx)), q.id).toBeCloseTo(gx, 10)
      }
    }
  })

  it('roots pin to the mountain feet so the silhouette spans both peaks', () => {
    for (const q of QUADRATIC_BANK) {
      expect(graphXToPercent(q, q.r1), q.id).toBeCloseTo(RIDGE_X0_PCT, 5)
      expect(graphXToPercent(q, q.r2), q.id).toBeCloseTo(RIDGE_X1_PCT, 5)
    }
  })

  it('the curve sample points equal the evaluated quadratic at every sampled x, clamped to y >= 0 past the roots', () => {
    for (const q of QUADRATIC_BANK) {
      const pts = curvePoints(q, 40)
      const { x0, x1 } = graphRange(q)
      const peakY = visualPeakY(q)
      for (let i = 0; i <= 40; i++) {
        const gx = x0 + ((x1 - x0) * i) / 40
        const expectedY = graphYToPercent(Math.max(0, evaluate(q, gx)), peakY)
        expect(pts[i].yPct, `${q.id} @ sample ${i}`).toBeCloseTo(expectedY, 10)
      }
    }
  })

  it('the curve never dips below the baseline percent, even past the roots', () => {
    for (const q of QUADRATIC_BANK) {
      const pts = curvePoints(q, 40)
      for (const p of pts) expect(p.yPct, q.id).toBeLessThanOrEqual(BASELINE_Y_PCT + 1e-6)
    }
  })

  it('waterline is graph y = 0 mapped to the baseline percent, and vertex maps above it', () => {
    expect(graphYToPercent(0)).toBe(BASELINE_Y_PCT)
    expect(graphYToPercent(9)).toBeCloseTo(PEAK_Y_PCT, 10)
    expect(graphYToPercent(9)).toBeLessThan(graphYToPercent(0))
  })

  it('placement snapping lands on half units within tolerance of typed answers', () => {
    expect(snapGraphX(1.24)).toBe(1)
    expect(snapGraphX(1.26)).toBe(1.5)
    expect(snapGraphX(-2.24)).toBe(-2)
  })

  it('the sight overlay range covers both roots with margin', () => {
    for (const q of QUADRATIC_BANK) {
      const { x0, x1 } = graphRange(q)
      expect(x0).toBeLessThan(q.r1)
      expect(x1).toBeGreaterThan(q.r2)
    }
  })
})
