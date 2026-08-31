/**
 * ColdCheckPrompt.tsx
 *
 * The "solo check" gate: after a student self-reports "I get it" on a
 * Solver/Homework concept, this shows ONE fresh, unaided question on that
 * same concept before the session is allowed to close. No hints, no clues —
 * this is the moment that turns a self-report button into a real signal.
 *
 * Why this exists: Bastani et al. (2025, PNAS) found unguarded AI homework
 * help can quietly cost real exam performance while students *feel* fine
 * about it — self-report can't detect the gap. This component is the fix:
 * a real, graded check, not another feeling.
 */

import { useState } from 'react'
import MathText from './MathText'
import type { Question } from '../lib/questionBank'
import s from './HomeworkCards.module.css'

interface Props {
  question: Question
  onResult: (result: { correct: boolean; selectedIndex: number }) => void
}

export default function ColdCheckPrompt({ question, onResult }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)

  function pick(i: number) {
    if (checked) return
    setSelected(i)
  }

  function submit() {
    if (selected === null || checked) return
    setChecked(true)
  }

  function finish() {
    if (selected === null) return
    onResult({ correct: selected === question.correctIndex, selectedIndex: selected })
  }

  const correct = selected === question.correctIndex

  return (
    <div className={s.card} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#F0C060', textTransform: 'uppercase' }}>
          Quick check, on your own
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
        <MathText text={question.question} />
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {question.choices.map((choice, i) => {
          let borderColor = 'rgba(255,255,255,0.15)'
          if (checked && i === question.correctIndex) borderColor = '#58CC02'
          else if (checked && i === selected) borderColor = '#FF6B6B'
          else if (!checked && i === selected) borderColor = '#6366F1'

          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={checked}
              style={{
                textAlign: 'left',
                padding: '10px 14px',
                borderRadius: 10,
                border: `1.5px solid ${borderColor}`,
                background: 'rgba(255,255,255,0.03)',
                color: 'inherit',
                cursor: checked ? 'default' : 'pointer',
                fontSize: 14,
              }}
            >
              <MathText text={choice} />
            </button>
          )
        })}
      </div>

      {!checked ? (
        <button
          onClick={submit}
          disabled={selected === null}
          style={{
            alignSelf: 'flex-start',
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            background: selected === null ? 'rgba(255,255,255,0.1)' : '#6366F1',
            color: 'white',
            fontWeight: 600,
            cursor: selected === null ? 'default' : 'pointer',
          }}
        >
          Check my answer
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, color: correct ? '#58CC02' : '#FF6B6B', fontWeight: 600 }}>
            {correct ? 'Got it on your own, that\'s the real proof.' : 'Not quite. Worth a second look before this one\'s "done."'}
          </div>
          <button
            onClick={finish}
            style={{
              alignSelf: 'flex-start',
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#6366F1',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  )
}
