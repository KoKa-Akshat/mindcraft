import { useEffect, useRef, useState } from 'react'
import s from './InterestCapture.module.css'

const EXAMPLES = ['cooking', 'music production', 'basketball', 'fashion', 'gaming', 'travel']

interface Props {
  visible: boolean
  interests: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
  onContinue: () => void
}

export default function InterestCapture({
  visible,
  interests,
  onAdd,
  onRemove,
  onContinue,
}: Props) {
  const [value, setValue] = useState('')
  const [exampleIdx, setExampleIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!visible) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const id = window.setInterval(() => {
      setExampleIdx(i => (i + 1) % EXAMPLES.length)
    }, 4000)
    return () => clearInterval(id)
  }, [visible])

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (interests.length >= 4) return
    onAdd(trimmed)
    setValue('')
  }

  const canContinue = interests.length >= 2

  return (
    <div className={`${s.wrap} ${visible ? s.wrapVisible : ''}`}>
      <div className={s.card}>
        <p className={s.eyebrow}>Your scene starts here</p>
        <h2 className={s.title}>Tell us what you&apos;re into</h2>
        <p className={s.sub}>
          Type an interest and press Enter. We&apos;ll build your first problem around it.
        </p>

        <div className={s.inputRow}>
          <input
            ref={inputRef}
            className={s.input}
            value={value}
            placeholder={`${EXAMPLES[exampleIdx]}…`}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            disabled={interests.length >= 4}
          />
          <button type="button" className={s.addBtn} onClick={submit} disabled={!value.trim() || interests.length >= 4}>
            Add
          </button>
        </div>

        {interests.length === 1 && (
          <p className={s.nudge}>One more — we need a shape to match.</p>
        )}
        {interests.length >= 4 && (
          <p className={s.nudge}>Four is plenty for a first scene.</p>
        )}

        {interests.length > 0 && (
          <div className={s.chips}>
            {interests.map((item, i) => (
              <span key={`${item}-${i}`} className={s.chip}>
                {item}
                <button type="button" className={s.chipRemove} onClick={() => onRemove(i)} aria-label={`Remove ${item}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          className={`${s.continue} ${canContinue ? s.continueReady : ''}`}
          onClick={onContinue}
          disabled={!canContinue}
        >
          Build my scene →
        </button>
      </div>
    </div>
  )
}
