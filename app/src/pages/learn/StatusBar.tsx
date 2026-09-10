import { ArrowLeft, BookOpen, Network } from 'lucide-react'
import type { ConceptMatch, PathStep } from '../../lib/conceptLibrary'

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
  const subject = resolved.subjectTitle || resolved.subject
  const confidence = `${(resolved.score * 100).toFixed(0)}% match`
  const topMatchMissingLesson = !!matches && matches[0].conceptId !== resolved.conceptId

  let title = resolved.label
  let detail = chapter ? 'Chapter ready' : 'Looking for a chapter'
  if (outOfDomain) {
    title = 'No close lesson match'
    detail = `The closest result was ${resolved.label}. Try a more specific topic.`
  } else if (!chapter) {
    detail = contentLoading
      ? 'Loading the chapter...'
      : contentFailed || 'This concept does not have a lesson yet.'
  } else if (hasPath && pathIndex === 0) {
    detail = `Starting with ${path[0].label}, the foundation for this ${path.length}-step route.`
  } else if (topMatchMissingLesson) {
    detail = 'Showing the closest matching concept that has a lesson.'
  } else if (belowThreshold) {
    detail = 'This is a tentative match. The confidence is shown so you can judge it.'
  }

  return (
    <header className={`lrn-status${showPanels ? ' lrn-status--reading' : ''}${outOfDomain ? ' lrn-status--warning' : ''}`}>
      <div className="lrn-status-icon" aria-hidden="true">
        {showPanels ? <BookOpen size={19} strokeWidth={2} /> : <Network size={19} strokeWidth={2} />}
      </div>
      <div className="lrn-status-copy">
        <span className="lrn-status-eyebrow">{outOfDomain ? 'Search result' : subject}</span>
        <strong>{title}</strong>
        <span className="lrn-status-detail">{detail}</span>
      </div>
      {!outOfDomain && (
        <div className="lrn-status-meta" aria-label="Lesson match details">
          <span className={belowThreshold ? 'is-tentative' : ''}>{confidence}</span>
          {hasPath && <span>Step {pathIndex + 1} of {path.length}</span>}
          {resolveMeta?.coldStart && <span>Search ready</span>}
        </div>
      )}
      {showPanels && (
        <button className="lrn-status-back" onClick={onBackToGraph}>
          <ArrowLeft size={16} aria-hidden="true" />
          Full graph
        </button>
      )}
    </header>
  )
}
