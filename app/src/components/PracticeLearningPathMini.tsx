import { useNavigate } from 'react-router-dom'
import { ConceptPathIcon } from './ConceptPathIcon'
import type { PathConcept } from '../lib/practicePathQueue'
import s from './PracticeLearningPathMini.module.css'

const STEP = 96
const SPINE = 280

function estMinutesFor(id: string, i: number): number {
  const table: Record<string, number> = {
    linear_equations: 12,
    linear_inequalities: 10,
    absolute_value: 14,
    systems_of_linear_equations: 16,
    exponent_rules: 11,
    radical_expressions: 13,
  }
  return table[id] ?? [12, 10, 14, 16, 11, 13][i % 6]
}

type Props = {
  concepts: PathConcept[]
  activeConceptId?: string | null
  progressPct: number
  completedCount: number
  totalCount: number
  exam?: string
  loading?: boolean
}

export default function PracticeLearningPathMini({
  concepts,
  activeConceptId,
  progressPct,
  completedCount,
  totalCount,
  exam,
  loading,
}: Props) {
  const navigate = useNavigate()
  const flowHeight = Math.max(concepts.length, 1) * STEP + 24
  const nodeY = (i: number) => i * STEP + STEP * 0.52

  if (loading) {
    return <p className={s.loading}>Loading your learning path…</p>
  }

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <h2 className={s.title}>
          Your <span className={s.accent}>Learning Path</span>
        </h2>
        {exam ? <span className={s.meta}>{exam}</span> : null}
      </div>

      <div className={s.progressRow}>
        <div
          className={s.ring}
          style={{ background: `conic-gradient(#c4f547 ${progressPct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
        >
          <span className={s.ringInner}>{progressPct}%</span>
        </div>
        <div className={s.progressCopy}>
          <strong>{completedCount} / {totalCount || concepts.length} topics completed</strong>
          <span>Same path as Practice</span>
        </div>
      </div>

      {concepts.length === 0 ? (
        <p className={s.empty}>Complete the gap scan in Practice to build your path.</p>
      ) : (
        <div className={s.flowMap} style={{ height: `${flowHeight}px` }}>
          <svg
            className={s.flowSvg}
            viewBox={`0 0 560 ${flowHeight}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="miniPathCurveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(196,245,71,0.55)" />
                <stop offset="100%" stopColor="rgba(84,185,72,0.25)" />
              </linearGradient>
            </defs>
            {concepts.slice(0, -1).map((_, i) => {
              const y1 = nodeY(i)
              const y2 = nodeY(i + 1)
              const bulge = i % 2 === 0 ? 72 : -72
              return (
                <path
                  key={i}
                  d={`M ${SPINE} ${y1} C ${SPINE + bulge} ${y1 + STEP * 0.22}, ${SPINE - bulge} ${y2 - STEP * 0.22}, ${SPINE} ${y2}`}
                  stroke="url(#miniPathCurveGrad)"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
              )
            })}
            {concepts.map((_, i) => {
              const cy = nodeY(i)
              return (
                <g key={i}>
                  <circle cx={SPINE} cy={cy} r="8" fill="#c4f547" />
                </g>
              )
            })}
          </svg>

          {concepts.map((c, i) => {
            const isLeft = i % 2 === 0
            const isActive = c.id === activeConceptId
            return (
              <button
                key={c.id}
                type="button"
                className={`${s.flowCard} ${isLeft ? s.flowCardLeft : s.flowCardRight} ${isActive ? s.flowCardActive : ''}`}
                style={{ top: `${i * STEP + 6}px` }}
                onClick={() => navigate('/practice', { state: { conceptId: c.id } })}
              >
                <div className={s.flowIcon}>
                  <ConceptPathIcon conceptId={c.id} size={26} />
                </div>
                <div className={s.flowBody}>
                  <span className={s.flowTitle}>{c.label}</span>
                  <span className={s.flowMeta}>Practice · {estMinutesFor(c.id, i)} min</span>
                </div>
                <span className={s.flowStatus}>→</span>
              </button>
            )
          })}
        </div>
      )}

      <button type="button" className={s.openFull} onClick={() => navigate('/practice')}>
        Open full path in Practice →
      </button>
    </div>
  )
}
