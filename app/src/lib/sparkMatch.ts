import storyCellsData from '../data/storyCells.json'
import type { Question } from './questionBank'
import {
  matchFolkTale,
  type FolkTaleEntry,
  type MatchContext,
} from './storyMatch'
import mathSkinTopRaw from '../data/mathSkinTop.json'
import { weaveSparkIntro, type SparkScene } from './sparkNarrative'

export interface SparkWorldFeedback {
  correct: string
  incorrect: string
}

export interface SparkMatchResult {
  tale: FolkTaleEntry
  taleScore: number
  question: Question
  scene: SparkScene
  worldFeedback: SparkWorldFeedback
  conceptId: string
}

const FOLK_BANK: FolkTaleEntry[] = Array.isArray(
  (mathSkinTopRaw as unknown as { tales?: FolkTaleEntry[] }).tales,
)
  ? (mathSkinTopRaw as unknown as { tales: FolkTaleEntry[] }).tales
  : []

const FALLBACK_TALE: FolkTaleEntry = FOLK_BANK[0] ?? {
  id: 'folk_spark_fallback',
  title: 'The First Scene',
  culture: 'MindCraft',
  region: 'Your world',
  synopsis: 'A story where the math you need shows up inside what you already care about.',
  setting: 'somewhere that matters to you',
  themes: ['discovery'],
  concept_affinity: ['fractions_decimals'],
  concept_affinity_scores: { fractions_decimals: 0.7 },
  math_skin_score: 0.5,
  quality_score: 0.5,
}

const INTEREST_LEXICON: Record<string, { themes: string[]; concepts: string[]; keywords: string[] }> = {
  basketball: { themes: ['competition', 'teamwork', 'pattern'], concepts: ['ratios_proportions', 'linear_equations'], keywords: ['court', 'score', 'rhythm'] },
  cooking: { themes: ['trade', 'community', 'fairness'], concepts: ['fractions_decimals', 'ratios_proportions'], keywords: ['recipe', 'share', 'portion'] },
  music: { themes: ['rhythm', 'discipline', 'pattern'], concepts: ['fractions_decimals', 'sequences_series'], keywords: ['beat', 'tempo', 'count'] },
  fashion: { themes: ['pattern', 'design'], concepts: ['geometric_transformations', 'ratios_proportions'], keywords: ['fabric', 'symmetry', 'measure'] },
  gaming: { themes: ['strategy', 'cleverness'], concepts: ['basic_probability', 'linear_equations'], keywords: ['level', 'odds', 'route'] },
  soccer: { themes: ['competition', 'teamwork'], concepts: ['ratios_proportions'], keywords: ['field', 'angle', 'pass'] },
  football: { themes: ['competition', 'teamwork'], concepts: ['ratios_proportions'], keywords: ['field', 'angle', 'pass'] },
  art: { themes: ['pattern', 'design'], concepts: ['geometric_transformations', 'coordinate_geometry'], keywords: ['canvas', 'shape', 'line'] },
  travel: { themes: ['journey', 'navigation'], concepts: ['coordinate_geometry', 'right_triangle_geometry'], keywords: ['map', 'bearing', 'distance'] },
  money: { themes: ['trade', 'fairness'], concepts: ['fractions_decimals', 'linear_equations'], keywords: ['budget', 'cost', 'percent'] },
  space: { themes: ['journey', 'discovery'], concepts: ['coordinate_geometry', 'functions_basics'], keywords: ['orbit', 'scale', 'distance'] },
  animals: { themes: ['community', 'cleverness'], concepts: ['basic_probability', 'ratios_proportions'], keywords: ['herd', 'pack', 'count'] },
  building: { themes: ['discipline', 'design'], concepts: ['area_volume', 'right_triangle_geometry'], keywords: ['blueprint', 'measure', 'angle'] },
  dance: { themes: ['rhythm', 'pattern'], concepts: ['fractions_decimals', 'ratios_proportions'], keywords: ['beat', 'step', 'count'] },
  science: { themes: ['discovery', 'pattern'], concepts: ['descriptive_statistics', 'basic_probability'], keywords: ['lab', 'data', 'measure'] },
  books: { themes: ['mentorship', 'cleverness'], concepts: ['linear_equations', 'ratios_proportions'], keywords: ['story', 'chapter', 'count'] },
  film: { themes: ['journey', 'design'], concepts: ['ratios_proportions', 'coordinate_geometry'], keywords: ['frame', 'scene', 'scale'] },
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
}

function expandInterest(interest: string) {
  const tokens = tokenize(interest)
  const themes = new Set<string>()
  const concepts = new Set<string>()
  const keywords = new Set<string>(tokens)

  for (const [key, entry] of Object.entries(INTEREST_LEXICON)) {
    const hit = tokens.some(t => t.includes(key) || key.includes(t))
      || interest.toLowerCase().includes(key)
    if (hit) {
      entry.themes.forEach(t => themes.add(t))
      entry.concepts.forEach(c => concepts.add(c))
      entry.keywords.forEach(k => keywords.add(k))
    }
  }

  return { themes: [...themes], concepts: [...concepts], keywords: [...keywords] }
}

function scoreTaleForInterests(tale: FolkTaleEntry, interests: string[]): number {
  const expanded = interests.map(expandInterest)
  const allThemes = expanded.flatMap(e => e.themes)
  const allConcepts = expanded.flatMap(e => e.concepts)
  const allKeywords = expanded.flatMap(e => e.keywords)

  const taleThemes = (tale.themes ?? []).map(t => t.toLowerCase())
  const taleKeywords = [
    ...(tale.keywords ?? []),
    tale.title,
    tale.culture,
    tale.region,
  ].join(' ').toLowerCase().split(/\s+/)

  let themeHit = 0
  for (const th of allThemes) if (taleThemes.includes(th)) themeHit++
  const themeScore = allThemes.length ? themeHit / allThemes.length : 0

  let kwHit = 0
  for (const kw of allKeywords) if (taleKeywords.some(t => t.includes(kw) || kw.includes(t))) kwHit++
  const kwScore = allKeywords.length ? kwHit / allKeywords.length : 0

  let conceptScore = 0
  for (const c of allConcepts) {
    const aff = tale.concept_affinity_scores?.[c]
      ?? (tale.concept_affinity?.includes(c) ? 0.6 : 0)
    conceptScore = Math.max(conceptScore, aff)
  }
  if (!allConcepts.length && tale.concept_affinity_scores) {
    conceptScore = Math.max(...Object.values(tale.concept_affinity_scores))
  }

  const quality = tale.quality_score ?? tale.math_skin_score ?? 0.5
  return (0.35 * themeScore + 0.3 * kwScore + 0.35 * conceptScore) * (0.85 + 0.15 * quality)
}

function pickConcept(tale: FolkTaleEntry, interests: string[]): string {
  const expanded = interests.flatMap(i => expandInterest(i).concepts)
  if (expanded.length) {
    const scored = expanded.map(c => ({
      c,
      s: tale.concept_affinity_scores?.[c]
        ?? (tale.concept_affinity?.includes(c) ? 0.65 : 0),
    }))
    scored.sort((a, b) => b.s - a.s)
    if (scored[0]?.s > 0) return scored[0].c
  }
  const aff = tale.concept_affinity ?? []
  if (aff.length) return aff[0]
  const scores = tale.concept_affinity_scores ?? {}
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return best?.[0] ?? 'fractions_decimals'
}

function worldFeedbackForQuestion(q: Question): SparkWorldFeedback {
  const cells = (storyCellsData as { cells?: Record<string, unknown>[] }).cells ?? []
  const cell = cells.find(c => String(c.id) === q.id)
  const wf = cell?.world_feedback as SparkWorldFeedback | undefined
  if (wf?.correct && wf?.incorrect) return wf
  return {
    correct: 'The route ahead opens a little wider — you read the scene correctly.',
    incorrect: 'Pause — notice what the last scene was really asking. The pattern is still there.',
  }
}

function pickQuestionFromCells(conceptId: string): Question | undefined {
  const cells = (storyCellsData as { cells?: Record<string, unknown>[] }).cells ?? []
  const match = cells.find(c => String(c.conceptId) === conceptId && c.storyIntro)
    ?? cells.find(c => String(c.conceptId) === conceptId)
  if (!match) return undefined
  const c = match as Record<string, unknown>
  const choices = (c.choices as string[]) ?? []
  return {
    id: String(c.id ?? ''),
    conceptId: String(c.conceptId ?? ''),
    level: (Number(c.level) || 2) as 1 | 2 | 3,
    question: String(c.question ?? ''),
    choices,
    correctIndex: Number(c.correctIndex ?? 0),
    explanation: String(c.explanation ?? c.correct_reasoning ?? ''),
    hints: Array.isArray(c.hints) ? (c.hints as string[]).slice(0, 3) : [],
    storyContext: typeof c.storyContext === 'string' ? c.storyContext : undefined,
    storyIntro: typeof c.storyIntro === 'string' ? c.storyIntro : undefined,
    distractor_taxonomy: Array.isArray(c.distractor_taxonomy)
      ? (c.distractor_taxonomy as Question['distractor_taxonomy'])
      : undefined,
  }
}

/** Async — question bank is loaded only when matching, not on page load. */
export async function matchSparkExperience(interests: string[]): Promise<SparkMatchResult> {
  const cleaned = interests.map(i => i.trim()).filter(Boolean).slice(0, 4)
  const ctx: MatchContext = { goalText: cleaned.join(', ') }

  let bestTale: FolkTaleEntry = FALLBACK_TALE
  let bestScore = -1
  for (const tale of FOLK_BANK) {
    const s = scoreTaleForInterests(tale, cleaned)
    if (s > bestScore) {
      bestScore = s
      bestTale = tale
    }
  }

  if (bestScore < 0.15) {
    const folk = matchFolkTale(
      { id: 'spark_probe', conceptId: 'fractions_decimals', level: 2, question: cleaned.join(' '), choices: [], correctIndex: 0, explanation: '', hints: [] },
      ctx,
    )
    if (folk) {
      bestTale = folk.tale
      bestScore = folk.score
    }
  }

  const conceptId = pickConcept(bestTale, cleaned)

  let question = pickQuestionFromCells(conceptId)

  if (!question) {
    const { getStoryCell, getQuestions } = await import('./questionBank')
    question = getStoryCell(conceptId, 2)
      ?? getStoryCell(conceptId)
      ?? getQuestions(conceptId, 2, 1, [], 'General', undefined, true)[0]
      ?? getQuestions('fractions_decimals', 2, 1, [], 'General', undefined, true)[0]
  }

  if (!question?.question || !question.choices?.length) {
    throw new Error('No playable spark question in bank')
  }

  const scene = weaveSparkIntro(cleaned, bestTale, question)
  return {
    tale: bestTale,
    taleScore: bestScore,
    question,
    scene,
    worldFeedback: worldFeedbackForQuestion(question),
    conceptId,
  }
}

export function interestHue(interest: string): number {
  let h = 0
  for (let i = 0; i < interest.length; i++) h = ((h << 5) - h + interest.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}
