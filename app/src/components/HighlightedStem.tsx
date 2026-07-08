/**
 * HighlightedStem — question stem with Jarvis focus highlighter strokes.
 * One lime stroke on the primary focus phrase; ask/given get pencil underlines.
 */
import MathText from './MathText'
import type { HighlightSpan } from '../lib/journalGuide'
import { glossaryFor } from '../lib/mathGlossary'
import s from './HighlightedStem.module.css'

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightPlainText(text: string, spans: HighlightSpan[], accent: string) {
  if (!spans.length || !text.trim()) return <MathText text={text} />

  const focus = spans.find(h => h.kind === 'focus') ?? spans.find(h => h.kind === 'ask')
  if (!focus?.phrase) return <MathText text={text} />

  const re = new RegExp(`(${escapeRegExp(focus.phrase)})`, 'i')
  const parts = text.split(re)
  if (parts.length < 2) return <MathText text={text} />

  const definition = glossaryFor(focus.phrase)

  return (
    <>
      {parts.map((part, i) => {
        if (part.toLowerCase() === focus.phrase.toLowerCase()) {
          return (
            <mark
              key={i}
              className={`${s.focusStroke} ${definition ? s.glossaryTerm : ''}`}
              style={{ backgroundImage: `linear-gradient(104deg, transparent 2%, ${accent}55 4%, ${accent}44 96%, transparent 98%)` }}
              title={definition}
              tabIndex={definition ? 0 : undefined}
            >
              <MathText text={part} />
              {definition && <span className={s.glossaryTip}>{definition}</span>}
            </mark>
          )
        }
        return part ? <MathText key={i} text={part} /> : null
      })}
    </>
  )
}

interface Props {
  text: string
  ink: string
  accent: string
  highlights?: HighlightSpan[]
  className?: string
}

export default function HighlightedStem({ text, ink, accent, highlights = [], className }: Props) {
  const parts = text.split(/(\(Diagram:[^)]{0,300}\))/g)

  return (
    <p className={`${s.stem} ${className ?? ''}`} style={{ color: ink }}>
      {parts.map((part, i) => {
        const m = part.match(/^\(Diagram: (.+)\)$/)
        if (m) {
          return (
            <span key={i} className={s.diagramBox} style={{ borderLeftColor: accent }}>
              <span className={s.diagramIcon} aria-hidden>⬡</span>
              {m[1]}
            </span>
          )
        }
        return <span key={i}>{highlightPlainText(part, highlights, accent)}</span>
      })}
    </p>
  )
}
