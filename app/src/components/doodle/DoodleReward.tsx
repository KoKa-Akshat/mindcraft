import { useEffect } from 'react'
import ConfettiBurst from './ConfettiBurst'
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
  useEffect(() => {
    if (!phrase) return
    const t = window.setTimeout(() => onDone?.(), durationMs)
    return () => window.clearTimeout(t)
  }, [phrase, durationMs, onDone])

  if (!phrase) return null

  return (
    <div className={s.overlay} aria-live="polite" aria-atomic="true">
      <ConfettiBurst active count={28} durationMs={durationMs} />
      <div className={s.stamp} key={phrase}>{phrase}</div>
      <div className={s.mascot} aria-hidden>
        <span className={s.mascotFace}>★</span>
      </div>
    </div>
  )
}
