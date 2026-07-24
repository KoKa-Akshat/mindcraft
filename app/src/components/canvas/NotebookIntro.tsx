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

/**
 * 2026-07-23: resized to the exact same full-bleed formula as
 * CoverLanding.module.css's .desk/.cover (same padding numbers, same flex
 * child sizing) so this overlay is byte-for-byte the same box the cover was,
 * not a separately-tuned "close enough" width  -  see CoverLanding.module.css
 * for why matching the padding formula (not just the aspect ratio) is what
 * actually makes two full-bleed boxes provably identical. The whole card is
 * now one tap target (click/Enter/Space anywhere on it continues to the
 * dashboard); "Show me contents" is a visual cue inside it, not a second
 * required tap.
 */
export default function NotebookIntro({ onContinue }: { onContinue: () => void }) {
  function go() {
    markIntroSeen()
    onContinue()
  }

  return (
    <div className={s.root}>
      <button type="button" className={s.card} onClick={go} aria-label="Continue to your ACT notebook">
        <img className={s.banner} src={introBanner} alt="" draggable={false} />
        <div className={s.body}>
          <p className={s.eyebrow}>Welcome in</p>
          <h1 className={s.title}>Your ACT notebook</h1>
          <p className={s.lead}>
            One big page. Pick a topic, write freely, get help when you’re stuck.
          </p>
          <ul className={s.steps}>
            <li><strong>Map</strong>: icons across a big sky, lines between topics</li>
            <li><strong>Work</strong>: drop homework or paste a problem</li>
            <li><strong>Lessons</strong>: short stories + questions that stick</li>
          </ul>
          <div className={s.footer}>
            <WizardMascot line="I’ll cheer you on and point at what to study next ★" />
            <span className={s.go}>Show me contents →</span>
          </div>
        </div>
      </button>
    </div>
  )
}
