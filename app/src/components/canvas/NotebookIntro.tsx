import introBanner from '../../assets/canvas/mindcraft-intro-banner.jpg'
import WizardMascot from './WizardMascot'
import s from './NotebookIntro.module.css'

const INTRO_KEY = 'mc-canvas-intro-seen'

export function introAlreadySeen(): boolean {
  try { return localStorage.getItem(INTRO_KEY) === '1' } catch { return true }
}

function markIntroSeen() {
  try { localStorage.setItem(INTRO_KEY, '1') } catch { /* ignore */ }
}

export default function NotebookIntro({ onContinue }: { onContinue: () => void }) {
  function go() {
    markIntroSeen()
    onContinue()
  }

  return (
    <div className={s.root}>
      <div className={s.card}>
        <img className={s.banner} src={introBanner} alt="" draggable={false} />
        <div className={s.body}>
          <p className={s.eyebrow}>Welcome in</p>
          <h1 className={s.title}>Your ACT notebook</h1>
          <p className={s.lead}>
            One big page. Pick a topic, write freely, get help when you’re stuck.
          </p>
          <ul className={s.steps}>
            <li><strong>Map</strong> — cute topic stickers across your sky</li>
            <li><strong>Work</strong> — drop homework or paste a problem</li>
            <li><strong>Lessons</strong> — short stories + questions that stick</li>
          </ul>
          <div className={s.footer}>
            <WizardMascot line="I’ll cheer you on and point at what to study next ★" />
            <button type="button" className={s.go} onClick={go}>
              Show me contents →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
