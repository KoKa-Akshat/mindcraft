/**
 * StoryVisualPanel — story-aligned illustration for a question.
 * Routes to ward tables, concept vignettes, regular polygons, or real figures.
 */
import ConceptVignette from './book/ConceptVignette'
import StoryDataTable from './StoryDataTable'
import QuestionFigure, { RegularPolygonFigure, shouldRenderFigure } from './QuestionFigure'
import type { StoryDisplay } from '../lib/storyDisplay'
import type { FormatId } from '../lib/questionBank'
import s from './StoryVisualPanel.module.css'

interface Theme {
  accent: string
  ink: string
  dim: string
}

interface Props {
  conceptId: string
  questionText: string
  format?: FormatId
  display: StoryDisplay
  theme: Theme
}

export default function StoryVisualPanel({
  conceptId,
  questionText,
  format,
  display,
  theme,
}: Props) {
  const vignetteId = display.vignetteId ?? conceptId

  return (
    <div className={s.panel}>
      {display.table && (
        <StoryDataTable table={display.table} accent={theme.accent} />
      )}

      {display.visual === 'polygon' && display.polygonSides && (
        <figure className={s.polygonWrap}>
          <RegularPolygonFigure sides={display.polygonSides} theme={theme} />
          <figcaption className={s.caption} style={{ color: theme.dim }}>
            Regular {display.polygonSides}-gon
          </figcaption>
        </figure>
      )}

      {display.visual === 'vignette' && (
        <div className={s.vignetteWrap} data-tone="paper" aria-hidden>
          <ConceptVignette id={vignetteId} />
        </div>
      )}

      {(display.visual === 'figure'
        || (display.visual === 'none' && shouldRenderFigure(conceptId, questionText, format, display))
      ) && (
        <QuestionFigure
          conceptId={conceptId}
          questionText={questionText}
          format={format}
          theme={theme}
          display={display}
        />
      )}
    </div>
  )
}
