/**
 * ScratchPad — pressure-aware freehand canvas for student reasoning capture.
 * Uses Pointer Events + perfect-freehand for natural ink strokes.
 *
 * v2 additions:
 *  - Expression evaluator: detects arithmetic in transcribed workLines and
 *    shows a computed result overlay beneath each line's bbox.
 *  - Mini SVG graph: detects y=f(x) patterns and renders a 120×80 curve.
 *  - Eraser button (top-right) with 200ms fade.
 *  - Session logs: saves scratch data to localStorage, shows last 5 as dropdown.
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { getStroke } from 'perfect-freehand'
import type { InkBbox, ScratchStrokeData, ScratchStrokePoint } from '../types'
import s from './ScratchPad.module.css'

type Point = ScratchStrokePoint

export type LineOverlay = {
  bbox: InkBbox
  kind: 'debug' | 'suspect'
}

// ── Math eval ────────────────────────────────────────────────────────────────

/**
 * Tokenises a single-line math string into tokens (numbers, operators, names).
 */
function tokenize(src: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    if (/[\d]/.test(c) || (c === '.' && /\d/.test(src[i + 1] ?? ''))) {
      let n = ''
      while (i < src.length && /[\d.]/.test(src[i])) n += src[i++]
      out.push(n); continue
    }
    if (/[a-z]/i.test(c)) {
      let name = ''
      while (i < src.length && /[a-zA-Z]/.test(src[i])) name += src[i++]
      out.push(name); continue
    }
    if (/[+\-*/^(),]/.test(c)) { out.push(c); i++; continue }
    i++ // skip unknown
  }
  return out
}

/** Recursive-descent evaluator. vars maps variable names to numbers. */
class MathParser {
  pos = 0
  constructor(private toks: string[], private vars: Record<string, number> = {}) {}

  parse(): number { const v = this.addSub(); return v }

  addSub(): number {
    let left = this.mulDiv()
    while (this.pos < this.toks.length && ['+', '-'].includes(this.toks[this.pos])) {
      const op = this.toks[this.pos++]
      const right = this.mulDiv()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  mulDiv(): number {
    let left = this.power()
    while (this.pos < this.toks.length && ['*', '/'].includes(this.toks[this.pos])) {
      const op = this.toks[this.pos++]
      const right = this.power()
      if (op === '/') { if (right === 0) throw new Error('div0'); left = left / right }
      else left = left * right
    }
    return left
  }

  power(): number {
    let base = this.unary()
    if (this.pos < this.toks.length && this.toks[this.pos] === '^') {
      this.pos++
      return Math.pow(base, this.power())
    }
    return base
  }

  unary(): number {
    if (this.toks[this.pos] === '-') { this.pos++; return -this.primary() }
    if (this.toks[this.pos] === '+') { this.pos++; return this.primary() }
    return this.primary()
  }

  primary(): number {
    const tok = this.toks[this.pos]
    if (tok === undefined) throw new Error('unexpected end')

    // Number literal
    if (/^[\d.]+$/.test(tok)) { this.pos++; return parseFloat(tok) }

    // Variables (e.g. x)
    if (tok in this.vars) { this.pos++; return this.vars[tok] }

    // Constants
    if (tok === 'pi') { this.pos++; return Math.PI }
    if (tok === 'e' && !['x'].includes(this.toks[this.pos + 1] ?? '')) { this.pos++; return Math.E }

    // Functions
    const FUNS: Record<string, (a: number) => number> = {
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      sqrt: Math.sqrt, abs: Math.abs,
      log: Math.log10, ln: Math.log, exp: Math.exp,
    }
    if (tok in FUNS) {
      this.pos++
      if (this.toks[this.pos] === '(') { this.pos++ }
      const arg = this.addSub()
      if (this.toks[this.pos] === ')') this.pos++
      return FUNS[tok](arg)
    }

    // Parentheses
    if (tok === '(') {
      this.pos++
      const val = this.addSub()
      if (this.toks[this.pos] === ')') this.pos++
      return val
    }

    throw new Error(`unknown: ${tok}`)
  }
}

/** Evaluate a plain-text arithmetic expression. Returns null on failure. */
function safeEval(raw: string): number | null {
  const src = raw.trim()

  // "15% of 60" shorthand
  const pctOf = src.match(/^([\d.]+)\s*%\s+of\s+([\d.]+)$/i)
  if (pctOf) return (parseFloat(pctOf[1]) / 100) * parseFloat(pctOf[2])

  // Strip trailing '=' so "2*3=" still evaluates
  const stripped = src.replace(/=\s*$/, '').trim()

  // Must contain at least one operator between operands
  if (!/[\d)(][+\-*/^][\d(]/.test(stripped) && !/[\d]\s*%\s*of\s*[\d]/i.test(stripped)) return null

  try {
    const toks = tokenize(stripped)
    const p = new MathParser(toks)
    const result = p.parse()
    if (!isFinite(result) || isNaN(result)) return null
    // Round to 8 sig figs to avoid floating-point noise
    return parseFloat(result.toPrecision(8))
  } catch { return null }
}

/** Build a function from a y=f(x) expression string. Returns null on failure. */
function buildFn(fnStr: string): ((x: number) => number) | null {
  // Normalise implicit multiplication: 2x → 2*x, x2 → x*2
  const prep = fnStr.trim()
    .replace(/(\d)(x)/g, '$1*$2')
    .replace(/(x)(\d)/g, '$1*$2')

  return (x: number) => {
    try {
      const toks = tokenize(prep)
      const p = new MathParser(toks, { x })
      const v = p.parse()
      return isFinite(v) ? v : NaN
    } catch { return NaN }
  }
}

/** Parse "y = ..." and return the RHS as a function, or null. */
function parseFnLine(text: string): ((x: number) => number) | null {
  const m = text.trim().match(/^y\s*=\s*(.+)$/i)
  if (!m) return null
  return buildFn(m[1])
}

/** Render a tiny SVG graph for a function over [-5, 5]. */
function MiniGraph({ fn }: { fn: (x: number) => number }) {
  const W = 120, H = 80, PAD = 6
  const INNER_W = W - PAD * 2
  const INNER_H = H - PAD * 2

  // Sample the function
  const N = 120
  const xs = Array.from({ length: N + 1 }, (_, i) => -5 + (10 * i) / N)
  const ys = xs.map(fn)
  const validYs = ys.filter(isFinite)
  if (validYs.length < 2) return null

  const yMin = Math.min(...validYs)
  const yMax = Math.max(...validYs)
  const yRange = yMax - yMin || 1

  const toSvgX = (x: number) => PAD + ((x + 5) / 10) * INNER_W
  const toSvgY = (y: number) => PAD + INNER_H - ((y - yMin) / yRange) * INNER_H

  // Build path — break on NaN
  let d = ''
  let penDown = false
  for (let i = 0; i <= N; i++) {
    const sx = toSvgX(xs[i])
    const sy = toSvgY(ys[i])
    if (!isFinite(ys[i])) { penDown = false; continue }
    d += penDown ? `L${sx.toFixed(1)},${sy.toFixed(1)}` : `M${sx.toFixed(1)},${sy.toFixed(1)}`
    penDown = true
  }

  // Axis positions
  const axisX = toSvgX(0)
  const axisY = toSvgY(0)

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={s.miniGraph}
      aria-hidden
    >
      {/* axes */}
      {axisY >= PAD && axisY <= H - PAD && (
        <line x1={PAD} y1={axisY} x2={W - PAD} y2={axisY} className={s.axis} />
      )}
      {axisX >= PAD && axisX <= W - PAD && (
        <line x1={axisX} y1={PAD} x2={axisX} y2={H - PAD} className={s.axis} />
      )}
      {/* curve */}
      <path d={d} className={s.curve} />
    </svg>
  )
}

// ── Session logs ──────────────────────────────────────────────────────────────

interface ScratchLog {
  ts: number
  questionId: string
  strokes: ScratchStrokeData
}

function saveScratchLog(questionId: string, data: ScratchStrokeData) {
  if (!questionId || !data.strokes.length) return
  try {
    const key = 'mc_scratch_logs'
    const raw = localStorage.getItem(key)
    const logs: ScratchLog[] = raw ? JSON.parse(raw) : []
    logs.unshift({ ts: Date.now(), questionId, strokes: data })
    localStorage.setItem(key, JSON.stringify(logs.slice(0, 20)))
  } catch { /* storage unavailable */ }
}

function loadScratchLogs(questionId?: string): ScratchLog[] {
  try {
    const raw = localStorage.getItem('mc_scratch_logs')
    if (!raw) return []
    const logs: ScratchLog[] = JSON.parse(raw)
    return questionId ? logs.filter(l => l.questionId === questionId).slice(0, 5) : logs.slice(0, 5)
  } catch { return [] }
}

function fmtTs(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function pathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''
  const [firstX, firstY] = stroke[0]
  const rest = stroke.slice(1).reduce((acc, [x, y], i, arr) => {
    const [nx, ny] = arr[(i + 1) % arr.length]
    return `${acc} ${x.toFixed(1)},${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)},${((y + ny) / 2).toFixed(1)}`
  }, '')
  return `M ${firstX.toFixed(1)},${firstY.toFixed(1)} Q${rest} Z`
}

function roundStrokes(strokes: Point[][]): Point[][] {
  return strokes.map(stroke =>
    stroke.map(([x, y, p]) => [
      Math.round(x * 10) / 10,
      Math.round(y * 10) / 10,
      Math.round(p * 10) / 10,
    ]),
  )
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Point[][],
  width: number,
  height: number,
  transparentBg = false,
) {
  if (!transparentBg) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.fillStyle = '#1a2234'
  for (const pts of strokes) {
    const outline = getStroke(pts, { size: 3, thinning: 0.6, smoothing: 0.5 })
    if (outline.length) ctx.fill(new Path2D(pathFromStroke(outline)))
  }
}

/** Redraw strokes at `scale`× CSS size — used for transcription (2× legibility). */
export function exportScratchImage(
  strokes: Point[][],
  width: number,
  height: number,
  scale = 2,
): string {
  const off = document.createElement('canvas')
  off.width = Math.round(width * scale)
  off.height = Math.round(height * scale)
  const ctx = off.getContext('2d')
  if (!ctx) return ''
  ctx.scale(scale, scale)
  drawStrokes(ctx, strokes, width, height)
  return off.toDataURL('image/png')
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface EvalLine {
  bbox: InkBbox
  text: string
  latex: string
}

interface Props {
  onChange?: (canvas: HTMLCanvasElement, data: ScratchStrokeData) => void
  height?: number
  lineOverlays?: LineOverlay[]
  /** Transparent canvas over ruled paper — chapter pages. */
  paperMode?: boolean
  /** Transcribed workLines from ScratchTranscriptionPane — used for expression eval overlays. */
  evalLines?: EvalLine[]
  /** Question id used for keying localStorage scratch logs. */
  questionId?: string
}

export default function ScratchPad({
  onChange,
  height = 320,
  lineOverlays,
  paperMode = false,
  evalLines,
  questionId,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Point[][]>([])
  const pointsRef = useRef<Point[]>([])
  const drawingRef = useRef(false)

  // Eraser / fade state
  const [fading, setFading] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  // Logs dropdown
  const [logsOpen, setLogsOpen] = useState(false)
  const logs = useMemo(() => loadScratchLogs(questionId), [questionId, logsOpen]) // recalculate when dropdown opens

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)

    const all = [...strokesRef.current]
    if (pointsRef.current.length) all.push(pointsRef.current)
    drawStrokes(ctx, all, w, h, paperMode)
  }, [paperMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      redraw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [redraw])

  function deliverChange() {
    const canvas = canvasRef.current
    if (!canvas || !onChange) return
    onChange(canvas, {
      strokes: roundStrokes(strokesRef.current),
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    })
  }

  function strokePressure(e: React.PointerEvent) {
    return e.pointerType === 'pen' ? e.pressure : 0.5
  }

  function begin(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType !== 'mouse') e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    pointsRef.current = [[e.nativeEvent.offsetX, e.nativeEvent.offsetY, strokePressure(e)]]
    redraw()
    setConfirmClear(false)
    setLogsOpen(false)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    pointsRef.current.push([e.nativeEvent.offsetX, e.nativeEvent.offsetY, strokePressure(e)])
    redraw()
  }

  function end() {
    if (!drawingRef.current) return
    drawingRef.current = false
    if (pointsRef.current.length) {
      strokesRef.current.push([...pointsRef.current])
      pointsRef.current = []
      redraw()
      deliverChange()
    }
  }

  function doClear() {
    // Save current content to log before clearing
    const canvas = canvasRef.current
    if (canvas && questionId && strokesRef.current.length > 0) {
      saveScratchLog(questionId, {
        strokes: roundStrokes(strokesRef.current),
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      })
    }
    setFading(true)
    setTimeout(() => {
      strokesRef.current = []
      pointsRef.current = []
      drawingRef.current = false
      redraw()
      deliverChange()
      setFading(false)
      setConfirmClear(false)
    }, 200)
  }

  function handleEraserClick() {
    if (strokesRef.current.length === 0) return
    if (confirmClear) {
      doClear()
    } else {
      setConfirmClear(true)
    }
  }

  // ── Expression overlay computation ──────────────────────────────────────────

  interface EvalResult {
    bbox: InkBbox
    computed: number | null
    fn: ((x: number) => number) | null
    label: string
  }

  const evalResults = useMemo<EvalResult[]>(() => {
    if (!evalLines?.length) return []
    return evalLines.map(line => {
      const text = line.text || line.latex || ''
      const fn = parseFnLine(text)
      const computed = fn ? null : safeEval(text)
      const label = computed !== null
        ? `= ${Number.isInteger(computed) ? computed : computed.toPrecision(4).replace(/\.?0+$/, '')}`
        : ''
      return { bbox: line.bbox, computed, fn, label }
    }).filter(r => r.computed !== null || r.fn !== null)
  }, [evalLines])

  return (
    <div className={`${s.wrap} ${paperMode ? s.wrapPaper : ''}`}>
      <div className={`${s.canvasWrap} ${paperMode ? s.canvasWrapPaper : ''}`}>

        {/* Eraser + Logs toolbar (top-right corner) */}
        <div className={s.toolbar} onClick={e => e.stopPropagation()}>
          {confirmClear ? (
            <span className={s.confirmPrompt}>
              Clear?{' '}
              <button type="button" className={s.toolBtn} onClick={doClear}>yes</button>
              {' / '}
              <button type="button" className={s.toolBtn} onClick={() => setConfirmClear(false)}>no</button>
            </span>
          ) : (
            <button
              type="button"
              className={s.toolBtn}
              title="Clear scratch"
              onClick={handleEraserClick}
              aria-label="Erase scratch"
            >
              {/* eraser icon (×) */}
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                <path d="M2 2L11 11M11 2L2 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {questionId && (
            <button
              type="button"
              className={s.toolBtn}
              title="View saved logs"
              onClick={() => setLogsOpen(v => !v)}
              aria-label="Scratch logs"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                <rect x="2" y="2" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="4" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="4" y1="7.5" x2="9" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {logsOpen && logs.length > 0 && (
            <div className={s.logsDropdown}>
              <p className={s.logsTitle}>saved logs</p>
              {logs.map((log, i) => (
                <div key={i} className={s.logEntry}>
                  <span className={s.logTs}>{fmtTs(log.ts)}</span>
                  <span className={s.logMeta}>{log.strokes.strokes.length} strokes</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <canvas
          ref={canvasRef}
          className={`${s.canvas} ${paperMode ? s.canvasPaper : ''} ${fading ? s.canvasFading : ''}`}
          style={paperMode ? { flex: 1, minHeight: height ?? 0, height: height ? undefined : '100%' } : { height }}
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={() => { if (drawingRef.current) end() }}
        />

        {/* Existing line overlays (debug/suspect bboxes) */}
        {lineOverlays && lineOverlays.length > 0 && (
          <div className={s.overlay} aria-hidden>
            {lineOverlays.map((line, i) => {
              const [x, y, w, h] = line.bbox
              return (
                <div
                  key={i}
                  className={`${s.lineBox} ${line.kind === 'suspect' ? s.lineSuspect : s.lineDebug}`}
                  style={{ left: x, top: y, width: w, height: h }}
                />
              )
            })}
          </div>
        )}

        {/* Expression eval overlays */}
        {evalResults.length > 0 && (
          <div className={s.overlay} aria-hidden={false} aria-label="computed results">
            {evalResults.map((r, i) => {
              const [x, y, , h] = r.bbox
              return (
                <div
                  key={i}
                  className={s.evalChip}
                  style={{ left: x, top: y + h + 2 }}
                >
                  {r.fn ? (
                    <MiniGraph fn={r.fn} />
                  ) : (
                    <span className={s.evalResult}>{r.label}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!paperMode && (
        <button type="button" className={s.clearBtn} onClick={handleEraserClick}>Clear</button>
      )}
    </div>
  )
}
