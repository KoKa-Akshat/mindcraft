import { useEffect, useState } from 'react'
import coverHero from '../../assets/canvas/mindcraft-cover-hero.jpg'
import s from './CoverLanding.module.css'

const SEEN_KEY = 'mc-cover-seen-session'

/** Has the student already opened the cover once this browser session? */
export function coverAlreadySeen(): boolean {
  try { return sessionStorage.getItem(SEEN_KEY) === '1' } catch { return true }
}

function markCoverSeen() {
  try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
}

/**
 * Soft pastel notebook cover — tap to open into the canvas desk.
 * Shown once per browser session.
 */
export default function CoverLanding({
  entryLabel,
  onOpen,
}: {
  entryLabel: string
  onOpen: () => void
}) {
  const [closing, setClosing] = useState(false)

  function open() {
    if (closing) return
    setClosing(true)
    markCoverSeen()
    window.setTimeout(onOpen, 480)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing])

  return (
    <div className={`${s.desk} ${closing ? s.deskClosing : ''}`}>
      <button
        type="button"
        className={s.cover}
        onClick={open}
        aria-label="Open your MindCraft ACT notebook"
      >
        <img className={s.hero} src={coverHero} alt="" draggable={false} />
        <div className={s.scrim} aria-hidden />
        <div className={s.coverFace}>
          <span className={s.eyebrow}>ACT Math</span>
          <span className={s.wordmark}>MindCraft</span>
          <span className={s.wordmarkSub}>your cozy study notebook</span>
          <span className={s.openCue}>tap to open →</span>
        </div>
        <div className={s.ribbon} aria-hidden="true" />
      </button>

      <p className={s.caption}>{entryLabel}</p>
    </div>
  )
}
