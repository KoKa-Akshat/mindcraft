/**
 * api/spark-experience.ts
 *
 * First Spark — interest → matched bank question → Groq story skin.
 * POST { interests: string[] } → personalized scene + question payload.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../lib/cors'
import bankData from '../data/spark-bank.json'

const GROQ_MODEL = 'meta-llama/llama-3.3-70b-versatile'
const MAX_INTERESTS = 6

interface BankQuestion {
  id: string
  conceptId: string
  level: number
  title?: string
  question: string
  choices: string[]
  correctIndex: number
  storyIntro?: string
  storyContext?: string
  world_feedback?: { correct: string; incorrect: string }
}

interface BankTale {
  id: string
  title: string
  setting: string
  protagonist?: string
  synopsis: string
  themes?: string[]
  keywords?: string[]
  concept_affinity?: string[]
  concept_affinity_scores?: Record<string, number>
}

const QUESTIONS = (bankData as { questions: BankQuestion[] }).questions ?? []
const TALES = (bankData as { tales: BankTale[] }).tales ?? []

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'is', 'are', 'my', 'i', 'me'])

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w))
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

function interestBag(interests: string[]): string[] {
  return interests.flatMap(i => tokenize(i))
}

function scoreTale(tale: BankTale, interests: string[]): number {
  const bag = interestBag(interests)
  const taleBag = tokenize([
    tale.synopsis,
    tale.title,
    tale.setting,
    ...(tale.keywords ?? []),
    ...(tale.themes ?? []),
  ].join(' '))
  let score = jaccard(bag, taleBag)
  // Substring rescue for compound interests ("music production", "rock climbing")
  for (const interest of interests) {
    const lower = interest.toLowerCase()
    if (tale.synopsis.toLowerCase().includes(lower)) score += 0.15
    if ((tale.keywords ?? []).some(k => lower.includes(k) || k.includes(lower))) score += 0.1
  }
  const quality = 0.85
  return score * quality
}

function pickConcept(tale: BankTale, interests: string[]): string {
  const bag = interestBag(interests)
  let best = tale.concept_affinity?.[0] ?? 'fractions_decimals'
  let bestScore = -1
  const scores = tale.concept_affinity_scores ?? {}
  for (const [concept, s] of Object.entries(scores)) {
    const conceptTokens = tokenize(concept.replace(/_/g, ' '))
    const overlap = jaccard(bag, conceptTokens)
    const total = s * 0.6 + overlap * 0.4
    if (total > bestScore) { bestScore = total; best = concept }
  }
  return best
}

function hashInterests(interests: string[]): number {
  let h = 0
  for (const s of interests.join('|')) {
    h = ((h << 5) - h + s.charCodeAt(0)) | 0
  }
  return Math.abs(h)
}

function pickQuestion(conceptId: string, interests: string[]): BankQuestion {
  const pool = QUESTIONS.filter(q => q.conceptId === conceptId && q.choices?.length >= 2)
  const fallback = QUESTIONS.filter(q => q.choices?.length >= 2)
  const use = pool.length ? pool : fallback
  const idx = hashInterests(interests) % use.length
  return use[idx] ?? use[0]
}

function pickTale(interests: string[]): BankTale {
  let best: BankTale = TALES[0]
  let bestScore = -1
  for (const tale of TALES) {
    const s = scoreTale(tale, interests)
    if (s > bestScore) { bestScore = s; best = tale }
  }
  return best
}

async function groqSparkSkin(
  interests: string[],
  tale: BankTale,
  question: BankQuestion,
): Promise<{ storyIntro: string; storyStem: string; protagonist: string; setting: string } | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  const system = `You are MindCraft's First Spark composer. A new visitor typed what they care about. Wrap ONE real math question inside a story scene that weaves ALL their interests naturally — not as a list, but as one coherent world (person → place → problem).

RULES:
1. NEVER change, remove, or reorder any number, variable, equation, or unit from the original question. Every numeric value MUST appear verbatim in storyStem.
2. Do NOT reveal which multiple-choice answer is correct.
3. storyIntro: 2-3 sentences, immersive, italic-worthy prose. Mention their interests organically.
4. storyStem: the full question re-set in the story (include the mathematical ask). 2-4 sentences.
5. Tone: warm, serious, never "math is fun", no emojis, no shame.
6. Return ONLY JSON: {"storyIntro":"...","storyStem":"...","protagonist":"...","setting":"..."}`

  const user = JSON.stringify({
    interests,
    tale_title: tale.title,
    tale_synopsis: tale.synopsis.slice(0, 500),
    default_protagonist: tale.protagonist ?? tale.title,
    default_setting: tale.setting,
    original_question: question.question,
    choices: question.choices,
    story_context: question.storyContext ?? '',
  })

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.55,
      max_tokens: 900,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) return null
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  const raw = data.choices?.[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    const storyStem = parsed.storyStem ?? question.question
    const nums = question.question.match(/\d+(?:\.\d+)?/g) ?? []
    if (!nums.every(n => storyStem.includes(n))) return null
    return {
      storyIntro: parsed.storyIntro ?? question.storyIntro ?? '',
      storyStem,
      protagonist: parsed.protagonist ?? tale.protagonist ?? 'the guide',
      setting: parsed.setting ?? tale.setting,
    }
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { interests } = (req.body ?? {}) as { interests?: string[] }
  if (!Array.isArray(interests) || interests.length < 1) {
    return res.status(400).json({ error: 'interests[] required' })
  }

  const cleaned = interests
    .map(i => String(i).trim())
    .filter(Boolean)
    .slice(0, MAX_INTERESTS)

  const tale = pickTale(cleaned)
  const conceptId = pickConcept(tale, cleaned)
  const question = pickQuestion(conceptId, cleaned)

  const skin = await groqSparkSkin(cleaned, tale, question)

  const protagonist = skin?.protagonist ?? tale.protagonist ?? tale.title
  const setting = skin?.setting ?? tale.setting
  const storyIntro = skin?.storyIntro
    ?? question.storyIntro
    ?? `You told us you care about ${cleaned.join(', ')}. Tonight the numbers matter inside ${setting}.`
  const storyStem = skin?.storyStem ?? question.question

  return res.status(200).json({
    interests: cleaned,
    taleId: tale.id,
    taleTitle: tale.title,
    conceptId,
    questionId: question.id,
    protagonist,
    setting,
    storyIntro,
    storyStem,
    choices: question.choices,
    correctIndex: question.correctIndex,
    worldFeedback: question.world_feedback ?? {
      correct: 'The scene holds — you read it correctly.',
      incorrect: 'Pause — notice what the scene was really asking.',
    },
    generated: !!skin,
  })
}
