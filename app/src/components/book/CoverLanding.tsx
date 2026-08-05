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

/** Soft subject constellation — atmospheric only (college-tutorable worlds).
 *  Non-interactive so they never steal focus from name / open / Find a Tutor. */
const SUBJECT_CHIPS: ReadonlyArray<{ label: string; className: string }> = [
  { label: 'ACT Math', className: s.chipAct },
  { label: 'Writing', className: s.chipWriting },
  { label: 'Fashion', className: s.chipFashion },
  { label: 'Law', className: s.chipLaw },
  { label: 'Violin', className: s.chipViolin },
  { label: 'Spanish', className: s.chipSpanish },
  { label: 'Photography', className: s.chipPhoto },
  { label: 'Coding', className: s.chipCoding },
  { label: 'Philosophy', className: s.chipPhil },
  { label: 'Debate', className: s.chipDebate },
]

/**
 * Cover, redesigned 2026-07-23: no background photo… (sizing match to
 * canvasDesk unchanged). 2026-08-05 pass: drop the big “Let’s go” CTA for
 * an inline name→arrow, host Find a Tutor here, and scatter subject chips
 * as a quiet constellation around the brand.
 */
export default function CoverLanding({
  entryLabel,
  accountName,
  onOpen,
}: {
  entryLabel: string
  /** The student's real signed-in display name (Firestore users/{uid}.displayName,
   * falling back to the Firebase Auth profile name, see useStudentData.ts).
   * Used to greet a returning student by their actual name on first render,
   * instead of making them re-type it every session. A locally-typed override
   * (saved via saveCoverName) still always wins if one exists. */
  accountName?: string
  onOpen: () => void
}) {
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const [name, setName] = useState(() => loadCoverName() || accountName?.trim() || '')

  // accountName resolves async (Firestore read in useStudentData), so it can
  // still be empty on this component's first render. Fill it in the moment it
  // arrives, but never clobber a name the student already typed themselves
  // (this render or a prior session's saved override).
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

  function goFindTutor() {
    markCoverSeen()
    navigate('/find-a-tutor')
  }

  return (
    <div className={`${s.desk} ${closing ? s.deskClosing : ''}`}>
      <div className={s.cover}>
        <div className={s.decor} aria-hidden="true">
          <svg viewBox="0 0 64 64" className={s.doodleStar}><path d="M32 6 L37 26 L57 26 L41 38 L47 58 L32 46 L17 58 L23 38 L7 26 L27 26 Z" /></svg>
          <svg viewBox="0 0 80 40" className={s.doodleWave}><path d="M2 30 Q20 4 40 20 T78 12" fill="none" /></svg>
          <svg viewBox="0 0 48 48" className={s.doodleTri}><path d="M24 6 L44 40 L4 40 Z" fill="none" /><path d="M24 6 L24 40 M4 40 L44 40" /></svg>
        </div>

        <ul className={s.subjectField} aria-hidden="true">
          {SUBJECT_CHIPS.map((chip, i) => (
            <li
              key={chip.label}
              className={`${s.subjectChip} ${chip.className}`}
              style={{ ['--chip-i' as string]: String(i) }}
            >
              {chip.label}
            </li>
          ))}
        </ul>

        <div className={s.coverFace}>
          <span className={s.eyebrow}>study · create · explore</span>
          <span className={s.wordmark}>MindCraft</span>
          <span className={s.wordmarkSub}>your cozy study notebook</span>

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
                placeholder="Type your name"
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

          <button
            type="button"
            className={s.findTutorBtn}
            onClick={goFindTutor}
          >
            <Search size={14} aria-hidden="true" />
            <span>Find a Tutor</span>
          </button>
        </div>
      </div>

      <p className={s.caption}>{entryLabel}</p>
    </div>
  )
}
