/**
 * storySelection — pick the best narrative world per question.
 * Folk tale matcher first; 42 concept stories are fallback spine.
 */
import conceptStoriesRaw from '../data/conceptStories.json'
import framesRaw from '../data/questionContextFrames.json'
import type { Question } from './questionBank'
import { toOntologyId } from './conceptMap'
import { matchSkinForQuestion, type MatchContext } from './storyMatch'

export type { MatchContext }

type ConceptStory = { conceptId: string; conceptName: string; story: string }
type ContextFrame = {
  protagonist: string
  settingLine: string
  questionBridge: string
}

const STORIES = conceptStoriesRaw as Record<string, ConceptStory>
const FRAMES = framesRaw as Record<string, ContextFrame>

const GOAL_TONE: Record<string, string> = {
  act_prep: 'exam stakes — crisp mission briefing energy',
  get_unstuck: 'patient breakthrough — mentor helps you see the trap',
  college_prep: 'long-horizon ambition — the math unlocks the next door',
  curious: 'wonder-first — discovery beats drill',
}

export interface SelectedStory {
  conceptId: string
  conceptName: string
  story: string
  protagonist: string
  settingLine: string
}

function resolveConceptId(conceptId: string): string {
  if (STORIES[conceptId]) return conceptId
  const aliased = toOntologyId(conceptId)
  return STORIES[aliased] ? aliased : conceptId
}

export function selectStoryForConcept(conceptId: string): SelectedStory | null {
  const id = resolveConceptId(conceptId)
  const entry = STORIES[id]
  if (!entry?.story) return null
  const frame = FRAMES[id]
  return {
    conceptId: id,
    conceptName: entry.conceptName,
    story: entry.story,
    protagonist: frame?.protagonist ?? entry.conceptName,
    settingLine: frame?.settingLine ?? '',
  }
}

export function goalToneHint(goalTags: string[]): string {
  const hints = goalTags.map(t => GOAL_TONE[t]).filter(Boolean)
  return hints.length ? hints.join('; ') : ''
}

export interface EnrichContext extends MatchContext {
  goalTags?: string[]
}

/** Match folk tale → concept story → context; attach skin payload for Groq. */
export function enrichQuestionsWithStories(
  questions: Question[],
  ctx: EnrichContext = {},
): Array<Question & {
  conceptStory: string
  conceptName: string
  protagonist: string
  skinSource?: string
  skinTaleTitle?: string
}> {
  const goalTags = ctx.goalTags ?? []
  return questions.map(q => {
    const matched = matchSkinForQuestion(q, { ...ctx, goalTags })
    return {
      ...q,
      conceptStory: matched.conceptStory,
      conceptName: matched.conceptName,
      protagonist: matched.protagonist,
      skinSource: matched.source,
      skinTaleTitle: matched.taleTitle,
    }
  })
}

export function uniqueConceptsInQueue(questions: Question[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of questions) {
    const id = resolveConceptId(q.conceptId)
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}
