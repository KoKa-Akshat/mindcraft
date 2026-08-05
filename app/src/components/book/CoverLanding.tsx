import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { ArrowRight, Search, Sparkles, X } from 'lucide-react'
import { useUser } from '../../App'
import { db } from '../../firebase'
import {
  COVER_STICKERS,
  COVER_STICKER_EQUIP_CAP,
  canEquipCoverSticker,
  coverStickerById,
  formatStickerPrice,
  loadEquippedCoverStickers,
  parseStickerPlan,
  saveEquippedCoverStickers,
  showStickerFreeBadge,
  stickerShelfNote,
  type StickerPlan,
} from '../../lib/coverStickers'
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

const EQUIP_SLOTS = [s.equip0, s.equip1, s.equip2, s.equip3] as const

/**
 * Cover entry: floating worlds + Stickers shelf; center is name + arrow.
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
  const user = useUser()
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const [name, setName] = useState(() => loadCoverName() || accountName?.trim() || '')
  const [hiddenSubjects, setHiddenSubjects] = useState<string[]>(() => loadHiddenSubjects())
  const [equipped, setEquipped] = useState<string[]>(() => loadEquippedCoverStickers())
  const [storeOpen, setStoreOpen] = useState(false)
  const [stickerPlan, setStickerPlan] = useState<StickerPlan>('testing')

  useEffect(() => {
    if (loadCoverName()) return
    const trimmedAccount = accountName?.trim()
    if (trimmedAccount) setName(prev => prev || trimmedAccount)
  }, [accountName])

  useEffect(() => {
    const uid = user?.uid
    if (!uid) {
      setStickerPlan('testing')
      return
    }
    let cancelled = false
    void getDoc(doc(db, 'users', uid))
      .then(snap => {
        if (cancelled) return
        setStickerPlan(parseStickerPlan(snap.data()?.stickerPlan))
      })
      .catch(() => {
        if (!cancelled) setStickerPlan('testing')
      })
    return () => { cancelled = true }
  }, [user?.uid])

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

  function toggleSticker(id: string) {
    if (!canEquipCoverSticker(stickerPlan) && !equipped.includes(id)) return
    setEquipped(prev => {
      const next = prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length >= COVER_STICKER_EQUIP_CAP
          ? prev
          : [...prev, id]
      saveEquippedCoverStickers(next)
      return next
    })
  }

  const freeBadge = showStickerFreeBadge(stickerPlan)
  const shelfNote = stickerShelfNote(stickerPlan)

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
            <span>Stickers</span>
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

        <ul className={s.equipField} aria-label="Stickers on your cover">
          {equipped.map((id, i) => {
            const sticker = coverStickerById(id)
            if (!sticker) return null
            const slot = EQUIP_SLOTS[i] ?? EQUIP_SLOTS[0]
            return (
              <li key={id} className={`${s.equipWrap} ${slot}`}>
                <div className={s.equipSticker}>
                  <img src={sticker.src} alt={sticker.name} draggable={false} />
                  <button
                    type="button"
                    className={s.equipDismiss}
                    onClick={() => toggleSticker(id)}
                    title={`Remove ${sticker.name}`}
                    aria-label={`Remove ${sticker.name}`}
                  >
                    <X size={12} strokeWidth={3} aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
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
              aria-labelledby="cover-stickers-title"
              onClick={e => e.stopPropagation()}
            >
              <div className={s.storeHead}>
                <div>
                  <p className={s.storeEyebrow}>tap to pin · up to {COVER_STICKER_EQUIP_CAP}</p>
                  <h2 id="cover-stickers-title" className={s.storeTitle}>Stickers</h2>
                </div>
                <button
                  type="button"
                  className={s.storeClose}
                  onClick={() => setStoreOpen(false)}
                  aria-label="Close stickers"
                >
                  <X size={18} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
              <p className={s.storeNote} role="status">{shelfNote}</p>
              <ul className={s.storeGrid}>
                {COVER_STICKERS.map(sticker => {
                  const on = equipped.includes(sticker.id)
                  const full = !on && equipped.length >= COVER_STICKER_EQUIP_CAP
                  return (
                    <li key={sticker.id}>
                      <button
                        type="button"
                        className={`${s.storeCard} ${on ? s.storeCardOn : ''} ${full ? s.storeCardFull : ''}`}
                        onClick={() => toggleSticker(sticker.id)}
                        disabled={full}
                        aria-pressed={on}
                      >
                        <img src={sticker.src} alt="" className={s.storeArt} draggable={false} />
                        <span className={s.storeName}>{sticker.name}</span>
                        <span className={s.storePriceRow}>
                          <span className={s.storePrice}>{formatStickerPrice(sticker.priceUsd)}</span>
                          {freeBadge && <span className={s.storeFree}>Free</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
