import wizard from '../../assets/canvas/wizard-doodle-cheer.jpg'
import s from './WizardMascot.module.css'

export default function WizardMascot({
  line,
  cheering = true,
}: {
  line: string
  cheering?: boolean
}) {
  return (
    <aside className={`${s.wrap} ${cheering ? s.cheer : ''}`} aria-live="polite">
      <img className={s.sprite} src={wizard} alt="" draggable={false} />
      <div className={s.bubble}>
        <p className={s.line}>{line}</p>
      </div>
    </aside>
  )
}
