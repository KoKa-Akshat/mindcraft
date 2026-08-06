import { useEffect, useMemo, useRef, useState } from 'react'
import ConfettiBurst from './ConfettiBurst'
import s from './ChapterFinishOverlay.module.css'

const CHAPTER_CHEERS = [
  'Hooray!',
  'You crushed it!',
  'Chapter complete!',
  'Fire work!',
  'That was clean!',
  'Look at you go!',
  'Boss mode!',
  'All done. Legend.',
  'Mic drop.',
  'Congrats!',
  'Spark secured!',
  'What a run!',
] as const

const CHAPTER_SUBS = [
  'Heading home.',
  'Back to Contents.',
  'Nice chapter.',
  'Take the win.',
] as const

export function pickChapterCheer(): string {
  return CHAPTER_CHEERS[Math.floor(Math.random() * CHAPTER_CHEERS.length)]
}

function pickChapterSub(): string {
  return CHAPTER_SUBS[Math.floor(Math.random() * CHAPTER_SUBS.length)]
}

/**
 * Full-bleed end-of-chapter celebration. Random cheer each time, confetti,
 * then fades out and calls onDone so the chapter can navigate home.
 */
export default function ChapterFinishOverlay({
  active,
  conceptName,
  onDone,
  holdMs = 2200,
  fadeMs = 700,
}: {
  active: boolean
  conceptName?: string
  onDone: () => void
  holdMs?: number
  fadeMs?: number
}) {
  const [phase, setPhase] = useState<'idle' | 'show' | 'out'>('idle')
  const cheer = useMemo(() => (active ? pickChapterCheer() : ''), [active])
  const sub = useMemo(() => (active ? pickChapterSub() : ''), [active])
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!active) {
      setPhase('idle')
      return
    }
    setPhase('show')
    const fadeTimer = window.setTimeout(() => setPhase('out'), holdMs)
    const doneTimer = window.setTimeout(() => onDoneRef.current(), holdMs + fadeMs)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(doneTimer)
    }
  }, [active, holdMs, fadeMs])

  if (!active || phase === 'idle') return null

  return (
    <div
      className={`${s.overlay} ${phase === 'out' ? s.overlayOut : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <ConfettiBurst active={phase === 'show'} count={36} durationMs={holdMs} />
      <div className={s.card} key={cheer}>
        <p className={s.eyebrow}>Chapter clear</p>
        <h2 className={s.cheer}>{cheer}</h2>
        {conceptName && <p className={s.concept}>{conceptName}</p>}
        <p className={s.sub}>{sub}</p>
      </div>
    </div>
  )
}
