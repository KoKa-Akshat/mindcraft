import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ML_TO_LABEL, LEGACY_TO_ML, PREREQUISITES, resolveConceptId } from '../lib/conceptMap'
import s from './LearningGPS.module.css'

const ML_API_URL = import.meta.env.VITE_ML_API_URL ?? ''

interface MLNode {
  id: string
  mastery: number
  status: 'mastered' | 'struggling' | 'in_progress' | 'untouched'
}

interface PathStep {
  id: string
  label: string
  depth: number
  mastery: number
  status: 'mastered' | 'struggling' | 'in_progress' | 'untouched'
}

const URGENCY: Record<string, number> = { struggling: 0, untouched: 1, in_progress: 2, mastered: 3 }

function fuzzyResolve(query: string): string | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  // Exact ML ID
  if (ML_TO_LABEL[q]) return q
  // Legacy mapping
  const via = resolveConceptId(query)
  if (ML_TO_LABEL[via]) return via
  // Partial label match
  for (const [id, label] of Object.entries(ML_TO_LABEL)) {
    if (label.toLowerCase().includes(q)) return id
  }
  // Partial legacy name match
  for (const [name, id] of Object.entries(LEGACY_TO_ML)) {
    if (name.toLowerCase().includes(q)) return id
  }
  return null
}

function buildPath(targetId: string, nodeMap: Map<string, MLNode>): PathStep[] {
  const visited = new Set<string>()
  const queue: Array<{ id: string; depth: number }> = [{ id: targetId, depth: 0 }]
  const steps: PathStep[] = []

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    if (depth > 0) {
      const node = nodeMap.get(id)
      steps.push({
        id,
        label: ML_TO_LABEL[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        depth,
        mastery: node?.mastery ?? 0,
        status: node?.status ?? 'untouched',
      })
    }

    for (const prereq of PREREQUISITES[id] ?? []) {
      if (!visited.has(prereq)) queue.push({ id: prereq, depth: depth + 1 })
    }
  }

  steps.sort((a, b) => {
    const u = URGENCY[a.status] - URGENCY[b.status]
    if (u !== 0) return u
    const d = a.depth - b.depth
    if (d !== 0) return d
    return a.mastery - b.mastery
  })

  return steps
}

const STATUS_COLOR: Record<string, string> = {
  mastered:    '#58CC02',
  in_progress: '#4A7BF7',
  struggling:  '#FF4B4B',
  untouched:   '#B0B0BE',
}

const STATUS_LABEL: Record<string, string> = {
  mastered:    'Mastered',
  in_progress: 'In progress',
  struggling:  'Needs work',
  untouched:   'Not started',
}

interface Props { userId: string }

export default function LearningGPS({ userId }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [path, setPath] = useState<PathStep[] | null>(null)
  const [targetLabel, setTargetLabel] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)

  async function search() {
    const resolved = fuzzyResolve(query)
    if (!resolved) { setNotFound(true); setPath(null); return }

    setNotFound(false)
    setTargetLabel(ML_TO_LABEL[resolved] ?? resolved)
    setLoading(true)

    let nodeMap = new Map<string, MLNode>()
    if (userId && ML_API_URL) {
      try {
        const res = await fetch(`${ML_API_URL}/knowledge-graph/${userId}`)
        if (res.ok) {
          const data: { nodes: MLNode[] } = await res.json()
          for (const n of data.nodes) nodeMap.set(n.id, n)
        }
      } catch { /* no constellation yet — path still works with all-untouched */ }
    }

    setPath(buildPath(resolved, nodeMap))
    setLoading(false)
  }

  const mastered  = path?.filter(p => p.status === 'mastered').length ?? 0
  const total     = path?.length ?? 0
  const nextFocus = path?.find(p => p.status !== 'mastered')

  return (
    <div className={s.card}>
      <div className={s.header}>
        <span className={s.headerIcon}>◈</span>
        <span className={s.headerTitle}>Learning GPS</span>
        <span className={s.headerSub}>Map your path to mastery</span>
      </div>

      <div className={s.searchRow}>
        <input
          className={s.input}
          placeholder="Enter a concept…"
          value={query}
          onChange={e => { setQuery(e.target.value); setNotFound(false) }}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button
          className={s.searchBtn}
          onClick={search}
          disabled={!query.trim() || loading}
          title="Map path"
        >
          {loading ? <span className={s.spin} /> : '→'}
        </button>
      </div>

      {notFound && (
        <p className={s.notFound}>Concept not found. Try "Logarithms", "Derivatives", "Probability"…</p>
      )}

      {path !== null && (
        <div className={s.results}>
          <div className={s.pathHeader}>
            <span className={s.pathTitle}>Path to {targetLabel}</span>
            <span className={s.pathProgress}>
              {mastered}/{total} prerequisites mastered
            </span>
          </div>

          <div className={s.progressBar}>
            <div
              className={s.progressFill}
              style={{ width: total > 0 ? `${Math.round((mastered / total) * 100)}%` : '0%' }}
            />
          </div>

          {path.length === 0 ? (
            <p className={s.noPrereqs}>No prerequisites found — you can jump right in!</p>
          ) : (
            <ul className={s.list}>
              {path.map(step => (
                <li key={step.id} className={s.step}>
                  <span
                    className={s.dot}
                    style={{ background: STATUS_COLOR[step.status] }}
                  />
                  <div className={s.stepInfo}>
                    <span className={s.stepLabel}>{step.label}</span>
                    <div className={s.masteryBar}>
                      <div
                        className={s.masteryFill}
                        style={{
                          width: `${Math.round(step.mastery * 100)}%`,
                          background: STATUS_COLOR[step.status],
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className={s.stepStatus}
                    style={{ color: STATUS_COLOR[step.status] }}
                  >
                    {STATUS_LABEL[step.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {nextFocus && (
            <button
              className={s.focusBtn}
              onClick={() => navigate('/practice', { state: { problemText: `Help me practice ${nextFocus.label}` } })}
            >
              Focus on {nextFocus.label} →
            </button>
          )}
        </div>
      )}

      {path === null && !notFound && (
        <p className={s.hint}>
          Type any concept to see which prerequisites from your constellation you need to master it.
        </p>
      )}
    </div>
  )
}
