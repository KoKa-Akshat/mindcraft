/**
 * themedStems — synchronous lookup for offline-baked story stems (C-4).
 *
 * Artifact: app/src/data/themedStems.generated.json
 * Key: `{conceptId}__{storyId}__{questionId}`
 *   - concept-chapter stories: storyId === conceptId
 *   - folk-tale skins (later): storyId === taleId
 *
 * Serve order in Practice: baked > framedLocalStem > plain.
 * Live /story-module is an optional overlay for socratic/steps only (C-5).
 */
import themedStemsData from '../data/themedStems.generated.json'

export interface ThemedStemsArtifact {
  bakeVersion: number
  sourceBankHash: string
  generatedAt: string
  model: string
  stems: Record<string, string>
  drops?: Array<{ key: string; questionId: string; reason: string; storyId?: string }>
  stats?: Record<string, number>
}

const artifact = themedStemsData as ThemedStemsArtifact

function safeIdPart(s: string): string {
  return s.replace(/\//g, '_').slice(0, 180)
}

/** Key contract shared with the bake script / composer. */
export function themedStemKey(
  conceptId: string,
  questionId: string,
  storyId?: string,
): string {
  const cid = conceptId === 'diagnostic_mixed' ? 'mixed' : conceptId
  const sid = storyId?.trim() || cid
  return `${safeIdPart(cid)}__${safeIdPart(sid)}__${safeIdPart(questionId)}`
}

/**
 * Resolve a baked stem for this concept + question under a specific story world.
 * Pass storyId from selectStoryForConcept (concept chapter) or a matched taleId.
 */
export function getBakedThemedStem(
  conceptId: string,
  questionId: string,
  storyId?: string,
): string | null {
  const sid = storyId?.trim() || conceptId
  const stem = artifact.stems?.[themedStemKey(conceptId, questionId, sid)]
  if (typeof stem !== 'string' || stem.trim().length < 20) return null
  return stem
}

/** True when a baked stem exists for this exact {concept, story, question} triple. */
export function hasBakedStemForStory(
  conceptId: string,
  questionId: string,
  storyId: string,
): boolean {
  return getBakedThemedStem(conceptId, questionId, storyId) !== null
}

export function themedStemsMeta(): Pick<
  ThemedStemsArtifact,
  'bakeVersion' | 'sourceBankHash' | 'generatedAt' | 'model'
> {
  return {
    bakeVersion: artifact.bakeVersion,
    sourceBankHash: artifact.sourceBankHash,
    generatedAt: artifact.generatedAt,
    model: artifact.model,
  }
}

export function bakedStemCount(): number {
  return Object.keys(artifact.stems ?? {}).length
}
