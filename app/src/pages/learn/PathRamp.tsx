import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ConceptMatch, PathStep } from '../../lib/conceptLibrary'

export interface PathRampProps {
  path: PathStep[]
  pathIndex: number
  contentLoading: boolean
  nextStep: PathStep | null
  searchedQuery: string
  resolved: ConceptMatch
  isStudied: (id: string) => boolean
  onGoToStep: (i: number) => void
}

/** "Your path to X" prerequisite ramp card. Purely presentational, walking
 * the ramp (`goToStep`) and the ramp data itself live in Learn.tsx. */
export default function PathRamp({ path, pathIndex, contentLoading, nextStep, searchedQuery, resolved, isStudied, onGoToStep }: PathRampProps) {
  return (
    <nav className="lrn-path" aria-label={`Path to ${path[path.length - 1].label}`}>
      <div className="lrn-path-heading">
        <div>
          <span className="lrn-kicker">Learning path</span>
          <h2>Path to {path[path.length - 1].label}</h2>
        </div>
        <span className={contentLoading ? 'lrn-path-count is-loading' : 'lrn-path-count'}>
          {contentLoading ? 'Loading step...' : `${pathIndex + 1} of ${path.length}`}
        </span>
      </div>
      <p className="lrn-path-intro">
        Follow the prerequisite trail from foundation to target.
      </p>
      <div className="lrn-path-steps">
        {path.map((step, i) => {
          const current = i === pathIndex
          const done = i < pathIndex
          return (
            <span className="lrn-path-step-wrap" key={step.conceptId}>
              {i > 0 && <span className="lrn-path-line" aria-hidden="true" />}
              <button
                onClick={() => onGoToStep(i)}
                title={step.conceptId}
                aria-current={current ? 'step' : undefined}
                className={`lrn-path-step${current ? ' is-current' : ''}${done ? ' is-done' : ''}`}
              >
                <span className="lrn-path-number">{isStudied(step.conceptId) ? <Check size={12} /> : i + 1}</span>
                <span>{step.label}</span>
                {step.hasSim && <span className="lrn-path-sim">Sim</span>}
              </button>
            </span>
          )
        })}
      </div>
      <div className="lrn-path-actions">
        <button
          onClick={() => onGoToStep(pathIndex - 1)}
          disabled={pathIndex === 0}
          className="lrn-button lrn-button--quiet"
          aria-label="Previous concept"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Previous
        </button>
        {nextStep ? (
          <button
            onClick={() => onGoToStep(pathIndex + 1)}
            className="lrn-button lrn-button--forest"
          >
            Next: {nextStep.label}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <span className="lrn-path-finish">
            Target reached for "{searchedQuery || resolved.label}."
          </span>
        )}
      </div>
    </nav>
  )
}
