import { useEffect, useState } from 'react'
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
 * CoverLanding — the physical notebook cover a student lands on before the
 * open spread. Full-bleed Deep Field desk, a near-black cover object with
 * a lime elastic band, a red ribbon, and a column of ring-binder hooks down
 * the spine. Click anywhere, or press Enter, to open into the dashboard.
 *
 * Shown once per browser session (DASHBOARD_NOTEBOOK_SPEC.md §2.1) — skipped
 * on subsequent same-session navigations back to /dashboard.
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
    window.setTimeout(onOpen, 520)
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
        aria-label="Open your MindCraft journal"
      >
        <div className={s.spine} aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={s.hook}>
              <span className={s.hookHole} />
            </span>
          ))}
        </div>

        <div className={s.coverFace}>
          <span className={s.wordmark}>MindCraft</span>
          <span className={s.wordmarkSub}>field journal</span>
        </div>

        <div className={s.elastic} aria-hidden="true" />
        <div className={s.ribbon} aria-hidden="true" />
      </button>

      <p className={s.caption}>{entryLabel}</p>
    </div>
  )
}
