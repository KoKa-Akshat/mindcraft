import { useRef, useState } from 'react'
import {
  type DashboardSticker,
  type DashboardTheme,
  type CustomSticker,
  type PaperPreset,
  type FontPreset,
  type StickerSelection,
  STICKER_IDS,
  STICKER_CAP,
  PAPER_LABELS,
  FONT_LABELS,
} from '../../lib/dashboardPersonalization'
import { uploadCustomSticker } from '../../lib/stickerUpload'
import {
  ALLOWED_CUSTOM_FONTS,
  contrastRatio,
  ensureGoogleFont,
  isValidHexColor,
  meetsContrast,
} from '../../lib/themeUtils'
import { StickerGlyph } from './StickerLayer'
import s from './JournalStyleDrawer.module.css'

function selectionKey(sel: StickerSelection | null): string | null {
  if (!sel) return null
  return sel.customUrl ? `custom:${sel.stickerId}` : sel.stickerId
}

export default function JournalStyleDrawer({
  open,
  onClose,
  uid,
  theme,
  stickers,
  customStickers,
  selectedSticker,
  onThemeChange,
  onSelectSticker,
  onClearStickers,
  onCustomStickersChange,
}: {
  open: boolean
  onClose: () => void
  uid: string
  theme: DashboardTheme
  stickers: DashboardSticker[]
  customStickers: CustomSticker[]
  selectedSticker: StickerSelection | null
  onThemeChange: (theme: DashboardTheme) => void
  onSelectSticker: (selection: StickerSelection | null) => void
  onClearStickers: () => void
  onCustomStickersChange: (stickers: CustomSticker[]) => void
}) {
  const [tab, setTab] = useState<'theme' | 'stickers'>('theme')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [customPaperDraft, setCustomPaperDraft] = useState(theme.customPaper ?? '#f7f3ee')
  const [customInkDraft, setCustomInkDraft] = useState(theme.customInk ?? '#232f4e')
  const [customFontDraft, setCustomFontDraft] = useState(theme.customFontFamily ?? 'Caveat')
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const selectedKey = selectionKey(selectedSticker)
  const customContrastOk = meetsContrast(customInkDraft, customPaperDraft)

  function pickPresetPaper(paper: Exclude<PaperPreset, 'custom'>) {
    onThemeChange({
      paper,
      font: theme.font === 'custom' ? theme.font : theme.font,
      customFontFamily: theme.customFontFamily,
      customPaper: undefined,
      customInk: undefined,
    })
  }

  function pickPresetFont(font: Exclude<FontPreset, 'custom'>) {
    onThemeChange({
      ...theme,
      font,
      customFontFamily: undefined,
    })
  }

  function applyCustomColors() {
    if (!customContrastOk) return
    onThemeChange({
      paper: 'custom',
      font: theme.font,
      customPaper: customPaperDraft,
      customInk: customInkDraft,
      customFontFamily: theme.customFontFamily,
    })
  }

  function applyCustomFont(family: string) {
    ensureGoogleFont(family)
    onThemeChange({
      ...theme,
      font: 'custom',
      customFontFamily: family,
    })
  }

  async function handleUpload(file: File | undefined) {
    if (!file || !uid) return
    setUploadError('')
    setUploading(true)
    try {
      const uploaded = await uploadCustomSticker(uid, file)
      const next = [uploaded, ...customStickers]
      onCustomStickersChange(next)
      onSelectSticker({ stickerId: uploaded.storagePath, customUrl: uploaded.url })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload sticker.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className={s.backdrop}>
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
              {(Object.keys(PAPER_LABELS) as Exclude<PaperPreset, 'custom'>[]).map(paper => (
                <button
                  key={paper}
                  type="button"
                  className={`${s.chip} ${theme.paper === paper ? s.chipActive : ''}`}
                  onClick={() => pickPresetPaper(paper)}
                >
                  {PAPER_LABELS[paper]}
                </button>
              ))}
            </div>
            <div className={s.label}>hand accent</div>
            <div className={s.chips}>
              {(Object.keys(FONT_LABELS) as Exclude<FontPreset, 'custom'>[]).map(font => (
                <button
                  key={font}
                  type="button"
                  className={`${s.chip} ${theme.font === font ? s.chipActive : ''}`}
                  onClick={() => pickPresetFont(font)}
                >
                  {FONT_LABELS[font]}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={s.advancedToggle}
              onClick={() => setAdvancedOpen(v => !v)}
            >
              {advancedOpen ? 'hide advanced' : 'advanced custom colors & font'}
            </button>

            {advancedOpen && (
              <div className={s.advancedBlock}>
                <div className={s.colorRow}>
                  <label className={s.colorField}>
                    <span>paper</span>
                    <input
                      type="color"
                      value={isValidHexColor(customPaperDraft) ? customPaperDraft : '#f7f3ee'}
                      onChange={e => setCustomPaperDraft(e.target.value)}
                    />
                  </label>
                  <label className={s.colorField}>
                    <span>ink</span>
                    <input
                      type="color"
                      value={isValidHexColor(customInkDraft) ? customInkDraft : '#232f4e'}
                      onChange={e => setCustomInkDraft(e.target.value)}
                    />
                  </label>
                </div>
                <p className={customContrastOk ? s.contrastOk : s.contrastBad}>
                  {customContrastOk
                    ? `contrast ${contrastRatio(customInkDraft, customPaperDraft).toFixed(1)}:1`
                    : 'too low contrast to read — lighten paper or darken ink'}
                </p>
                <button
                  type="button"
                  className={s.applyBtn}
                  disabled={!customContrastOk}
                  onClick={applyCustomColors}
                >
                  save custom colors
                </button>

                <label className={s.fontSelect}>
                  <span>custom font</span>
                  <select
                    value={customFontDraft}
                    onChange={e => {
                      setCustomFontDraft(e.target.value)
                      applyCustomFont(e.target.value)
                    }}
                  >
                    {ALLOWED_CUSTOM_FONTS.map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        ) : (
          <div className={s.section}>
            <p className={s.hint}>
              Pick a sticker, then tap the cover to place it. Drag to move; hold to remove.
              {stickers.length >= STICKER_CAP ? ' Sticker limit reached.' : ` ${stickers.length}/${STICKER_CAP} placed.`}
            </p>
            <div className={s.stickerGrid}>
              <button
                type="button"
                className={s.uploadTile}
                onClick={() => fileRef.current?.click()}
                disabled={uploading || !uid}
              >
                {uploading ? '…' : '+'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className={s.hiddenFile}
                onChange={e => void handleUpload(e.target.files?.[0])}
              />
              {customStickers.map(sticker => {
                const key = `custom:${sticker.storagePath}`
                return (
                  <button
                    key={sticker.id}
                    type="button"
                    className={`${s.stickerBtn} ${selectedKey === key ? s.stickerBtnActive : ''}`}
                    onClick={() => onSelectSticker(
                      selectedKey === key
                        ? null
                        : { stickerId: sticker.storagePath, customUrl: sticker.url },
                    )}
                    disabled={stickers.length >= STICKER_CAP && selectedKey !== key}
                  >
                    <StickerGlyph id={sticker.storagePath} customUrl={sticker.url} size={24} />
                  </button>
                )
              })}
              {STICKER_IDS.map(id => (
                <button
                  key={id}
                  type="button"
                  className={`${s.stickerBtn} ${selectedKey === id ? s.stickerBtnActive : ''}`}
                  onClick={() => onSelectSticker(selectedKey === id ? null : { stickerId: id })}
                  disabled={stickers.length >= STICKER_CAP && selectedKey !== id}
                >
                  <StickerGlyph id={id} size={24} />
                </button>
              ))}
            </div>
            {uploadError && <p className={s.uploadError}>{uploadError}</p>}
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
