/**
 * extractPlottablePoints / extractGraphableExpression — GraphBox should plot
 * a question's REAL figure when one is parseable, not always the generic
 * default curve (the reported bug: eedi_203, linear_equations, GraphBox
 * showed x^2+5x+6 for a two-point distance question).
 */
import { describe, expect, it } from 'vitest'
import { extractGraphableExpression, extractPlottablePoints } from './plottablePoints'

describe('extractPlottablePoints', () => {
  it('extracts the real points from the eedi_203 regression case', () => {
    const text =
      'Mark is working out the distance between these two points. What type of triangle would help him? ' +
      '(Diagram: Axes with not scales drawn on. Two points are marked, (4,10) and (9,2))'
    expect(extractPlottablePoints(text)).toEqual([{ x: 4, y: 10 }, { x: 9, y: 2 }])
  })

  it('extracts 3+ labeled points from a geometric_transformations diagram', () => {
    const text =
      'What is the image of point T after a translation? ' +
      '(Diagram: A set of axes: x-axis from -5 to 5, y-axis from -2 to 2. Three points are plotted and joined to make a triangle: (2, -2), (4, -2), (3, -1). Point (3, -1) is labelled with the letter "P".)'
    const points = extractPlottablePoints(text)
    expect(points).not.toBeNull()
    expect(points!.length).toBe(4)
  })

  it('does NOT fire for a dimensioned geometric shape (needs a real diagram, not a point plot)', () => {
    const text = 'How would you calculate the area of this triangle? (Diagram: A triangle, base 12m. All three sides are equal.)'
    expect(extractPlottablePoints(text)).toBeNull()
  })

  it('does NOT fire for a Venn diagram region label', () => {
    const text = 'In which region would a rectangle belong? (Diagram: Venn diagram with two circles labelled with (3,4) region markers.)'
    expect(extractPlottablePoints(text)).toBeNull()
  })

  it('does NOT fire for a circle-through-points question (GraphBox cannot draw a circle)', () => {
    const text = 'What is the equation of this circle? (Diagram: A set of axes with a circle drawn. The circle goes through the points (4,0), (0, -4), (-4,0) and (0,4).)'
    expect(extractPlottablePoints(text)).toBeNull()
  })

  it('returns null for plain prose with no diagram callout', () => {
    expect(extractPlottablePoints('Solve for x: 2x + 4 = 10')).toBeNull()
  })
})

describe('extractGraphableExpression', () => {
  it('pulls a stated quadratic equation out of the diagram text', () => {
    const text = 'A set of axes with the quadratic graph y=x^2+4x-1 drawn on. What is the vertex?'
    expect(extractGraphableExpression(text)).toBe('x^2+4x-1')
  })

  it('pulls a stated linear equation with a decimal slope', () => {
    const text = 'A set of axes with the graph y=0.4x-3 drawn on.'
    expect(extractGraphableExpression(text)).toBe('0.4x-3')
  })

  it('returns null when there is no explicit y= equation', () => {
    const text = 'A quadratic curve with minimum point (1,0).'
    expect(extractGraphableExpression(text)).toBeNull()
  })
})
