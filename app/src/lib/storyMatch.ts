/**
 * storyMatch — deterministic folk-tale ↔ question matching for skinning.
 * Groq skins AFTER we pick the world; this module never calls an LLM.
 *
 * Fallback: folk tale (score ≥ threshold) → concept story → storyContext.
 */
import type { Question } from './questionBank'
import { questionFormat, inferQuestionFormat, type FormatId } from './questionBank'
import { toOntologyId } from './conceptMap'
import { selectStoryForConcept, goalToneHint, type SelectedStory } from './storySelection'
import mathSkinTopRaw from '../data/mathSkinTop.json'

export interface FolkTaleEntry {
  id: string
  title: string
  culture: string
  region: string
  category?: string
  synopsis: string
  characters?: Array<{ name: string; role: string }>
  setting: string
  themes?: string[]
  math_theme_tags?: string[]
  concept_affinity?: string[]
  concept_affinity_scores?: Record<string, number>
  math_skin_score?: number
  quality_score?: number
  katha_voice_sample?: string
  keywords?: string[]
}

export interface QuestionSignals {
  conceptId: string
  formatId: FormatId
  keywords: string[]
  mathSignals: string[]
  hasTable: boolean
  hasDiagram: boolean
  hasPolygon: boolean
}

export interface MatchContext {
  goalTags?: string[]
  goalText?: string
  tutorFocusConcepts?: string[]
}

export interface MatchedSkin {
  source: 'folk_tale' | 'concept_story' | 'question_context'
  score: number
  taleId?: string
  taleTitle?: string
  conceptStory: string
  protagonist: string
  setting: string
  conceptName: string
}

const FOLK_BANK: FolkTaleEntry[] = Array.isArray(
  (mathSkinTopRaw as unknown as { tales?: FolkTaleEntry[] }).tales,
)
  ? (mathSkinTopRaw as unknown as { tales: FolkTaleEntry[] }).tales
  : []

const MATCH_THRESHOLD = 0.38

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'is', 'are', 'was', 'were',
  'what', 'which', 'how', 'if', 'find', 'value', 'given', 'following', 'shown', 'below',
  'above', 'figure', 'table', 'diagram', 'problem', 'question', 'choose', 'select',
])

const MATH_TERM_MAP: Record<string, string[]> = {
  ratio: ['ratios_proportions', 'fractions_decimals'],
  proportion: ['ratios_proportions'],
  fraction: ['fractions_decimals'],
  percent: ['fractions_decimals', 'ratios_proportions'],
  slope: ['linear_equations', 'functions_basics'],
  equation: ['linear_equations', 'algebraic_manipulation'],
  area: ['area_volume', 'right_triangle_geometry'],
  volume: ['area_volume'],
  triangle: ['right_triangle_geometry', 'triangles_congruence'],
  circle: ['circles_geometry'],
  graph: ['coordinate_geometry', 'functions_basics'],
  coordinate: ['coordinate_geometry'],
  probability: ['basic_probability'],
  mean: ['descriptive_statistics'],
  median: ['descriptive_statistics'],
  average: ['descriptive_statistics'],
  sequence: ['sequences_series'],
  pattern: ['sequences_series', 'number_properties'],
  exponent: ['exponent_rules'],
  quadratic: ['quadratic_equations'],
  factor: ['factoring_polynomials'],
  angle: ['lines_angles', 'trigonometry_basics'],
  transform: ['geometric_transformations'],
}

const FORMAT_TALE_BOOST: Partial<Record<FormatId, string[]>> = {
  table: ['ledger', 'counting', 'record', 'data', 'statistics', 'market', 'trade'],
  diagram: ['spatial', 'geometry', 'navigation', 'weaving', 'pattern'],
  coordinate_graph: ['navigation', 'map', 'journey', 'graph'],
  word_problem: ['journey', 'trade', 'cleverness', 'community'],
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a)
  const B = new Set(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const union = A.size + B.size - inter
  return union ? inter / union : 0
}

function detectMathSignals(stem: string): string[] {
  const lower = stem.toLowerCase()
  const out = new Set<string>()
  for (const [term, tags] of Object.entries(MATH_TERM_MAP)) {
    if (lower.includes(term)) tags.forEach(t => out.add(t))
  }
  if (/\\frac|\d+\s*\/\s*\d+/.test(stem)) out.add('fractions_decimals')
  if (/\d+\s*%/.test(stem)) out.add('ratios_proportions')
  if (/x\s*=|solve|equation/.test(lower)) out.add('linear_equations')
  return [...out]
}

/** Extract matchable signals from a bank question. */
export function extractQuestionSignals(q: Question): QuestionSignals {
  const stem = q.question ?? ''
  const fmt = questionFormat(q) ?? inferQuestionFormat(q)
  const lower = stem.toLowerCase()
  return {
    conceptId: toOntologyId(q.conceptId),
    formatId: fmt,
    keywords: tokenize(stem),
    mathSignals: detectMathSignals(stem),
    hasTable: fmt === 'table' || lower.includes('table'),
    hasDiagram: fmt === 'diagram' || lower.includes('diagram'),
    hasPolygon: /hexagon|pentagon|octagon|polygon|sides/.test(lower),
  }
}

function taleKeywordBag(tale: FolkTaleEntry): string[] {
  const base = [
    ...(tale.keywords ?? []),
    ...(tale.themes ?? []),
    ...(tale.math_theme_tags ?? []),
    tale.culture,
    tale.region,
    tale.title,
  ]
  return tokenize(base.join(' '))
}

function scoreTale(
  tale: FolkTaleEntry,
  signals: QuestionSignals,
  ctx: MatchContext,
): number {
  const conceptId = signals.conceptId
  let score = 0

  const affinity = tale.concept_affinity_scores?.[conceptId]
    ?? (tale.concept_affinity?.includes(conceptId) ? 0.65 : 0)
  score += 0.35 * Math.min(1, affinity)

  const kwOverlap = jaccard(signals.keywords, taleKeywordBag(tale))
  score += 0.25 * kwOverlap

  const taleMath = new Set((tale.math_theme_tags ?? []).map(t => t.toLowerCase()))
  const signalMath = new Set(signals.mathSignals)
  let mathHit = 0
  for (const s of signalMath) {
    if (taleMath.has(s) || tale.concept_affinity?.includes(s)) mathHit++
  }
  score += 0.20 * Math.min(1, mathHit / Math.max(1, signalMath.size))

  const formatBoost = FORMAT_TALE_BOOST[signals.formatId] ?? []
  if (formatBoost.length) {
    const taleTokens = taleKeywordBag(tale)
    const hit = formatBoost.some(b => taleTokens.includes(b))
    if (hit) score += 0.10
  }

  const goalTags = ctx.goalTags ?? []
  if (goalTags.length && tale.themes?.length) {
    const goalThemes = goalTags.flatMap(g => g.split('_'))
    if (jaccard(goalThemes, tale.themes.map(t => t.toLowerCase())) > 0) score += 0.05
  }

  if (ctx.tutorFocusConcepts?.includes(conceptId)) score += 0.05 * 1.5

  const quality = tale.quality_score ?? tale.math_skin_score ?? 0.5
  score *= 0.85 + 0.15 * Math.min(1, quality)

  return Math.min(1, score)
}

/** Pick best folk tale for a question; null if below threshold. */
export function matchFolkTale(
  q: Question,
  ctx: MatchContext = {},
  bank: FolkTaleEntry[] = FOLK_BANK,
): { tale: FolkTaleEntry; score: number } | null {
  if (!bank.length) return null
  const signals = extractQuestionSignals(q)
  let best: { tale: FolkTaleEntry; score: number } | null = null
  for (const tale of bank) {
    const score = scoreTale(tale, signals, ctx)
    if (!best || score > best.score) best = { tale, score }
  }
  if (!best || best.score < MATCH_THRESHOLD) return null
  return best
}

function buildFolkPayload(tale: FolkTaleEntry, ctx: MatchContext): MatchedSkin {
  const protagonist = tale.characters?.[0]?.name ?? tale.title
  const tone = ctx.goalTags?.length ? goalToneHint(ctx.goalTags) : ''
  const toneNote = tone ? `\n[Student tone: ${tone}]` : ''
  const story = [
    tale.synopsis,
    tale.katha_voice_sample ? `Voice: ${tale.katha_voice_sample}` : '',
    `Setting: ${tale.setting}`,
    `Culture: ${tale.culture}`,
  ].filter(Boolean).join('\n') + toneNote

  return {
    source: 'folk_tale',
    score: tale.math_skin_score ?? 0.5,
    taleId: tale.id,
    taleTitle: tale.title,
    conceptStory: story,
    protagonist,
    setting: tale.setting,
    conceptName: tale.title,
  }
}

/**
 * Full match pipeline: concept story (locked) → folk tale → question context.
 *
 * Concept-lock takes priority over folk-tale rotation. Every concept that has
 * a chapter identity (data/conceptStories.json + questionContextFrames.json —
 * a fixed protagonist/setting, e.g. Simon Stevin for fractions_decimals) must
 * show that SAME protagonist in Practice, not a different, unrelated folk
 * tale (e.g. Kwame). Two reasons this was chosen over keeping folk-tale
 * rotation as primary:
 *   1. The art is concept-keyed, not tale-keyed (storyArtFor(conceptId)) — a
 *      folk-tale skin under concept-locked art produced a real world/art
 *      mismatch (a Kwame story stem next to a Simon Stevin ledger photo).
 *      Generating separate art per folk tale per concept isn't scoped.
 *   2. Practice's own local/offline fallback (framedLocalStem in
 *      Practice.tsx) already renders the concept-locked story immediately,
 *      before the Groq story-module response lands. Folk-tale-first here
 *      meant the story could visibly SWAP protagonists mid-session once Groq
 *      responded — worse than just being generic.
 * Folk-tale matching still fires for the handful of concepts with no locked
 * story (not in conceptStories.json) and stays wired for Spark
 * (sparkMatch.ts calls matchFolkTale directly — a separate, goal-driven
 * flow outside the chapter/practice concept-lock system).
 */
export function matchSkinForQuestion(
  q: Question,
  ctx: MatchContext = {},
): MatchedSkin {
  const concept = selectStoryForConcept(q.conceptId)
  if (concept) {
    const tone = ctx.goalTags?.length ? goalToneHint(ctx.goalTags) : ''
    return {
      source: 'concept_story',
      score: 1,
      conceptStory: concept.story + (tone ? `\n[Student tone: ${tone}]` : ''),
      protagonist: concept.protagonist,
      setting: concept.settingLine,
      conceptName: concept.conceptName,
    }
  }

  const folk = matchFolkTale(q, ctx)
  if (folk) {
    const payload = buildFolkPayload(folk.tale, ctx)
    payload.score = folk.score
    return payload
  }

  const fallback = q.storyIntro ?? q.storyContext ?? q.question
  return {
    source: 'question_context',
    score: 0.3,
    conceptStory: fallback,
    protagonist: 'the guide',
    setting: '',
    conceptName: q.conceptId,
  }
}
