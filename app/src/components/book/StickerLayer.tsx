import type { CSSProperties, ReactNode } from 'react'
import type { DashboardSticker, StickerId } from '../../lib/dashboardPersonalization'
import s from './StickerLayer.module.css'

const STICKER_VIEW: Record<StickerId, (color: string) => ReactNode> = {
  star: c => (
    <svg viewBox="0 0 24 24" fill={c} stroke="none"><path d="M12 2.5l2.9 6.1 6.7.6-5 4.4 1.5 6.5L12 17.2 5.9 20.1l1.5-6.5-5-4.4 6.7-.6z"/></svg>
  ),
  paw: c => (
    <svg viewBox="0 0 24 24" fill={c} stroke="none">
      <ellipse cx="7" cy="8" rx="2.2" ry="2.6"/><ellipse cx="12" cy="6.5" rx="2.2" ry="2.6"/>
      <ellipse cx="17" cy="8" rx="2.2" ry="2.6"/><ellipse cx="9.5" cy="12" rx="2" ry="2.4"/>
      <path d="M12 11.5c-3.2 0-5.5 2.2-5.5 5.2 0 2.8 2.4 4.8 5.5 4.8s5.5-2 5.5-4.8c0-3-2.3-5.2-5.5-5.2z"/>
    </svg>
  ),
  compass: c => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6">
      <circle cx="12" cy="12" r="9"/><polygon points="12,4 15,15 12,12 9,15" fill={c} stroke="none"/>
    </svg>
  ),
  flag: c => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round">
      <path d="M6 3v18"/><path d="M6 4h10l-2 3 2 3H6" fill={c} stroke="none"/>
    </svg>
  ),
  plant: c => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round">
      <path d="M12 20V10"/><path d="M12 10C12 6 8 4 5 5c1 4 3 6 7 5"/><path d="M12 10c0-4 4-6 7-5-1 4-3 6-7 5"/>
    </svg>
  ),
  moon: c => (
    <svg viewBox="0 0 24 24" fill={c} stroke="none"><path d="M14.5 3.2a8.5 8.5 0 1 0 6.3 14.3A7 7 0 0 1 14.5 3.2z"/></svg>
  ),
  heart: c => (
    <svg viewBox="0 0 24 24" fill={c} stroke="none"><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/></svg>
  ),
  bolt: c => (
    <svg viewBox="0 0 24 24" fill={c} stroke="none"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>
  ),
  leaf: c => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round">
      <path d="M5 19C15 19 19 9 19 5 9 5 5 15 5 19z"/><path d="M5 19c4-2 8-6 10-10"/>
    </svg>
  ),
  anchor: c => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="5" r="2"/><path d="M12 7v11"/><path d="M5 13a7 7 0 0 0 14 0"/><path d="M3 13h18"/>
    </svg>
  ),
  gem: c => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round">
      <path d="M4 9 12 3l8 6-8 12L4 9z" fill={c} fillOpacity="0.25"/>
    </svg>
  ),
  feather: c => (
    <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 20c8-1 12-6 16-14"/><path d="M9 15l2-2"/><path d="M13 11l2-2"/>
    </svg>
  ),
}

const STICKER_COLORS: Record<StickerId, string> = {
  star: '#c9963f',
  paw: '#7d6fa8',
  compass: '#1d3a8a',
  flag: '#c1121f',
  plant: '#5d8a5e',
  moon: '#4f8a8b',
  heart: '#c96a7e',
  bolt: '#c9963f',
  leaf: '#5d8a5e',
  anchor: '#4f8a8b',
  gem: '#7d6fa8',
  feather: '#6f6a61',
}

function isCuratedId(id: string): id is StickerId {
  return id in STICKER_VIEW
}

export const EMOJI_STICKER_PREFIX = 'emoji:'

export function isEmojiStickerId(id: string): boolean {
  return id.startsWith(EMOJI_STICKER_PREFIX)
}

/** Pull the raw emoji characters out of an `emoji:<chars>` sticker id. */
export function emojiFromStickerId(id: string): string {
  return id.slice(EMOJI_STICKER_PREFIX.length)
}

export function StickerGlyph({
  id,
  customUrl,
  size = 28,
}: {
  id: string
  customUrl?: string
  size?: number
}) {
  if (customUrl) {
    return (
      <span className={s.glyph} style={{ width: size, height: size }}>
        <img src={customUrl} alt="" className={s.customImg} draggable={false} />
      </span>
    )
  }
  if (isEmojiStickerId(id)) {
    return (
      <span className={s.glyph} style={{ width: size, height: size, fontSize: size * 0.86, lineHeight: 1 }}>
        {emojiFromStickerId(id)}
      </span>
    )
  }
  if (!isCuratedId(id)) return null
  const color = STICKER_COLORS[id]
  return (
    <span className={s.glyph} style={{ width: size, height: size }}>
      {STICKER_VIEW[id](color)}
    </span>
  )
}

export default function StickerLayer({
  stickers,
  editable,
  selectedSticker,
  onPlace,
  onMove,
  onRemove,
}: {
  stickers: DashboardSticker[]
  editable?: boolean
  selectedSticker?: { stickerId: string; customUrl?: string } | null
  onPlace?: (x: number, y: number) => void
  onMove?: (index: number, x: number, y: number) => void
  onRemove?: (index: number) => void
}) {
  function handleSurfaceClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!editable || !selectedSticker || !onPlace) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    onPlace(x, y)
  }

  return (
    <div
      className={`${s.layer} ${editable ? s.editable : ''} ${selectedSticker ? s.placing : ''}`}
      onClick={handleSurfaceClick}
      aria-hidden={!stickers.length && !editable}
    >
      {stickers.map((sticker, index) => {
        const style: CSSProperties = {
          left: `${sticker.x * 100}%`,
          top: `${sticker.y * 100}%`,
          transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
        }
        return (
          <button
            key={`${sticker.stickerId}-${index}`}
            type="button"
            className={s.placed}
            style={style}
            draggable={editable}
            onClick={e => e.stopPropagation()}
            onDragEnd={e => {
              if (!editable || !onMove) return
              const parent = e.currentTarget.parentElement
              if (!parent) return
              const rect = parent.getBoundingClientRect()
              const x = (e.clientX - rect.left) / rect.width
              const y = (e.clientY - rect.top) / rect.height
              onMove(index, Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)))
            }}
            onContextMenu={e => {
              if (!editable || !onRemove) return
              e.preventDefault()
              onRemove(index)
            }}
            onTouchStart={() => {
              if (!editable || !onRemove) return
              const timer = window.setTimeout(() => onRemove(index), 650)
              const clear = () => window.clearTimeout(timer)
              window.addEventListener('touchend', clear, { once: true })
              window.addEventListener('touchmove', clear, { once: true })
            }}
            aria-label="Journal sticker"
          >
            <StickerGlyph
              id={sticker.stickerId}
              customUrl={sticker.customUrl}
              size={34}
            />
          </button>
        )
      })}
    </div>
  )
}
