/**
 * content.ts
 *
 * Authored content for the Manjushree zone: the validated quadratic bank,
 * narrative copy, and mappings into the real MindCraft ontology.
 *
 * Every `expected` block below was computed BY HAND during authoring. The
 * vitest suite recomputes each value from (a, r1, r2) and asserts equality,
 * so the bank cannot drift from the math.
 *
 * Concept and ingredient ids are REAL ids from
 * ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json.
 * Do not invent new ids here.
 */

import type { EncounterId, TrajectoryQuadratic, ZoneQuadratic } from './quadratics'

// ── Ontology mapping ───────────────────────────────────────────────────────

export const CONCEPT_ID = 'quadratic_equations'

/** Real Layer-1 ingredient ids exercised by each encounter. */
export const ENCOUNTER_INGREDIENTS: Record<EncounterId, string[]> = {
  roots: ['quadratics__solutions_as_x_intercepts', 'quadratics__factoring_method'],
  axis: ['quadratics__vertex_from_roots'],
  vertex: ['quadratics__vertex_from_roots'],
  strike: [],
  discriminant: ['quadratics__discriminant_meaning'],
}

/** Student-facing names for what each encounter demonstrated. */
export const ENCOUNTER_SKILLS: Record<EncounterId, string> = {
  roots: 'Roots as x-intercepts',
  axis: 'Axis of symmetry',
  vertex: 'Vertex of a parabola',
  strike: 'Connecting roots, axis, and vertex',
  discriminant: 'Discriminant as a prediction',
}

// ── The validated quadratic bank ───────────────────────────────────────────
// 12 core quadratics across 3 levels. All open downward (a < 0), all roots are
// integers, every vertex is rational, and no equation has irrational or
// complex roots. Level 1 shows factored form; levels 2 and 3 show standard
// form. mjz_q01 is the canonical legend quadratic from the design brief.

export const QUADRATIC_BANK: ZoneQuadratic[] = [
  {
    id: 'mjz_q01', level: 1, displayForm: 'factored', a: -0.5, r1: 1, r2: 9,
    expected: { b: 5, c: -4.5, axis: 5, vertex: { x: 5, y: 8 }, discriminant: 16 },
  },
  {
    id: 'mjz_q02', level: 1, displayForm: 'factored', a: -1, r1: 2, r2: 6,
    expected: { b: 8, c: -12, axis: 4, vertex: { x: 4, y: 4 }, discriminant: 16 },
  },
  {
    id: 'mjz_q03', level: 1, displayForm: 'factored', a: -0.5, r1: -2, r2: 6,
    expected: { b: 2, c: 6, axis: 2, vertex: { x: 2, y: 8 }, discriminant: 16 },
  },
  {
    id: 'mjz_q04', level: 1, displayForm: 'factored', a: -0.5, r1: 0, r2: 8,
    expected: { b: 4, c: 0, axis: 4, vertex: { x: 4, y: 8 }, discriminant: 16 },
  },
  {
    id: 'mjz_q05', level: 2, displayForm: 'standard', a: -1, r1: 1, r2: 5,
    expected: { b: 6, c: -5, axis: 3, vertex: { x: 3, y: 4 }, discriminant: 16 },
  },
  {
    id: 'mjz_q06', level: 2, displayForm: 'standard', a: -1, r1: -2, r2: 4,
    expected: { b: 2, c: 8, axis: 1, vertex: { x: 1, y: 9 }, discriminant: 36 },
  },
  {
    id: 'mjz_q07', level: 2, displayForm: 'standard', a: -0.5, r1: 2, r2: 10,
    expected: { b: 6, c: -10, axis: 6, vertex: { x: 6, y: 8 }, discriminant: 16 },
  },
  {
    id: 'mjz_q08', level: 2, displayForm: 'standard', a: -1, r1: -1, r2: 5,
    expected: { b: 4, c: 5, axis: 2, vertex: { x: 2, y: 9 }, discriminant: 36 },
  },
  {
    id: 'mjz_q09', level: 3, displayForm: 'standard', a: -0.25, r1: 2, r2: 10,
    expected: { b: 3, c: -5, axis: 6, vertex: { x: 6, y: 4 }, discriminant: 4 },
  },
  {
    id: 'mjz_q10', level: 3, displayForm: 'standard', a: -0.5, r1: -1, r2: 7,
    expected: { b: 3, c: 3.5, axis: 3, vertex: { x: 3, y: 8 }, discriminant: 16 },
  },
  {
    id: 'mjz_q11', level: 3, displayForm: 'standard', a: -1, r1: 1, r2: 6,
    expected: { b: 7, c: -6, axis: 3.5, vertex: { x: 3.5, y: 6.25 }, discriminant: 25 },
  },
  {
    id: 'mjz_q12', level: 3, displayForm: 'standard', a: -0.25, r1: -3, r2: 9,
    expected: { b: 1.5, c: 6.75, axis: 3, vertex: { x: 3, y: 9 }, discriminant: 9 },
  },
]

/** Optional Discriminant Sight trajectories (standard form, authored directly). */
export const TRAJECTORY_BANK: TrajectoryQuadratic[] = [
  { id: 'mjz_t01', a: -0.5, b: 4, c: -6, expected: { discriminant: 4, intersections: 'two' } },
  { id: 'mjz_t02', a: -1, b: 8, c: -16, expected: { discriminant: 0, intersections: 'one' } },
  { id: 'mjz_t03', a: -0.5, b: 3, c: -6, expected: { discriminant: -3, intersections: 'none' } },
]

export function quadraticById(id: string): ZoneQuadratic | undefined {
  return QUADRATIC_BANK.find(q => q.id === id)
}

/** Pick a quest quadratic for a difficulty level, avoiding a repeat. */
export function pickQuadratic(level: 1 | 2 | 3, excludeId?: string): ZoneQuadratic {
  const pool = QUADRATIC_BANK.filter(q => q.level === level && q.id !== excludeId)
  const fallback = QUADRATIC_BANK.filter(q => q.level === level)
  const source = pool.length > 0 ? pool : fallback
  return source[Math.floor(Math.random() * source.length)]
}

// ── Narrative copy ─────────────────────────────────────────────────────────
// Brand voice: second person, present tense, declaratives, sentence case,
// no exclamation marks, no emoji, no em dashes. The legend is framed as a
// legend, told with respect.

export const CULTURAL_NOTE =
  'Inspired by a Nepali Buddhist legend of Manjushree and the Kathmandu Valley lake. ' +
  'Told with respect. The sword cuts stone and uncertainty, never the living.'

/** One punch line for the title card. Full lore lives in pause. */
export const INTRO_TAGLINE = 'See the shape in the mountain. Cut with precision.'

export const INTRO_LINES = [INTRO_TAGLINE]

// Simplified 2026-07-21: the arrival -> villager -> travel -> hill -> cut ->
// result loop replaces the old free-roam explore/sight/roots/axis/vertex
// phase chain. Copy below is grouped by beat. Zero exclamation marks, zero
// em dashes, calm declarative tone throughout, matching brand voice.
export const NARRATIVE: Record<string, string> = {
  // Beat 1: arrival (establishing illustration)
  arrivalObjective: 'A hill blocks the water between two villages.',
  // Beat 2: villager interaction (a short exchange, not a text dump -- see
  // VILLAGER_DIALOGUE below for the actual lines)
  villagerPrompt: 'Someone is waiting by the path.',
  // Beat 3: travel transition
  travelLine: 'You start toward the ridge.',
  // Beat 4: Wisdom Sight
  sightIntro: 'The ridge blocks the water. Look closer.',
  sightPrompt: 'Reveal the shape.',
  sightRevealed: 'See the outline. That is the curve.',
  sightGuidance: 'Read the equation. Find where the curve meets the ground.',
  // Beat 5: roots -> sword power (first charge)
  // rootsObjective is a stem only; ManjushreeZone appends the live equation.
  rootsObjective: 'What are the roots of',
  rootsCorrect: 'Sword power gathers in the blade.',
  rootsUnstable: 'Wrong roots. The valley floods.',
  // Beat 6: axis (sub-step of the vertex encounter) then vertex -> cleave power (second, final charge)
  vertexAxisObjective: 'For this curve, where is the axis of symmetry?',
  vertexAxisCorrect: 'The halves match.',
  vertexAxisUnstable: 'Wrong center. The valley floods.',
  vertexHeightObjective: 'For this curve, what is the peak height?',
  vertexHeightCorrect: 'Cleave power completes the sword.',
  vertexUnstable: 'Wrong peak. The valley floods.',
  // Beat 7: the cut
  strikeObjective: 'Hold steady. Cut from the center.',
  strikeReady: 'Two charges. One strike.',
  cinematicLine: 'Precision opens the ridge.',
  // Beat 8: result
  postCut: 'The villager says thank you. Water reaches both sides.',
  summaryLead: 'Cut complete. Your proof stands.',
}

/**
 * Villager dialogue beat (spec: "discovered through interaction, not an
 * upfront text dump"). Shown one line at a time with a continue tap, before
 * the travel transition. Speaks for both settlements on the two sides of
 * the ridge, since only one villager character was generated this pass.
 */
export const VILLAGER_DIALOGUE: string[] = [
  'The ridge holds our lake back from the terraces on both sides.',
  'Two before you have tried the cut and failed. A wrong cut floods the fields, not the mountain.',
  'If you can read the true shape of the ridge, the sword will answer to you.',
]

/** Short HUD labels for the two-charge system (roots, then axis+vertex combined). */
export const CHARGE_LABELS = {
  sword: 'Sword power',
  cleave: 'Cleave power',
} as const

export const CONTROLS_REFERENCE: Array<{ keys: string; action: string }> = [
  { keys: 'Click or tap', action: 'Advance dialogue, choose a rune stone, mark the curve' },
  { keys: 'Hint button (or H)', action: 'Ask for a hint' },
  { keys: 'Hold the Strike button (or Space)', action: 'Charge and release the final cut' },
  { keys: 'Type answer (or T)', action: 'Type an answer instead of choosing a stone' },
  { keys: 'R', action: 'Reset the current trial' },
  { keys: 'Esc or the pause button', action: 'Pause' },
]
