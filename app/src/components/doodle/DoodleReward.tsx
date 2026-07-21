import { useEffect, useState } from 'react'
import s from './DoodleReward.module.css'

export const DOODLE_STAMPS = [
  'MAGICAL!',
  'UNSTOPPABLE!',
  'YOU DID IT!',
  'GENIUS LEVEL!',
  'SPARKLY BRAIN!',
] as const

export function pickDoodleStamp(seed?: number): string {
  const i = seed != null
    ? Math.abs(seed) % DOODLE_STAMPS.length
    : Math.floor(Math.random() * DOODLE_STAMPS.length)
  return DOODLE_STAMPS[i]
}

/** High-juice celebration overlay: stamp slam + pastel confetti + margin mascot. */
export default function DoodleReward({
  phrase,
  onDone,
  durationMs = 1600,
}: {
  phrase: string | null
  onDone?: () => void
  durationMs?: number
}) {
  const [bits] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: 8 + ((i * 37) % 84),
      delay: (i % 7) * 0.04,
      hue: i % 5,
      size: 6 + (i % 5) * 2,
      drift: (i % 2 === 0 ? 1 : -1) * (12 + (i % 9) * 4),
    })),
  )

  useEffect(() => {
    if (!phrase) return
    const t = window.setTimeout(() => onDone?.(), durationMs)
    return () => window.clearTimeout(t)
  }, [phrase, durationMs, onDone])

  if (!phrase) return null

  return (
    <div className={s.overlay} aria-live="polite" aria-atomic="true">
      <div className={s.confetti} aria-hidden>
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
      <div className={s.stamp} key={phrase}>{phrase}</div>
      <div className={s.mascot} aria-hidden>
        <span className={s.mascotFace}>★</span>
      </div>
    </div>
  )
}
