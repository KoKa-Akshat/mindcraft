/**
 * SoundToggle — small speaker icon button that mutes/unmutes the click
 * feedback sounds (lib/uiSound.ts). State is shared (localStorage +
 * a same-tab change event) so toggling it in one place — Sidebar, a chapter
 * page header, the diagnostic — reflects everywhere immediately.
 */
import { useEffect, useState } from 'react'
import { isSoundMuted, toggleSoundMuted, onSoundMutedChange } from '../lib/uiSound'

export default function SoundToggle({ className }: { className?: string }) {
  const [muted, setMuted] = useState(() => isSoundMuted())

  useEffect(() => onSoundMutedChange(setMuted), [])

  return (
    <button
      type="button"
      className={className}
      onClick={() => setMuted(toggleSoundMuted())}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      aria-pressed={muted}
      title={muted ? 'Sounds off' : 'Sounds on'}
    >
      {muted ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 010 7.07" />
          <path d="M18.36 5.64a9 9 0 010 12.73" />
        </svg>
      )}
    </button>
  )
}
