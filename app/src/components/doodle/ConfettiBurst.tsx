import { useEffect, useState } from 'react'
import s from './ConfettiBurst.module.css'

/** Generates the same pastel-bit layout DoodleReward always used —
 *  pulled out so it's one function instead of two copies. */
function makeBits(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 8 + ((i * 37) % 84),
    delay: (i % 7) * 0.04,
    hue: i % 5,
    size: 6 + (i % 5) * 2,
    drift: (i % 2 === 0 ? 1 : -1) * (12 + (i % 9) * 4),
  }))
}

/**
 * ConfettiBurst — the reusable confetti-only piece of DoodleReward's
 * celebration overlay (no stamp text, no mascot). Renders nothing while
 * `active` is false; mount it as a sibling positioned over whatever should
 * celebrate (parent needs `position: relative`).
 *
 * Usage: keep `active` true for `durationMs`, then flip back to false
 * (call `onDone` to do that) before triggering again — the burst re-plays
 * because the DOM nodes are freshly created each time active flips
 * false → true, same mechanism DoodleReward already relied on.
 */
export default function ConfettiBurst({
  active,
  count = 20,
  durationMs = 900,
  onDone,
}: {
  active: boolean
  count?: number
  durationMs?: number
  onDone?: () => void
}) {
  const [bits] = useState(() => makeBits(count))

  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => onDone?.(), durationMs)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, durationMs])

  if (!active) return null

  return (
    <div className={s.wrap} aria-hidden>
      {bits.map(b => (
        <span
          key={b.id}
          className={`${s.bit} ${s[`hue${b.hue}` as keyof typeof s] ?? s.hue0}`}
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            animationDelay: `${b.delay}s`,
            ['--drift' as string]: `${b.drift}px`,
          }}
        />
      ))}
    </div>
  )
}
