import { useEffect, useMemo, useRef, useState } from 'react'
import { interestHue } from '../../lib/sparkMatch'
import s from './BubbleField.module.css'

export interface BubblePulse {
  interest: string
  at: number
}

interface Bubble {
  id: number
  x: number
  y: number
  size: number
  layer: number
  driftX: number
  driftY: number
  phase: number
  hue?: number
}

interface Props {
  active: boolean
  gather: boolean
  count?: number
  pulses?: BubblePulse[]
}

function makeBubbles(count: number, w: number, h: number): Bubble[] {
  const out: Bubble[] = []
  for (let i = 0; i < count; i++) {
    const layer = i % 3
    const size = 12 + Math.pow(Math.random(), 2.2) * (layer === 0 ? 100 : layer === 1 ? 60 : 36)
    out.push({
      id: i,
      x: Math.random() * w,
      y: Math.random() * h,
      size,
      layer,
      driftX: (Math.random() - 0.5) * 0.35,
      driftY: (Math.random() - 0.5) * 0.28,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return out
}

export default function BubbleField({ active, gather, count = 48, pulses = [] }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const tRef = useRef(0)

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const bubbleCount = reducedMotion ? Math.floor(count * 0.5) : count
  const [bubbles, setBubbles] = useState<Bubble[]>(() =>
    makeBubbles(bubbleCount, typeof window !== 'undefined' ? window.innerWidth : 1200, 800),
  )
  const bubblesRef = useRef(bubbles)
  bubblesRef.current = bubbles

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setBubbles(makeBubbles(bubbleCount, rect.width || window.innerWidth, rect.height || window.innerHeight))
  }, [bubbleCount])

  useEffect(() => {
    if (!active || reducedMotion) return
    const el = wrapRef.current
    if (!el) return

    const nodes = el.querySelectorAll<HTMLDivElement>(`.${s.bubble}`)
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(32, now - last) / 1000
      last = now
      tRef.current += dt
      const t = tRef.current
      const cx = (el.clientWidth || window.innerWidth) * 0.5
      const cy = (el.clientHeight || window.innerHeight) * 0.5

      bubblesRef.current.forEach((b, i) => {
        const node = nodes[i]
        if (!node) return

        let x = b.x + Math.sin(t * 0.4 + b.phase) * 18 * b.driftX + t * b.driftX * 12
        let y = b.y + Math.cos(t * 0.35 + b.phase) * 14 * b.driftY + t * b.driftY * 10

        if (gather) {
          const pull = 0.04 + b.layer * 0.01
          x += (cx - x) * pull
          y += (cy - y) * pull
        }

        const w = el.clientWidth || window.innerWidth
        const h = el.clientHeight || window.innerHeight
        if (x < -b.size) x = w + b.size
        if (x > w + b.size) x = -b.size
        if (y < -b.size) y = h + b.size
        if (y > h + b.size) y = -b.size

        b.x = x
        b.y = y

        const pulse = pulses.find(p => now - p.at < 2000)
        const hue = pulse ? interestHue(pulse.interest) : b.hue
        if (hue != null) {
          node.style.background = `hsla(${hue}, 62%, 68%, ${0.08 + b.layer * 0.04})`
          node.style.boxShadow = `0 0 ${b.size * 0.4}px hsla(${hue}, 80%, 70%, 0.15)`
        }

        node.style.transform = `translate3d(${x - b.size / 2}px, ${y - b.size / 2}px, 0)`
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, gather, pulses, reducedMotion])

  return (
    <div
      ref={wrapRef}
      className={`${s.field} ${active ? s.fieldActive : ''} ${gather ? s.fieldGather : ''}`}
      aria-hidden
    >
      {bubbles.map(b => (
        <div
          key={b.id}
          className={`${s.bubble} ${s[`layer${b.layer}`]}`}
          style={{ width: b.size, height: b.size }}
        />
      ))}
    </div>
  )
}
