/**
 * Dynamic "For this batch" copy for Chapter Notes.
 * Built from the actual question draw for this chapter open — so a new
 * shuffle gets a new briefing. Does not touch question.hints UI; may read
 * hint text as coach focus lines only.
 */
import { questionFormat, type Question } from './questionBank'

export type BatchBriefCard = {
  title: string
  body: string
}

export type ChapterBatchBrief = {
  /** One-line summary of what this draw leans on. */
  lead: string
  /** Short chips: formats / levels present in the draw. */
  chips: string[]
  /** 1–3 focus cards (coach lines or stem peeks — never the answer key). */
  cards: BatchBriefCard[]
}

const FORMAT_LABEL: Record<string, string> = {
  word_problem: 'Word problems',
  diagram: 'Diagrams',
  number_line: 'Number lines',
  symbolic_expression: 'Symbolic',
  coordinate_graph: 'Graphs',
  table: 'Tables',
}

function stripDiagramNoise(text: string): string {
  return text
    .replace(/\(Diagram:[^)]*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stemPeek(q: Question, max = 88): string {
  const clean = stripDiagramNoise(q.question)
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`
}

function hashSeed(ids: string[]): number {
  let h = 0
  for (const id of ids) {
    for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0
  }
  return h
}

/** Build a brief that changes when the chapter question draw changes. */
export function buildChapterBatchBrief(questions: Question[]): ChapterBatchBrief {
  if (questions.length === 0) {
    return {
      lead: 'No questions in this draw yet. Open again after the bank loads.',
      chips: [],
      cards: [],
    }
  }

  const formatCounts = new Map<string, number>()
  const levelCounts = new Map<number, number>()
  for (const q of questions) {
    const fmt = questionFormat(q) ?? q.format ?? 'symbolic_expression'
    formatCounts.set(fmt, (formatCounts.get(fmt) ?? 0) + 1)
    levelCounts.set(q.level, (levelCounts.get(q.level) ?? 0) + 1)
  }

  const topFormats = [...formatCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const formatBits = topFormats.map(([fmt, n]) => {
    const label = FORMAT_LABEL[fmt] ?? fmt.replace(/_/g, ' ')
    return n === 1 ? label : `${label} (${n})`
  })

  const levelBits = [...levelCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lv, n]) => `L${lv}×${n}`)

  const chips = [...formatBits.slice(0, 2), ...levelBits]

  const lead = formatBits.length
    ? `This draw (${questions.length} Qs) leans on ${formatBits.join(', ')}. Read the rules once, then write.`
    : `This draw has ${questions.length} questions. Read the rules once, then write.`

  const seed = hashSeed(questions.map(q => q.id))
  const order = questions.map((_, i) => i)
  // Stable shuffle from seed so the same draw keeps the same brief.
  for (let i = order.length - 1; i > 0; i--) {
    const j = (seed + i * 17) % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  const cards: BatchBriefCard[] = []
  for (const idx of order) {
    if (cards.length >= 3) break
    const q = questions[idx]
    const hint = (q.hints?.[0] ?? '').trim()
    if (hint && hint.length >= 12) {
      cards.push({
        title: 'Coach focus',
        body: hint.length > 140 ? `${hint.slice(0, 137).trim()}…` : hint,
      })
      continue
    }
    cards.push({
      title: 'You will see',
      body: stemPeek(q),
    })
  }

  // Prefer mixing one stem peek if we only got coach lines.
  if (cards.length >= 2 && cards.every(c => c.title === 'Coach focus')) {
    const peekQ = questions[order[0]]
    cards[cards.length - 1] = { title: 'You will see', body: stemPeek(peekQ) }
  }

  return { lead, chips, cards }
}
