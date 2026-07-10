/**
 * FigureSpec — thin inferred figure description (F1).
 * Producers: regex inference today; authored Question.figure later.
 * Consumer: InteractiveFigure (Desmos) + QuestionFigure (SVG geometry).
 */
import { parseLinearEquation } from '../components/InteractiveWidget'
import type { FormatId } from './questionBank'
import { inferQuestionFormat } from './questionBank'
import type { StoryDisplay } from './storyDisplay'
import { buildStoryDisplay } from './storyDisplay'

export type GeometryShape =
  | 'triangle'
  | 'circle'
  | 'polygon'
  | 'angle'
  | 'area'
  | 'numberline'

export type FigureSpec =
  | {
      kind: 'graph'
      engine: 'desmos'
      expressions: string[]
      points?: { x: number; y: number; label?: string }[]
      window?: { x: [number, number]; y: [number, number] }
    }
  | {
      kind: 'geometry'
      engine: 'svg'
      shape: GeometryShape
      params?: Record<string, number>
    }

export function diagramCaption(text: string): string | null {
  const m = text.match(/\(Diagram:\s*([^)]{8,280})\)/i)
  return m ? m[1].trim() : null
}

export function decimalMultiply(text: string): { a: number; b: number } | null {
  const m = text.replace(/\$/g, ' ').match(/(\d+\.?\d*)\s*[×x*]\s*(\d+\.?\d*)/)
  if (!m) return null
  const a = parseFloat(m[1])
  const b = parseFloat(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > 1 || b > 1) return null
  if (a === 0 || b === 0) return null
  return { a, b }
}

function formatStub(conceptId: string, question: string) {
  return {
    conceptId,
    question,
    choices: ['', '', '', ''],
    correctIndex: 0,
    level: 1 as const,
    id: '',
    explanation: '',
    hints: [] as string[],
  }
}

function formatDesmosLinear(m: number, c: number): string {
  if (m === 0) return `${c}`
  const slope =
    m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`
  if (c === 0) return slope
  const sign = c > 0 ? '+' : '-'
  return `${slope}${sign}${Math.abs(c)}`
}

function lineToGraphSpec(line: NonNullable<ReturnType<typeof parseLinearEquation>>): FigureSpec {
  if (line.vertical !== undefined) {
    const v = line.vertical
    return {
      kind: 'graph',
      engine: 'desmos',
      expressions: [`x=${v}`],
      window: { x: [v - 5, v + 5], y: [-5, 5] },
    }
  }

  const span = 5
  const y1 = line.m * -span + line.c
  const y2 = line.m * span + line.c
  const yMin = Math.min(y1, y2, 0) - 1
  const yMax = Math.max(y1, y2, 0) + 1

  return {
    kind: 'graph',
    engine: 'desmos',
    expressions: [`y=${formatDesmosLinear(line.m, line.c)}`],
    window: { x: [-span, span], y: [yMin, yMax] },
  }
}

/**
 * Infer a FigureSpec from question text. Returns null when no figure should
 * render or when only a coord-grid sketch applies (handled by QuestionFigure).
 */
export function inferFigureSpec(
  conceptId: string,
  questionText: string,
  format?: FormatId,
  display?: StoryDisplay,
): FigureSpec | null {
  const plan = display ?? buildStoryDisplay({
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

  if (plan.visual === 'vignette' || plan.visual === 'polygon' || plan.table) return null

  const caption = diagramCaption(questionText)
  const line = parseLinearEquation(questionText)
  const dec = decimalMultiply(questionText)
  const fmt = format ?? inferQuestionFormat(formatStub(conceptId, questionText))

  if (line && (fmt === 'coordinate_graph' || Math.abs(line.m) <= 25)) {
    return lineToGraphSpec(line)
  }
  if (dec && (conceptId.includes('fraction') || conceptId.includes('decimal') || fmt === 'number_line')) {
    return { kind: 'geometry', engine: 'svg', shape: 'area', params: { a: dec.a, b: dec.b } }
  }
  if (fmt === 'number_line' || conceptId.includes('fraction') || conceptId.includes('decimal')) {
    return { kind: 'geometry', engine: 'svg', shape: 'numberline' }
  }
  if (conceptId === 'right_triangle_geometry' || /triangle|pythag|hypotenuse/i.test(questionText)) {
    return { kind: 'geometry', engine: 'svg', shape: 'triangle' }
  }
  if (conceptId === 'circles_geometry' || /\bcircle\b|radius|diameter|circumference/i.test(questionText)) {
    return { kind: 'geometry', engine: 'svg', shape: 'circle' }
  }
  if (plan.polygonSides) {
    return { kind: 'geometry', engine: 'svg', shape: 'polygon', params: { sides: plan.polygonSides } }
  }
  if (conceptId === 'lines_angles' || /angle|parallel|transversal/i.test(questionText)) {
    return { kind: 'geometry', engine: 'svg', shape: 'angle' }
  }
  if (fmt === 'coordinate_graph' || conceptId === 'coordinate_geometry' || /graph|coordinate|plotted|slope/i.test(questionText)) {
    return null
  }
  if (fmt === 'diagram' || caption) {
    if (/rectangle|square|area|volume/i.test(questionText)) {
      return { kind: 'geometry', engine: 'svg', shape: 'area' }
    }
    return null
  }

  return null
}
