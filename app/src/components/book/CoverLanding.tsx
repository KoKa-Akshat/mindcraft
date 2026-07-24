import { useEffect, useState } from 'react'
import s from './CoverLanding.module.css'

const SEEN_KEY = 'mc-cover-seen-session'
const NAME_KEY = 'mc-student-display-name'

/** Has the student already opened the cover once this browser session? */
export function coverAlreadySeen(): boolean {
  try { return sessionStorage.getItem(SEEN_KEY) === '1' } catch { return true }
}

function markCoverSeen() {
  try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
}

/** Whatever name the student last typed on the cover, if any. Read by
 * anything downstream that wants to personalize a greeting (kept as a
 * plain client-side nicety, not synced to Firestore). */
export function loadCoverName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' }
}

function saveCoverName(name: string) {
  try { localStorage.setItem(NAME_KEY, name) } catch { /* ignore */ }
}

/**
 * Cover, redesigned 2026-07-23: no background photo (the old
 * mindcraft-cover-hero.jpg was a portrait-shot image forced into this
 * full-bleed landscape box via object-fit: cover, which is what produced the
 * "blending artifact bleeding on the right edge" Akshat flagged, the photo's
 * bright window content got cropped/stretched toward the right edge and
 * washed out against the dark vignette scrim sitting on top of it), calmer
 * lighter colors (dropped the saturated hot-pink ribbon + heavy dark scrim
 * in favor of the same soft parchment/violet desk palette everything else
 * uses), and a name input so the cover greets the student by name.
 * Sizing is unchanged from the 2026-07-23 full-bleed fix (still exactly
 * matches Dashboard.module.css's .canvasDesk padding formula).
 */
export default function CoverLanding({
  entryLabel,
  onOpen,
}: {
  entryLabel: string
  onOpen: () => void
}) {
  const [closing, setClosing] = useState(false)
  const [name, setName] = useState(() => loadCoverName())

  function open() {
    if (closing) return
    setClosing(true)
    markCoverSeen()
    window.setTimeout(onOpen, 480)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Enter while typing a name should submit the name field, not blow
      // past it and open the notebook out from under the student.
      if ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing])

  function onNameChange(value: string) {
    setName(value)
    saveCoverName(value.trim())
  }

  const trimmed = name.trim()

  return (
    <div className={`${s.desk} ${closing ? s.deskClosing : ''}`}>
      <div className={s.cover}>
        <div className={s.decor} aria-hidden="true">
          <svg viewBox="0 0 64 64" className={s.doodleStar}><path d="M32 6 L37 26 L57 26 L41 38 L47 58 L32 46 L17 58 L23 38 L7 26 L27 26 Z" /></svg>
          <svg viewBox="0 0 80 40" className={s.doodleWave}><path d="M2 30 Q20 4 40 20 T78 12" fill="none" /></svg>
          <svg viewBox="0 0 48 48" className={s.doodleTri}><path d="M24 6 L44 40 L4 40 Z" fill="none" /><path d="M24 6 L24 40 M4 40 L44 40" /></svg>
        </div>

        <div className={s.coverFace}>
          <span className={s.eyebrow}>ACT Math</span>
          <span className={s.wordmark}>MindCraft</span>
          <span className={s.wordmarkSub}>your cozy study notebook</span>

          <div className={s.nameField}>
            <label className={s.nameLabel} htmlFor="cover-name">What should we call you?</label>
            <input
              id="cover-name"
              type="text"
              className={s.nameInput}
              value={name}
              onChange={e => onNameChange(e.target.value)}
              placeholder="Type your name"
              maxLength={40}
              autoComplete="given-name"
            />
          </div>

          <button
            type="button"
            className={s.openBtn}
            onClick={open}
          >
            {/* No separate aria-label: the visible text IS the accessible
             * name here, so a screen reader announces the personalized
             * "Let's go, {name}" too, not a generic label frozen at "Open
             * your notebook" while the sighted text changes underneath it. */}
            {trimmed ? `Let's go, ${trimmed} →` : 'Tap to open →'}
          </button>
        </div>
      </div>

      <p className={s.caption}>{entryLabel}</p>
    </div>
  )
}
