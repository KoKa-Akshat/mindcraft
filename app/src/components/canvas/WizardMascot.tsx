import wizard from '../../assets/canvas/wizard-doodle-cheer.jpg'
import s from './WizardMascot.module.css'

export default function WizardMascot({
  line,
  cheering = true,
  compact = false,
}: {
  line: string
  cheering?: boolean
  /** Smaller sprite/bubble for the merged hero bar (shows on every dashboard
   * view now, not just a big standalone Home header). */
  compact?: boolean
}) {
  return (
    <aside className={`${s.wrap} ${cheering ? s.cheer : ''} ${compact ? s.compact : ''}`} aria-live="polite">
      <img className={s.sprite} src={wizard} alt="" draggable={false} />
      <div className={s.bubble}>
        <p className={s.line}>{line}</p>
      </div>
    </aside>
  )
}
