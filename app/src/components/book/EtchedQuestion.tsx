/**
 * EtchedQuestion  -  a practice item rendered as ink on ruled paper.
 * Equations in standard form (Ax + By = C) get a small coordinate sketch.
 */
import { useMemo } from 'react'
import MathText from '../MathText'
import s from './EtchedQuestion.module.css'

/** Detect Ax + By = C (or − variants) for a mini slope sketch. */
function lineFromEquation(text: string): { m: number; b: number } | null {
  const cleaned = text.replace(/\$/g, '').replace(/\\[()]/g, '')
  const m = cleaned.match(
    /(-?\d+)\s*[x×]\s*([+-])\s*(-?\d+)\s*[y]\s*=\s*(-?\d+)/i,
  )
  if (!m) return null
  const a = Number(m[1])
  const sign = m[2] === '+' ? 1 : -1
  const bCoeff = sign * Number(m[3])
  const c = Number(m[4])
  if (!a || !bCoeff) return null
  // ax + by = c  →  y = (c - ax) / b  →  slope m = -a/b, intercept = c/b
  return { m: -a / bCoeff, b: c / bCoeff }
}

function MiniLineGraph({ slope, intercept }: { slope: number; intercept: number }) {
  const w = 120
  const h = 72
  const pad = 10
  const x0 = pad
  const x1 = w - pad
  const toY = (x: number) => {
    const y = slope * x + intercept
    const mid = h / 2
    return mid - y * 8
  }
  const y0 = Math.max(pad, Math.min(h - pad, toY(0)))
  const y1 = Math.max(pad, Math.min(h - pad, toY(10)))
  return (
    <svg className={s.miniGraph} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(102,92,78,0.25)" strokeWidth="1" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="rgba(102,92,78,0.25)" strokeWidth="1" />
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="rgba(61,47,31,0.55)" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export default function EtchedQuestion({
  text,
  tag,
  compact = false,
}: {
  text: string
  tag?: string
  compact?: boolean
}) {
  const line = useMemo(() => lineFromEquation(text), [text])
  return (
    <div className={`${s.etched}${compact ? ` ${s.compact}` : ''}`}>
      {tag && <span className={s.tag}>{tag}</span>}
      <div className={s.body}>
        <p className={s.stem}><MathText text={text} /></p>
        {line && (
          <div className={s.graphWrap}>
            <MiniLineGraph slope={line.m} intercept={line.b} />
            <span className={s.graphCaption}>sketch the line</span>
          </div>
        )}
      </div>
      <div className={s.writeSpace} aria-hidden="true">
        <span className={s.writeHint}>your work</span>
      </div>
    </div>
  )
}
