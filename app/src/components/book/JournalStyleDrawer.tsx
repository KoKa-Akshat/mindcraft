import { useState } from 'react'
import {
  type DashboardSticker,
  type DashboardTheme,
  type PaperPreset,
  type FontPreset,
  type StickerId,
  STICKER_IDS,
  STICKER_CAP,
  PAPER_LABELS,
  FONT_LABELS,
} from '../../lib/dashboardPersonalization'
import { StickerGlyph } from './StickerLayer'
import s from './JournalStyleDrawer.module.css'

export default function JournalStyleDrawer({
  open,
  onClose,
  theme,
  stickers,
  selectedStickerId,
  onThemeChange,
  onSelectSticker,
  onClearStickers,
}: {
  open: boolean
  onClose: () => void
  theme: DashboardTheme
  stickers: DashboardSticker[]
  selectedStickerId: StickerId | null
  onThemeChange: (theme: DashboardTheme) => void
  onSelectSticker: (id: StickerId | null) => void
  onClearStickers: () => void
}) {
  const [tab, setTab] = useState<'theme' | 'stickers'>('theme')
  if (!open) return null

  return (
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.drawer} onClick={e => e.stopPropagation()}>
        <header className={s.head}>
          <span className={s.title}>journal style</span>
          <button type="button" className={s.close} onClick={onClose}>✕</button>
        </header>

        <div className={s.tabs}>
          <button type="button" className={tab === 'theme' ? s.tabActive : s.tab} onClick={() => setTab('theme')}>
            paper & type
          </button>
          <button type="button" className={tab === 'stickers' ? s.tabActive : s.tab} onClick={() => setTab('stickers')}>
            stickers
          </button>
        </div>

        {tab === 'theme' ? (
          <div className={s.section}>
            <div className={s.label}>paper tone</div>
            <div className={s.chips}>
              {(Object.keys(PAPER_LABELS) as PaperPreset[]).map(paper => (
                <button
                  key={paper}
                  type="button"
                  className={`${s.chip} ${theme.paper === paper ? s.chipActive : ''}`}
                  onClick={() => onThemeChange({ ...theme, paper })}
                >
                  {PAPER_LABELS[paper]}
                </button>
              ))}
            </div>
            <div className={s.label}>hand accent</div>
            <div className={s.chips}>
              {(Object.keys(FONT_LABELS) as FontPreset[]).map(font => (
                <button
                  key={font}
                  type="button"
                  className={`${s.chip} ${theme.font === font ? s.chipActive : ''}`}
                  onClick={() => onThemeChange({ ...theme, font })}
                >
                  {FONT_LABELS[font]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={s.section}>
            <p className={s.hint}>
              Pick a sticker, then tap the cover to place it. Drag to move; hold to remove.
              {stickers.length >= STICKER_CAP ? ' Sticker limit reached.' : ` ${stickers.length}/${STICKER_CAP} placed.`}
            </p>
            <div className={s.stickerGrid}>
              {STICKER_IDS.map(id => (
                <button
                  key={id}
                  type="button"
                  className={`${s.stickerBtn} ${selectedStickerId === id ? s.stickerBtnActive : ''}`}
                  onClick={() => onSelectSticker(selectedStickerId === id ? null : id)}
                  disabled={stickers.length >= STICKER_CAP && selectedStickerId !== id}
                >
                  <StickerGlyph id={id} size={24} />
                </button>
              ))}
            </div>
            {stickers.length > 0 && (
              <button type="button" className={s.clearBtn} onClick={onClearStickers}>
                clear all stickers
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
