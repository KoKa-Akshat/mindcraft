/**
 * QuestionFigure — lightweight SVG sketches for diagram / graph / shape questions.
 * Complements InteractiveWidget manipulatives (dice, spinner). Always degrades gracefully.
 */
import type { ReactNode } from 'react'
import { parseLinearEquation } from './InteractiveWidget'
import type { FormatId } from '../lib/questionBank'
import { inferQuestionFormat } from '../lib/questionBank'
import type { StoryDisplay } from '../lib/storyDisplay'
import { buildStoryDisplay } from '../lib/storyDisplay'
import {
  diagramCaption,
  decimalMultiply,
  inferFigureSpec,
  type GeometryShape,
} from '../lib/figureSpec'
import s from './QuestionFigure.module.css'

interface Theme {
  accent: string
  ink: string
  dim: string
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

export function shouldRenderFigure(
  conceptId: string,
  questionText: string,
  format?: FormatId,
  display?: StoryDisplay,
): boolean {
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

  if (plan.visual === 'vignette' || plan.visual === 'polygon') return false
  if (plan.table) return false

  const fmt = format ?? inferQuestionFormat(formatStub(conceptId, questionText))
  if (fmt === 'diagram' || fmt === 'coordinate_graph' || fmt === 'number_line') return true
  if (diagramCaption(questionText)) return true
  if (parseLinearEquation(questionText)) return true
  if (decimalMultiply(questionText)) return true
  const visualWords = /\b(triangle|circle|graph|diagram|coordinate|grid|rectangle|square|polygon|number line)\b/i
  if (visualWords.test(questionText)) return true
  if (/\bangle\b/i.test(questionText)) return true
  return false
}

function AreaModel({ a, b, theme }: { a: number; b: number; theme: Theme }) {
  const w = 200
  const h = 120
  const aw = Math.round(a * w)
  const bh = Math.round(b * h)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={s.fig} aria-hidden>
      <rect x={0} y={0} width={w} height={h} fill="none" stroke={theme.dim} strokeOpacity={0.25} />
      <rect x={0} y={0} width={aw} height={bh} fill={theme.accent} fillOpacity={0.18} stroke={theme.accent} strokeWidth={1.5} />
      <text x={4} y={12} fontSize={9} fill={theme.dim}>{a} × {b}</text>
    </svg>
  )
}

function NumberLine({ theme }: { theme: Theme }) {
  return (
    <svg viewBox="0 0 220 48" className={s.figWide} aria-hidden>
      <line x1={12} y1={24} x2={208} y2={24} stroke={theme.ink} strokeOpacity={0.45} strokeWidth={1.5} />
      {[0, 0.25, 0.5, 0.75, 1].map((v, i) => {
        const x = 12 + v * 196
        return (
          <g key={i}>
            <line x1={x} y1={18} x2={x} y2={30} stroke={theme.ink} strokeOpacity={0.35} />
            <text x={x} y={42} textAnchor="middle" fontSize={8} fill={theme.dim}>{v}</text>
          </g>
        )
      })}
    </svg>
  )
}

function RightTriangle({ theme }: { theme: Theme }) {
  return (
    <svg viewBox="0 0 160 100" className={s.fig} aria-hidden>
      <polygon points="20,85 140,85 20,25" fill={theme.accent} fillOpacity={0.12} stroke={theme.accent} strokeWidth={1.8} />
      <rect x={20} y={73} width={12} height={12} fill="none" stroke={theme.dim} strokeOpacity={0.5} />
    </svg>
  )
}

function CircleFigure({ theme }: { theme: Theme }) {
  return (
    <svg viewBox="0 0 120 120" className={s.fig} aria-hidden>
      <circle cx={60} cy={60} r={42} fill="none" stroke={theme.accent} strokeWidth={1.8} />
      <line x1={60} y1={60} x2={102} y2={60} stroke={theme.accent} strokeWidth={1.2} strokeDasharray="4 3" />
      <text x={78} y={56} fontSize={9} fill={theme.dim}>r</text>
    </svg>
  )
}

function AreaSketch({ theme }: { theme: Theme }) {
  return (
    <svg viewBox="0 0 180 112" className={s.figWide} aria-hidden>
      <rect x={26} y={24} width={128} height={64} rx={4} fill={theme.accent} fillOpacity={0.10} stroke={theme.accent} strokeWidth={1.8} />
      <line x1={26} y1={94} x2={154} y2={94} stroke={theme.dim} strokeOpacity={0.35} />
      <line x1={20} y1={24} x2={20} y2={88} stroke={theme.dim} strokeOpacity={0.35} />
      <text x={90} y={108} textAnchor="middle" fontSize={10} fill={theme.dim}>length</text>
      <text x={10} y={60} textAnchor="middle" fontSize={10} fill={theme.dim} transform="rotate(-90 10 60)">width</text>
    </svg>
  )
}

function AngleFigure({ theme }: { theme: Theme }) {
  return (
    <svg viewBox="0 0 160 90" className={s.figWide} aria-hidden>
      <line x1={20} y1={70} x2={140} y2={70} stroke={theme.ink} strokeOpacity={0.5} strokeWidth={1.5} />
      <line x1={80} y1={70} x2={130} y2={25} stroke={theme.accent} strokeWidth={1.8} />
      <path d="M 92 70 A 18 18 0 0 0 86 56" fill="none" stroke={theme.accent} strokeWidth={1.2} />
    </svg>
  )
}

/** Regular n-gon for hexagon / pentagon / octagon stems. */
export function RegularPolygonFigure({ sides, theme }: { sides: number; theme: Theme }) {
  const cx = 80
  const cy = 80
  const r = 52
  const pts: string[] = []
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides - Math.PI / 2
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
  }
  return (
    <svg viewBox="0 0 160 160" className={s.fig} aria-hidden>
      <polygon
        points={pts.join(' ')}
        fill={theme.accent}
        fillOpacity={0.12}
        stroke={theme.accent}
        strokeWidth={2}
      />
      <circle cx={cx} cy={cy} r={3} fill={theme.accent} fillOpacity={0.5} />
    </svg>
  )
}

function CoordGrid({ theme }: { theme: Theme }) {
  const n = 160
  const p = 14
  const lines: number[] = []
  for (let i = -2; i <= 2; i++) lines.push(i)
  const scale = (n - 2 * p) / 4
  const tx = (x: number) => n / 2 + x * scale
  const ty = (y: number) => n / 2 - y * scale
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className={s.fig} aria-hidden>
      {lines.map(v => (
        <g key={v}>
          <line x1={tx(v)} y1={p} x2={tx(v)} y2={n - p} stroke={theme.dim} strokeOpacity={0.14} />
          <line x1={p} y1={ty(v)} x2={n - p} y2={ty(v)} stroke={theme.dim} strokeOpacity={0.14} />
        </g>
      ))}
      <line x1={p} y1={ty(0)} x2={n - p} y2={ty(0)} stroke={theme.ink} strokeOpacity={0.45} />
      <line x1={tx(0)} y1={p} x2={tx(0)} y2={n - p} stroke={theme.ink} strokeOpacity={0.45} />
    </svg>
  )
}

function LineGraphMini({ m, c, vertical, label, theme }: { m: number; c: number; vertical?: number; label: string; theme: Theme }) {
  const size = 180
  const pad = 12
  const span = 5
  const scale = (size - 2 * pad) / (2 * span)
  const toX = (x: number) => size / 2 + x * scale
  const toY = (y: number) => size / 2 - y * scale
  let x1: number, y1: number, x2: number, y2: number
  if (vertical !== undefined) {
    x1 = x2 = vertical; y1 = -span; y2 = span
  } else {
    x1 = -span; y1 = m * -span + c
    x2 = span; y2 = m * span + c
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={s.fig} role="img" aria-label={`Graph of ${label}`}>
      <line x1={pad} y1={toY(0)} x2={size - pad} y2={toY(0)} stroke={theme.ink} strokeOpacity={0.35} />
      <line x1={toX(0)} y1={pad} x2={toX(0)} y2={size - pad} stroke={theme.ink} strokeOpacity={0.35} />
      <line x1={toX(x1)} y1={toY(y1)} x2={toX(x2)} y2={toY(y2)} stroke={theme.accent} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  )
}

function renderGeometry(shape: GeometryShape, params: Record<string, number> | undefined, theme: Theme): ReactNode {
  switch (shape) {
    case 'area':
      if (params?.a !== undefined && params?.b !== undefined) {
        return <AreaModel a={params.a} b={params.b} theme={theme} />
      }
      return <AreaSketch theme={theme} />
    case 'numberline':
      return <NumberLine theme={theme} />
    case 'triangle':
      return <RightTriangle theme={theme} />
    case 'circle':
      return <CircleFigure theme={theme} />
    case 'polygon':
      return <RegularPolygonFigure sides={params?.sides ?? 6} theme={theme} />
    case 'angle':
      return <AngleFigure theme={theme} />
    default:
      return null
  }
}

function renderCoordGridFallback(
  conceptId: string,
  questionText: string,
  format: FormatId | undefined,
  caption: string | null,
  theme: Theme,
): ReactNode {
  const fmt = format ?? inferQuestionFormat(formatStub(conceptId, questionText))
  if (fmt === 'coordinate_graph' || conceptId === 'coordinate_geometry' || /graph|coordinate|plotted|slope/i.test(questionText)) {
    return <CoordGrid theme={theme} />
  }
  if (fmt === 'diagram' || caption) {
    return /rectangle|square|area|volume/i.test(questionText)
      ? <AreaSketch theme={theme} />
      : <CoordGrid theme={theme} />
  }
  return null
}

export default function QuestionFigure({
  conceptId,
  questionText,
  format,
  theme,
  display,
}: {
  conceptId: string
  questionText: string
  format?: FormatId
  theme: Theme
  display?: StoryDisplay
}) {
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
  if (!shouldRenderFigure(conceptId, questionText, format, plan)) return null

  const caption = diagramCaption(questionText)
  const spec = inferFigureSpec(conceptId, questionText, format, plan)
  const line = parseLinearEquation(questionText)

  let body: ReactNode = null

  if (spec?.kind === 'graph') {
    body = line ? <LineGraphMini {...line} theme={theme} /> : null
  } else if (spec?.kind === 'geometry') {
    body = renderGeometry(spec.shape, spec.params, theme)
  } else {
    body = renderCoordGridFallback(conceptId, questionText, format, caption, theme)
  }

  if (!body) return null

  return (
    <figure className={s.wrap}>
      {body}
      {caption && <figcaption className={s.caption} style={{ color: theme.dim }}>{caption}</figcaption>}
    </figure>
  )
}
