/**
 * AltDiagramCallout — renders Eedi accessibility alt-text as an actual small
 * diagram when the pattern is recognizable (see lib/altDiagram.ts), instead
 * of the raw description reading like a bug report. Falls back to a lightly
 * cleaned-up caption, clearly framed as a picture description, when it
 * isn't. Shared by HighlightedStem (question stem) and MathText (answer
 * choices, hints — anywhere a `(Diagram: ...)` chunk can appear).
 */
import { useMemo } from 'react'
import { parseAltDiagram, humanizeAltCaption, type DashLineDiagram, type InequalityRayDiagram } from '../lib/altDiagram'
import s from './AltDiagramCallout.module.css'

function DashLineFigure({ diagram, accent }: { diagram: DashLineDiagram; accent: string }) {
  const { count, marks, arrow } = diagram
  const left = 30
  const right = 230
  const y = 40
  const step = count > 1 ? (right - left) / (count - 1) : 0
  const xFor = (i: number) => left + (i - 1) * step

  return (
    <svg viewBox="0 0 260 66" className={s.figure} role="img" aria-label="Number line diagram">
      <line x1={left - 12} y1={y} x2={right + 12} y2={y} stroke={accent} strokeOpacity={0.4} strokeWidth={1.5} />
      {Array.from({ length: count }, (_, k) => k + 1).map(i => (
        <line key={i} x1={xFor(i)} y1={y - 7} x2={xFor(i)} y2={y + 7} stroke={accent} strokeOpacity={0.7} strokeWidth={1.5} />
      ))}
      {marks.map(({ index, label }) => (
        <text key={index} x={xFor(index)} y={y + 24} textAnchor="middle" fontSize={11} fill={accent} fontFamily="var(--tok-font-mono)">
          {label}
        </text>
      ))}
      {arrow && (
        <g transform={`translate(${xFor(arrow.index)} ${arrow.direction === 'up' ? y - 12 : y + 12})`}>
          <path
            d={arrow.direction === 'up' ? 'M0 0 L-6 12 L6 12 Z' : 'M0 0 L-6 -12 L6 -12 Z'}
            fill={arrow.color === 'blue' ? '#1d3a8a' : arrow.color === 'red' ? '#c1121f' : accent}
          />
        </g>
      )}
    </svg>
  )
}

function InequalityRayFigure({ diagram, accent }: { diagram: InequalityRayDiagram; accent: string }) {
  const { value, filled, direction } = diagram
  const left = 20
  const right = 240
  const cx = 130 // the marked value sits at the visual center; ticks around it are unlabeled context
  const y = 34
  const rayEnd = direction === 'left' ? left : right
  return (
    <svg viewBox="0 0 260 56" className={s.figure} role="img" aria-label={`Number line at ${value}`}>
      <line x1={left} y1={y} x2={right} y2={y} stroke={accent} strokeOpacity={0.35} strokeWidth={1.5} />
      <line
        x1={cx} y1={y} x2={rayEnd} y2={y}
        stroke={accent} strokeWidth={3} strokeLinecap="round"
        markerEnd={direction === 'right' ? 'url(#altray-arrow-r)' : undefined}
        markerStart={direction === 'left' ? 'url(#altray-arrow-l)' : undefined}
      />
      <defs>
        <marker id="altray-arrow-r" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill={accent} />
        </marker>
        <marker id="altray-arrow-l" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 Z" fill={accent} />
        </marker>
      </defs>
      <circle cx={cx} cy={y} r={6} fill={filled ? accent : '#fff'} stroke={accent} strokeWidth={2} />
      <text x={cx} y={y - 14} textAnchor="middle" fontSize={11} fill={accent} fontFamily="var(--tok-font-mono)">{value}</text>
    </svg>
  )
}

export default function AltDiagramCallout({ alt, accent = '#1d3a8a' }: { alt: string; accent?: string }) {
  const parsed = useMemo(() => parseAltDiagram(alt), [alt])

  if (parsed?.kind === 'dashline') {
    return (
      <span className={s.figureWrap}>
        <DashLineFigure diagram={parsed} accent={accent} />
      </span>
    )
  }
  if (parsed?.kind === 'inequalityray') {
    return (
      <span className={s.figureWrap}>
        <InequalityRayFigure diagram={parsed} accent={accent} />
      </span>
    )
  }

  return (
    <span className={s.box} style={{ borderLeftColor: accent }}>
      <span className={s.icon} aria-hidden>⬡</span>
      <span className={s.caption}>Picture: {humanizeAltCaption(alt)}</span>
    </span>
  )
}
