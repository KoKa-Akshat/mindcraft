/**
 * questionStem — the ONE place that decides what stem text a student reads.
 *
 * Serve order (C-4): baked themed stem > framedLocalStem > plain bank text.
 *
 * Both Practice and the concept chapter page call `resolveQuestionStem`, so a
 * question reads identically wherever it is served. This mirrors the
 * "one prompt, two callers" rule the bake already follows on the webhook side
 * (storyModuleComposer) — no second copy of the resolve chain.
 *
 * IMPORTANT: this returns DISPLAY text only. Anything that parses the question
 * mathematically (graph extraction, math-ask extraction, answer checking) must
 * keep reading `q.question` — the narrative wrap is not machine-readable.
 */
import type { Question } from './questionBank'
import { buildStoryDisplay } from './storyDisplay'
import { selectStoryForConcept } from './storySelection'
import { selectSceneForQuestion } from './sceneSelection'
import { getBakedThemedStem } from './themedStems'

/**
 * Local story wrap when no baked stem exists — never bare textbook.
 *
 * Checks the concept's `scenes[]` list (lib/sceneSelection.ts) first, so a
 * fractions_decimals question varies its bridge/setting across a session;
 * concepts with no scenes array fall through to the single locked
 * `contextFrame` stored on their concept story.
 */
export function framedLocalStem(q: Question): string {
  const display = buildStoryDisplay(q)
  const story = selectStoryForConcept(q.conceptId)
  if (!story) return display.stem
  const scene = selectSceneForQuestion(q, story.conceptId)
  const setting = scene?.settingLine || story.settingLine || ''
  const bridge =
    scene?.questionBridge || story.questionBridge || `${story.protagonist} sets this on the desk.`
  return [setting ? `✦ ${setting}` : '', bridge, display.stem].filter(Boolean).join('\n\n')
}

// STORY WRAP DISABLED (2026-08-04): both the offline bake and framedLocalStem
// were pasting the same fixed sentence onto every question in a concept
// verbatim ("On the 1761 voyage to Jamaica, William Harrison enters this
// calculation..." on literally every linear_equations item, "Antwerp...Simon
// Stevin" on every fractions_decimals item) — not per-question narrative,
// just uniform noise wrapped around the real question. Reverting to the
// deterministic structural reskin only (table/vignette handling in
// storyDisplay.ts) until the bake is redone with actual per-question scenes.
// Flip STORY_WRAP_ENABLED back to true once that's fixed.
const STORY_WRAP_ENABLED = false

/**
 * Resolve the stem a student should read for this question.
 *
 * The baked key includes storyId, so the reskin only applies when it matches
 * the story world currently active for the concept.
 */
export function resolveQuestionStem(q: Question): string {
  if (!STORY_WRAP_ENABLED) return buildStoryDisplay(q).stem

  const story = selectStoryForConcept(q.conceptId)
  const baked = getBakedThemedStem(q.conceptId, q.id, story?.conceptId ?? q.conceptId)
  if (baked) return baked
  return framedLocalStem(q)
}
