/**
 * InteractiveFigure — Desmos renderer for graph FigureSpecs (Track A2).
 * Falls back to QuestionFigure SVG when Desmos is unavailable.
 */
import { useEffect, useRef, useState } from 'react'
import type { FigureSpec } from '../lib/figureSpec'
import { diagramCaption } from '../lib/figureSpec'
import { loadDesmos } from '../lib/desmosLoader'
import type { FormatId } from '../lib/questionBank'
import type { StoryDisplay } from '../lib/storyDisplay'
import QuestionFigure from './QuestionFigure'
import s from './InteractiveFigure.module.css'

interface Theme {
  accent: string
  ink: string
  dim: string
}

interface Props {
  spec: Extract<FigureSpec, { kind: 'graph' }>
  conceptId: string
  questionText: string
  format?: FormatId
  theme: Theme
  display?: StoryDisplay
}

export default function InteractiveFigure({
  spec,
  conceptId,
  questionText,
  format,
  theme,
  display,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const calcRef = useRef<ReturnType<NonNullable<typeof window.Desmos>['GraphingCalculator']> | null>(null)
  const [desmosReady, setDesmosReady] = useState(false)
  const [desmosFailed, setDesmosFailed] = useState(false)

  const caption = diagramCaption(questionText)

  useEffect(() => {
    if (spec.engine !== 'desmos' || desmosFailed) return
    let cancelled = false

    loadDesmos().then((api) => {
      if (cancelled || !api || !hostRef.current) {
        if (!cancelled && !api) setDesmosFailed(true)
        return
      }

      calcRef.current?.destroy()
      const calc = api.GraphingCalculator(hostRef.current, {
        expressions: false,
        settingsMenu: false,
        zoomButtons: false,
        expressionsTopbar: false,
        keypad: false,
        lockViewport: false,
        borderRadius: '4px',
        fontSize: 14,
      })

      spec.expressions.forEach((latex, i) => {
        calc.setExpression({ id: `line-${i}`, latex, color: theme.accent })
      })

      spec.points?.forEach((pt, i) => {
        calc.setExpression({
          id: `pt-${i}`,
          latex: `(${pt.x},${pt.y})`,
          color: theme.accent,
          pointStyle: 'POINT',
        })
      })

      if (spec.window) {
        calc.setMathBounds({
          left: spec.window.x[0],
          right: spec.window.x[1],
          bottom: spec.window.y[0],
          top: spec.window.y[1],
        })
      }

      calcRef.current = calc
      setDesmosReady(true)
    })

    return () => {
      cancelled = true
      calcRef.current?.destroy()
      calcRef.current = null
    }
  }, [spec, theme.accent, desmosFailed])

  if (spec.engine !== 'desmos' || desmosFailed) {
    return (
      <QuestionFigure
        conceptId={conceptId}
        questionText={questionText}
        format={format}
        theme={theme}
        display={display}
      />
    )
  }

  return (
    <figure className={s.wrap}>
      {!desmosReady && (
        <div className={s.fallback} aria-hidden>
          <QuestionFigure
            conceptId={conceptId}
            questionText={questionText}
            format={format}
            theme={theme}
            display={display}
          />
        </div>
      )}
      <div
        ref={hostRef}
        className={s.desmosHost}
        style={{ visibility: desmosReady ? 'visible' : 'hidden' }}
        role="img"
        aria-label={`Interactive graph: ${spec.expressions.join(', ')}`}
      />
      {caption && (
        <figcaption className={s.caption} style={{ color: theme.dim }}>
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
