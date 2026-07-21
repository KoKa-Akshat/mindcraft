/**
 * Pinterest-style story art keyed by concept. Falls back to vignette when
 * a dedicated plate isn't ready yet — we'll keep filling this map.
 */
import fractions from '../assets/canvas/story-fractions.jpg'
import quadratics from '../assets/canvas/story-quadratics.jpg'
import probability from '../assets/canvas/story-probability.jpg'

const ART: Record<string, string> = {
  fractions_decimals: fractions,
  ratios_proportions: fractions,
  quadratic_equations: quadratics,
  polynomials: quadratics,
  factoring_polynomials: quadratics,
  basic_probability: probability,
  descriptive_statistics: probability,
}

export function storyArtFor(conceptId: string): string | null {
  return ART[conceptId] ?? null
}
