import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, Search } from 'lucide-react'
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
  short: string
  tone: string
  slot: string
  live: boolean
}

/** Orbit of worlds — atmospheric only. ACT is selected in the name row. */
const SUBJECT_CHIPS: ReadonlyArray<SubjectChip> = [
  { id: 'act', label: 'ACT Math', short: 'ACT', tone: s.toneMint, slot: s.slot0, live: true },
  { id: 'writing', label: 'Writing', short: 'Writing', tone: s.toneSand, slot: s.slot1, live: false },
  { id: 'fashion', label: 'Fashion', short: 'Fashion', tone: s.tonePeach, slot: s.slot2, live: false },
  { id: 'violin', label: 'Violin', short: 'Violin', tone: s.toneGold, slot: s.slot3, live: false },
  { id: 'law', label: 'Law', short: 'Law', tone: s.toneBlue, slot: s.slot4, live: false },
  { id: 'coding', label: 'Coding', short: 'Coding', tone: s.toneMint, slot: s.slot5, live: false },
  { id: 'spanish', label: 'Spanish', short: 'Spanish', tone: s.tonePeach, slot: s.slot6, live: false },
  { id: 'photo', label: 'Photography', short: 'Photo', tone: s.toneBlue, slot: s.slot7, live: false },
]

/**
 * Cover entry — Deep Field title card. Floating subjects hint at a shelf of
 * worlds; the name row opens the live ACT notebook.
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
  const [courseOpen, setCourseOpen] = useState(false)
  const courseWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (loadCoverName()) return
    const trimmedAccount = accountName?.trim()
    if (trimmedAccount) setName(prev => prev || trimmedAccount)
  }, [accountName])

  useEffect(() => {
    if (!courseOpen) return
    function onDoc(e: MouseEvent) {
      if (!courseWrapRef.current?.contains(e.target as Node)) setCourseOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCourseOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [courseOpen])

  function open() {
    if (closing) return
    setCourseOpen(false)
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
              key={chip.id}
              className={`${s.subjectChipWrap} ${chip.slot}`}
              style={{ ['--chip-i' as string]: String(i) }}
            >
              <span
                className={`${s.subjectChip} ${chip.tone} ${chip.live ? s.subjectChipLive : s.subjectChipSoon}`}
              >
                {chip.label}
                {chip.live && <span className={s.chipLiveDot} />}
              </span>
            </li>
          ))}
        </ul>

        <div className={s.coverFace}>
          <span className={s.eyebrow}>your notebook</span>
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

              <div className={s.courseWrap} ref={courseWrapRef}>
                <button
                  type="button"
                  className={`${s.courseSelect} ${courseOpen ? s.courseSelectOpen : ''}`}
                  onClick={() => setCourseOpen(v => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={courseOpen}
                  aria-label="Course: ACT Math"
                >
                  <span className={s.courseSelectLabel}>ACT</span>
                  <ChevronDown size={16} strokeWidth={2.6} aria-hidden="true" />
                </button>
                {courseOpen && (
                  <ul className={s.courseMenu} role="listbox" aria-label="Courses">
                    {SUBJECT_CHIPS.map(chip => (
                      <li key={chip.id} role="option" aria-selected={chip.live} aria-disabled={!chip.live}>
                        <button
                          type="button"
                          className={`${s.courseOption} ${chip.live ? s.courseOptionLive : s.courseOptionSoon}`}
                          disabled={!chip.live}
                          onClick={() => {
                            if (!chip.live) return
                            setCourseOpen(false)
                          }}
                        >
                          <span>{chip.label}</span>
                          {!chip.live && <span className={s.courseSoon}>soon</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                className={s.openArrow}
                onClick={open}
                aria-label={
                  name.trim()
                    ? `Open ACT notebook as ${name.trim()}`
                    : 'Open ACT notebook'
                }
              >
                <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
