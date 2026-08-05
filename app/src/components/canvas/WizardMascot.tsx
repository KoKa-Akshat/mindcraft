import wizardFallback from '../../assets/canvas/wizard-doodle-cheer.png'
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
  /** Opens Stickers when the sprite is tapped. */
  onSpriteClick?: () => void
}) {
  const src = spriteSrc || wizardFallback
  const clickable = typeof onSpriteClick === 'function'

  return (
    <aside
      className={`${s.wrap} ${cheering ? s.cheer : ''} ${compact ? s.compact : ''} ${clickable ? s.clickable : ''}`}
      aria-live="polite"
    >
      {clickable ? (
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
      <div className={s.bubble}>
        <p className={s.line}>{line}</p>
      </div>
    </aside>
  )
}
