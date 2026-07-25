/**
 * splitAltDiagramSegments — regression coverage for the caption-bleed bug
 * (eedi_203, linear_equations): the alt text a `(Diagram: ...)` callout
 * wraps can contain its own nested parens (coordinate pairs), and a naive
 * regex split truncates the callout at the first inner `)`.
 */
import { describe, expect, it } from 'vitest'
import { splitAltDiagramSegments } from './altDiagram'

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
