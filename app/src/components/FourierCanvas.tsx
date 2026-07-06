import { useRef, useEffect } from 'react'

interface Props {
  className?: string
}

// Draws an animated Fourier series decomposition of a square wave.
// N odd harmonics; each is a rotating phasor. The sum traces the wave.
export default function FourierCanvas({ className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvasEl = ref.current
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d')!
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const HARMONICS = [1, 3, 5, 7, 11, 13, 17]

    const resize = () => {
      const parent = canvasEl.parentElement
      if (!parent) return
      const { width, height } = parent.getBoundingClientRect()
      canvasEl.width = Math.round(width * dpr)
      canvasEl.height = Math.round(height * dpr)
      canvasEl.style.width = width + 'px'
      canvasEl.style.height = height + 'px'
    }
    resize()

    const ro = new ResizeObserver(resize)
    if (canvasEl.parentElement) ro.observe(canvasEl.parentElement)

    const wave: number[] = []
    let t = 0
    let rafId: number

    const draw = () => {
      const W = canvasEl.width / dpr
      const H = canvasEl.height / dpr

      // Reset transform each frame
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const cx = W * 0.30
      const cy = H * 0.50
      const BASE_R = Math.min(W, H) * 0.13

      // Subtle background grid
      ctx.strokeStyle = 'rgba(196,245,71,0.04)'
      ctx.lineWidth = 0.5
      const GRID = 40
      for (let gx = 0; gx < W; gx += GRID) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
      }
      for (let gy = 0; gy < H; gy += GRID) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
      }

      // Horizontal center line
      ctx.strokeStyle = 'rgba(196,245,71,0.10)'
      ctx.lineWidth = 0.75
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke()

      // Draw phasors
      let px = cx, py = cy
      for (let i = 0; i < HARMONICS.length; i++) {
        const n = HARMONICS[i]
        const r = (BASE_R * 4) / (n * Math.PI)
        const angle = n * t

        // Circle (fades with harmonic index)
        const circleAlpha = 0.22 - i * 0.025
        ctx.beginPath()
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(196,245,71,${Math.max(circleAlpha, 0.04).toFixed(2)})`
        ctx.lineWidth = 0.75
        ctx.stroke()

        const nx = px + r * Math.cos(angle)
        const ny = py + r * Math.sin(angle)

        // Arm
        const armAlpha = 0.75 - i * 0.07
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(nx, ny)
        ctx.strokeStyle = `rgba(196,245,71,${Math.max(armAlpha, 0.1).toFixed(2)})`
        ctx.lineWidth = i === 0 ? 2 : 1.2
        ctx.stroke()

        // Tip
        if (i < 3) {
          ctx.beginPath()
          ctx.arc(nx, ny, i === 0 ? 3 : 2, 0, Math.PI * 2)
          ctx.fillStyle = '#c4f547'
          ctx.globalAlpha = 0.7
          ctx.fill()
          ctx.globalAlpha = 1
        }

        px = nx
        py = ny
      }

      // Wave start X
      const totalR = HARMONICS.reduce((sum, n) => sum + (BASE_R * 4) / (n * Math.PI), 0)
      const WAVE_X = cx + totalR + 28

      // Store wave point
      wave.unshift(py)
      const MAX_LEN = Math.max(10, Math.floor(W - WAVE_X - 8))
      if (wave.length > MAX_LEN) wave.length = MAX_LEN

      // Dashed connector from last phasor tip to wave start
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(WAVE_X, wave[0])
      ctx.setLineDash([3, 6])
      ctx.strokeStyle = 'rgba(196,245,71,0.28)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])

      // Wave — gradient fade from bright at front to ghost at tail
      for (let i = 1; i < wave.length; i++) {
        const progress = i / wave.length
        const alpha = (1 - progress) * 0.9 + 0.08
        ctx.beginPath()
        ctx.moveTo(WAVE_X + i - 1, wave[i - 1])
        ctx.lineTo(WAVE_X + i, wave[i])
        ctx.strokeStyle = `rgba(196,245,71,${alpha.toFixed(2)})`
        ctx.lineWidth = 1.8
        ctx.stroke()
      }

      // Center dot at phasor origin
      ctx.beginPath()
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(196,245,71,0.4)'
      ctx.fill()

      t += 0.018
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
