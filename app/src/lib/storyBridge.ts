import type { StoryModuleItem } from './storyModule'

/** Client-side narrative bridge between probes — no extra Groq call. */
export function storyBridgeLine(
  item: StoryModuleItem | undefined,
  correct: boolean,
): string | null {
  if (!item) return null
  if (!correct && item.misconceptionCallout?.trim()) {
    return item.misconceptionCallout.trim()
  }
  if (!correct && item.socratic[1]?.trim()) {
    return item.socratic[1].trim()
  }
  if (correct && item.socratic[0]?.trim()) {
    return item.socratic[0].trim()
  }
  if (correct) return 'The route ahead opens a little wider.'
  return 'Pause — notice what the last scene was really asking.'
}
