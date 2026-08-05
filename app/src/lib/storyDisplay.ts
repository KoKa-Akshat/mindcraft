/**
 * storyDisplay — presentation-layer display transforms for bank questions.
 *
 * The JSON bank often still carries textbook stems (OpenStax NWSL tables, Eedi
 * concept-level storyContext). This module reformats what the student SEES at
 * render time: structured tables instead of newline blobs, concept vignettes
 * instead of misleading coord grids, regular-polygon figures for named
 * shapes. Narrative sentence-injection (e.g. renaming the table's protagonist
 * / dataset into a story scene) was removed — see ACTIVE_TASK.md. Every
 * branch below must stay a plain VISUAL/layout transform; it must never
 * invent narrative prose for the `stem` field. The future wrapping agent
 * (per CLAUDE.md) is what will add story framing, from `conceptStories.json`
 * + one LLM call — not this module.
 */
import type { FormatId, Question } from './questionBank'
import conceptStories from '../data/conceptStories.json'
import type { ContextFrame } from './storySelection'

const STORIES = conceptStories as Record<string, { contextFrame?: ContextFrame }>

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

function frameFor(conceptId: string): ContextFrame | undefined {
  return STORIES[conceptId]?.contextFrame
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

  const headers = ['Team', 'Points', 'W', 'L', 'T', 'GF', 'GA']
  const dataStart = teamIdx + 7
  const askIdx = lines.findIndex(
    (l, i) => i >= dataStart && /^(Compute|Find|What|Determine|Calculate)\b/i.test(l),
  )
  const dataLines = askIdx >= 0 ? lines.slice(dataStart, askIdx) : lines.slice(dataStart)
  if (dataLines.length < 7) return null

  const rows: string[][] = []
  for (let i = 0; i + 7 <= dataLines.length; i += 7) {
    // Keep the bank's real team name (chunk[0]) — no invented row labels.
    const chunk = dataLines.slice(i, i + 7)
    rows.push(chunk)
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

// Plain layout transform only — no narrative sentence injection (the
// previous "Florence Nightingale copied ten ward ledgers..." framing was
// removed, see ACTIVE_TASK.md). The table itself (real team names, real
// values) is the visual/layout change; the stem is just the bank's ask line.
function reskinTableQuestion(q: Question, table: ParsedTable): StoryDisplay {
  const ask = extractAskLine(q.question).replace(OPENSTAX_PREFIX, '')

  return {
    stem: ask,
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
  return {
    stem: ask,
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
