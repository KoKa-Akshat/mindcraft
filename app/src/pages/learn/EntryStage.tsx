import { CARD, TEXT_FAINT, TEXT_PRIMARY, TEXT_SOFT } from './shared'

export interface EntryStageProps {
  onFocusSearch: () => void
  onUploadHomework: () => void
  nudgeLabel: string | null
  onPracticeNudge: () => void
}

/** The very first thing a student sees on a blank /learn: a greeting from
 * Jesse and a few real starting points, instead of a bare search box or the
 * raw graph. Purely presentational, every action here just drives the same
 * search/upload/nudge machinery Learn.tsx already had. Sits as an overlay
 * on top of the still-alive graph, same spot RouteCards takes over once a
 * search resolves. */
export default function EntryStage({ onFocusSearch, onUploadHomework, nudgeLabel, onPracticeNudge }: EntryStageProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ ...CARD, pointerEvents: 'auto', maxWidth: 480, width: '92%', padding: '26px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 8 }}>Hi, I'm Jesse. What would you like to work on?</div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: TEXT_SOFT }}>
          Ask anything below, or start from one of these.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          <button
            onClick={onFocusSearch}
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(61,107,79,0.35)', background: 'rgba(61,107,79,0.1)', color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Help me learn something new
          </button>
          <button
            onClick={onUploadHomework}
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(94,200,240,0.35)', background: 'rgba(94,200,240,0.08)', color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            I have homework to work through
          </button>
          {nudgeLabel && (
            <button
              onClick={onPracticeNudge}
              style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(196,245,71,0.35)', background: 'rgba(196,245,71,0.08)', color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Show me what I'm weak on ({nudgeLabel})
            </button>
          )}
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 11.5, color: TEXT_FAINT }}>The graph behind this is real and live. Type your own question below any time.</p>
      </div>
    </div>
  )
}
