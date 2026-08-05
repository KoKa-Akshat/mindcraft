/**
 * storyModuleComposer — shared Groq composer for /story-module + offline bake.
 *
 * THE CONTRACT (deterministic spine, LLM skin):
 *   The LLM NEVER touches the math. Choices, correctIndex, and every numeric
 *   value stay byte-identical — it only rewrites the *stem* as a scene and
 *   derives guidance. Items that fail numeric validation are dropped.
 *
 * One prompt, two callers (C-2): the Vercel handler and bake-themed-stems.
 * Do not fork the prompt between them.
 */

import { ChatGroq } from '@langchain/groq'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { JsonOutputParser } from '@langchain/core/output_parsers'

export const STORY_MODULE_MODEL = 'llama-3.3-70b-versatile'
export const MAX_QUESTIONS = 12
export const MAX_STORY_CHARS = 4000
export const CACHE_VERSION = 'v5'

export interface StoryModuleItem {
  storyStem: string
  socratic: string[]
  steps: string[]
  misconceptionCallout?: string
}

export interface IncomingQuestion {
  id: string
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
  hints?: string[]
  level?: number
  format?: string
  misconceptionLabel?: string
  conceptId?: string
  conceptName?: string
  conceptStory?: string
  protagonist?: string
  storyContext?: string
  storyIntro?: string
}

export interface ComposeStudentContext {
  goals?: { tags?: string[]; text?: string }
  tutorFocusConcepts?: string[]
  priorOutcomes?: Array<{ conceptId: string; questionId: string; correct: boolean }>
  sessionKind?: string
}

export interface ComposeRequest {
  conceptId: string
  conceptName: string
  story: string
  questions: IncomingQuestion[]
  context?: ComposeStudentContext
  /** Override Groq key (bake script loads from ml/.env.local). */
  apiKey?: string
  /** Cap for this call (default MAX_QUESTIONS). Bake may pass the same; live stays ≤12. */
  maxQuestions?: number
  /** Groq max output tokens (default 6000). Bake uses a higher ceiling to avoid truncation. */
  maxTokens?: number
  /**
   * Bake mode: keep a storyStem that passes numeric/markup checks even when
   * socratic/steps fail validation. Live handler leaves this false (C-2 prompt
   * is identical; only acceptance differs for the stem artifact).
   */
  stemOnlyAccept?: boolean
}

export interface ComposeResult {
  items: Record<string, StoryModuleItem>
  generated: number
  dropped: Array<{ questionId: string; reason: string }>
}

/** Artifact / Firestore-safe key fragment (no slashes). */
export function safeIdPart(s: string): string {
  return s.replace(/\//g, '_').slice(0, 180)
}

/** Live Firestore cache doc id (includes cache version). */
export function cacheDocId(conceptId: string, questionId: string): string {
  const cid = conceptId === 'diagnostic_mixed' ? 'mixed' : conceptId
  return `${CACHE_VERSION}__${safeIdPart(cid)}__${safeIdPart(questionId)}`
}

/**
 * Product artifact key (C-1) — includes storyId so a reskin can be checked
 * against the story world it was baked for.
 * Format: `{conceptId}__{storyId}__{questionId}`
 * For concept-chapter stories, storyId === conceptId. Folk-tale skins use tale id.
 */
export function themedStemKey(
  conceptId: string,
  questionId: string,
  storyId?: string,
): string {
  const cid = conceptId === 'diagnostic_mixed' ? 'mixed' : conceptId
  const sid = storyId?.trim() || cid
  return `${safeIdPart(cid)}__${safeIdPart(sid)}__${safeIdPart(questionId)}`
}

/** Every digit-run in the original stem must survive into the story stem. */
export function numbersPreserved(originalStem: string, storyStem: string): boolean {
  const nums = originalStem.match(/\d+(?:\.\d+)?/g) ?? []
  return nums.every(n => storyStem.includes(n))
}

const BANNED_MARKUP = /(<script|<svg|<iframe|javascript:|on\w+=)/i

export function isValidItem(
  raw: unknown,
  original: IncomingQuestion,
): raw is StoryModuleItem {
  if (!raw || typeof raw !== 'object') return false
  const item = raw as Partial<StoryModuleItem>
  if (typeof item.storyStem !== 'string' || item.storyStem.trim().length < 20) return false
  if (item.storyStem.length > 2200) return false
  if (BANNED_MARKUP.test(item.storyStem)) return false
  if (item.storyStem.includes('—')) return false
  if (!numbersPreserved(original.question, item.storyStem)) return false
  if (!Array.isArray(item.socratic)
    || item.socratic.length < 1 || item.socratic.length > 3
    || !item.socratic.every(sq => typeof sq === 'string' && sq.trim().length > 0 && !sq.includes('—'))) return false
  if (!Array.isArray(item.steps)
    || item.steps.length < 2 || item.steps.length > 6
    || !item.steps.every(st => typeof st === 'string' && st.trim().length > 0 && !st.includes('—'))) return false
  if (item.misconceptionCallout !== undefined
    && (typeof item.misconceptionCallout !== 'string' || item.misconceptionCallout.includes('—'))) return false
  const correctText = original.choices[original.correctIndex] ?? ''
  const leaky = (s: string) =>
    correctText.length > 2 && s.toLowerCase().includes(correctText.toLowerCase())
  if (item.socratic.some(leaky)) return false
  return true
}

/** Stem-only check for consuming a baked stem (no socratic/steps required). */
export function isValidBakedStem(originalStem: string, storyStem: string): boolean {
  if (typeof storyStem !== 'string' || storyStem.trim().length < 20) return false
  if (storyStem.length > 2200) return false
  if (BANNED_MARKUP.test(storyStem)) return false
  if (storyStem.includes('—')) return false
  return numbersPreserved(originalStem, storyStem)
}

export const SYSTEM_TEMPLATE = `You are MindCraft's story-module composer. A student is about to practice math. Each question may belong to a different concept with its own origin story — a real historical or folkloric narrative of why that math exists. Your job is to re-set each practice question INSIDE the best story world for THAT question and attach guidance, so the session feels like living those worlds rather than grinding a worksheet.

DEFAULT STORY (when a question has no conceptStory field):
{story}

STUDENT CONTEXT (surface the world toward these — never change the math):
• Goals: {goals_summary}
• Tutor focus concepts: {tutor_focus}
• Session: {session_kind}
• Recent probes: {prior_outcomes}

When goals mention a career, exam, or interest, let each protagonist's scene reflect that
tone (e.g. ACT prep → mission briefing; music → studio) while keeping every number frozen.
When a question includes its own "conceptStory", "protagonist", or "storyIntro", use THAT
world for THAT question only — do not force every question into one protagonist.
Prefer story cells / storyIntro when present — they are pre-authored immersive scenes.
1. NEVER change, remove, or reorder any number, variable, equation, unit, or mathematical relationship in a question. Every numeric value in the original stem MUST appear verbatim in your rewrite.
2. NEVER mention the answer choices — the app renders them unchanged. Your stem must ask for exactly the same quantity the original asks for.
3. Keep any LaTeX (\\( \\), $ $, \\[ \\]) exactly as written.
4. Each storyStem must stand alone (2-4 sentences of scene + the full mathematical ask). Do NOT reference other questions or "the previous scene" — questions can appear in any order.
5. Use the story's actual characters, places, and stakes. If the original stem's context conflicts with the story world, translate the surface context but keep the math identical.
6. The math must be WOVEN INTO the scene's action — a named character must need this exact equation/quantity for a concrete reason inside the story ("the ledger shows 9x − 3y = 10, and Stevin needs the slope to set the ramp"), never a scene followed by an unrelated textbook ask. If you cannot tie the exact math to the story naturally, set the scene around the character ENCOUNTERING that exact expression (a chart, a ledger, an instrument reading) — the connection must always be explicit.
7. BAD example: "William watches planes land. If 9x - 3y = 10, what is the slope?" GOOD example: "Stevin opens the cargo ledger where today's balance reads 9x − 3y = 10. What slope does that constraint line show for the airlift ramp?"
8. Voice: warm, direct, genuinely excited to help a student who has struggled with math before. Never stilted or corporate-sounding. NEVER use an em dash (—) anywhere in any field; use a period, colon, or comma instead.

GUIDANCE — derived from the signals given per question:
• "socratic": exactly 2 short guiding questions a great tutor would ask, in story voice. Lead toward the method, never reveal the answer or the correct choice.
• "steps": 2-5 short imperative steps distilled from the worked explanation ("how to solve"). Plain language a 9th grader follows. No final numeric answer in the steps — end with "…which gives your answer."
• "misconceptionCallout": ONLY if a misconception is tagged — one sentence, story-voiced, warning about that exact trap without shame. Omit the field otherwise.
• Never say: wrong, failed, bad, stupid, easy. Direct and respectful, no cheerleading, no emojis.

QUESTIONS (JSON — per question you get the stem, choices, correct answer, worked explanation, hints, difficulty level, format, and tagged misconception):
{questions_json}

Return ONLY a JSON object keyed by question id — no markdown fences, no commentary:
{{"<questionId>": {{"storyStem": "...", "socratic": ["...", "..."], "steps": ["...", "..."], "misconceptionCallout": "..."}}}}`

/**
 * Run one Groq batch (≤ MAX_QUESTIONS) through the shared composer + validators.
 * Used by the live handler (cache misses) and the offline bake (neutral context).
 */
export async function composeStoryModuleItems(
  req: ComposeRequest,
): Promise<ComposeResult> {
  const items: Record<string, StoryModuleItem> = {}
  const dropped: Array<{ questionId: string; reason: string }> = []

  const limit = Math.max(1, Math.min(req.maxQuestions ?? MAX_QUESTIONS, 24))
  const batch = req.questions
    .filter(q => q
      && typeof q.id === 'string'
      && typeof q.question === 'string'
      && q.question.length <= 4000
      && Array.isArray(q.choices)
      && q.choices.length <= 8
      && Number.isInteger(q.correctIndex)
      && typeof q.explanation === 'string'
      && q.explanation.length <= 6000)
    .slice(0, limit)

  if (batch.length === 0) {
    return { items, generated: 0, dropped }
  }

  const apiKey = req.apiKey ?? process.env.GROQ_API_KEY ?? ''
  if (!apiKey) {
    for (const q of batch) dropped.push({ questionId: q.id, reason: 'missing_groq_api_key' })
    return { items, generated: 0, dropped }
  }

  const model = new ChatGroq({
    apiKey,
    model: STORY_MODULE_MODEL,
    temperature: 0.55,
    maxTokens: req.maxTokens ?? 6000,
  })

  const prompt = ChatPromptTemplate.fromMessages([['system', SYSTEM_TEMPLATE]])
  const chain = prompt.pipe(model).pipe(new JsonOutputParser())

  const questionsJson = JSON.stringify(batch.map(q => ({
    id: q.id,
    conceptId: q.conceptId ?? req.conceptId,
    conceptName: q.conceptName ?? req.conceptName,
    conceptStory: q.conceptStory?.slice(0, 3000) ?? null,
    protagonist: q.protagonist ?? null,
    storyContext: q.storyContext ?? null,
    storyIntro: q.storyIntro ?? null,
    stem: q.question,
    choices: q.choices,
    correctAnswer: q.choices[q.correctIndex] ?? '',
    howToSolve: q.explanation,
    existingHints: q.hints ?? [],
    difficultyLevel: q.level ?? 2,
    format: q.format ?? 'symbolic_expression',
    misconception: q.misconceptionLabel ?? null,
  })))

  const ctx = req.context ?? {}
  const goalsSummary = [
    ctx.goals?.text?.trim(),
    ...(ctx.goals?.tags?.length ? [`tags: ${ctx.goals.tags.join(', ')}`] : []),
  ].filter(Boolean).join(' · ') || '(not specified)'

  const tutorFocus = ctx.tutorFocusConcepts?.length
    ? ctx.tutorFocusConcepts.join(', ')
    : '(none)'

  const priorSummary = (ctx.priorOutcomes ?? []).slice(-3).map(o =>
    `${o.conceptId}: ${o.correct ? 'solid' : 'uncertain'}`,
  ).join('; ') || '(first questions)'

  let raw: Record<string, unknown>
  try {
    raw = await chain.invoke({
      concept_name: req.conceptName,
      story: req.story.slice(0, MAX_STORY_CHARS),
      goals_summary: goalsSummary.slice(0, 500),
      tutor_focus: tutorFocus.slice(0, 300),
      session_kind: ctx.sessionKind ?? 'practice',
      prior_outcomes: priorSummary.slice(0, 400),
      questions_json: questionsJson,
    }) as Record<string, unknown>
  } catch {
    for (const q of batch) dropped.push({ questionId: q.id, reason: 'groq_failure' })
    return { items, generated: 0, dropped }
  }

  for (const q of batch) {
    const candidate = raw?.[q.id]
    if (isValidItem(candidate, q)) {
      items[q.id] = candidate
    } else if (
      req.stemOnlyAccept
      && candidate
      && typeof candidate === 'object'
      && typeof (candidate as StoryModuleItem).storyStem === 'string'
      && isValidBakedStem(q.question, (candidate as StoryModuleItem).storyStem)
    ) {
      // Stem is good; guidance fields failed — still keep the stem for the bake.
      const partial = candidate as Partial<StoryModuleItem>
      items[q.id] = {
        storyStem: partial.storyStem!,
        socratic: Array.isArray(partial.socratic) && partial.socratic.length > 0
          ? partial.socratic.slice(0, 3).map(String)
          : ['What quantities are given?', 'What are you solving for?'],
        steps: Array.isArray(partial.steps) && partial.steps.length >= 2
          ? partial.steps.slice(0, 6).map(String)
          : ['Name the given quantities.', 'Set up the relationship.', 'Solve for the unknown, which gives your answer.'],
        misconceptionCallout: typeof partial.misconceptionCallout === 'string'
          ? partial.misconceptionCallout
          : undefined,
      }
    } else if (candidate && typeof candidate === 'object'
      && typeof (candidate as StoryModuleItem).storyStem === 'string'
      && !numbersPreserved(q.question, (candidate as StoryModuleItem).storyStem)) {
      dropped.push({ questionId: q.id, reason: 'numeric_preservation' })
    } else {
      dropped.push({ questionId: q.id, reason: 'validation_failed' })
    }
  }

  return { items, generated: Object.keys(items).length, dropped }
}
