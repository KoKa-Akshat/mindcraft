/**
 * Public post-diagnostic landing for marketing "Try demo".
 * Reads sessionStorage from /try/diagnostic (no login).
 */
import { Link } from 'react-router-dom'
import s from './DemoNotebook.module.css'

const KEY = 'mc-demo-diagnostic'

type DemoPayload = {
  exam?: string
  deadlineDays?: number | null
  confidence?: Record<string, string>
}

function readDemo(): DemoPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DemoPayload) : null
  } catch {
    return null
  }
}

function labelConfidence(v: string) {
  if (v === 'easy') return 'Solid'
  if (v === 'kinda') return 'Shaky'
  if (v === 'hard') return 'Gap'
  return v
}

export default function DemoNotebook() {
  const data = readDemo()
  const entries = Object.entries(data?.confidence ?? {})
  const gaps = entries.filter(([, v]) => v === 'hard' || v === 'kinda')

  return (
    <div className={s.page}>
      <div className={s.sheet}>
        <p className={s.kicker}>Your ACT study notebook</p>
        <h1>The map is open.</h1>
        <p className={s.lead}>
          {data
            ? 'MindCraft just turned your answers into a living learning record. No login. This is the demo notebook.'
            : 'Start the free diagnostic demo to build your notebook.'}
        </p>

        {gaps.length > 0 ? (
          <ul className={s.list}>
            {gaps.slice(0, 8).map(([id, v]) => (
              <li key={id}>
                <span>{labelConfidence(v)}</span>
                <strong>{id.replace(/_/g, ' ')}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>Tap below to name your first gaps.</p>
        )}

        <div className={s.actions}>
          <Link className={s.primary} to="/try/diagnostic">
            {data ? 'Retake demo scan' : 'Start diagnostic demo'}
          </Link>
          <a className={s.soft} href="https://mindcraft-marketing-site.web.app/#intake">
            Request a real seat
          </a>
        </div>
      </div>
    </div>
  )
}
