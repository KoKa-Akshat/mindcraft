/**
 * ParabolaOverlay.tsx
 *
 * Draws the black ridge line above the hills (the hand-drawn adumbrate),
 * plus the center-cut once the student earns it. No root/vertex dots.
 */

import { useEffect, useState } from 'react'
import {
  graphXToPercent, graphYToPercent, ridgePathD, visualPeakY,
  BASELINE_Y_PCT, PEAK_Y_PCT,
} from './math/mapping'
import { axisOf, vertexOf, type ZoneQuadratic } from './math/quadratics'
import s from './ParabolaOverlay.module.css'

export default function ParabolaOverlay({
  quadratic,
  revealed,
  axisConfirmed = false,
  showCenterCut = false,
  reducedMotion = false,
}: {
  quadratic: ZoneQuadratic
  revealed: boolean
  axisConfirmed?: boolean
  showCenterCut?: boolean
  reducedMotion?: boolean
}) {
  const [drawn, setDrawn] = useState(reducedMotion)

  useEffect(() => {
    if (!revealed) { setDrawn(false); return }
    if (reducedMotion) { setDrawn(true); return }
    const t = window.setTimeout(() => setDrawn(true), 60)
    return () => window.clearTimeout(t)
  }, [revealed, reducedMotion])

  if (!revealed) return null

  const axis = axisOf(quadratic)
  const v = vertexOf(quadratic)
  const peakY = visualPeakY(quadratic)
  const ridge = ridgePathD(quadratic)
  const axisXPct = graphXToPercent(quadratic, axis)
  const vertexYPct = graphYToPercent(v.y, peakY)
  const cutTop = Math.min(vertexYPct + 2, PEAK_Y_PCT + 8)

  return (
    <svg
      className={`${s.overlay} ${drawn ? s.overlayIn : ''}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* The black line above the hills — no root/vertex dots */}
      <path d={ridge} className={s.adumbrateHalo} />
      <path d={ridge} className={s.adumbrate} />

      {showCenterCut && (
        <>
          <line
            x1={axisXPct} y1={cutTop} x2={axisXPct} y2={BASELINE_Y_PCT}
            className={s.centerCutHalo}
          />
          <line
            x1={axisXPct} y1={cutTop} x2={axisXPct} y2={BASELINE_Y_PCT}
            className={s.centerCut}
          />
        </>
      )}

      {axisConfirmed && !showCenterCut && (
        <line
          x1={axisXPct} y1={BASELINE_Y_PCT} x2={axisXPct} y2={vertexYPct}
          className={s.axisLine}
        />
      )}
    </svg>
  )
}
