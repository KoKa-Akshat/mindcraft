/**
 * splitAltDiagramSegments — regression coverage for the caption-bleed bug
 * (eedi_203, linear_equations): the alt text a `(Diagram: ...)` callout
 * wraps can contain its own nested parens (coordinate pairs), and a naive
 * regex split truncates the callout at the first inner `)`.
 */
import { describe, expect, it } from 'vitest'
import { splitAltDiagramSegments, parseAltDiagram } from './altDiagram'

describe('splitAltDiagramSegments', () => {
  it('keeps a diagram callout whole when its alt text has nested coordinate parens', () => {
    const text =
      'Mark is working out the distance between these two points. What type of triangle would help him? ' +
      '(Diagram: Axes with not scales drawn on. Two points are marked, (4,10) and (9,2))'
    const segments = splitAltDiagramSegments(text)

    expect(segments).toHaveLength(2)
    expect(segments[0]).toEqual({
      kind: 'text',
      content: 'Mark is working out the distance between these two points. What type of triangle would help him? ',
    })
    expect(segments[1]).toEqual({
      kind: 'diagram',
      alt: 'Axes with not scales drawn on. Two points are marked, (4,10) and (9,2)',
    })
    // The old bug: " and (9,2))" leaking out as a trailing plain-text segment.
    expect(segments.some(s => s.kind === 'text' && s.content.includes('(9,2)'))).toBe(false)
  })

  it('handles multiple nested pairs and doubly-nested parens', () => {
    const text = '(Diagram: A circle through (4,0), (0,-4), (-4,0) and (0,4) with center (0,0))'
    const segments = splitAltDiagramSegments(text)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toEqual({
      kind: 'diagram',
      alt: 'A circle through (4,0), (0,-4), (-4,0) and (0,4) with center (0,0)',
    })
  })

  it('passes plain text through untouched when there is no diagram callout', () => {
    const text = 'Solve for x: 2x + 4 = 10'
    expect(splitAltDiagramSegments(text)).toEqual([{ kind: 'text', content: text }])
  })

  it('handles a callout followed by more prose', () => {
    const text = '(Diagram: A dashed line from (1,1) to (2,2)) What is the slope?'
    const segments = splitAltDiagramSegments(text)
    expect(segments).toEqual([
      { kind: 'diagram', alt: 'A dashed line from (1,1) to (2,2)' },
      { kind: 'text', content: ' What is the slope?' },
    ])
  })
})

/**
 * parseAltDiagram — every quote below is real eedi alt-text (see
 * ml/data/eedi/train.csv via the ingestion pipeline, CLAUDE.md "Question
 * bank"), not invented. Coverage against the full `format: 'diagram'` corpus
 * (243 questions with non-empty alt text) is 42% (102/243) across all 9
 * patterns — the rest fall through to `humanizeAltCaption` on purpose, since
 * a wrong guess at a labeled diagram is worse than a plain caption.
 */
describe('parseAltDiagram — shape dimensions', () => {
  it('parses a triangle with base and equal sides', () => {
    const d = parseAltDiagram('A triangle, base 12m. All three sides are equal.')
    expect(d).toMatchObject({ kind: 'shapedimension', shape: 'triangle', base: '12m' })
  })

  it('parses a cuboid with depth/height and a starred width', () => {
    const d = parseAltDiagram('A cuboid, depth 2cm and height 3cm. The width is labelled with a star.')
    expect(d).toMatchObject({ kind: 'shapedimension', shape: 'cuboid', depth: '2cm', height: '3cm', width: '★' })
  })

  it('parses a trapezium with two parallel sides and height', () => {
    const d = parseAltDiagram(
      'Trapezium with parallel sides of lengths 90mm and 40mm. The length of one slanted side is 6cm and the perpendicular height is 5cm.',
    )
    expect(d).toMatchObject({ kind: 'shapedimension', shape: 'trapezium', parallel1: '90mm', parallel2: '40mm', height: '5cm' })
  })

  it('parses a right-angled triangle with base/slant/perpendicular height', () => {
    const d = parseAltDiagram('A right angled triangle with base length 11cm, slant height, 13 cm and perpendicular height 8cm.')
    expect(d).toMatchObject({ kind: 'shapedimension', shape: 'triangle', base: '11cm', height: '8cm', slant: '13cm' })
  })

  it('parses a cube with one labeled edge', () => {
    const d = parseAltDiagram('A cube with one edge labelled 5cm')
    expect(d).toMatchObject({ kind: 'shapedimension', shape: 'cube', edge: '5cm' })
  })

  it('falls through a bare parallel-sides mention with no values', () => {
    expect(parseAltDiagram('Trapezium with parallel sides labelled')).toBeNull()
  })

  it('parses an angle-only triangle with a variable third angle', () => {
    const d = parseAltDiagram('A triangle with two labelled interior angles. One angle is 65 degrees. One angle is k degrees. The third angle has no label.')
    expect(d).toMatchObject({ kind: 'triangleangles' })
    expect((d as { angles: string[] }).angles).toContain('65')
    expect((d as { angles: string[] }).angles).toContain('k')
  })
})

describe('parseAltDiagram — function machines', () => {
  it('parses input + two chained operations', () => {
    const d = parseAltDiagram('A function machine showing an input of n and operations divide by 5 and add 3')
    expect(d).toMatchObject({ kind: 'functionmachine', input: 'n' })
    expect((d as { steps: string[] }).steps).toEqual(['divide by 5', 'add 3'])
  })

  it('falls through an all-blank function machine', () => {
    const d = parseAltDiagram('A function machine with the input box blank. The first function box blank. The second function box has a purple star in and the output box is blank.')
    expect(d).toBeNull()
  })
})

describe('parseAltDiagram — bracket expansion arrows', () => {
  it('parses two brackets with arrows pointing at specific terms', () => {
    const d = parseAltDiagram('The two brackets are (x+5)(x-3). The arrows are pointing at the +5 in the first bracket and the -3 in the second bracket.')
    expect(d).toEqual({ kind: 'bracketarrows', bracket1: 'x+5', bracket2: 'x-3', term1: '+5', term2: '-3' })
  })
})

describe('parseAltDiagram — angle diagrams', () => {
  it('parses angles around a point with two labels', () => {
    const d = parseAltDiagram('Angles around a point, split into 2 parts. One is labelled 310 degrees and the other x.')
    expect(d).toMatchObject({ kind: 'anglediagram', variant: 'aroundpoint' })
  })

  it('parses three angles meeting on a straight line', () => {
    const d = parseAltDiagram('Three angles which meet to form a straight line. They are labelled 46 degrees, 115 degrees and k.')
    expect(d).toMatchObject({ kind: 'anglediagram', variant: 'online' })
  })

  it('parses three lines crossing at a point', () => {
    const d = parseAltDiagram('A diagram showing 3 lines crossing at a point to form 6 angles. Two angles are marked in orange, there are two unmarked angles between them on either side.')
    expect(d).toMatchObject({ kind: 'anglediagram', variant: 'crossing6' })
  })
})

describe('parseAltDiagram — venn diagrams', () => {
  it('parses a two-set venn diagram', () => {
    const d = parseAltDiagram(
      "A Venn diagram with two sets, one labelled Square number and one labelled Odd number. Square Number without the intersection is labelled A, Odd Number without the intersection is labelled C, the intersection of the two sets is labelled B.",
    )
    expect(d).toMatchObject({ kind: 'venn' })
    expect((d as { labels: string[] }).labels).toHaveLength(2)
  })
})

describe('parseAltDiagram — sequence patterns', () => {
  it('parses a growing square-count sequence', () => {
    const d = parseAltDiagram('A diagram showing the first 3 patterns in a sequence. Pattern 1 contains 3 squares in this arrangement. Pattern 2 contains 5 squares in this arrangement. Pattern 3 contains 7 squares in this arrangement.')
    expect(d).toEqual({ kind: 'sequencepattern', counts: [3, 5, 7] })
  })
})
