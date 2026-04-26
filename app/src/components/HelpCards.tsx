import { useState } from 'react'
import s from './HelpCards.module.css'

export interface HelpCard {
  title:        string
  tagline:      string
  visual:       string
  core_insight: string
  equation:     string
  applications: string[]
  step:         number
  style?:       'geometric' | 'algebraic' | 'intuitive'
}

interface Props {
  cards:       HelpCard[]
  onClose:     () => void
  onPractice?: () => void
}

const STYLE_LABELS: Record<string, string> = {
  geometric:  'Geometric',
  algebraic:  'Algebraic',
  intuitive:  'Intuitive',
}

const STYLE_ICONS: Record<string, string> = {
  geometric: '⬡',
  algebraic: 'Σ',
  intuitive: '◎',
}

export default function HelpCards({ cards, onClose, onPractice }: Props) {
  const [idx, setIdx]         = useState(0)
  const [sliding, setSliding] = useState<'left' | 'right' | null>(null)

  const card = cards[idx]
  const style = card.style ?? 'intuitive'

  function go(next: number, dir: 'left' | 'right') {
    setSliding(dir)
    setTimeout(() => { setIdx(next); setSliding(null) }, 200)
  }

  const isDone = idx === cards.length - 1

  return (
    <div className={s.deck}>

      {/* Style badge + progress */}
      <div className={s.deckMeta}>
        <span className={`${s.styleBadge} ${s[`style_${style}`]}`}>
          {STYLE_ICONS[style]} {STYLE_LABELS[style]}
        </span>
        <div className={s.stepDots}>
          {cards.map((_, i) => (
            <span key={i} className={`${s.dot} ${i === idx ? s.dotActive : i < idx ? s.dotDone : ''}`} />
          ))}
        </div>
      </div>

      {/* Cinematic card */}
      <div className={`${s.card} ${sliding === 'left' ? s.slideLeft : sliding === 'right' ? s.slideRight : s.slideIn}`}>

        {/* Top: step label + tagline */}
        <div className={s.cardTop}>
          <span className={s.stepNum}>{card.step} / {cards.length}</span>
          <p className={s.tagline}>{card.tagline}</p>
        </div>

        {/* Title */}
        <h3 className={s.title}>{card.title}</h3>

        {/* Visual description */}
        <div className={s.visualBox}>
          <span className={s.visualIcon}>⬡</span>
          <p className={s.visual}>{card.visual}</p>
        </div>

        {/* Core insight */}
        <p className={s.insight}>{card.core_insight}</p>

        {/* Equation */}
        {card.equation && (
          <div className={s.equationBox}>
            <span className={s.equationLabel}>Key relation</span>
            <div className={s.equation}>{card.equation}</div>
          </div>
        )}

        {/* Applications */}
        {card.applications?.length > 0 && (
          <ul className={s.apps}>
            {card.applications.map((a, i) => (
              <li key={i}><span className={s.appDot}>·</span>{a}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation */}
      <div className={s.nav}>
        <button className={s.navBack} onClick={() => go(idx - 1, 'right')} disabled={idx === 0}>
          ← Back
        </button>

        {isDone ? (
          <div className={s.doneRow}>
            {onPractice && (
              <button className={s.practiceBtn} onClick={onPractice}>Practice this →</button>
            )}
            <button className={s.doneBtn} onClick={onClose}>Done</button>
          </div>
        ) : (
          <button className={s.navNext} onClick={() => go(idx + 1, 'left')}>
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
