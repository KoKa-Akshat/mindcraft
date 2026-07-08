import { useMemo } from 'react'
import type { Question } from '../lib/questionBank'
import { buildStoryDisplay, type StoryDisplay } from '../lib/storyDisplay'

export function useStoryQuestion(
  q: Question | null | undefined,
  /** Practice story-module stem overrides display reskin when present. */
  storyStem?: string | null,
): { display: StoryDisplay | null; stemText: string } {
  return useMemo(() => {
    if (!q) return { display: null, stemText: '' }
    const display = buildStoryDisplay(q)
    const stemText = storyStem?.trim() || display.stem
    return { display, stemText }
  }, [q, storyStem])
}
