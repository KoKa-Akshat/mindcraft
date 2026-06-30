import { useState, type RefObject } from 'react'
import s from './ScientificCalculator.module.css'

type CalcCategory =
  | 'algebra'
  | 'operations'
  | 'sets'
  | 'trig'
  | 'functions'
  | 'probability'
  | 'greek'
  | 'geometry'
  | 'sequences'
  | 'complex'

const CATEGORIES: { id: CalcCategory; label: string }[] = [
  { id: 'algebra', label: 'Algebra' },
  { id: 'operations', label: 'Operations' },
  { id: 'sets', label: 'Sets' },
  { id: 'trig', label: 'Trigonometry' },
  { id: 'functions', label: 'Functions' },
  { id: 'probability', label: 'Probability' },
  { id: 'greek', label: 'Greek' },
  { id: 'geometry', label: 'Geometry' },
  { id: 'sequences', label: 'Sequences' },
  { id: 'complex', label: 'Complex' },
]

const QUICK_BAR = ['x', 'y', 'π', '=', '≈', '≤', '≥', '<', '>', '%', 'x²', 'x³', '≡']

const CATEGORY_SYMBOLS: Record<CalcCategory, string[]> = {
  algebra: ['x', 'y', 'n', 'a', 'b', '²', '³', '√', '|x|', '±'],
  operations: ['+', '−', '×', '÷', '·', '^', '(', ')', '.', '≠'],
  sets: ['∈', '∉', '⊂', '⊆', '∪', '∩', '∅', 'ℝ', 'ℤ', 'ℕ'],
  trig: ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', '°', 'π', 'θ'],
  functions: ['f(x)', 'g(x)', 'log', 'ln', 'e', 'exp', 'lim', '→'],
  probability: ['P(A)', 'P(A|B)', 'C(n,r)', 'n!', '∩', '∪', 'μ', 'σ'],
  greek: ['α', 'β', 'γ', 'θ', 'λ', 'μ', 'σ', 'Δ', 'Σ', 'Ω'],
  geometry: ['∠', '⊥', '∥', '△', '□', '°', '≅', '∼', '↔'],
  sequences: ['Σ', '∞', 'aₙ', 'n', '…', '+∞', '−∞'],
  complex: ['i', 'Re', 'Im', '|z|', 'arg', 'conj', 'ℂ'],
}

const SIDE_KEYS = ['(', ')', '×', '÷', '√', 'x²', 'x³', 'abc']

function insertAtCursor(
  inputRef: RefObject<HTMLInputElement | null>,
  value: string,
  text: string,
  onChange: (v: string) => void,
) {
  const el = inputRef.current
  if (!el) {
    onChange(value + text)
    return
  }
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  const next = value.slice(0, start) + text + value.slice(end)
  onChange(next)
  requestAnimationFrame(() => {
    el.focus()
    const pos = start + text.length
    el.setSelectionRange(pos, pos)
  })
}

function moveCursor(inputRef: RefObject<HTMLInputElement | null>, delta: number) {
  const el = inputRef.current
  if (!el) return
  const pos = Math.max(0, Math.min(el.value.length, (el.selectionStart ?? 0) + delta))
  el.focus()
  el.setSelectionRange(pos, pos)
}

type Props = {
  open: boolean
  active: boolean
  onToggle: () => void
  disabled?: boolean
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  inputRef: RefObject<HTMLInputElement | null>
}

export function ScientificCalcToggle({ active, onToggle, disabled }: Pick<Props, 'active' | 'onToggle' | 'disabled'>) {
  return (
    <button
      type="button"
      className={`${s.toggle} ${active ? s.toggleActive : ''}`}
      onClick={onToggle}
      disabled={disabled}
      aria-label="Scientific keyboard"
      title="Scientific keyboard"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7.5 8h9M8 13h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="16.5" r="1" fill="currentColor" />
        <circle cx="16" cy="16.5" r="1" fill="currentColor" />
      </svg>
    </button>
  )
}

export function ScientificCalcPanel({
  open,
  value,
  onChange,
  onSubmit,
  inputRef,
}: Pick<Props, 'open' | 'value' | 'onChange' | 'onSubmit' | 'inputRef'>) {
  const [category, setCategory] = useState<CalcCategory>('algebra')

  if (!open) return null

  function insert(text: string) {
    insertAtCursor(inputRef, value, text, onChange)
  }

  function handleKey(key: string) {
    if (key === 'C') onChange('')
    else if (key === '⌫') {
      const el = inputRef.current
      if (el && el.selectionStart !== null && el.selectionStart !== el.selectionEnd) {
        const start = el.selectionStart
        const end = el.selectionEnd ?? start
        onChange(value.slice(0, start) + value.slice(end))
        requestAnimationFrame(() => {
          el.focus()
          el.setSelectionRange(start, start)
        })
      } else if (el && (el.selectionStart ?? 0) > 0) {
        const pos = el.selectionStart ?? 1
        onChange(value.slice(0, pos - 1) + value.slice(pos))
        requestAnimationFrame(() => {
          el.focus()
          el.setSelectionRange(pos - 1, pos - 1)
        })
      } else {
        onChange(value.slice(0, -1))
      }
    } else if (key === '=') onSubmit()
    else if (key === '←') moveCursor(inputRef, -1)
    else if (key === '→') moveCursor(inputRef, 1)
    else if (key === 'abc') inputRef.current?.focus()
    else insert(key)
  }

  return (
    <div className={s.panel}>
      <div className={s.quickBar}>
        {QUICK_BAR.map(sym => (
          <button key={sym} type="button" className={s.quickKey} onClick={() => insert(sym)}>
            {sym}
          </button>
        ))}
      </div>

      <div className={s.body}>
        <div className={s.sideCol}>
          {SIDE_KEYS.map(key => (
            <button
              key={key}
              type="button"
              className={`${s.sideKey} ${key === 'abc' ? s.sideKeyAccent : ''}`}
              onClick={() => handleKey(key === 'abc' ? 'abc' : key)}
            >
              {key}
            </button>
          ))}
        </div>

        <div className={s.numpad}>
          {['7', '8', '9', '4', '5', '6', '1', '2', '3', '←', '0', '→'].map(key => (
            <button
              key={key}
              type="button"
              className={`${s.numKey} ${key === '←' || key === '→' ? s.numKeyAccent : ''}`}
              onClick={() => handleKey(key)}
            >
              {key}
            </button>
          ))}
        </div>

        <div className={s.categoryCol}>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              className={`${s.categoryBtn} ${category === c.id ? s.categoryBtnActive : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {category === c.id && <span className={s.check}>✓</span>}
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className={s.symbolGrid}>
        {CATEGORY_SYMBOLS[category].map(sym => (
          <button key={sym} type="button" className={s.symbolKey} onClick={() => insert(sym)}>
            {sym}
          </button>
        ))}
        <button type="button" className={`${s.symbolKey} ${s.symbolKeyMuted}`} onClick={() => handleKey('⌫')}>⌫</button>
        <button type="button" className={`${s.symbolKey} ${s.symbolKeyMuted}`} onClick={() => handleKey('C')}>C</button>
      </div>
    </div>
  )
}
