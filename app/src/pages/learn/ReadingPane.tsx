import ColdCheckPrompt from '../../components/ColdCheckPrompt'
import type { CheckQuestion, ConceptChapter } from '../../lib/conceptLibrary'
import { CARD, Eyebrow, TEXT_FAINT, TEXT_PRIMARY, TEXT_SOFT } from './shared'

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

/** Chapter header + reading paragraphs + the check question at the end.
 * Purely presentational, simplify/check-question fetching and the reading
 * flow's own state live in Learn.tsx. */
export default function ReadingPane({
  chapter, usingSimplified, simplifying, simplifiedBody, showSimplified, onToggleSimplified,
  simplifyMeta, searchedQuery, simplifyFailed, chunks, checkQuestion, checkLoading,
  checkFailed, checkResult, onAnswered,
}: ReadingPaneProps) {
  return (
    <>
      <div style={{ ...CARD, padding: '22px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Eyebrow color="#58CC02">Chapter</Eyebrow>
          {usingSimplified && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: '#5EC8F0', border: '1px solid rgba(94,200,240,0.5)', background: 'rgba(94,200,240,0.12)', borderRadius: 6, padding: '2px 8px' }}>
              SIMPLIFIED
            </span>
          )}
          {simplifying && <span style={{ fontSize: 11.5, color: 'rgba(94,200,240,0.8)' }}>simplifying for your question...</span>}
          {simplifiedBody && (
            <button
              onClick={onToggleSimplified}
              style={{ marginLeft: 'auto', fontSize: 11.5, padding: '4px 11px', borderRadius: 7, border: '1px solid rgba(205,215,238,0.25)', background: 'transparent', color: TEXT_SOFT, cursor: 'pointer' }}
            >
              {showSimplified ? 'show full original' : 'show simplified'}
            </button>
          )}
        </div>
        <div style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.3, margin: '10px 0 8px', letterSpacing: -0.2 }}>{chapter.title}</div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: TEXT_SOFT, fontStyle: 'italic' }}>{chapter.summary}</p>
        {usingSimplified && simplifyMeta && (
          <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.55, color: 'rgba(94,200,240,0.75)' }}>
            Auto-shortened by {simplifyMeta.reductionPct}% for how you asked ("{searchedQuery}"), then independently checked by a second model to confirm no formula, number, or conclusion was lost. Toggle above for the full original.
          </p>
        )}
        {!usingSimplified && simplifyFailed && (
          <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.55, color: TEXT_FAINT }}>
            Showing the full original chapter: the auto-simplified version was not used ({simplifyFailed}).
          </p>
        )}
      </div>

      {chunks.map((group, i) => (
        <div key={`${usingSimplified ? 's' : 'o'}-${i}`} style={{ ...CARD, padding: '20px 24px', flexShrink: 0 }}>
          <Eyebrow color="rgba(205,215,238,0.4)">Part {i + 1} of {chunks.length}</Eyebrow>
          {group.map((p, j) => (
            <p key={j} style={{ margin: '12px 0 0', fontSize: 16.5, lineHeight: 1.75, color: TEXT_PRIMARY, maxWidth: '64ch' }}>{p}</p>
          ))}
        </div>
      ))}

      <div style={{ ...CARD, padding: '20px 24px', flexShrink: 0 }}>
        <Eyebrow color="#818CF8">Cement understanding</Eyebrow>
        {checkQuestion ? (
          <>
            <div style={{ marginTop: 10 }}>
              <ColdCheckPrompt
                key={checkQuestion.id}
                question={checkQuestion as never}
                onResult={({ correct }) => onAnswered(correct)}
              />
            </div>
            {checkResult && <p style={{ fontSize: 13.5, color: TEXT_SOFT, margin: '10px 0 0' }}>{checkResult}</p>}
          </>
        ) : checkLoading ? (
          <p style={{ fontSize: 13, color: TEXT_FAINT, margin: '8px 0 0', lineHeight: 1.6 }}>
            Generating a check question for this concept and independently re-solving it before you see it...
          </p>
        ) : (
          <p style={{ fontSize: 13, color: TEXT_FAINT, margin: '8px 0 0', lineHeight: 1.6 }}>
            No check question for this concept right now{checkFailed ? `: ${checkFailed}` : '.'} You can keep reading; this concept just will not be marked studied, since nothing was answered.
          </p>
        )}
      </div>
    </>
  )
}
