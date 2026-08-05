import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Search, Sparkles, X } from 'lucide-react'
import s from './CoverLanding.module.css'

const SEEN_KEY = 'mc-cover-seen-session'
const NAME_KEY = 'mc-student-display-name'
const HIDDEN_SUBJECTS_KEY = 'mc-cover-hidden-subjects'

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

function loadHiddenSubjects(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_SUBJECTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveHiddenSubjects(labels: string[]) {
  try { localStorage.setItem(HIDDEN_SUBJECTS_KEY, JSON.stringify(labels)) } catch { /* ignore */ }
}

type SubjectChip = {
  label: string
  tone: string
  slot: string
  live?: boolean
}

/** Atmospheric subject orbit. ACT stays; others can be dismissed. */
const SUBJECT_CHIPS: ReadonlyArray<SubjectChip> = [
  { label: 'ACT Math', tone: s.toneMint, slot: s.slot0, live: true },
  { label: 'Writing', tone: s.toneSand, slot: s.slot1 },
  { label: 'Fashion', tone: s.tonePeach, slot: s.slot2 },
  { label: 'Violin', tone: s.toneGold, slot: s.slot3 },
  { label: 'Law', tone: s.toneBlue, slot: s.slot4 },
  { label: 'Coding', tone: s.toneMint, slot: s.slot5 },
  { label: 'Spanish', tone: s.tonePeach, slot: s.slot6 },
  { label: 'Photography', tone: s.toneBlue, slot: s.slot7 },
]

/**
 * Cover entry — floating worlds in orbit; center is name + arrow into the notebook.
 * Sticker store scaffold waits for catalog ideas.
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
  const [hiddenSubjects, setHiddenSubjects] = useState<string[]>(() => loadHiddenSubjects())
  const [storeOpen, setStoreOpen] = useState(false)

  useEffect(() => {
    if (loadCoverName()) return
    const trimmedAccount = accountName?.trim()
    if (trimmedAccount) setName(prev => prev || trimmedAccount)
  }, [accountName])

  function open() {
    if (closing) return
    setStoreOpen(false)
    setClosing(true)
    markCoverSeen()
    window.setTimeout(onOpen, 480)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && storeOpen) {
        setStoreOpen(false)
        return
      }
      if ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing, storeOpen])

  function onNameChange(value: string) {
    setName(value)
    saveCoverName(value.trim())
  }

  function dismissSubject(label: string) {
    setHiddenSubjects(prev => {
      if (prev.includes(label)) return prev
      const next = [...prev, label]
      saveHiddenSubjects(next)
      return next
    })
  }

  function goFindTutor() {
    markCoverSeen()
    navigate('/find-a-tutor')
  }

  const visibleChips = SUBJECT_CHIPS.filter(
    chip => chip.live || !hiddenSubjects.includes(chip.label),
  )

  return (
    <div className={`${s.desk} ${closing ? s.deskClosing : ''}`}>
      <div className={s.cover}>
        <div className={s.wash} aria-hidden="true" />

        <div className={s.topActions}>
          <button
            type="button"
            className={s.stickerStoreBtn}
            onClick={() => setStoreOpen(true)}
          >
            <Sparkles size={17} strokeWidth={2.5} aria-hidden="true" />
            <span>Sticker Store</span>
          </button>
          <button
            type="button"
            className={s.findTutorBtn}
            onClick={goFindTutor}
          >
            <Search size={18} strokeWidth={2.6} aria-hidden="true" />
            <span>Find a Tutor</span>
          </button>
        </div>

        <ul className={s.subjectField} aria-label="Subjects on the shelf">
          {visibleChips.map((chip, i) => (
            <li
              key={chip.label}
              className={`${s.subjectChipWrap} ${chip.slot}`}
              style={{ ['--chip-i' as string]: String(i) }}
            >
              {chip.live ? (
                <span className={`${s.subjectChip} ${chip.tone} ${s.subjectChipLive}`}>
                  {chip.label}
                  <span className={s.chipLiveDot} aria-hidden="true" />
                </span>
              ) : (
                <span className={`${s.subjectChip} ${chip.tone} ${s.subjectChipRemovable}`}>
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    className={s.chipDismiss}
                    onClick={() => dismissSubject(chip.label)}
                    aria-label={`Remove ${chip.label}`}
                    title="Remove"
                  >
                    <X size={12} strokeWidth={3} aria-hidden="true" />
                  </button>
                </span>
              )}
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

        {storeOpen && (
          <div
            className={s.storeBackdrop}
            role="presentation"
            onClick={() => setStoreOpen(false)}
          >
            <div
              className={s.storePanel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cover-sticker-store-title"
              onClick={e => e.stopPropagation()}
            >
              <div className={s.storeHead}>
                <div>
                  <p className={s.storeEyebrow}>coming soon</p>
                  <h2 id="cover-sticker-store-title" className={s.storeTitle}>Sticker Store</h2>
                </div>
                <button
                  type="button"
                  className={s.storeClose}
                  onClick={() => setStoreOpen(false)}
                  aria-label="Close sticker store"
                >
                  <X size={18} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
              <p className={s.storeCopy}>
                Drop your sticker ideas here next — we’ll stock the shelf.
              </p>
              <div className={s.storeGrid} aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className={s.storeSlot}>
                    <Sparkles size={20} strokeWidth={2} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
