import { BookOpen, CheckCircle2, Rows3 } from 'lucide-react'
import ColdCheckPrompt from '../../components/ColdCheckPrompt'
import type { CheckQuestion, ConceptChapter } from '../../lib/conceptLibrary'

export interface ReadingPaneProps {
  chapter: ConceptChapter
  usingSimplified: boolean
  simplifying: boolean
  simplifiedBody: string
  showSimplified: boolean
  onToggleSimplified: () => void
  simplifyMeta: { reductionPct: number; cached: boolean } | null
  searchedQuery: string
  simplifyFailed: string
  chunks: string[][]
  checkQuestion: CheckQuestion | null
  checkLoading: boolean
  checkFailed: string
  checkResult: string
  onAnswered: (correct: boolean) => void
}

/** The continuous chapter page and its closing independent check. */
export default function ReadingPane({
  chapter, usingSimplified, simplifying, simplifiedBody, showSimplified, onToggleSimplified,
  simplifyMeta, searchedQuery, simplifyFailed, chunks, checkQuestion, checkLoading,
  checkFailed, checkResult, onAnswered,
}: ReadingPaneProps) {
  return (
    <article className="lrn-reading-paper">
      <header className="lrn-chapter-header">
        <div className="lrn-chapter-meta">
          <span className="lrn-kicker"><BookOpen size={14} aria-hidden="true" /> Chapter</span>
          {usingSimplified && <span className="lrn-chapter-badge">Simplified</span>}
          {simplifying && <span className="lrn-chapter-working">Simplifying for your question...</span>}
          {simplifiedBody && (
            <button onClick={onToggleSimplified} className="lrn-reading-toggle">
              <Rows3 size={15} aria-hidden="true" />
              {showSimplified ? 'Show full original' : 'Show simplified'}
            </button>
          )}
        </div>

        <h1>{chapter.title}</h1>
        <p className="lrn-chapter-summary">{chapter.summary}</p>
        {usingSimplified && simplifyMeta && (
          <p className="lrn-reading-note">
            Auto-shortened by {simplifyMeta.reductionPct}% for how you asked ("{searchedQuery}"), then independently checked by a second model to confirm no formula, number, or conclusion was lost. The full original stays available above.
          </p>
        )}
        {!usingSimplified && simplifyFailed && (
          <p className="lrn-reading-note lrn-reading-note--muted">
            Showing the full original chapter because the simplified version did not pass its check ({simplifyFailed}).
          </p>
        )}
      </header>

      <div className="lrn-article-body">
        {chunks.map((group, i) => (
          <section className="lrn-reading-section" key={`${usingSimplified ? 's' : 'o'}-${i}`}>
            <span className="lrn-section-index">Section {i + 1} of {chunks.length}</span>
            {group.map((p, j) => <p key={j}>{p}</p>)}
          </section>
        ))}
      </div>

      <section className="lrn-check-section">
        <div className="lrn-check-heading">
          <span className="lrn-check-icon"><CheckCircle2 size={19} aria-hidden="true" /></span>
          <div>
            <span className="lrn-kicker">Make it stick</span>
            <h2>Try one on your own</h2>
          </div>
        </div>
        {checkQuestion ? (
          <>
            <div className="lrn-check-prompt">
              <ColdCheckPrompt
                key={checkQuestion.id}
                question={checkQuestion as never}
                onResult={({ correct }) => onAnswered(correct)}
                tone="paper"
              />
            </div>
            {checkResult && <p className="lrn-check-result">{checkResult}</p>}
          </>
        ) : checkLoading ? (
          <p className="lrn-check-status">
            Generating a check question and independently re-solving it before you see it...
          </p>
        ) : (
          <p className="lrn-check-status">
            No check question is ready for this concept{checkFailed ? `: ${checkFailed}` : '.'} You can keep reading, but this concept will not be marked studied until you answer one.
          </p>
        )}
      </section>
    </article>
  )
}
