/**
 * ScratchPad — pressure-aware freehand canvas for student reasoning capture.
 * Uses Pointer Events + perfect-freehand for natural ink strokes.
 */

import { useRef, useEffect, useCallback } from 'react'
import { getStroke } from 'perfect-freehand'
import s from './ScratchPad.module.css'

type Point = [number, number, number]

function pathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''
  const [firstX, firstY] = stroke[0]
  const rest = stroke.slice(1).reduce((acc, [x, y], i, arr) => {
    const [nx, ny] = arr[(i + 1) % arr.length]
    return `${acc} ${x.toFixed(1)},${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)},${((y + ny) / 2).toFixed(1)}`
  }, '')
  return `M ${firstX.toFixed(1)},${firstY.toFixed(1)} Q${rest} Z`
}

interface Props {
  onChange?: (canvas: HTMLCanvasElement) => void
  height?: number
}

export default function ScratchPad({ onChange, height = 320 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Point[][]>([])
  const pointsRef = useRef<Point[]>([])
  const drawingRef = useRef(false)

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
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#1a2234'

    const all = [...strokesRef.current]
    if (pointsRef.current.length) all.push(pointsRef.current)

    for (const pts of all) {
      const outline = getStroke(pts, { size: 3, thinning: 0.6, smoothing: 0.5 })
      if (outline.length) ctx.fill(new Path2D(pathFromStroke(outline)))
    }
  }, [])

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

  function strokePressure(e: React.PointerEvent) {
    return e.pointerType === 'pen' ? e.pressure : 0.5
  }

  function begin(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    pointsRef.current = [[e.nativeEvent.offsetX, e.nativeEvent.offsetY, strokePressure(e)]]
    redraw()
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
      if (canvasRef.current && onChange) onChange(canvasRef.current)
    }
  }

  function clear() {
    strokesRef.current = []
    pointsRef.current = []
    drawingRef.current = false
    redraw()
    if (canvasRef.current && onChange) onChange(canvasRef.current)
  }

  return (
    <div className={s.wrap}>
      <canvas
        ref={canvasRef}
        className={s.canvas}
        style={{ height }}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={() => { if (drawingRef.current) end() }}
      />
      <button type="button" className={s.clearBtn} onClick={clear}>Clear</button>
    </div>
  )
}
