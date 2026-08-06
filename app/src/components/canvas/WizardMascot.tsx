import wizardFallback from '../../assets/canvas/wizard-doodle-cheer.png'
import RotatableSticker from '../book/RotatableSticker'
import s from './WizardMascot.module.css'

export default function WizardMascot({
  line,
  cheering = true,
  compact = false,
  spriteSrc,
  onSpriteClick,
}: {
  line: string
  cheering?: boolean
  /** Smaller sprite/bubble for the merged hero bar. */
  compact?: boolean
  /** Replace the default doodle with a cover sticker (e.g. Palm of Sparks). */
  spriteSrc?: string
  /** Opens Stickers when the sprite is tapped (not dragged). */
  onSpriteClick?: () => void
}) {
  const src = spriteSrc || wizardFallback
  const clickable = typeof onSpriteClick === 'function'
  const useSpin = Boolean(spriteSrc)

  return (
    <aside
      className={`${s.wrap} ${cheering && !useSpin ? s.cheer : ''} ${compact ? s.compact : ''}`}
      aria-live="polite"
    >
      <div className={s.spriteHit}>
        {useSpin ? (
          <RotatableSticker
            src={src}
            alt=""
            className={s.spin}
            onClick={onSpriteClick}
          />
        ) : clickable ? (
          <button
            type="button"
            className={s.spriteBtn}
            onClick={onSpriteClick}
            aria-label="Open Stickers. Choose a sticker for your wizard."
            title="Stickers"
          >
            <img className={s.sprite} src={src} alt="" draggable={false} />
          </button>
        ) : (
          <img className={s.sprite} src={src} alt="" draggable={false} />
        )}
      </div>
      <div className={s.bubble}>
        <p className={s.line}>{line}</p>
      </div>
    </aside>
  )
}
