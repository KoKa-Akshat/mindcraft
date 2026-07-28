import { describe, expect, it } from 'vitest'
import { evaluatePolynomial, parsePolynomial, PolyParseError } from './polynomialExpression'

describe('parsePolynomial — bare-caret grammar', () => {
  it('parses a quadratic', () => {
    const p = parsePolynomial('x^2+5x+6')
    expect(p.terms).toEqual([
      { coefficient: 1, power: 2 },
      { coefficient: 5, power: 1 },
      { coefficient: 6, power: 0 },
    ])
  })

  it('parses negative coefficients and a bare x', () => {
    const p = parsePolynomial('-3x^2 - 4x + x - 1')
    expect(evaluatePolynomial(p, 1)).toBeCloseTo(-3 - 4 + 1 - 1)
  })

  it('evaluates correctly', () => {
    const p = parsePolynomial('2x^3-4x+1')
    expect(evaluatePolynomial(p, 2)).toBe(2 * 8 - 8 + 1)
  })
})

describe('parsePolynomial — LaTeX subset', () => {
  it('reads braced exponents', () => {
    const p = parsePolynomial('x^{2}+5x+6')
    expect(p.terms).toEqual([
      { coefficient: 1, power: 2 },
      { coefficient: 5, power: 1 },
      { coefficient: 6, power: 0 },
    ])
  })

  it('reads a numeric fraction coefficient', () => {
    const p = parsePolynomial('\\frac{1}{2}x-3')
    expect(p.terms).toEqual([
      { coefficient: 0.5, power: 1 },
      { coefficient: -3, power: 0 },
    ])
  })

  it('strips math-mode delimiters and spacing commands', () => {
    const p = parsePolynomial('\\(x^{2}\\,+\\;5x-6\\)')
    expect(evaluatePolynomial(p, 0)).toBe(-6)
  })

  it('rejects a variable inside a fraction with a clear message', () => {
    expect(() => parsePolynomial('\\frac{x}{2}+1')).toThrow(PolyParseError)
    try {
      parsePolynomial('\\frac{x}{2}+1')
    } catch (e) {
      expect((e as PolyParseError).kind).toBe('unsupportedFraction')
    }
  })

  it('rejects general unsupported LaTeX with a clear message', () => {
    expect(() => parsePolynomial('\\int x dx')).toThrow(PolyParseError)
    try {
      parsePolynomial('\\int x dx')
    } catch (e) {
      expect((e as PolyParseError).kind).toBe('unsupportedLaTeX')
    }
  })
})

describe('parsePolynomial — errors', () => {
  it('rejects empty input', () => {
    expect(() => parsePolynomial('')).toThrow(PolyParseError)
  })

  it('rejects an invalid term', () => {
    expect(() => parsePolynomial('2x^')).toThrow(PolyParseError)
  })
})
