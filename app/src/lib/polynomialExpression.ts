/**
 * Parses a simple polynomial in x, e.g. "x^2+5x+6" or "2x^3 - 4x + 1", and
 * evaluates it at any given x. Direct TypeScript port of the iPad prototype's
 * PolynomialExpression.swift (see ios-prototype/MindCraftNotes/MindCraftNotes/
 * Models/PolynomialExpression.swift + LaTeXMath.swift) — same grammar, same
 * LaTeX subset, same error messages, ported faithfully rather than re-derived.
 *
 * Supported grammar, one term per +/- separated chunk:
 *   term := [sign] [coefficient] ["x" ["^" exponent]]
 * Examples: "x^2", "5x", "-4x", "6", "-3x^2", "x"
 * Not supported: parentheses, other variables, non-polynomial functions.
 * That is a deliberate scope limit, not an oversight.
 *
 * LaTeX subset also accepted (additive, on top of the bare-caret grammar):
 *   - Braced exponents: "x^{2}" as well as the existing "x^2".
 *   - Numeric-over-numeric fractions: "\frac{1}{2}x" is read as the
 *     coefficient 0.5 times x. A variable in the numerator or denominator,
 *     e.g. "\frac{x}{2}", is real general fraction algebra and is explicitly
 *     NOT supported; it produces a clear parse error rather than a silent
 *     wrong answer.
 *   - Math-mode delimiters and sizing commands that carry no numeric
 *     meaning are stripped: "\(", "\)", "\[", "\]", "$", "$$",
 *     "\left(", "\right)" (and the other bracket/pipe/period variants),
 *     plus spacing commands "\,", "\;", "\!", "\quad", "\qquad".
 * Anything else backslash-prefixed (integrals, matrices, general nested
 * LaTeX expressions, etc.) is out of scope and raises a parse error.
 */

export interface PolyTerm {
  coefficient: number
  power: number
}

export interface PolynomialExpression {
  terms: PolyTerm[]
  originalText: string
}

export type PolyParseErrorKind = 'empty' | 'invalidTerm' | 'unsupportedFraction' | 'unsupportedLaTeX'

export class PolyParseError extends Error {
  kind: PolyParseErrorKind
  constructor(kind: PolyParseErrorKind, message: string) {
    super(message)
    this.kind = kind
    this.name = 'PolyParseError'
  }
}

function errEmpty(): PolyParseError {
  return new PolyParseError('empty', 'Type an expression in x, like x^2+5x+6 or x^{2}+5x+6.')
}
function errInvalidTerm(raw: string): PolyParseError {
  return new PolyParseError('invalidTerm', `Could not read the term "${raw}".`)
}
function errUnsupportedFraction(): PolyParseError {
  return new PolyParseError(
    'unsupportedFraction',
    'Only numeric fractions like \\frac{1}{2} are supported, not a variable in the fraction.',
  )
}
function errUnsupportedLaTeX(): PolyParseError {
  return new PolyParseError(
    'unsupportedLaTeX',
    "That LaTeX syntax isn't supported here, only polynomial-style expressions.",
  )
}

// ── LaTeXMath — shared low-level LaTeX text surgery (port of LaTeXMath.swift) ──

/** Removes math-mode wrappers and \left/\right sizing commands. A plain,
 * unsized parenthesis is left alone on purpose — this grammar still does
 * not support grouping parentheses, so a lone "(" left behind after this
 * pass is a deliberate signal that the input used something out of scope. */
function stripDelimiters(text: string): string {
  let result = text
  result = result.split('$$').join('')
  result = result.split('$').join('')
  result = result.split('\\(').join('')
  result = result.split('\\)').join('')
  result = result.split('\\[').join('')
  result = result.split('\\]').join('')
  for (const delimiter of ['(', ')', '[', ']', '|', '.']) {
    result = result.split(`\\left${delimiter}`).join('')
    result = result.split(`\\right${delimiter}`).join('')
  }
  return result
}

/** Drops LaTeX spacing commands that have no numeric meaning. */
function stripSpacingCommands(text: string): string {
  let result = text
  for (const command of ['\\,', '\\;', '\\!', '\\quad', '\\qquad']) {
    result = result.split(command).join('')
  }
  return result
}

/** Finds every \frac{a}{b} in `text` and asks `transform` what to do with
 * the raw (unparsed) numerator/denominator text. If `transform` returns a
 * string, that \frac{a}{b} is replaced with it; if it returns null, that
 * particular \frac{a}{b} is left exactly as written. Only single-level
 * braces are matched (no nested \frac inside \frac). */
function replaceFractions(text: string, transform: (numerator: string, denominator: string) => string | null): string {
  const regex = /\\frac\{([^{}]*)\}\{([^{}]*)\}/g
  return text.replace(regex, (match, numerator: string, denominator: string) => {
    const replacement = transform(numerator, denominator)
    return replacement ?? match
  })
}

// ── PolynomialExpression's own LaTeX normalization ──

function formatDecimal(value: number): string {
  if (value === Math.round(value)) return String(Math.trunc(value))
  return String(value)
}

/** "x^{2}" -> "x^2": the bare-caret grammar already reads an exponent as a
 * run of digits right after "^", so unwrapping the braces is all that is
 * needed. Single-level braces only, same as the Swift original. */
function replaceBracedExponents(text: string): string {
  return text.replace(/\^\{([^{}]*)\}/g, (_match, inner: string) => `^${inner}`)
}

/** Normalizes the polynomial-relevant LaTeX subset down to the existing
 * bare-caret grammar, so `parsePolynomial` has exactly one grammar to
 * actually read. */
export function normalizeLaTeX(raw: string): string {
  let text = stripDelimiters(raw)
  text = stripSpacingCommands(text)
  text = replaceBracedExponents(text)
  text = replaceFractions(text, (numerator, denominator) => {
    const num = Number(numerator)
    const den = Number(denominator)
    if (numerator.trim() === '' || denominator.trim() === '' || !isFinite(num) || !isFinite(den) || den === 0) {
      // A variable in the numerator/denominator: leave it as an unresolved
      // \frac so parsePolynomial below can detect it and raise
      // unsupportedFraction, instead of guessing at what it might mean.
      return null
    }
    return formatDecimal(num / den)
  })
  return text
}

/** Strict integer parse — Swift's `Int(String)` does not accept decimals or
 * scientific notation, only an optional sign followed by digits. */
function parseStrictInt(s: string): number | null {
  if (!/^[+-]?\d+$/.test(s)) return null
  return parseInt(s, 10)
}

/** Strict decimal parse — rejects empty strings (JS `Number('')` is 0,
 * unlike Swift's `Double("")` which is nil) and non-numeric junk. */
function parseStrictNumber(s: string): number | null {
  if (s.trim() === '') return null
  const value = Number(s)
  return isFinite(value) ? value : null
}

function parseTerm(raw: string): PolyTerm {
  let s = raw
  let sign = 1
  if (s.startsWith('-')) { sign = -1; s = s.slice(1) }
  else if (s.startsWith('+')) { s = s.slice(1) }

  const xIndex = s.split('').findIndex(ch => ch === 'x' || ch === 'X')
  if (xIndex === -1) {
    // Pure constant term, e.g. "6"
    const value = parseStrictNumber(s)
    if (value === null) throw errInvalidTerm(raw)
    return { coefficient: sign * value, power: 0 }
  }

  const coefficientPart = s.slice(0, xIndex)
  let coefficient: number
  if (coefficientPart === '') {
    coefficient = 1
  } else {
    const value = parseStrictNumber(coefficientPart)
    if (value === null) throw errInvalidTerm(raw)
    coefficient = value
  }

  const afterX = s.slice(xIndex + 1)
  if (afterX === '') {
    return { coefficient: sign * coefficient, power: 1 }
  }
  if (!afterX.startsWith('^')) throw errInvalidTerm(raw)
  const powerPart = afterX.slice(1)
  const power = parseStrictInt(powerPart)
  if (power === null) throw errInvalidTerm(raw)
  return { coefficient: sign * coefficient, power }
}

export function parsePolynomial(raw: string): PolynomialExpression {
  const latexNormalized = normalizeLaTeX(raw)
  const cleaned = latexNormalized
    .split(' ').join('')
    .split('−').join('-') // some keyboards emit a real minus sign
  if (cleaned === '') throw errEmpty()

  // Anything backslash-prefixed still here failed to normalize above: an
  // unresolved \frac (variable numerator/denominator) or other general
  // LaTeX this parser does not attempt. Fail clearly rather than feeding a
  // literal backslash into the bare-caret grammar below.
  if (cleaned.includes('\\frac')) throw errUnsupportedFraction()
  if (cleaned.includes('\\')) throw errUnsupportedLaTeX()

  // Split on + / - while keeping the sign attached to each term.
  const chunks: string[] = []
  let current = ''
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if ((ch === '+' || ch === '-') && i !== 0) {
      if (current !== '') chunks.push(current)
      current = ch
    } else {
      current += ch
    }
  }
  if (current !== '') chunks.push(current)

  const terms = chunks.map(parseTerm)
  return { terms, originalText: raw }
}

export function evaluatePolynomial(expr: PolynomialExpression, x: number): number {
  return expr.terms.reduce((partial, term) => partial + term.coefficient * Math.pow(x, term.power), 0)
}
