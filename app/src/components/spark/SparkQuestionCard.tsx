import { useState } from 'react'
import MathText from '../MathText'
import type { Question } from '../../lib/questionBank'
import type { SparkWorldFeedback } from '../../lib/sparkMatch'
import type { SparkScene } from '../../lib/sparkNarrative'
import s from './SparkQuestionCard.module.css'

interface Props {
  visible: boolean
  scene: SparkScene
  question: Question
  worldFeedback: SparkWorldFeedback
  taleTitle: string
  onAnswered: () => void
}

export default function SparkQuestionCard({
  visible,
  scene,
  question,
  worldFeedback,
  taleTitle,
  onAnswered,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const pick = (index: number) => {
    if (selected != null) return
    setSelected(index)
    const correct = index === question.correctIndex
    setFeedback(correct ? worldFeedback.correct : worldFeedback.incorrect)
    window.setTimeout(onAnswered, 2400)
  }

  return (
    <div className={`${s.wrap} ${visible ? s.wrapVisible : ''}`}>
      <article className={s.card}>
        <header className={s.header}>
          <span className={s.stamp}>{scene.protagonist}</span>
          <span className={s.dot}>·</span>
          <span className={s.setting}>{scene.setting}</span>
          <span className={s.tale}>{taleTitle}</span>
        </header>

        <p className={s.intro}>{scene.storyIntro}</p>
        <p className={s.bridge}>{scene.bridgeLine}</p>

        <div className={s.divider} />

        <div className={s.stem}>
          <MathText text={question.question} />
        </div>

        <div className={s.choices}>
          {question.choices.map((choice, i) => (
            <button
              key={i}
              type="button"
              className={`${s.choice} ${selected === i ? s.choicePicked : ''}`}
              onClick={() => pick(i)}
              disabled={selected != null}
            >
              <span className={s.choiceLetter}>{String.fromCharCode(65 + i)}</span>
              <MathText text={choice} />
            </button>
          ))}
        </div>

        <p className={s.hint}>
          {selected == null ? 'Pick one — we won\'t tell you if it\'s right or wrong yet.' : 'Watch what the scene does next.'}
        </p>

        {feedback && (
          <p className={s.feedback} role="status">
            {feedback}
          </p>
        )}
      </article>
    </div>
  )
}
