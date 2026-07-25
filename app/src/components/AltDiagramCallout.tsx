/**
 * AltDiagramCallout — renders Eedi accessibility alt-text as an actual small
 * diagram when the pattern is recognizable (see lib/altDiagram.ts), instead
 * of the raw description reading like a bug report. Falls back to a lightly
 * cleaned-up caption, clearly framed as a picture description, when it
 * isn't. Shared by HighlightedStem (question stem) and MathText (answer
 * choices, hints — anywhere a `(Diagram: ...)` chunk can appear).
 */
import { useMemo, type ReactNode } from 'react'
import {
  parseAltDiagram, humanizeAltCaption,
  type DashLineDiagram, type InequalityRayDiagram, type ShapeDimensionDiagram,
  type TriangleAnglesDiagram, type FunctionMachineDiagram, type AngleDiagram,
  type VennDiagram, type SequencePatternDiagram, type BracketArrowsDiagram,
} from '../lib/altDiagram'
import { renderNoBreakCoordinates } from '../lib/noBreakCoords'
import s from './AltDiagramCallout.module.css'

const LABEL_FONT = { fontSize: 11, fontFamily: 'var(--tok-font-mono)' } as const

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

/** Renders the 5 measured shapes (triangle/rectangle/parallelogram/trapezium
 * cuboid/cube) — not to scale, illustrative only, using whatever real
 * dimensions altDiagram.ts extracted. */
function ShapeDimensionFigure({ diagram, accent }: { diagram: ShapeDimensionDiagram; accent: string }) {
  const { shape, base, height, slant, depth, width, edge, parallel1, parallel2 } = diagram
  const label = (x: number, y: number, text?: string, anchor: 'start' | 'middle' | 'end' = 'middle') =>
    text ? <text key={`${x}-${y}-${text}`} x={x} y={y} textAnchor={anchor} fill={accent} style={LABEL_FONT}>{text}</text> : null

  let shapePath: ReactNode = null
  const labels: ReactNode[] = []

  if (shape === 'triangle') {
    const bx1 = 30, bx2 = 220, by = 120, ax = 100, ay = 20
    shapePath = <polygon points={`${bx1},${by} ${bx2},${by} ${ax},${ay}`} fill="none" stroke={accent} strokeWidth={1.5} />
    labels.push(label((bx1 + bx2) / 2, by + 18, base))
    if (height) {
      shapePath = <>{shapePath}<line x1={ax} y1={ay} x2={ax} y2={by} stroke={accent} strokeDasharray="3 3" strokeWidth={1} /></>
      labels.push(label(ax + 14, (ay + by) / 2, height, 'start'))
    }
    labels.push(label((ax + bx2) / 2 + 10, (ay + by) / 2 - 6, slant, 'start'))
  } else if (shape === 'rectangle') {
    const x = 40, y = 30, w = 160, h = 70
    shapePath = <rect x={x} y={y} width={w} height={h} fill="none" stroke={accent} strokeWidth={1.5} />
    labels.push(label(x + w / 2, y + h + 18, base))
    labels.push(label(x + w + 14, y + h / 2, height, 'start'))
  } else if (shape === 'parallelogram') {
    const x = 50, y = 30, w = 140, h = 70, skew = 30
    shapePath = <polygon points={`${x + skew},${y} ${x + skew + w},${y} ${x + w},${y + h} ${x},${y + h}`} fill="none" stroke={accent} strokeWidth={1.5} />
    labels.push(label(x + w / 2, y + h + 18, base))
    if (height) {
      shapePath = <>{shapePath}<line x1={x + skew} y1={y} x2={x + skew} y2={y + h} stroke={accent} strokeDasharray="3 3" strokeWidth={1} /></>
      labels.push(label(x + skew + 10, (y + y + h) / 2, height, 'start'))
    }
    labels.push(label((x + skew + x + skew + w) / 2, y - 10, slant))
  } else if (shape === 'trapezium') {
    const x1 = 60, x2 = 200, y1 = 30, y2 = 100, xb1 = 30, xb2 = 230
    shapePath = <polygon points={`${x1},${y1} ${x2},${y1} ${xb2},${y2} ${xb1},${y2}`} fill="none" stroke={accent} strokeWidth={1.5} />
    labels.push(label((x1 + x2) / 2, y1 - 10, parallel1))
    labels.push(label((xb1 + xb2) / 2, y2 + 18, parallel2))
    if (height) {
      shapePath = <>{shapePath}<line x1={x1} y1={y1} x2={x1} y2={y2} stroke={accent} strokeDasharray="3 3" strokeWidth={1} /></>
      labels.push(label(x1 - 12, (y1 + y2) / 2, height, 'end'))
    }
  } else if (shape === 'cuboid' || shape === 'cube') {
    const x = 50, y = 50, w = 110, h = 60, ox = 30, oy = -25
    shapePath = (
      <>
        <rect x={x} y={y} width={w} height={h} fill="none" stroke={accent} strokeWidth={1.5} />
        <polygon points={`${x},${y} ${x + ox},${y + oy} ${x + w + ox},${y + oy} ${x + w},${y}`} fill="none" stroke={accent} strokeWidth={1.5} />
        <line x1={x + w} y1={y} x2={x + w + ox} y2={y + oy} stroke={accent} strokeWidth={1.5} />
        <line x1={x + w} y1={y + h} x2={x + w + ox} y2={y + h + oy} stroke={accent} strokeWidth={1} strokeDasharray="3 3" />
        <line x1={x + w + ox} y1={y + oy} x2={x + w + ox} y2={y + h + oy} stroke={accent} strokeWidth={1} strokeDasharray="3 3" />
      </>
    )
    if (shape === 'cube') {
      labels.push(label(x + w / 2, y + h + 18, edge))
    } else {
      labels.push(label(x + w / 2, y + h + 18, width))
      labels.push(label(x - 12, y + h / 2, height, 'end'))
      labels.push(label(x + w + ox + 10, (y + oy + y + h + oy) / 2, depth, 'start'))
    }
  }

  return (
    <span className={s.figureWrap}>
      <svg viewBox="0 0 260 150" className={s.figure} role="img" aria-label={`${shape} diagram`}>
        {shapePath}
        {labels}
      </svg>
    </span>
  )
}

function TriangleAnglesFigure({ diagram, accent }: { diagram: TriangleAnglesDiagram; accent: string }) {
  const bx1 = 30, bx2 = 220, by = 110, ax = 100, ay = 20
  const [a1, a2, a3] = diagram.angles
  return (
    <span className={s.figureWrap}>
      <svg viewBox="0 0 260 140" className={s.figure} role="img" aria-label="Triangle with labeled angles">
        <polygon points={`${bx1},${by} ${bx2},${by} ${ax},${ay}`} fill="none" stroke={accent} strokeWidth={1.5} />
        {a1 && <text x={ax} y={ay + 18} textAnchor="middle" fill={accent} style={LABEL_FONT}>{a1}</text>}
        {a2 && <text x={bx1 + 18} y={by - 8} textAnchor="start" fill={accent} style={LABEL_FONT}>{a2}</text>}
        {a3 && <text x={bx2 - 18} y={by - 8} textAnchor="end" fill={accent} style={LABEL_FONT}>{a3}</text>}
      </svg>
    </span>
  )
}

function FunctionMachineFigure({ diagram, accent }: { diagram: FunctionMachineDiagram; accent: string }) {
  const boxes = [diagram.input ?? 'in', ...diagram.steps, ...(diagram.steps.length === 0 ? ['out'] : [])]
  const boxW = 62, boxH = 40, gap = 26
  const totalW = boxes.length * boxW + (boxes.length - 1) * gap
  const startX = (260 - totalW) / 2
  return (
    <span className={s.figureWrap}>
      <svg viewBox="0 0 260 70" className={s.figure} role="img" aria-label="Function machine">
        {boxes.map((text, i) => {
          const x = startX + i * (boxW + gap)
          return (
            <g key={i}>
              <rect x={x} y={15} width={boxW} height={boxH} rx={6} fill="none" stroke={accent} strokeWidth={1.5} />
              <text x={x + boxW / 2} y={15 + boxH / 2 + 4} textAnchor="middle" fill={accent} style={LABEL_FONT}>{text}</text>
              {i < boxes.length - 1 && (
                <line x1={x + boxW} y1={35} x2={x + boxW + gap} y2={35} stroke={accent} strokeWidth={1.5} markerEnd="url(#fm-arrow)" />
              )}
            </g>
          )
        })}
        <defs>
          <marker id="fm-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" fill={accent} />
          </marker>
        </defs>
      </svg>
    </span>
  )
}

function AngleDiagramFigure({ diagram, accent }: { diagram: AngleDiagram; accent: string }) {
  const { variant, labels } = diagram
  const cx = 130, cy = 70, r = 55

  if (variant === 'aroundpoint') {
    const n = Math.max(labels.length, 2)
    const angles = Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / n - Math.PI / 2)
    return (
      <span className={s.figureWrap}>
        <svg viewBox="0 0 260 140" className={s.figure} role="img" aria-label="Angles around a point">
          <circle cx={cx} cy={cy} r={3} fill={accent} />
          {angles.map((a, i) => (
            <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke={accent} strokeWidth={1.5} />
          ))}
          {angles.map((a, i) => {
            const mid = a + Math.PI / n
            return labels[i] ? (
              <text key={i} x={cx + (r - 15) * Math.cos(mid)} y={cy + (r - 15) * Math.sin(mid)} textAnchor="middle" fill={accent} style={LABEL_FONT}>{labels[i]}</text>
            ) : null
          })}
        </svg>
      </span>
    )
  }

  if (variant === 'online') {
    const n = Math.max(labels.length, 2)
    const rays = Array.from({ length: n - 1 }, (_, i) => Math.PI - ((i + 1) * Math.PI) / n)
    return (
      <span className={s.figureWrap}>
        <svg viewBox="0 0 260 90" className={s.figure} role="img" aria-label="Angles on a straight line">
          <line x1={20} y1={cy} x2={240} y2={cy} stroke={accent} strokeWidth={1.5} />
          {rays.map((a, i) => (
            <line key={i} x1={cx} y1={cy} x2={cx + 55 * Math.cos(a)} y2={cy - 55 * Math.sin(a)} stroke={accent} strokeWidth={1.5} />
          ))}
          {Array.from({ length: n }, (_, i) => {
            const lo = i === 0 ? Math.PI : Math.PI - (i * Math.PI) / n
            const hi = i === n - 1 ? 0 : Math.PI - ((i + 1) * Math.PI) / n
            const mid = (lo + hi) / 2
            return labels[i] ? (
              <text key={i} x={cx + 34 * Math.cos(mid)} y={cy - 34 * Math.sin(mid)} textAnchor="middle" fill={accent} style={LABEL_FONT}>{labels[i]}</text>
            ) : null
          })}
        </svg>
      </span>
    )
  }

  if (variant === 'crossing6') {
    const angles = [0, 60, 120, 180, 240, 300].map(d => (d * Math.PI) / 180)
    return (
      <span className={s.figureWrap}>
        <svg viewBox="0 0 260 140" className={s.figure} role="img" aria-label="Three lines crossing at a point">
          {[0, 1, 2].map(i => {
            const a = angles[i]
            return <line key={i} x1={cx - r * Math.cos(a)} y1={cy - r * Math.sin(a)} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke={accent} strokeWidth={1.5} />
          })}
        </svg>
      </span>
    )
  }

  if (variant === 'xcrossing') {
    return (
      <span className={s.figureWrap}>
        <svg viewBox="0 0 260 140" className={s.figure} role="img" aria-label="Two lines crossing">
          <line x1={cx - r} y1={cy - r * 0.6} x2={cx + r} y2={cy + r * 0.6} stroke={accent} strokeWidth={1.5} />
          <line x1={cx - r} y1={cy + r * 0.6} x2={cx + r} y2={cy - r * 0.6} stroke={accent} strokeWidth={1.5} />
        </svg>
      </span>
    )
  }

  // paralleltransversal
  return (
    <span className={s.figureWrap}>
      <svg viewBox="0 0 260 140" className={s.figure} role="img" aria-label="Parallel lines crossed by a transversal">
        <line x1={30} y1={45} x2={230} y2={45} stroke={accent} strokeWidth={1.5} />
        <line x1={30} y1={95} x2={230} y2={95} stroke={accent} strokeWidth={1.5} />
        <line x1={90} y1={15} x2={170} y2={125} stroke={accent} strokeWidth={1.5} />
        <path d="M100 41 l6 -2 M92 89 l6 -2" stroke={accent} strokeWidth={1.2} fill="none" />
      </svg>
    </span>
  )
}

function VennFigure({ diagram, accent }: { diagram: VennDiagram; accent: string }) {
  const [labelA, labelB] = diagram.labels
  return (
    <span className={s.figureWrap}>
      <svg viewBox="0 0 260 140" className={s.figure} role="img" aria-label="Venn diagram">
        <circle cx={105} cy={70} r={50} fill="none" stroke={accent} strokeWidth={1.5} />
        <circle cx={155} cy={70} r={50} fill="none" stroke={accent} strokeWidth={1.5} />
        <text x={70} y={20} textAnchor="middle" fill={accent} style={LABEL_FONT}>{labelA}</text>
        <text x={190} y={20} textAnchor="middle" fill={accent} style={LABEL_FONT}>{labelB}</text>
      </svg>
    </span>
  )
}

function SequencePatternFigure({ diagram, accent }: { diagram: SequencePatternDiagram; accent: string }) {
  const { counts } = diagram
  const stepW = 260 / counts.length
  return (
    <span className={s.figureWrap}>
      <svg viewBox="0 0 260 80" className={s.figure} role="img" aria-label="Sequence of patterns">
        {counts.map((count, stepIdx) => {
          const cols = Math.ceil(Math.sqrt(count))
          const cellSize = 10
          const gridW = cols * cellSize
          const originX = stepIdx * stepW + (stepW - gridW) / 2
          return (
            <g key={stepIdx}>
              {Array.from({ length: count }, (_, cellIdx) => {
                const col = cellIdx % cols
                const row = Math.floor(cellIdx / cols)
                return (
                  <rect
                    key={cellIdx}
                    x={originX + col * cellSize}
                    y={10 + row * cellSize}
                    width={cellSize - 2}
                    height={cellSize - 2}
                    fill={accent}
                    fillOpacity={0.65}
                  />
                )
              })}
              <text x={stepIdx * stepW + stepW / 2} y={70} textAnchor="middle" fill={accent} style={LABEL_FONT}>{count}</text>
            </g>
          )
        })}
      </svg>
    </span>
  )
}

function BracketArrowsFigure({ diagram, accent }: { diagram: BracketArrowsDiagram; accent: string }) {
  const { bracket1, bracket2, term1, term2 } = diagram
  const text = `(${bracket1})(${bracket2})`
  const midX1 = 65, midX2 = 175, topY = 45, anchorY = 15, anchorX = 120
  return (
    <span className={s.figureWrap}>
      <svg viewBox="0 0 260 70" className={s.figure} role="img" aria-label="Bracket expansion diagram">
        <text x={130} y={topY} textAnchor="middle" fill={accent} style={{ ...LABEL_FONT, fontSize: 15 }}>{text}</text>
        <path d={`M${anchorX} ${anchorY} Q${midX1 - 10} ${anchorY + 8} ${midX1} ${topY - 12}`} stroke={accent} strokeWidth={1.2} fill="none" markerEnd="url(#ba-arrow)" />
        <path d={`M${anchorX} ${anchorY} Q${midX2 + 10} ${anchorY + 8} ${midX2} ${topY - 12}`} stroke={accent} strokeWidth={1.2} fill="none" markerEnd="url(#ba-arrow)" />
        <text x={midX1} y={65} textAnchor="middle" fill={accent} style={LABEL_FONT}>{term1}</text>
        <text x={midX2} y={65} textAnchor="middle" fill={accent} style={LABEL_FONT}>{term2}</text>
        <defs>
          <marker id="ba-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0 0 L7 3.5 L0 7 Z" fill={accent} />
          </marker>
        </defs>
      </svg>
    </span>
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
  if (parsed?.kind === 'shapedimension') return <ShapeDimensionFigure diagram={parsed} accent={accent} />
  if (parsed?.kind === 'triangleangles') return <TriangleAnglesFigure diagram={parsed} accent={accent} />
  if (parsed?.kind === 'functionmachine') return <FunctionMachineFigure diagram={parsed} accent={accent} />
  if (parsed?.kind === 'anglediagram') return <AngleDiagramFigure diagram={parsed} accent={accent} />
  if (parsed?.kind === 'venn') return <VennFigure diagram={parsed} accent={accent} />
  if (parsed?.kind === 'sequencepattern') return <SequencePatternFigure diagram={parsed} accent={accent} />
  if (parsed?.kind === 'bracketarrows') return <BracketArrowsFigure diagram={parsed} accent={accent} />

  return (
    <span className={s.box} style={{ borderLeftColor: accent }}>
      <span className={s.icon} aria-hidden>⬡</span>
      <span className={s.caption}>Picture: {renderNoBreakCoordinates(humanizeAltCaption(alt))}</span>
    </span>
  )
}
