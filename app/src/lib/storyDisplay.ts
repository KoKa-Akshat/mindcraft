/**
 * storyDisplay — presentation-layer story framing for bank questions.
 *
 * The JSON bank often still carries textbook stems (OpenStax NWSL tables, Eedi
 * concept-level storyContext). This module rewrites what the student SEES at
 * render time: Florence ward ledgers instead of soccer tables, structured
 * tables instead of newline blobs, concept vignettes instead of random grids.
 */
import type { FormatId, Question } from './questionBank'
import conceptFrames from '../data/questionContextFrames.json'

type Frame = { protagonist?: string; settingLine?: string }

const FRAMES = conceptFrames as Record<string, Frame>

const FLORENCE_WARDS = [
  'Scutari North', 'Scutari East', 'Scutari South', 'Scutari West',
  'Balaclava Ward', 'Renkioi Ward', 'Koulali Ward', 'Sanjak Ward',
  'Hospital Pier', 'Commissary Ward',
]

const OPENSTAX_PREFIX = /^For the following exercises,\s*use the table,?\s*/i

export interface ParsedTable {
  headers: string[]
  rows: string[][]
}

export type StoryVisualKind = 'vignette' | 'polygon' | 'figure' | 'none'

export interface StoryDisplay {
  /** Stem shown to the student (may differ from bank `question`). */
  stem: string
  /** Structured data when the bank embeds a columnar table. */
  table?: ParsedTable
  /** How to illustrate — vignette beats a misleading coord grid. */
  visual: StoryVisualKind
  vignetteId?: string
  polygonSides?: number
  /** Runtime scene when bank `storyContext` mismatches the stem. */
  sceneLine?: string
}

function frameFor(conceptId: string): Frame | undefined {
  return FRAMES[conceptId]
}

function isFlorenceQuestion(q: Question): boolean {
  if (q.conceptId === 'descriptive_statistics') return true
  const p = frameFor(q.conceptId)?.protagonist ?? ''
  return /florence/i.test(p) || /florence/i.test(q.storyContext ?? '')
}

function extractAskLine(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^(Compute|Find|What|Determine|Calculate|Which|How many|Solve)\b/i.test(lines[i])) {
      return lines[i]
    }
  }
  const m = text.match(/(Compute[\s\S]{10,200})/i)
  return m?.[1]?.trim() ?? text.split('\n').filter(Boolean).slice(-1)[0] ?? text
}

/** Parse OpenStax-style newline-separated tables (Team / Points / …). */
export function parseColumnarTable(text: string): ParsedTable | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const teamIdx = lines.findIndex(l => /^Team$/i.test(l))
  if (teamIdx < 0) return null

  const headers = ['Ward', 'Points', 'W', 'L', 'T', 'GF', 'GA']
  const dataStart = teamIdx + 7
  const askIdx = lines.findIndex(
    (l, i) => i >= dataStart && /^(Compute|Find|What|Determine|Calculate)\b/i.test(l),
  )
  const dataLines = askIdx >= 0 ? lines.slice(dataStart, askIdx) : lines.slice(dataStart)
  if (dataLines.length < 7) return null

  const rows: string[][] = []
  for (let i = 0; i + 7 <= dataLines.length; i += 7) {
    const chunk = dataLines.slice(i, i + 7)
    const wardName = FLORENCE_WARDS[rows.length] ?? `Ward ${rows.length + 1}`
    rows.push([wardName, ...chunk.slice(1)])
  }
  return rows.length ? { headers, rows } : null
}

function polygonSidesFromStem(stem: string): number | undefined {
  const m = stem.match(/\bregular\s+(hexagon|octagon|pentagon|heptagon|nonagon|decagon)\b/i)
  if (m) {
    const map: Record<string, number> = {
      pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10,
    }
    return map[m[1].toLowerCase()]
  }
  if (/\binterior angle[s]?\b/i.test(stem) && /\bhexagon\b/i.test(stem)) return 6
  if (/\binterior angle[s]?\b/i.test(stem) && /\boctagon\b/i.test(stem)) return 8
  if (/\binterior angle[s]?\b/i.test(stem) && /\bpentagon\b/i.test(stem)) return 5
  return undefined
}

function reskinTableQuestion(q: Question, table: ParsedTable): StoryDisplay {
  const ask = extractAskLine(q.question)
    .replace(/\bpoints\b/gi, 'weekly patient counts')
    .replace(/\bteams\b/gi, 'wards')
    .replace(OPENSTAX_PREFIX, '')

  const protagonist = frameFor(q.conceptId)?.protagonist ?? 'Florence Nightingale'
  const stem = isFlorenceQuestion(q)
    ? `${protagonist} copied ten ward ledgers onto her table at Scutari — each row is one week's tally. ${ask}`
    : ask

  return {
    stem,
    table,
    visual: 'vignette',
    vignetteId: q.conceptId,
  }
}

function reskinGenericOpenStax(q: Question): StoryDisplay | null {
  if (!OPENSTAX_PREFIX.test(q.question) && !/nwslsoccer|National Women/i.test(q.question)) {
    return null
  }
  const table = parseColumnarTable(q.question)
  if (table) return reskinTableQuestion(q, table)

  const ask = extractAskLine(q.question)
  const protagonist = frameFor(q.conceptId)?.protagonist ?? 'the scholar'
  return {
    stem: `${protagonist} sets the problem on the table. ${ask}`,
    visual: 'vignette',
    vignetteId: q.conceptId,
  }
}

/** Build student-facing stem + visual plan for any bank question. */
export function buildStoryDisplay(q: Question): StoryDisplay {
  const sides = polygonSidesFromStem(q.question)
  if (sides) {
    const protagonist = frameFor(q.conceptId)?.protagonist ?? 'The scholar'
    return {
      stem: q.question,
      visual: 'polygon',
      polygonSides: sides,
      vignetteId: q.conceptId,
      sceneLine: `${protagonist} sketches a regular ${sides}-gon in the sand — every side equal, every corner matching.`,
    }
  }

  if (q.format === 'table' || /\buse the table\b/i.test(q.question)) {
    const table = parseColumnarTable(q.question)
    if (table) return reskinTableQuestion(q, table)
  }

  const openstax = reskinGenericOpenStax(q)
  if (openstax) return openstax

  // Eedi / bulk frames: storyContext carries the scene; keep stem but use vignette not coord grid.
  const needsVignette =
    q.format === 'table'
    || q.format === 'word_problem'
    || /\b(mode|median|mean|table|chart|data set|survey|tally)\b/i.test(q.question)

  if (needsVignette && !/\(Diagram:/i.test(q.question) && q.format !== 'coordinate_graph') {
    return {
      stem: q.question,
      visual: 'vignette',
      vignetteId: q.conceptId,
    }
  }

  if (q.format === 'diagram' || /\(Diagram:/i.test(q.question)) {
    return { stem: q.question, visual: 'figure' }
  }

  return { stem: q.question, visual: 'none' }
}

/** Prefer runtime scene when the bank frame mismatches the stem. */
export function resolveStoryScene(q: Question, display: StoryDisplay): string | undefined {
  if (display.sceneLine) return display.sceneLine
  return q.storyContext
}

export function shouldPreferVignette(
  conceptId: string,
  questionText: string,
  format?: FormatId,
): boolean {
  const d = buildStoryDisplay({
    id: '',
    conceptId,
    level: 2,
    question: questionText,
    choices: [],
    correctIndex: 0,
    explanation: '',
    hints: [],
    format,
  })
  return d.visual === 'vignette'
}
