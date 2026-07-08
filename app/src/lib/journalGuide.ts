/**
 * journalGuide — deterministic margin insights for the field journal.
 * Agent phrasing follows DASHBOARD_NOTEBOOK_SPEC §5.2: ≤12 words, mentor
 * marginalia, never "try again" — point at what to see differently.
 */
import type { CheckWorkResult } from './mlApi'
import type { ScratchInkState } from '../components/ScratchTranscriptionPane'
import type { ScratchStrokeData } from '../types'

export type GuideInsightKind = 'focus' | 'nudge' | 'encourage' | 'watch' | 'read'

export interface GuideInsight {
  id: string
  kind: GuideInsightKind
  text: string
  priority: number
}

export interface HighlightSpan {
  phrase: string
  kind: 'ask' | 'given' | 'focus'
}

const ASK_VERBS = /\b(find|solve for|determine|calculate|compute|how many|how much|which|evaluate|choose|select|identify|simplify|expand|factorise|factorize|write)\b/i

const MATH_FOCUS = [
  /\b(interior angles?)\b/i,
  /\b(regular\s+(?:hexagon|pentagon|octagon|heptagon|nonagon|decagon))\b/i,
  /\b(hexagon|pentagon|octagon|heptagon|nonagon|decagon)\b/i,
  /\b(mode|median|mean|range|standard deviation)\b/i,
  /\b(congruent|parallel|perpendicular|hypotenuse|circumference|diameter|radius|slope|vertex)\b/i,
  /\b(probability|ratio|proportion)\b/i,
]

function clipWords(text: string, max = 12): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(' ')
  return words.slice(0, max).join(' ') + '…'
}

/** Phrases worth a highlighter stroke on the question stem (one focus max). */
export function extractHighlights(questionText: string): HighlightSpan[] {
  const plain = questionText
    .replace(/\(Diagram:[^)]+\)/gi, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const spans: HighlightSpan[] = []

  // Math vocabulary beats generic "what is" / article phrases.
  for (const re of MATH_FOCUS) {
    const m = plain.match(re)
    if (m?.[0]) {
      spans.push({ phrase: m[0], kind: 'focus' })
      break
    }
  }

  const whatIs = plain.match(/\bwhat is (?:the )?([a-z][\w\s-]{2,32}?)(?:\s+(?:of|for|in)\b|[?.!,]|$)/i)
  if (whatIs?.[1] && !spans.length) {
    spans.push({ phrase: whatIs[1].trim(), kind: 'focus' })
  }

  const askMatch = plain.match(ASK_VERBS)
  if (askMatch?.[0]) {
    spans.push({ phrase: askMatch[0], kind: 'ask' })
  }

  const numMatch = plain.match(/\b\d+(?:\.\d+)?\b/)
  if (numMatch?.[0]) spans.push({ phrase: numMatch[0], kind: 'given' })

  if (!spans.some(s => s.kind === 'focus' || s.kind === 'ask')) {
    const focusMatch = plain.match(/\b(?:the|a|an)\s+[a-z][\w\s-]{2,28}/i)
    if (focusMatch?.[0] && (focusMatch.index ?? 0) > 5) {
      spans.push({ phrase: focusMatch[0].trim(), kind: 'focus' })
    }
  }

  return spans.slice(0, 3)
}

export interface GuideContext {
  conceptId: string
  questionText: string
  strokeData?: ScratchStrokeData | null
  inkState?: ScratchInkState | null
  transcribing?: boolean
  workCheck?: CheckWorkResult | null
  answerSelected?: boolean
  elapsedMs?: number
  coachNote?: string | null
}

export function buildGuideInsights(ctx: GuideContext): GuideInsight[] {
  const insights: GuideInsight[] = []
  const strokes = ctx.strokeData?.strokes?.length ?? 0
  const lines = ctx.inkState?.workLines ?? []
  const filledLines = lines.filter(l => l.text.trim() || l.latex.trim()).length
  const elapsed = ctx.elapsedMs ?? 0

  if (ctx.coachNote?.trim()) {
    insights.push({
      id: 'coach',
      kind: 'nudge',
      text: clipWords(ctx.coachNote),
      priority: 95,
    })
  }

  if (!strokes && elapsed > 6000 && !ctx.answerSelected) {
    insights.push({
      id: 'start-writing',
      kind: 'nudge',
      text: 'Sketch the first step — even a guess counts.',
      priority: 80,
    })
  }

  if (strokes && filledLines === 0 && ctx.transcribing) {
    insights.push({
      id: 'reading',
      kind: 'read',
      text: 'Reading your ink…',
      priority: 70,
    })
  }

  if (filledLines === 1 && !ctx.answerSelected) {
    insights.push({
      id: 'one-line',
      kind: 'encourage',
      text: 'Good — keep steps moving down the page.',
      priority: 65,
    })
  }

  const wrongLine = lines.find(l => l.verdict === 'wrong')
  if (wrongLine?.checkReason) {
    insights.push({
      id: 'wrong-step',
      kind: 'watch',
      text: clipWords(wrongLine.checkReason.replace(/^try again/i, 'Check')),
      priority: 90,
    })
  } else if (ctx.workCheck?.hypothesis?.label) {
    insights.push({
      id: 'hypothesis',
      kind: 'watch',
      text: clipWords(ctx.workCheck.hypothesis.label),
      priority: 88,
    })
  }

  if (filledLines >= 2 && !wrongLine && ctx.workCheck?.verdictPerLine.every(v => v.verdict === 'ok')) {
    insights.push({
      id: 'chain-ok',
      kind: 'encourage',
      text: 'That chain looks consistent so far.',
      priority: 60,
    })
  }

  if (!strokes && !ctx.answerSelected && elapsed > 12000) {
    insights.push({
      id: 'ink-first',
      kind: 'focus',
      text: 'Write before you tap — your ink is the evidence.',
      priority: 75,
    })
  }

  if (ctx.conceptId.includes('fraction') || ctx.conceptId.includes('decimal')) {
    insights.push({
      id: 'format-hint',
      kind: 'focus',
      text: 'Name what the numbers represent first.',
      priority: 40,
    })
  }

  if (/\bgraph\b|\bslope\b|\bcoordinate\b/i.test(ctx.questionText)) {
    insights.push({
      id: 'graph-hint',
      kind: 'focus',
      text: 'Picture the graph before the algebra.',
      priority: 42,
    })
  }

  return insights
}

export function topInsights(insights: GuideInsight[], max = 3): GuideInsight[] {
  return [...insights]
    .sort((a, b) => b.priority - a.priority)
    .filter((item, idx, arr) => arr.findIndex(x => x.text === item.text) === idx)
    .slice(0, max)
}

const QUESTION_IDS = new Set(['format-hint', 'graph-hint', 'ink-first'])

/** Split insights across the two-page spread. */
export function insightsForSide(insights: GuideInsight[], side: 'question' | 'work'): GuideInsight[] {
  if (side === 'question') {
    return insights.filter(i => i.kind === 'focus' || QUESTION_IDS.has(i.id))
  }
  return insights.filter(i => i.kind !== 'focus' && !QUESTION_IDS.has(i.id))
}

export function buildJarvisCoachPrompt(ctx: GuideContext): { message: string; context: string } {
  const work = (ctx.inkState?.workLines ?? [])
    .map((l, i) => `L${i + 1}: ${l.latex || l.text}`)
    .join('\n')

  return {
    message: [
      'Margin-note mode. Reply with ONE sentence, max 12 words.',
      'Mentor marginalia — point at what to notice, never the answer.',
      'Never say "try again". No exclamation marks.',
    ].join(' '),
    context: [
      `Concept: ${ctx.conceptId}`,
      `Question: ${ctx.questionText.slice(0, 200)}`,
      work ? `Student work:\n${work}` : 'Student work: (empty)',
      ctx.workCheck?.hypothesis?.label ? `Engine hint: ${ctx.workCheck.hypothesis.label}` : '',
    ].filter(Boolean).join('\n'),
  }
}
