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

export type ShapeDimensionDiagram = {
  kind: 'shapedimension'
  shape: 'triangle' | 'rectangle' | 'parallelogram' | 'trapezium' | 'cuboid' | 'cube'
  base?: string
  height?: string
  slant?: string
  depth?: string
  width?: string
  edge?: string
  parallel1?: string
  parallel2?: string
}

export type TriangleAnglesDiagram = {
  kind: 'triangleangles'
  angles: string[]
}

export type FunctionMachineDiagram = {
  kind: 'functionmachine'
  input: string | null
  steps: string[]
}

export type AngleDiagram = {
  kind: 'anglediagram'
  variant: 'aroundpoint' | 'online' | 'crossing6' | 'xcrossing' | 'paralleltransversal'
  labels: string[]
}

export type VennDiagram = {
  kind: 'venn'
  labels: string[]
}

export type SequencePatternDiagram = {
  kind: 'sequencepattern'
  counts: number[]
}

export type BracketArrowsDiagram = {
  kind: 'bracketarrows'
  bracket1: string
  bracket2: string
  term1: string
  term2: string
}

export type DividedShapeDiagram = {
  kind: 'dividedshape'
  shape: 'bar' | 'circle'
  total: number
  shaded?: number
  groups?: { count: number; label: string }[]
}

export type SpinnerDiagram = {
  kind: 'spinner'
  spinners: { sides: number; labels: string[] }[]
}

export type RegularPolygonDiagram = {
  kind: 'regularpolygon'
  sides: number
  angleLabel?: string
}

export type ShapePairDiagram = {
  kind: 'shapepair'
  labelA: string
  labelB: string
  valueA: string
  valueB: string
}

export type AltDiagram =
  | DashLineDiagram
  | InequalityRayDiagram
  | ShapeDimensionDiagram
  | TriangleAnglesDiagram
  | FunctionMachineDiagram
  | AngleDiagram
  | VennDiagram
  | SequencePatternDiagram
  | BracketArrowsDiagram
  | DividedShapeDiagram
  | SpinnerDiagram
  | RegularPolygonDiagram
  | ShapePairDiagram

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

// A labeled value token: a real measurement ("12m", "6cm"), a bare number, a
// simple algebraic term ("2s", "x", "4x", "p"), or the literal word "star"
// (Eedi's convention for "this value is deliberately hidden, marked with a
// star icon" — mapped to the ★ glyph so the figure shows the same visual cue
// the original diagram used, not a fabricated number).
// Single-letter English words that would otherwise look like a variable name
// ("a star" reading "a" as the value instead of noticing "star" two words
// later) — excluded from the bare-letter alternative below.
const LETTER_STOPWORDS = new Set(['a', 'i'])

const VALUE_RE = /\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:cm|mm|m)\b|\d+(?:\.\d+)?|\b[a-zA-Z]\b(?:\s*[+-]\s*\d+)?/g

function grabValue(alt: string, keywordPattern: string): string | undefined {
  const windowRe = new RegExp(`${keywordPattern}([^.]{0,50})`, 'i')
  const wm = alt.match(windowRe)
  if (!wm) return undefined
  const window = wm[1]
  if (/\bstar\b/i.test(window)) return '★'
  VALUE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = VALUE_RE.exec(window)) !== null) {
    const token = m[0]
    if (/^[a-zA-Z]$/.test(token) && LETTER_STOPWORDS.has(token.toLowerCase())) continue
    return token.replace(/\s+/g, '')
  }
  return undefined
}

/** "Perpendicular height" specifically, skipping a "slant height" mention
 * that appears earlier in the same sentence (real case: "slant height, 13cm
 * and perpendicular height 8cm" — a keyword-only search for "height" grabs
 * the slant value first since it appears first in the string). */
function grabHeight(alt: string): string | undefined {
  return grabValue(alt, 'perpendicular\\s+height') ?? grabValue(alt, '(?<!slant\\s)(?<!slanted\\s)height')
}

/** 2D shapes labeled with real measurements: "A triangle with base length
 * 12m...", "A cuboid, depth 2cm and height 3cm. The width is labelled with a
 * star.", "Trapezium with parallel sides of lengths 90mm and 40mm... the
 * perpendicular height is 5cm." (all real eedi alt-text, area_volume /
 * triangles_congruence). Requires at least one real dimension before
 * matching — a bare shape name with no measurement isn't this pattern. */
function parseShapeDimension(alt: string): ShapeDimensionDiagram | TriangleAnglesDiagram | null {
  let shape: ShapeDimensionDiagram['shape'] | null = null
  for (const [pattern, name] of [
    ['cuboid', 'cuboid'], ['cube', 'cube'], ['trapezium', 'trapezium'],
    ['parallelogram', 'parallelogram'], ['rectangle', 'rectangle'], ['triangle', 'triangle'],
  ] as const) {
    if (new RegExp(pattern, 'i').test(alt)) { shape = name; break }
  }
  if (!shape) return null

  if (shape === 'cube') {
    const edge = grabValue(alt, '(?:edge|side)')
    return edge ? { kind: 'shapedimension', shape, edge } : null
  }

  if (shape === 'cuboid') {
    const depth = grabValue(alt, 'depth')
    const height = grabValue(alt, 'height')
    const width = grabValue(alt, 'width')
    if ([depth, height, width].filter(Boolean).length >= 2) {
      return { kind: 'shapedimension', shape, depth, height, width }
    }
    const noSpace = (v: string) => v.replace(/\s+/g, '')
    // "dimensions 6cm by 3cm by 4cm" / "dimensions 60mm, 7cm and 5cm" — any
    // mix of "by"/","/"and" separators between all 3 values.
    const dims = alt.match(/dimensions?[^\d]{0,10}([\d.]+\s*(?:cm|mm|m))(?:,|\s+by|\s+and)\s*([\d.]+\s*(?:cm|mm|m))(?:,|\s+by|\s+and)\s*([\d.]+\s*(?:cm|mm|m))/i)
    if (dims) return { kind: 'shapedimension', shape, depth: noSpace(dims[1]), height: noSpace(dims[2]), width: noSpace(dims[3]) }
    // "The top measures 4cm by 2cm, and the height is 7cm." — no explicit
    // "dimensions" word, just a 2D top face plus a separate stated height.
    const topM = alt.match(/top measures\s*([\d.]+\s*(?:cm|mm|m))\s*by\s*([\d.]+\s*(?:cm|mm|m)).*?height is\s*([\d.]+\s*(?:cm|mm|m))/i)
    if (topM) return { kind: 'shapedimension', shape, width: noSpace(topM[1]), depth: noSpace(topM[2]), height: noSpace(topM[3]) }
    return null
  }

  if (shape === 'trapezium') {
    const parallels = alt.match(/parallel sides?[^.]{0,60}?([\d.]+\s*(?:cm|mm|m)?|[a-zA-Z])\s*and\s*([\d.]+\s*(?:cm|mm|m)?|[a-zA-Z])/i)
    if (!parallels) return null
    const height = grabHeight(alt)
    return { kind: 'shapedimension', shape, parallel1: parallels[1], parallel2: parallels[2], height }
  }

  // triangle / rectangle / parallelogram
  const base = grabValue(alt, '(?:base|length)(?:\\s+length)?')
  const height = grabHeight(alt)
  const slant = grabValue(alt, 'slant(?:ed)?\\s*(?:height|length)?')
  if (base || height) return { kind: 'shapedimension', shape, base, height, slant }

  // No side measurements — check for an angle-only triangle instead
  // ("A triangle with one angle of 40 degrees... third angle is labelled k.")
  if (shape === 'triangle') {
    const angleRe = /(\d+(?:\.\d+)?|\b[a-zA-Z]\b)\s*degrees?|labell?ed\s+([a-zA-Z])\b/gi
    const angles: string[] = []
    let m: RegExpExecArray | null
    while ((m = angleRe.exec(alt)) !== null) angles.push(m[1] ?? m[2])
    if (angles.length >= 2) return { kind: 'triangleangles', angles }
  }
  return null
}

/** "A function machine showing an input of n and operations divide by 5 and
 * add 3", "A function machine with input n and operations subtract 4,
 * multiply by 3" (real eedi alt-text, algebraic_manipulation). Requires the
 * literal phrase "function machine" plus at least an input or one operation —
 * blank-box variants ("input box blank... output box blank") fall through
 * since there is nothing real to render. */
function parseFunctionMachine(alt: string): FunctionMachineDiagram | null {
  if (!/function machine/i.test(alt)) return null
  const input = grabValue(alt, 'input(?:\\s+of)?') ?? null
  const steps: string[] = []
  const opRe = /(add|subtract|multiply by|divide by)\s+([\d.a-zA-Z]+)/gi
  let m: RegExpExecArray | null
  while ((m = opRe.exec(alt)) !== null) steps.push(`${m[1]} ${m[2]}`)
  if (!input && !steps.length) return null
  return { kind: 'functionmachine', input, steps }
}

/** "(x+5)(x-3). The arrows are pointing at the +5 in the first bracket and
 * the -3 in the second bracket." (real eedi alt-text, algebraic_manipulation
 * FOIL/expansion questions). */
function parseBracketArrows(alt: string): BracketArrowsDiagram | null {
  const m = alt.match(
    /brackets?\s*(?:are|shown are)?\s*\(([^)]+)\)\(([^)]+)\)[\s\S]*?arrows?\s+are\s+pointing\s+at\s+(?:the\s+)?(.+?)\s+in\s+the\s+first\s+bracket\s+and\s+(?:the\s+)?(.+?)\s+in\s+the\s+second\s+bracket/i,
  )
  if (!m) return null
  return { kind: 'bracketarrows', bracket1: m[1].trim(), bracket2: m[2].trim(), term1: m[3].trim(), term2: m[4].trim() }
}

/** Angle families keyed off distinctive phrasing that appears verbatim across
 * the bank: "Angles around a point... labelled 310 degrees and the other x."
 * (aroundpoint), "Three angles which meet to form a straight line..."
 * (online), "3 lines crossing at a point to form 6 angles..." (crossing6),
 * "crossing to form an X shape..." (xcrossing), "pair of parallel lines...
 * diagonally crosses..." (paralleltransversal). Requires the real labeled
 * values for aroundpoint/online — the other three variants are structural
 * (the diagram shape itself, not specific numbers) so they render generically. */
function parseAngleDiagram(alt: string): AngleDiagram | null {
  const low = alt.toLowerCase()
  const labelRe = /(\d+(?:\.\d+)?\s*degrees?|[a-zA-Z](?:\s*[+-]\s*\d+)?)(?=\s*(?:,|and|on|\.|$))/g

  if (low.includes('around a point')) {
    const labels = [...alt.matchAll(labelRe)].map(m => m[1])
    if (labels.length) return { kind: 'anglediagram', variant: 'aroundpoint', labels }
  }
  if (low.includes('straight line') && low.includes('angle')) {
    const labels = [...alt.matchAll(labelRe)].map(m => m[1])
    if (labels.length) return { kind: 'anglediagram', variant: 'online', labels }
  }
  if (/lines crossing at a point/.test(low)) {
    return { kind: 'anglediagram', variant: 'crossing6', labels: [] }
  }
  if (/crossing to form an x shape/.test(low)) {
    return { kind: 'anglediagram', variant: 'xcrossing', labels: [] }
  }
  if (low.includes('parallel') && (low.includes('transversal') || low.includes('diagonally crosses') || low.includes('crossing') || low.includes('crosses both'))) {
    return { kind: 'anglediagram', variant: 'paralleltransversal', labels: [] }
  }
  return null
}

/** Two-circle Venn diagrams: "A Venn diagram with two sets, one labelled
 * Square number and one labelled Odd number..." / "...two overlapping
 * circles. One is labelled 'Factorises' and the other is labelled 'Has one
 * solution equal to 0'." (real eedi alt-text, basic_probability /
 * triangles_congruence). Only the two set names are extracted — per-region
 * item labels vary too much in phrasing to extract reliably, so the figure
 * renders the two circles and their names, not the interior contents. */
function parseVenn(alt: string): VennDiagram | null {
  if (!/venn/i.test(alt)) return null
  const labels = [...alt.matchAll(/labell?ed\s+(?:with\s+)?['"]?([A-Za-z0-9 ]+?)['"]?(?=\s+and|[.,]|$)/gi)].map(m => m[1].trim())
  if (labels.length >= 2) return { kind: 'venn', labels: labels.slice(0, 2) }
  return null
}

/** Growing shape-count sequences: "Pattern 1 contains 3 squares... Pattern 2
 * contains 5 squares... Pattern 3 contains 7 squares." (real eedi alt-text,
 * sequences_series). Only the simple "N shapes per step" family is covered —
 * composite arrangements (shapes-plus-surrounding-shapes) aren't parsed since
 * the exact visual arrangement can't be reconstructed from the count alone. */
function parseSequencePattern(alt: string): SequencePatternDiagram | null {
  if (!/pattern|sequence/i.test(alt)) return null
  const counts = [...alt.matchAll(/(\d+)\s*(?:squares|circles|dots)/gi)].map(m => parseInt(m[1], 10))
  if (counts.length >= 2) return { kind: 'sequencepattern', counts }
  return null
}

/** Bar/rectangle split into equal parts with some shaded ("A rectangle split
 * into 10 equal parts with 3 parts shaded in yellow"), or a circle divided
 * into equal sections with labeled count-groups ("Circle divided into 5
 * equal sections. 2 sections labelled with a blue number 1. 3 sections
 * labelled with a red number 2."). Real eedi alt-text, area_volume /
 * fractions_decimals / basic_probability. Requires the exact "shaded" count
 * (bar) or 2+ labeled groups (circle) — a bare "divided into N sections"
 * with neither (e.g. a curly-bracket sum diagram) falls through. */
function parseDividedShape(alt: string): DividedShapeDiagram | null {
  const totalM = alt.match(/(rectangle|bar|circle)[^.]*?(?:split|divided) into (\d+) equal (?:parts|pieces|sections)/i)
  if (!totalM) return null
  const shape: DividedShapeDiagram['shape'] = totalM[1].toLowerCase() === 'circle' ? 'circle' : 'bar'
  const total = parseInt(totalM[2], 10)
  if (!Number.isFinite(total) || total < 2 || total > 100) return null

  if (shape === 'circle') {
    const groupRe = /(\d+)\s+(?:of the sections|sections)\s+(?:are\s+)?labell?ed with a\s+\w+\s+number\s+(\w+)/gi
    const groups = [...alt.matchAll(groupRe)].map(m => ({ count: parseInt(m[1], 10), label: m[2] }))
    if (groups.length >= 2) return { kind: 'dividedshape', shape, total, groups }
    return null
  }

  const shadedM = alt.match(/(\d+)(?:\s+of (?:the|these)(?: parts)?)?(?:\s+parts?|\s+pieces)?\s+(?:are\s+)?shaded/i)
  if (!shadedM) return null
  const shaded = parseInt(shadedM[1], 10)
  if (!Number.isFinite(shaded) || shaded > total) return null
  return { kind: 'dividedshape', shape, total, shaded }
}

const SPINNER_SIDE_WORDS: Record<string, number> = {
  three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  triangular: 3, square: 4, pentagonal: 5, hexagonal: 6, heptagonal: 7, octagonal: 8,
}

/** One or more spinners, each an N-sided wheel with real labeled sections:
 * "A four sided spinner labelled with 1, 2, 3 and 4", "A hexagonal shaped
 * spinner with 6 equal sections labelled 1, 3, 3, 5, 5 and 5." (real eedi
 * alt-text, basic_probability). Handles the "two spinners" case by matching
 * every spinner mention in the text, not just the first. */
function parseSpinner(alt: string): SpinnerDiagram | null {
  if (!/spinner/i.test(alt)) return null
  const spinnerRe = /(\w+)[\s-]*(?:sided|shaped)\s+spinner[^.]*?labell?ed\s+(?:with\s+)?([\d,\sand]+?)(?:\.|$)/gi
  const spinners: { sides: number; labels: string[] }[] = []
  let m: RegExpExecArray | null
  while ((m = spinnerRe.exec(alt)) !== null) {
    const sideWord = m[1].toLowerCase()
    const sides = SPINNER_SIDE_WORDS[sideWord] ?? (/^\d+$/.test(sideWord) ? parseInt(sideWord, 10) : NaN)
    const labels = m[2].split(/,|\band\b/).map(s => s.trim()).filter(Boolean)
    if (Number.isFinite(sides) && sides >= 3 && labels.length >= 3) spinners.push({ sides, labels })
  }
  return spinners.length ? { kind: 'spinner', spinners } : null
}

const POLYGON_NAME_SIDES: Record<string, number> = {
  triangle: 3, square: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10,
}

/** A regular polygon with an explicitly stated side count and (usually) one
 * labeled interior angle: "A regular octagon (8 sided polygon). Each side is
 * marked with a single dash to show that all sides are equal in length. One
 * of the interior angles of the octagon is labelled with the letter 'x'."
 * (real eedi alt-text, triangles_congruence). Only fires for a REGULAR
 * polygon with a stated side count — "an irregular pentagon" with no
 * measurements has nothing accurate to draw and correctly falls through.
 * Also excludes a polygon "joined" to another shape ("a regular pentagon
 * with a square joined along one edge") — that's a compound shape, and a
 * bare polygon outline would misrepresent it by omitting the square entirely. */
function parseRegularPolygon(alt: string): RegularPolygonDiagram | null {
  if (!/\bregular\b/i.test(alt)) return null
  if (/joined/i.test(alt)) return null
  const sidesM = alt.match(/\((\d+)\s*sided/i)
  const nameM = alt.match(/regular\s+(triangle|square|pentagon|hexagon|heptagon|octagon|nonagon|decagon)/i)
  const sides = sidesM ? parseInt(sidesM[1], 10) : (nameM ? POLYGON_NAME_SIDES[nameM[1].toLowerCase()] : undefined)
  if (!sides) return null
  const angleM = alt.match(/labell?ed with the letter\s+['"]?(\w+)['"]?/i) ?? alt.match(/interior angles?[^.]*?labell?ed\s+(?:with\s+)?(?:the\s+letter\s+)?['"]?(\w+)['"]?/i)
  return { kind: 'regularpolygon', sides, angleLabel: angleM ? angleM[1] : undefined }
}

/** Two labeled shapes (similar/congruent), each with one real stated
 * measurement: "To similar star shapes labelled P and Q. They have the same
 * side labelled for P it is 3cm and for Q it is 11cm" (real eedi alt-text,
 * triangles_congruence). Deliberately narrow — the spelled-out-number grid
 * variant ("Triangle A is two squares across one square up...") is NOT
 * parsed here since reading English number words accurately is a real
 * failure risk this module avoids per its no-guessing rule. */
function parseShapePair(alt: string): ShapePairDiagram | null {
  const labelsM = alt.match(/labell?ed\s+([A-Z])\s+and\s+([A-Z])\b/)
  if (!labelsM) return null
  const [, labelA, labelB] = labelsM
  const valueA = grabValue(alt, `for\\s+${labelA}\\s+(?:it\\s+)?is`)
  const valueB = grabValue(alt, `for\\s+${labelB}\\s+(?:it\\s+)?is`)
  if (!valueA || !valueB) return null
  return { kind: 'shapepair', labelA, labelB, valueA, valueB }
}

export function parseAltDiagram(alt: string): AltDiagram | null {
  return (
    parseDashLine(alt) ??
    parseInequalityRay(alt) ??
    parseBracketArrows(alt) ??
    parseFunctionMachine(alt) ??
    parseVenn(alt) ??
    parseAngleDiagram(alt) ??
    parseSequencePattern(alt) ??
    parseSpinner(alt) ??
    parseDividedShape(alt) ??
    parseRegularPolygon(alt) ??
    parseShapePair(alt) ??
    parseShapeDimension(alt)
  )
}

export type DiagramTextSegment = { kind: 'text'; content: string } | { kind: 'diagram'; alt: string }

/**
 * Splits `text` on `(Diagram: ...)` callouts using a balanced-parenthesis
 * scan, not a regex. Fixes a real bug: the alt text these callouts wrap often
 * contains its OWN parenthesized content — coordinate pairs like "(4,10)" are
 * the most common case (see e.g. eedi_203, linear_equations: "(Diagram: Axes
 * with not scales drawn on. Two points are marked, (4,10) and (9,2))"). A
 * naive `\(Diagram:[^)]*\)` regex stops at the FIRST `)` it meets — here,
 * the one closing "(4,10)" — truncating the callout mid-sentence and leaving
 * the remainder (" and (9,2))") to fall through as plain question text, at
 * full stem size, right after the truncated caption. That is the exact
 * "caption bending into the question" bug. This scan tracks paren depth so
 * it always finds the callout's REAL closing paren, however many nested
 * pairs it contains.
 */
export function splitAltDiagramSegments(text: string): DiagramTextSegment[] {
  const marker = '(Diagram:'
  const segments: DiagramTextSegment[] = []
  let i = 0
  while (i < text.length) {
    const idx = text.indexOf(marker, i)
    if (idx === -1) {
      segments.push({ kind: 'text', content: text.slice(i) })
      break
    }
    if (idx > i) segments.push({ kind: 'text', content: text.slice(i, idx) })

    let depth = 0
    let end = -1
    for (let j = idx; j < text.length; j++) {
      if (text[j] === '(') depth++
      else if (text[j] === ')') {
        depth--
        if (depth === 0) { end = j; break }
      }
    }
    if (end === -1) {
      // Unbalanced (shouldn't happen in real data) — bail out rather than
      // risk an infinite loop; treat the rest as plain text.
      segments.push({ kind: 'text', content: text.slice(idx) })
      break
    }
    const alt = text.slice(idx + marker.length, end).trim()
    segments.push({ kind: 'diagram', alt })
    i = end + 1
  }
  return segments.length > 0 ? segments : [{ kind: 'text', content: text }]
}

/** Fallback for alt text we can't confidently turn into a diagram: light
 * cleanup only (whitespace, trailing punctuation) — never invent content. */
export function humanizeAltCaption(alt: string): string {
  const cleaned = alt.replace(/\s+/g, ' ').trim()
  if (!cleaned) return cleaned
  const withPeriod = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
  return withPeriod.charAt(0).toUpperCase() + withPeriod.slice(1)
}
