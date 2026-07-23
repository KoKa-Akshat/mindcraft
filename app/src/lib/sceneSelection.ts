/**
 * sceneSelection: pick one scene from a concept's `scenes[]` list for a
 * given bank question.
 *
 * Concept-lock (conceptStories.json / questionContextFrames.json) fixes ONE
 * protagonist, setting, and art per concept forever (see storyMatch.ts). That
 * is right for identity, but it means the per-question bridge sentence never
 * varied, which reads as boring on repeat sessions. `scenes[]` is an
 * additive, opt-in extension: a concept MAY carry an ordered list of short
 * situational anchors (a customer, a dispute, a small crisis) inside the
 * SAME locked world. Concepts without a `scenes` array (everything except
 * the `fractions_decimals` pilot, for now) fall through untouched, callers
 * see `null` and keep using the single legacy frame exactly as before.
 *
 * Selection rule:
 *   1. Archetype match: if the question is Layer-3-linked (via its bank id
 *      matching a `question_instance_id` in the mirrored Layer 3 slice,
 *      `data/questionArchetypeLinks.json`) to a question archetype, and one
 *      of the concept's scenes is tagged with that same archetype id, use
 *      that scene. This is real evidence, not a guess.
 *   2. Rotation: otherwise, rotate through the concept's scene list by a
 *      stable hash of the question id, so the same question always lands on
 *      the same scene (deterministic, no `Math.random`), but different
 *      questions spread across the whole list instead of always landing on
 *      scene 1.
 *
 * Generic on purpose: nothing here is fractions_decimals-specific. Wiring in
 * the next concept later is just adding a `scenes` array to its
 * conceptStories.json entry, not new code.
 */
import conceptStoriesRaw from '../data/conceptStories.json'
import archetypeLinksRaw from '../data/questionArchetypeLinks.json'
import type { Question } from './questionBank'
import { toOntologyId } from './conceptMap'

export interface ConceptScene {
  sceneId: string
  /** Real Layer 2 question-archetype id this scene was built from, or null for a hand-authored scene. */
  archetypeId: string | null
  settingLine: string
  questionBridge: string
}

type ConceptStoryEntry = {
  conceptId: string
  conceptName: string
  story: string
  scenes?: ConceptScene[]
  ingredientStories?: Record<string, unknown>
}

type ArchetypeLinkEntry = {
  question_instance_id: string
  links?: { question_archetype_ids?: string[] }
}

const STORIES = conceptStoriesRaw as unknown as Record<string, ConceptStoryEntry>

const ARCHETYPE_LINKS_BY_QUESTION_ID: Map<string, string[]> = new Map(
  ((archetypeLinksRaw as unknown as { questionInstances: ArchetypeLinkEntry[] }).questionInstances ?? [])
    .map(entry => [entry.question_instance_id, entry.links?.question_archetype_ids ?? []]),
)

/** Stable string hash (djb2 variant): deterministic, no randomness. */
function stableHash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  }
  return h
}

function resolveConceptEntry(conceptId: string): ConceptStoryEntry | null {
  if (STORIES[conceptId]) return STORIES[conceptId]
  const aliased = toOntologyId(conceptId)
  return STORIES[aliased] ?? null
}

/** The concept's scene list, or null if it has none (legacy single-frame concept). */
export function getConceptScenes(conceptId: string): ConceptScene[] | null {
  const entry = resolveConceptEntry(conceptId)
  return entry?.scenes?.length ? entry.scenes : null
}

/** Archetype ids a bank question is Layer-3-linked to, via its bank `id`
 * matching a `question_instance_id` in the mirrored Layer 3 slice. Empty if
 * the question isn't in that mirror (true for most of the live bank today,
 * Layer 3 linkage is thin, see FORMAT_WEAKNESS_PLAN.md-adjacent notes). */
export function archetypeIdsForQuestion(questionId: string): string[] {
  return ARCHETYPE_LINKS_BY_QUESTION_ID.get(questionId) ?? []
}

/**
 * Pick a scene for a question within its concept's scene list.
 * Returns null when the concept has no `scenes[]` yet, callers should fall
 * back to the legacy single questionContextFrames.json frame in that case.
 */
export function selectSceneForQuestion(
  question: Pick<Question, 'id' | 'conceptId'>,
  conceptIdOverride?: string,
): ConceptScene | null {
  const conceptId = conceptIdOverride ?? question.conceptId
  const scenes = getConceptScenes(conceptId)
  if (!scenes) return null

  const archetypeIds = archetypeIdsForQuestion(question.id)
  if (archetypeIds.length) {
    const match = scenes.find(scene => scene.archetypeId && archetypeIds.includes(scene.archetypeId))
    if (match) return match
  }

  const idx = stableHash(question.id) % scenes.length
  return scenes[idx]
}
