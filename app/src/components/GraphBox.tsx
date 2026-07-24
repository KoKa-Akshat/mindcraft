/**
 * GraphBox — a live graphing box: type a polynomial in x, see it plotted
 * immediately, fully client-side (SVG), no external graphing service.
 *
 * Direct TypeScript/React port of the iPad prototype's GraphView.swift (see
 * ios-prototype/MindCraftNotes/MindCraftNotes/Views/GraphView.swift) — same
 * screenPoint transform, same niceStep/formatTick axis-label algorithm, same
 * y-range self-sampling so a parabola or cubic isn't clipped. The parsing
 * comes from ../lib/polynomialExpression.ts (ported from the sibling
 * PolynomialExpression.swift + LaTeXMath.swift in the same prototype).
 */
import { useMemo, useState } from 'react'
import { evaluatePolynomial, parsePolynomial, PolyParseError, type PolynomialExpression } from '../lib/polynomialExpression'
import s from './GraphBox.module.css'

const X_MIN = -10
const X_MAX = 10
const X_SPAN = X_MAX - X_MIN
const RANGE_SAMPLES = 200 // matches the prototype's 0.1 step over [-10, 10]
const CURVE_SAMPLES = 400

const VIEW_W = 300
const VIEW_H = 186
const TICK_LEN = 4

interface YBounds {
  min: number
  max: number
}

const DEFAULT_Y_BOUNDS: YBounds = { min: -10, max: 10 }

/** Samples the expression's own range so a parabola or cubic isn't clipped,
 * rather than assuming a fixed y-window. Direct port of GraphView.yRange. */
function yRangeFor(expr: PolynomialExpression): YBounds {
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i <= RANGE_SAMPLES; i++) {
    const x = X_MIN + (i / RANGE_SAMPLES) * X_SPAN
    const y = evaluatePolynomial(expr, x)
    if (isFinite(y)) {
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  if (!isFinite(minY) || !isFinite(maxY) || minY === maxY) return { ...DEFAULT_Y_BOUNDS }
  const padding = (maxY - minY) * 0.1
  return { min: minY - padding, max: maxY + padding }
}

/** Maps math coordinates to SVG viewBox points. Both the axis ticks and the
 * plotted curve go through this one function so they can never drift out of
 * sync. Direct port of GraphView.screenPoint. */
function screenPoint(x: number, y: number, yBounds: YBounds): { x: number; y: number } {
  const ySpan = yBounds.max - yBounds.min
  const px = ((x - X_MIN) / X_SPAN) * VIEW_W
  // SVG y grows downward, math y grows upward — flip it.
  const py = VIEW_H - ((y - yBounds.min) / ySpan) * VIEW_H
  return { x: px, y: py }
}

/** A "nice" tick spacing (1/2/5 x a power of ten) so the axis shows roughly
 * `targetTicks` marks regardless of scale. Direct port of GraphView.niceStep. */
function niceStep(span: number, targetTicks = 8): number {
  if (!isFinite(span) || span <= 0) return 1
  const rawStep = span / targetTicks
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  let niceResidual: number
  if (residual < 1.5) niceResidual = 1
  else if (residual < 3) niceResidual = 2
  else if (residual < 7) niceResidual = 5
  else niceResidual = 10
  const step = niceResidual * magnitude
  return step > 0 ? step : 1
}

/** Direct port of GraphView.formatTick. */
function formatTick(value: number, step: number): string {
  if (step >= 1) return String(Math.round(value))
  const decimals = Math.max(1, Math.ceil(-Math.log10(step)))
  return value.toFixed(decimals)
}

interface Tick {
  value: number
  screen: number
  label: string
}

function axisTicks(bounds: YBounds | { min: number; max: number }, step: number): Tick[] {
  const ticks: Tick[] = []
  let t = Math.ceil(bounds.min / step) * step
  while (t <= bounds.max + step * 1e-9) {
    if (Math.abs(t) > step * 0.001) ticks.push({ value: t, screen: 0, label: formatTick(t, step) })
    t += step
  }
  return ticks
}

function curvePath(expr: PolynomialExpression, yBounds: YBounds): string {
  let d = ''
  let started = false
  const step = X_SPAN / CURVE_SAMPLES
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const x = X_MIN + i * step
    const y = evaluatePolynomial(expr, x)
    const p = screenPoint(x, y, yBounds)
    if (isFinite(p.y) && isFinite(p.x)) {
      d += started ? ` L${p.x.toFixed(1)},${p.y.toFixed(1)}` : `M${p.x.toFixed(1)},${p.y.toFixed(1)}`
      started = true
    } else {
      started = false
    }
  }
  return d
}

export interface GraphBoxProps {
  className?: string
  initialExpression?: string
  /** Starts expanded when true (e.g. a concept where graphing is directly
   * relevant); starts collapsed but always available otherwise. Same
   * collapsible-panel pattern as ScientificCalcToggle elsewhere on this page. */
  defaultOpen?: boolean
}

export default function GraphBox({ className, initialExpression = 'x^2+5x+6', defaultOpen = true }: GraphBoxProps) {
  const [expressionText, setExpressionText] = useState(initialExpression)
  const [open, setOpen] = useState(defaultOpen)

  const { parsed, errorMessage } = useMemo(() => {
    try {
      return { parsed: parsePolynomial(expressionText), errorMessage: null as string | null }
    } catch (e) {
      const message = e instanceof PolyParseError ? e.message : 'Could not read that expression.'
      return { parsed: null as PolynomialExpression | null, errorMessage: message }
    }
  }, [expressionText])

  const yBounds = useMemo(() => (parsed ? yRangeFor(parsed) : { ...DEFAULT_Y_BOUNDS }), [parsed])

  const originScreen = useMemo(() => screenPoint(0, 0, yBounds), [yBounds])
  const axisY = Math.min(Math.max(originScreen.y, 0), VIEW_H)
  const axisX = Math.min(Math.max(originScreen.x, 0), VIEW_W)
  const xLabelAbove = axisY > VIEW_H * 0.75
  const yLabelRight = axisX < VIEW_W * 0.25

  const xStep = useMemo(() => niceStep(X_SPAN), [])
  const yStep = useMemo(() => niceStep(yBounds.max - yBounds.min), [yBounds])

  const xTicks = useMemo(() => axisTicks({ min: X_MIN, max: X_MAX }, xStep).map(t => ({
    ...t,
    screen: screenPoint(t.value, 0, yBounds).x,
  })), [xStep, yBounds])

  const yTicks = useMemo(() => axisTicks(yBounds, yStep).map(t => ({
    ...t,
    screen: screenPoint(0, t.value, yBounds).y,
  })), [yBounds, yStep])

  const path = useMemo(() => (parsed ? curvePath(parsed, yBounds) : ''), [parsed, yBounds])

  return (
    <div className={`${s.wrap} ${className ?? ''}`}>
      <button type="button" className={s.header} onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className={s.headerTitle}>Graph</span>
        <span className={s.headerChevron}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className={s.body}>
          <div className={s.inputRow}>
            <span className={s.inputPrefix}>y =</span>
            <input
              type="text"
              className={s.input}
              value={expressionText}
              onChange={e => setExpressionText(e.target.value)}
              placeholder="x^2+5x+6"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Polynomial expression to graph"
            />
          </div>
          <p className={s.hint}>Also reads LaTeX, e.g. x^{'{2}'}+5x+6 or \frac{'{1}'}{'{2}'}x-3</p>
          {errorMessage && <p className={s.error}>{errorMessage}</p>}

          <svg
            className={s.svg}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="img"
            aria-label={parsed ? `Graph of y = ${expressionText}` : 'Graph, no valid expression'}
          >
            {/* axes */}
            <line x1={0} y1={axisY} x2={VIEW_W} y2={axisY} className={s.axisLine} />
            <line x1={axisX} y1={0} x2={axisX} y2={VIEW_H} className={s.axisLine} />

            {/* x ticks */}
            {xTicks.map(t => (
              <g key={`x${t.value}`}>
                <line x1={t.screen} y1={axisY - TICK_LEN} x2={t.screen} y2={axisY + TICK_LEN} className={s.tickLine} />
                <text
                  x={t.screen}
                  y={axisY + (xLabelAbove ? -8 : 15)}
                  className={s.tickLabel}
                  textAnchor="middle"
                >
                  {t.label}
                </text>
              </g>
            ))}

            {/* y ticks */}
            {yTicks.map(t => (
              <g key={`y${t.value}`}>
                <line x1={axisX - TICK_LEN} y1={t.screen} x2={axisX + TICK_LEN} y2={t.screen} className={s.tickLine} />
                <text
                  x={axisX + (yLabelRight ? 8 : -8)}
                  y={t.screen + 3}
                  className={s.tickLabel}
                  textAnchor={yLabelRight ? 'start' : 'end'}
                >
                  {t.label}
                </text>
              </g>
            ))}

            {/* origin label */}
            <text
              x={axisX + (yLabelRight ? 8 : -8)}
              y={axisY + (xLabelAbove ? -8 : 15)}
              className={s.tickLabel}
              textAnchor={yLabelRight ? 'start' : 'end'}
            >
              0
            </text>

            {path && <path d={path} className={s.curve} />}
          </svg>
        </div>
      )}
    </div>
  )
}
