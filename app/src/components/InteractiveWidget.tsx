/**
 * InteractiveWidget — renders an interactive math manipulative when the
 * question text or concept implies one (dice, spinner, number line, etc.).
 *
 * Detection is text-heuristic + concept-based; always degrades gracefully to null.
 */

import { useState, useRef, useEffect } from 'react'
import s from './InteractiveWidget.module.css'

// ── Detection ────────────────────────────────────────────────────────────────

type WidgetKind = 'dice' | 'spinner' | 'coin' | 'numberline' | 'linegraph' | null

interface DiceConfig    { kind: 'dice';       sides: number; count: number }
interface SpinnerConfig { kind: 'spinner';    sections: number; labels?: string[] }
interface CoinConfig    { kind: 'coin' }
interface NumberLineConfig { kind: 'numberline'; min: number; max: number }
interface LineGraphConfig {
  kind: 'linegraph'
  /** y = m·x + c (slope-intercept), or a vertical line x = v. */
  m: number
  c: number
  vertical?: number
  label: string
}

type WidgetConfig = DiceConfig | SpinnerConfig | CoinConfig | NumberLineConfig | LineGraphConfig

const PROB_CONCEPTS = new Set([
  'basic_probability', 'probability', 'probability_distributions',
  'counting_combinatorics', 'descriptive_statistics',
])

/** Concepts where graphing a detected linear equation genuinely helps. */
const LINE_CONCEPTS = new Set([
  'linear_equations', 'linear_inequalities', 'systems_of_linear_equations',
  'coordinate_geometry', 'functions_basics', 'function_notation',
  'basic_equations', 'representation_translation',
])

function parseSpinnerSections(txt: string): number {
  const m = txt.match(/(\d+)[- ]sided\s+spinner|spinner\s+(?:with|labelled?\s+with)\s+(\d+)|(\d+)\s+(?:equal\s+)?(?:sections?|parts?|colou?rs?)/i)
  if (m) return parseInt(m[1] ?? m[2] ?? m[3] ?? '4')
  if (/four[- ]sided/i.test(txt)) return 4
  if (/six[- ]sided/i.test(txt)) return 6
  if (/three[- ]sided/i.test(txt)) return 3
  if (/five[- ]sided/i.test(txt)) return 5
  return 4
}

function parseDiceSides(txt: string): number {
  const m = txt.match(/(\d+)[- ]sided\s+die/i) ?? txt.match(/d(\d+)/i)
  if (m) return parseInt(m[1])
  if (/six[- ]sided|standard die|fair die/i.test(txt)) return 6
  if (/four[- ]sided/i.test(txt)) return 4
  if (/eight[- ]sided/i.test(txt)) return 8
  return 6
}

function parseDiceCount(txt: string): number {
  const m = txt.match(/(\d+)\s+dice|roll\s+(\d+)/i)
  if (m) return Math.min(parseInt(m[1] ?? m[2] ?? '1'), 4)
  if (/two dice|a pair of dice/i.test(txt)) return 2
  return 1
}

/**
 * Parse the first linear equation in a stem into slope-intercept form.
 * Handles `y = mx + b`, `ax + by = c`, and vertical `x = v`. Unicode minus
 * signs and LaTeX wrappers are normalised away first. Returns null when the
 * text has no clean linear equation — the widget must never guess.
 */
export function parseLinearEquation(questionText: string): LineGraphConfig | null {
  const txt = questionText
    .replace(/[−–—]/g, '-')
    .replace(/\\\(|\\\)|\\\[|\\\]|\$/g, ' ')
    .replace(/\s+/g, ' ')

  const num = (s: string | undefined, fallback: number): number => {
    if (s === undefined || s === '' || s === '+') return fallback
    if (s === '-') return -fallback
    const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
    if (frac) return parseFloat(frac[1]) / parseFloat(frac[2])
    const v = parseFloat(s)
    return Number.isFinite(v) ? v : fallback
  }

  // y = mx + b   (m may be a fraction like 2/3)
  let m = txt.match(/y\s*=\s*(-?\s*\d*(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*x\s*(?:([+-])\s*(\d+(?:\.\d+)?))?/)
  if (m) {
    const slope = num(m[1].replace(/\s/g, ''), 1)
    const intercept = m[2] ? (m[2] === '-' ? -1 : 1) * num(m[3], 0) : 0
    return { kind: 'linegraph', m: slope, c: intercept, label: m[0].trim() }
  }

  // ax + by = c  →  y = (c - ax)/b
  m = txt.match(/(-?\d*(?:\.\d+)?)\s*x\s*([+-])\s*(\d*(?:\.\d+)?)\s*y\s*=\s*(-?\d+(?:\.\d+)?)/)
  if (m) {
    const a = num(m[1], 1)
    const b = (m[2] === '-' ? -1 : 1) * num(m[3], 1)
    const cVal = num(m[4], 0)
    if (b === 0) return null
    return { kind: 'linegraph', m: -a / b, c: cVal / b, label: m[0].trim() }
  }

  // x = v (vertical line) — only when the stem talks about a line/graph
  m = txt.match(/\bline\b[^.]*\bx\s*=\s*(-?\d+(?:\.\d+)?)/)
  if (m) {
    return { kind: 'linegraph', m: 0, c: 0, vertical: num(m[1], 0), label: `x = ${m[1]}` }
  }

  return null
}

export function detectWidget(conceptId: string, questionText: string): WidgetConfig | null {
  // Linear-equation stems get a plotted graph — seeing the line IS the lesson.
  if (LINE_CONCEPTS.has(conceptId) || /\bslope\b|\by-intercept\b/i.test(questionText)) {
    const line = parseLinearEquation(questionText)
    if (line && Math.abs(line.m) <= 25 && Math.abs(line.c) <= 100) return line
  }

  if (!PROB_CONCEPTS.has(conceptId)) return null

  const txt = questionText.toLowerCase()

  if (/\bspinner\b/.test(txt)) {
    const raw = parseSpinnerSections(txt)
    const sections = raw >= 2 && raw <= 12 ? raw : 4
    // Extract labels like "labelled with 1, 2, 3 and 4"
    const labelMatch = txt.match(/labelled?\s+with\s+([\d,\s]+and\s+\d+|\d+)/i)
    let labels: string[] | undefined
    if (labelMatch) {
      labels = labelMatch[1].split(/[\s,]+(?:and\s+)?/).filter(Boolean).slice(0, sections)
    }
    return { kind: 'spinner', sections, labels }
  }

  if (/\bdi(?:ce|e)\b|\broll(?:ed|ing|s)?\b/.test(txt)) {
    const sides = parseDiceSides(txt)
    const count = parseDiceCount(txt)
    return { kind: 'dice', sides: sides >= 4 && sides <= 20 ? sides : 6, count }
  }

  if (/\bcoin\b|\bheads?\b|\btails?\b/.test(txt)) {
    return { kind: 'coin' }
  }

  return null
}

// ── Theme prop ───────────────────────────────────────────────────────────────

interface ThemeProps {
  accent: string
  ink: string
  bg: string
  dim: string
}

// ── DiceRoller ───────────────────────────────────────────────────────────────

const DIE_FACES: Record<number, number[][]> = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]],
}

function DieFace({ value, sides, rolling, accent }: { value: number | null; sides: number; rolling: boolean; accent: string }) {
  const showDots = sides === 6 && value !== null && value <= 6 && DIE_FACES[value]
  return (
    <div className={`${s.die} ${rolling ? s.dieRolling : ''}`} style={{ borderColor: accent + '44', background: accent + '08' }}>
      {showDots ? (
        <svg viewBox="0 0 40 40" className={s.dieFace} aria-label={`Die face ${value}`}>
          {DIE_FACES[value!]!.map(([cx, cy], i) => (
            <circle key={i} cx={cx * 40} cy={cy * 40} r="3.5" fill={accent} />
          ))}
        </svg>
      ) : (
        <span className={s.dieNum} style={{ color: accent }}>{value ?? '?'}</span>
      )}
    </div>
  )
}

function DiceRoller({ sides, count, theme }: DiceConfig & { theme: ThemeProps }) {
  const [values, setValues] = useState<(number | null)[]>(Array(count).fill(null))
  const [rolling, setRolling] = useState(false)
  const [history, setHistory] = useState<number[][]>([])
  const rollCount = history.length

  const roll = () => {
    if (rolling) return
    setRolling(true)
    setValues(Array(count).fill(null))
    setTimeout(() => {
      const newVals = Array(count).fill(0).map(() => Math.floor(Math.random() * sides) + 1)
      setValues(newVals)
      setHistory(h => [newVals, ...h].slice(0, 6))
      setRolling(false)
    }, 560)
  }

  const sum = values.every(v => v !== null) ? (values as number[]).reduce((a, b) => a + b, 0) : null

  return (
    <div className={s.widget}>
      <div className={s.widgetLabel} style={{ color: theme.dim }}>
        {count === 1 ? `${sides}-sided die` : `${count} dice (${sides}-sided)`} — roll to explore
      </div>
      <div className={s.diceRow}>
        {values.map((v, i) => (
          <DieFace key={i} value={v} sides={sides} rolling={rolling} accent={theme.accent} />
        ))}
      </div>
      {count > 1 && sum !== null && (
        <div className={s.diceSum} style={{ color: theme.dim }}>sum = <strong style={{ color: theme.ink }}>{sum}</strong></div>
      )}
      {history.length > 0 && (
        <div className={s.rollHistory} style={{ color: theme.dim }}>
          <span>last {Math.min(rollCount, 6)} rolls: </span>
          {history.map((vals, i) => (
            <span key={i} className={s.rollChip} style={{ background: theme.accent + '14', color: theme.ink }}>
              {vals.join('+')}
            </span>
          ))}
        </div>
      )}
      <button className={s.rollBtn} style={{ background: theme.accent, color: theme.bg }} onClick={roll} disabled={rolling}>
        {rolling ? 'Rolling…' : rollCount === 0 ? 'Roll the die' : 'Roll again'}
      </button>
    </div>
  )
}

// ── SpinnerWidget ────────────────────────────────────────────────────────────

const SECTOR_COLORS = ['#c4f547', '#e8d16b', '#87c4ff', '#ffb3a0', '#b8f0c0', '#f0d4a0', '#d4a0f0', '#a0d4f0', '#f0a0b8', '#a0f0c4', '#f0c0a0', '#c0a0f0']

function SpinnerWidget({ sections, labels, theme }: SpinnerConfig & { theme: ThemeProps }) {
  const [totalAngle, setTotalAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [lastResult, setLastResult] = useState<number | null>(null)
  const [spinCount, setSpinCount] = useState(0)
  const [history, setHistory] = useState<number[]>([])

  const spin = () => {
    if (spinning) return
    setSpinning(true)
    setLastResult(null)
    const fullRotations = 5 + Math.floor(Math.random() * 5)
    const extraDeg = Math.random() * 360
    const delta = fullRotations * 360 + extraDeg
    const newTotal = totalAngle + delta
    setTotalAngle(newTotal)

    setTimeout(() => {
      // Pointer is at top (270deg in standard SVG, or 12 o'clock).
      // We measure where the TOP of the wheel aligns after rotation.
      const normalised = ((newTotal % 360) + 360) % 360
      // The pointer points to sector that is at the top at final rest.
      // Sector i occupies [i * sectorDeg, (i+1) * sectorDeg]
      const sectorDeg = 360 / sections
      const idx = Math.floor(((360 - normalised) % 360) / sectorDeg)
      const result = (idx % sections) + 1
      setLastResult(result)
      setSpinCount(c => c + 1)
      setHistory(h => [result, ...h].slice(0, 8))
      setSpinning(false)
    }, 2100)
  }

  const sectorDeg = 360 / sections
  const R = 80

  const sectorPath = (i: number) => {
    const a1 = ((i * sectorDeg - 90) * Math.PI) / 180
    const a2 = (((i + 1) * sectorDeg - 90) * Math.PI) / 180
    const x1 = 90 + R * Math.cos(a1)
    const y1 = 90 + R * Math.sin(a1)
    const x2 = 90 + R * Math.cos(a2)
    const y2 = 90 + R * Math.sin(a2)
    const large = sectorDeg > 180 ? 1 : 0
    return `M 90 90 L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`
  }

  const labelPos = (i: number) => {
    const mid = ((i + 0.5) * sectorDeg - 90) * Math.PI / 180
    return { x: 90 + 55 * Math.cos(mid), y: 90 + 55 * Math.sin(mid) }
  }

  return (
    <div className={s.widget}>
      <div className={s.widgetLabel} style={{ color: theme.dim }}>
        {sections}-section spinner — click to spin
      </div>
      <div className={s.spinnerOuter}>
        <svg
          viewBox="0 0 180 180"
          className={s.spinnerWheel}
          style={{
            transform: `rotate(${totalAngle}deg)`,
            transition: spinning ? 'transform 2.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
          }}
          aria-label="Spinner wheel"
        >
          {Array(sections).fill(null).map((_, i) => {
            const { x, y } = labelPos(i)
            const lbl = labels?.[i] ?? String(i + 1)
            return (
              <g key={i}>
                <path d={sectorPath(i)} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} stroke="#fff" strokeWidth="1" />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                  fontSize="13" fontWeight="700" fill="#1a2c16" fontFamily="IBM Plex Mono, monospace">
                  {lbl}
                </text>
              </g>
            )
          })}
          <circle cx="90" cy="90" r="8" fill="#fff" stroke="#ccc" strokeWidth="1" />
        </svg>
        {/* Fixed pointer at top */}
        <div className={s.spinnerPointer} aria-hidden>▼</div>
      </div>

      {lastResult !== null && !spinning && (
        <div className={s.spinResult} style={{ color: theme.ink }}>
          Landed on <strong style={{ color: theme.accent }}>{labels?.[lastResult - 1] ?? lastResult}</strong>
        </div>
      )}
      {history.length > 1 && (
        <div className={s.rollHistory} style={{ color: theme.dim }}>
          {history.map((r, i) => (
            <span key={i} className={s.rollChip} style={{ background: SECTOR_COLORS[(r - 1) % SECTOR_COLORS.length] + 'cc', color: '#1a2c16' }}>
              {labels?.[r - 1] ?? r}
            </span>
          ))}
        </div>
      )}
      <button className={s.rollBtn} style={{ background: theme.accent, color: theme.bg }} onClick={spin} disabled={spinning}>
        {spinning ? 'Spinning…' : spinCount === 0 ? 'Spin it' : 'Spin again'}
      </button>
    </div>
  )
}

// ── CoinFlip ─────────────────────────────────────────────────────────────────

function CoinFlip({ theme }: { theme: ThemeProps }) {
  const [side, setSide] = useState<'H' | 'T' | null>(null)
  const [flipping, setFlipping] = useState(false)
  const [history, setHistory] = useState<('H' | 'T')[]>([])

  const flip = () => {
    if (flipping) return
    setFlipping(true)
    setSide(null)
    setTimeout(() => {
      const result = Math.random() < 0.5 ? 'H' : 'T'
      setSide(result)
      setHistory(h => ([result, ...h] as ('H'|'T')[]).slice(0, 10))
      setFlipping(false)
    }, 600)
  }

  const heads = history.filter(x => x === 'H').length
  const tails = history.filter(x => x === 'T').length

  return (
    <div className={s.widget}>
      <div className={s.widgetLabel} style={{ color: theme.dim }}>fair coin — flip to explore</div>
      <div className={`${s.coin} ${flipping ? s.coinFlipping : ''}`} style={{ borderColor: theme.accent + '55', background: theme.accent + '10' }}>
        <span style={{ color: theme.accent, fontSize: 28, fontWeight: 700, fontFamily: 'IBM Plex Mono' }}>
          {flipping ? '?' : side === 'H' ? 'H' : side === 'T' ? 'T' : '?'}
        </span>
        <span style={{ color: theme.dim, fontSize: 10, marginTop: 2 }}>
          {!flipping && side ? (side === 'H' ? 'heads' : 'tails') : ''}
        </span>
      </div>
      {history.length > 1 && (
        <div className={s.rollHistory} style={{ color: theme.dim }}>
          <span>H: {heads} · T: {tails}</span>
          {history.map((r, i) => (
            <span key={i} className={s.rollChip} style={{ background: r === 'H' ? theme.accent + '22' : theme.dim + '22', color: theme.ink }}>
              {r}
            </span>
          ))}
        </div>
      )}
      <button className={s.rollBtn} style={{ background: theme.accent, color: theme.bg }} onClick={flip} disabled={flipping}>
        {flipping ? 'Flipping…' : history.length === 0 ? 'Flip the coin' : 'Flip again'}
      </button>
    </div>
  )
}

// ── LineGraph ────────────────────────────────────────────────────────────────

function LineGraphWidget({ m, c, vertical, label, theme }: LineGraphConfig & { theme: ThemeProps }) {
  // Pick a window that keeps the interesting part of the line visible.
  const span = vertical !== undefined
    ? Math.max(6, Math.ceil(Math.abs(vertical)) + 2)
    : Math.max(6, Math.min(12, Math.ceil(Math.abs(c)) + 3))
  const size = 230
  const pad = 14
  const scale = (size - 2 * pad) / (2 * span)
  const toX = (x: number) => size / 2 + x * scale
  const toY = (y: number) => size / 2 - y * scale

  // Endpoints clipped to the window
  let x1: number, y1: number, x2: number, y2: number
  if (vertical !== undefined) {
    x1 = x2 = vertical; y1 = -span; y2 = span
  } else {
    x1 = -span; y1 = m * -span + c
    x2 = span;  y2 = m * span + c
  }

  const gridLines: number[] = []
  const step = span > 8 ? 4 : 2
  for (let v = -span + (span % step); v <= span; v += step) if (v !== 0) gridLines.push(v)

  return (
    <div className={s.widget}>
      <div className={s.widgetLabel} style={{ color: theme.dim }}>
        the line, drawn — <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{label}</span>
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img"
        aria-label={`Graph of ${label}`} style={{ maxWidth: '100%' }}>
        {gridLines.map(v => (
          <g key={v}>
            <line x1={toX(v)} y1={pad} x2={toX(v)} y2={size - pad} stroke={theme.dim} strokeOpacity="0.16" strokeWidth="1" />
            <line x1={pad} y1={toY(v)} x2={size - pad} y2={toY(v)} stroke={theme.dim} strokeOpacity="0.16" strokeWidth="1" />
            <text x={toX(v)} y={toY(0) + 12} fontSize="8" fill={theme.dim} textAnchor="middle">{v}</text>
            <text x={toX(0) - 5} y={toY(v) + 3} fontSize="8" fill={theme.dim} textAnchor="end">{v}</text>
          </g>
        ))}
        {/* axes */}
        <line x1={pad} y1={toY(0)} x2={size - pad} y2={toY(0)} stroke={theme.ink} strokeOpacity="0.55" strokeWidth="1.2" />
        <line x1={toX(0)} y1={pad} x2={toX(0)} y2={size - pad} stroke={theme.ink} strokeOpacity="0.55" strokeWidth="1.2" />
        <text x={size - pad - 2} y={toY(0) - 4} fontSize="9" fill={theme.dim} textAnchor="end">x</text>
        <text x={toX(0) + 5} y={pad + 8} fontSize="9" fill={theme.dim}>y</text>
        {/* the line — no slope/intercept callouts: those are often the answer */}
        <line
          x1={toX(x1)} y1={toY(y1)} x2={toX(x2)} y2={toY(y2)}
          stroke={theme.accent} strokeWidth="2.4" strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

// ── Public component ─────────────────────────────────────────────────────────

interface Props {
  conceptId: string
  questionText: string
  theme: ThemeProps
}

export default function InteractiveWidget({ conceptId, questionText, theme }: Props) {
  const config = detectWidget(conceptId, questionText)
  if (!config) return null

  return (
    <div className={s.widgetWrap}>
      {config.kind === 'dice'      && <DiceRoller     {...config} theme={theme} />}
      {config.kind === 'spinner'   && <SpinnerWidget  {...config} theme={theme} />}
      {config.kind === 'coin'      && <CoinFlip theme={theme} />}
      {config.kind === 'linegraph' && <LineGraphWidget {...config} theme={theme} />}
    </div>
  )
}
