import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import s from './CoverLanding.module.css'

const SEEN_KEY = 'mc-cover-seen-session'
const NAME_KEY = 'mc-student-display-name'

/** Has the student already opened the cover once this browser session? */
export function coverAlreadySeen(): boolean {
  // Fail open: storage errors should still show the cover, not skip it.
  try { return sessionStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}

function markCoverSeen() {
  try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
}

/** Clear so the next dashboard visit (e.g. after login) shows the cover again. */
export function clearCoverSeen() {
  try { sessionStorage.removeItem(SEEN_KEY) } catch { /* ignore */ }
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

/** Atmospheric subject orbit — college-tutorable worlds, non-interactive. */
const SUBJECT_CHIPS: ReadonlyArray<{ label: string; tone: string; slot: string }> = [
  { label: 'ACT Math', tone: s.toneMint, slot: s.slot0 },
  { label: 'Writing', tone: s.toneSand, slot: s.slot1 },
  { label: 'Fashion', tone: s.tonePeach, slot: s.slot2 },
  { label: 'Violin', tone: s.toneGold, slot: s.slot3 },
  { label: 'Law', tone: s.toneBlue, slot: s.slot4 },
  { label: 'Coding', tone: s.toneMint, slot: s.slot5 },
  { label: 'Spanish', tone: s.tonePeach, slot: s.slot6 },
  { label: 'Photography', tone: s.toneBlue, slot: s.slot7 },
]

/**
 * Cover entry — marketing cream/mint/leaf system, Find a Tutor in the
 * top-right, subject chips in a composed orbit (not a random scatter).
 */
export default function CoverLanding({
  accountName,
  onOpen,
}: {
  /** Kept for call-site compat; caption removed from the cover. */
  entryLabel?: string
  accountName?: string
  onOpen: () => void
}) {
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const [name, setName] = useState(() => loadCoverName() || accountName?.trim() || '')

  useEffect(() => {
    if (loadCoverName()) return
    const trimmedAccount = accountName?.trim()
    if (trimmedAccount) setName(prev => prev || trimmedAccount)
  }, [accountName])

  function open() {
    if (closing) return
    setClosing(true)
    markCoverSeen()
    window.setTimeout(onOpen, 480)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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

  function goFindTutor() {
    markCoverSeen()
    navigate('/find-a-tutor')
  }

  return (
    <div className={`${s.desk} ${closing ? s.deskClosing : ''}`}>
      <div className={s.cover}>
        <div className={s.wash} aria-hidden="true" />

        <button
          type="button"
          className={s.findTutorBtn}
          onClick={goFindTutor}
        >
          <Search size={14} strokeWidth={2.4} aria-hidden="true" />
          <span>Find a Tutor</span>
        </button>

        <ul className={s.subjectField} aria-hidden="true">
          {SUBJECT_CHIPS.map((chip, i) => (
            <li
              key={chip.label}
              className={`${s.subjectChip} ${chip.tone} ${chip.slot}`}
              style={{ ['--chip-i' as string]: String(i) }}
            >
              {chip.label}
            </li>
          ))}
        </ul>

        <div className={s.coverFace}>
          <span className={s.eyebrow}>study · create · explore</span>
          <button
            type="button"
            className={s.wordmark}
            onClick={open}
            aria-label="Open MindCraft"
          >
            Mind<span className={s.wordmarkCraft}>Craft</span>
          </button>

          <p className={s.entryLine}>Your map starts here.</p>

          <div className={s.nameField}>
            <label className={s.nameLabel} htmlFor="cover-name">What should we call you?</label>
            <div className={s.nameRow}>
              <input
                id="cover-name"
                type="text"
                className={s.nameInput}
                value={name}
                onChange={e => onNameChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    open()
                  }
                }}
                placeholder="Your name"
                maxLength={40}
                autoComplete="given-name"
              />
              <button
                type="button"
                className={s.openArrow}
                onClick={open}
                aria-label={name.trim() ? `Open notebook as ${name.trim()}` : 'Open your notebook'}
              >
                <ArrowRight size={20} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
