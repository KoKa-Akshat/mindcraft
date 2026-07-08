/** Student-facing definitions for tap-to-define on highlighted math terms. */
export const MATH_GLOSSARY: Record<string, string> = {
  mode: 'The value that appears most often in a data set.',
  median: 'The middle value when all values are listed in order.',
  mean: 'The average — add all values and divide by how many there are.',
  range: 'The spread from the smallest value to the largest.',
  'standard deviation': 'How spread out the values are around the mean.',
  hexagon: 'A six-sided polygon with six angles.',
  pentagon: 'A five-sided polygon with five angles.',
  octagon: 'An eight-sided polygon with eight angles.',
  'interior angle': 'An angle inside a shape, measured at a corner.',
  'interior angles': 'The angles inside a shape, one at each corner.',
  congruent: 'Exactly the same size and shape.',
  parallel: 'Lines that stay the same distance apart and never meet.',
  perpendicular: 'Meeting at a right angle (90°).',
  hypotenuse: 'The longest side of a right triangle, opposite the right angle.',
  probability: 'How likely something is, from 0 (impossible) to 1 (certain).',
  ratio: 'A comparison of two quantities, written like 3:4.',
  proportion: 'Two ratios set equal to each other.',
  slope: 'How steep a line is — rise over run.',
  vertex: 'A corner point of a shape or graph.',
  circumference: 'The distance around a circle.',
  diameter: 'A line through the center of a circle, touching both sides.',
  radius: 'The distance from the center of a circle to its edge.',
}

export function glossaryFor(phrase: string): string | undefined {
  const key = phrase.trim().toLowerCase()
  if (MATH_GLOSSARY[key]) return MATH_GLOSSARY[key]
  for (const [term, def] of Object.entries(MATH_GLOSSARY)) {
    if (key.includes(term)) return def
  }
  return undefined
}
