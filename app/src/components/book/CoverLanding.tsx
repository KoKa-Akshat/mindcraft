import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Search } from 'lucide-react'
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

type SubjectChip = {
  id: string
  label: string
  tone: string
  slot: string
  /** Only ACT opens the live notebook today. */
  opens: boolean
}

/** Orbit of worlds — ACT is the open book; others live on the shelf. */
const SUBJECT_CHIPS: ReadonlyArray<SubjectChip> = [
  { id: 'act', label: 'ACT Math', tone: s.toneMint, slot: s.slot0, opens: true },
  { id: 'writing', label: 'Writing', tone: s.toneSand, slot: s.slot1, opens: false },
  { id: 'fashion', label: 'Fashion', tone: s.tonePeach, slot: s.slot2, opens: false },
  { id: 'violin', label: 'Violin', tone: s.toneGold, slot: s.slot3, opens: false },
  { id: 'law', label: 'Law', tone: s.toneBlue, slot: s.slot4, opens: false },
  { id: 'coding', label: 'Coding', tone: s.toneMint, slot: s.slot5, opens: false },
  { id: 'spanish', label: 'Spanish', tone: s.tonePeach, slot: s.slot6, opens: false },
  { id: 'photo', label: 'Photography', tone: s.toneBlue, slot: s.slot7, opens: false },
]

/**
 * Cover entry — Deep Field title card. Floating subjects signal a shelf of
 * worlds; the CTA opens the ACT Math notebook that ships today.
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
  const [selectedId, setSelectedId] = useState('act')
  const [shelfNote, setShelfNote] = useState('')

  const selected = SUBJECT_CHIPS.find(c => c.id === selectedId) ?? SUBJECT_CHIPS[0]

  useEffect(() => {
    if (loadCoverName()) return
    const trimmedAccount = accountName?.trim()
    if (trimmedAccount) setName(prev => prev || trimmedAccount)
  }, [accountName])

  function open() {
    if (closing) return
    // Only ACT opens the live Contents notebook for now.
    if (!selected.opens) {
      setShelfNote(`${selected.label} is on the shelf. Opening ACT Math for now.`)
      setSelectedId('act')
      window.setTimeout(() => {
        setClosing(true)
        markCoverSeen()
        window.setTimeout(onOpen, 480)
      }, 720)
      return
    }
    setClosing(true)
    markCoverSeen()
    window.setTimeout(onOpen, 480)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing, selectedId])

  function onNameChange(value: string) {
    setName(value)
    saveCoverName(value.trim())
  }

  function pickSubject(chip: SubjectChip) {
    setSelectedId(chip.id)
    if (chip.opens) {
      setShelfNote('')
    } else {
      setShelfNote(`${chip.label} is coming. ACT Math is open today.`)
    }
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

        <ul className={s.subjectField} aria-label="Subjects on the shelf">
          {SUBJECT_CHIPS.map((chip, i) => {
            const active = chip.id === selectedId
            return (
              <li
                key={chip.id}
                className={`${s.subjectChipWrap} ${chip.slot}`}
                style={{ ['--chip-i' as string]: String(i) }}
              >
                <button
                  type="button"
                  className={`${s.subjectChip} ${chip.tone} ${active ? s.subjectChipActive : ''} ${chip.opens ? s.subjectChipLive : ''}`}
                  onClick={() => pickSubject(chip)}
                  aria-pressed={active}
                  title={chip.opens ? 'Open this notebook' : 'Coming soon'}
                >
                  {chip.label}
                  {chip.opens && <span className={s.chipLiveDot} aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>

        <div className={s.coverFace}>
          <span className={s.eyebrow}>a shelf of worlds</span>
          <button
            type="button"
            className={s.wordmark}
            onClick={open}
            aria-label="Open MindCraft"
          >
            Mind<span className={s.wordmarkCraft}>Craft</span>
          </button>

          <p className={s.entryLine}>
            {selected.opens
              ? 'Open your ACT Math notebook.'
              : `${selected.label} waits on the shelf.`}
          </p>
          <p className={s.shelfHint}>
            ACT is live. Writing, law, violin… more lessons on the orbit.
          </p>

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
                className={s.actBookCta}
                onClick={open}
                aria-label={
                  name.trim()
                    ? `Open ACT Math notebook as ${name.trim()}`
                    : 'Open ACT Math notebook'
                }
              >
                <BookOpen size={16} strokeWidth={2.4} aria-hidden="true" />
                <span className={s.actBookLabel}>ACT Math</span>
                <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
            {shelfNote && (
              <p className={s.shelfNote} role="status">{shelfNote}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
