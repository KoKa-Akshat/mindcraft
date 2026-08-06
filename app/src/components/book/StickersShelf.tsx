import { X } from 'lucide-react'
import {
  COVER_STICKERS,
  COVER_STICKER_EQUIP_CAP,
  formatStickerPrice,
  showStickerFreeBadge,
  stickerShelfNote,
  type StickerPlan,
} from '../../lib/coverStickers'
import RotatableSticker from './RotatableSticker'
import s from './StickersShelf.module.css'

type Props = {
  plan: StickerPlan
  onClose: () => void
  /** Highlight which sticker is the dashboard mascot / cover pick. */
  activeId?: string | null
  /** When set, cards toggle pin state (cover orbit). */
  equippedIds?: string[]
  onToggleEquip?: (id: string) => void
  /** When set, tap replaces the dashboard wizard sticker. */
  onPickMascot?: (id: string) => void
  eyebrow?: string
}

/**
 * Shared Stickers panel for cover + dashboard wizard.
 */
export default function StickersShelf({
  plan,
  onClose,
  activeId = null,
  equippedIds,
  onToggleEquip,
  onPickMascot,
  eyebrow,
}: Props) {
  const freeBadge = showStickerFreeBadge(plan)
  const shelfNote = stickerShelfNote(plan)
  const equipMode = Boolean(onToggleEquip && equippedIds)
  const label = eyebrow ?? (equipMode
    ? `tap to pin · up to ${COVER_STICKER_EQUIP_CAP}`
    : 'tap to set your wizard')

  return (
    <div
      className={s.backdrop}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={s.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stickers-shelf-title"
        onClick={e => e.stopPropagation()}
      >
        <div className={s.head}>
          <div>
            <p className={s.eyebrow}>{label}</p>
            <h2 id="stickers-shelf-title" className={s.title}>Stickers</h2>
          </div>
          <button
            type="button"
            className={s.close}
            onClick={onClose}
            aria-label="Close stickers"
          >
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
        <p className={s.note} role="status">{shelfNote}</p>
        <ul className={s.grid}>
          {COVER_STICKERS.map(sticker => {
            const equipped = equippedIds?.includes(sticker.id) ?? false
            const active = activeId === sticker.id
            const on = equipMode ? equipped : active
            const full = Boolean(equipMode && !equipped && (equippedIds?.length ?? 0) >= COVER_STICKER_EQUIP_CAP)
            function pick() {
              if (full) return
              if (onPickMascot) onPickMascot(sticker.id)
              if (onToggleEquip) onToggleEquip(sticker.id)
            }
            return (
              <li key={sticker.id}>
                <div
                  className={`${s.card} ${on ? s.cardOn : ''} ${full ? s.cardFull : ''}`}
                  aria-pressed={on}
                >
                  <RotatableSticker
                    src={sticker.src}
                    alt={sticker.name}
                    className={s.art}
                    onClick={full ? undefined : pick}
                  />
                  <button
                    type="button"
                    className={s.metaBtn}
                    onClick={pick}
                    disabled={full}
                  >
                    <span className={s.name}>{sticker.name}</span>
                    <span className={s.priceRow}>
                      <span className={s.price}>{formatStickerPrice(sticker.priceUsd)}</span>
                      {freeBadge && <span className={s.free}>Free</span>}
                    </span>
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
