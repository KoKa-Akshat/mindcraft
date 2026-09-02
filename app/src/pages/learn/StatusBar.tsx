import type { ConceptMatch, PathStep } from '../../lib/conceptLibrary'
import { BORDER_SOFT, TEXT_FAINT, TEXT_SOFT } from './shared'

export interface StatusBarProps {
  resolved: ConceptMatch
  outOfDomain: boolean
  belowThreshold: boolean
  chapter: unknown
  contentLoading: boolean
  contentFailed: string
  hasPath: boolean
  path: PathStep[]
  pathIndex: number
  matches: ConceptMatch[] | null
  resolveMeta: { indexed: number; totalMs: number; coldStart: boolean } | null
  showPanels: boolean
  onBackToGraph: () => void
}

/** The "Resolved to X..." strip under the header. Purely presentational: the
 * resolve/search logic that produces every one of these props lives in
 * Learn.tsx's `search()`. */
export default function StatusBar({
  resolved, outOfDomain, belowThreshold, chapter, contentLoading, contentFailed,
  hasPath, path, pathIndex, matches, resolveMeta, showPanels, onBackToGraph,
}: StatusBarProps) {
  return (
    <div style={{ padding: '10px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: BORDER_SOFT, background: 'rgba(205,220,208,0.03)', color: outOfDomain ? '#FF7B7B' : belowThreshold ? '#F0C060' : TEXT_FAINT }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {outOfDomain ? (
          <>Closest match was <b>{resolved.label}</b> at only {(resolved.score * 100).toFixed(0)}%, which is noise, not a real signal. Nothing in the {resolveMeta ? `${resolveMeta.indexed}-lesson library` : 'library'} is actually about this, so it is not shown as a match.</>
        ) : !chapter ? (
          <>
            Resolved to <b>{resolved.label}</b> in {resolved.subjectTitle || resolved.subject} at {(resolved.score * 100).toFixed(0)}%.
            {contentLoading ? ' Fetching its chapter...' : contentFailed ? ` ${contentFailed}` : ' No lesson exists for it yet. Honest gap, not a bug.'}
          </>
        ) : (
          <>
            Resolved to <b>{resolved.label}</b> in {resolved.subjectTitle || resolved.subject} at {(resolved.score * 100).toFixed(0)}% confidence
            {hasPath && pathIndex === 0 && (
              <>, but that sits {path.length - 1} prerequisites deep, so you are starting at <b>{path[0].label}</b> and working up (step {pathIndex + 1} of {path.length})</>
            )}
            {hasPath && pathIndex > 0 && <>, its {path.length - 1}-step prerequisite ramp is shown below for context</>}
            {belowThreshold && ', below our calibrated bar, shown honestly rather than faked as a confident match'}
            {matches && matches[0].conceptId !== resolved.conceptId && (
              <> (top raw match was "{matches[0].label}" at {(matches[0].score * 100).toFixed(0)}%, but it has no lesson yet, so showing the next best real one)</>
            )}
          </>
        )}
      </span>
      {showPanels && (
        <button onClick={onBackToGraph} style={{ flexShrink: 0, fontSize: 12, padding: '5px 13px', borderRadius: 9, border: '1px solid rgba(205,220,208,0.25)', background: 'transparent', color: TEXT_SOFT, cursor: 'pointer' }}>
          Back to full graph
        </button>
      )}
    </div>
  )
}
