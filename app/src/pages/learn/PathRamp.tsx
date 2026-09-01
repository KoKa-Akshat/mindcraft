import type { ConceptMatch, PathStep } from '../../lib/conceptLibrary'
import { CARD, Eyebrow, TEXT_FAINT, TEXT_SOFT } from './shared'

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
    <div style={{ ...CARD, padding: '16px 18px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <Eyebrow color="#58CC02">Your path to {path[path.length - 1].label}</Eyebrow>
        <span style={{ fontSize: 11.5, color: contentLoading ? '#8BE85C' : TEXT_FAINT }}>
          {contentLoading ? 'loading this step...' : `step ${pathIndex + 1} of ${path.length}`}
        </span>
      </div>
      <p style={{ margin: '6px 0 10px', fontSize: 13, color: TEXT_FAINT, lineHeight: 1.55 }}>
        Built from the real prerequisite edges in the concept graph, foundational first. Every step has a written lesson, so any chip is clickable.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {path.map((step, i) => {
          const current = i === pathIndex
          const done = i < pathIndex
          return (
            <span key={step.conceptId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ fontSize: 11, color: 'rgba(205,215,238,0.3)' }}>›</span>}
              <button
                onClick={() => onGoToStep(i)}
                title={step.conceptId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                  fontSize: 12.5, fontWeight: current ? 700 : 500, padding: '6px 12px', borderRadius: 999,
                  border: `1px solid ${current ? '#58CC02' : done ? 'rgba(88,204,2,0.32)' : 'rgba(205,215,238,0.18)'}`,
                  background: current ? 'rgba(88,204,2,0.18)' : done ? 'rgba(88,204,2,0.07)' : 'rgba(205,215,238,0.04)',
                  color: current ? '#8BE85C' : done ? TEXT_SOFT : TEXT_SOFT,
                }}
              >
                <span style={{ fontSize: 10, opacity: 0.7 }}>{i + 1}</span>
                {step.label}
                {step.hasSim && <span style={{ fontSize: 9, fontWeight: 700, color: '#F0C060' }}>SIM</span>}
                {isStudied(step.conceptId) && <span title="you have studied this before" style={{ fontSize: 9, fontWeight: 700, color: '#f2b84b' }}>✓ STUDIED</span>}
              </button>
            </span>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => onGoToStep(pathIndex - 1)}
          disabled={pathIndex === 0}
          style={{ fontSize: 12.5, padding: '7px 13px', borderRadius: 9, border: '1px solid rgba(205,215,238,0.2)', background: 'transparent', color: pathIndex === 0 ? 'rgba(205,215,238,0.3)' : TEXT_SOFT, cursor: pathIndex === 0 ? 'default' : 'pointer' }}
        >
          Back
        </button>
        {nextStep ? (
          <button
            onClick={() => onGoToStep(pathIndex + 1)}
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 15px', borderRadius: 9, border: 'none', background: '#58CC02', color: '#0a1a00', cursor: 'pointer' }}
          >
            Next concept: {nextStep.label} ›
          </button>
        ) : (
          <span style={{ fontSize: 12.5, color: TEXT_FAINT }}>
            Last step. This is what "{searchedQuery || resolved.label}" actually resolved to.
          </span>
        )}
      </div>
    </div>
  )
}
