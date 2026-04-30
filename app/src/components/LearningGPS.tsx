import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ML_TO_LABEL, LEGACY_TO_ML, PREREQUISITES, resolveConceptId } from '../lib/conceptMap'
import s from './LearningGPS.module.css'

const ML_API_URL = import.meta.env.VITE_ML_API_URL ?? ''

// ── SVG canvas ───────────────────────────────────────────────────────────────
const W = 268, H = 230
const VPAD_T = 18, VPAD_B = 32  // bottom pad leaves room for bottom-row labels
const TARGET_R = 10, NODE_R = 6
const MAX_DEPTH = 5

const STATUS_COLOR: Record<string, string> = {
  mastered:    '#58CC02',
  in_progress: '#4A7BF7',
  struggling:  '#FF4B4B',
  untouched:   '#B8B8C8',
}
const STATUS_LABEL: Record<string, string> = {
  mastered: 'Mastered', in_progress: 'In progress',
  struggling: 'Needs work', untouched: 'Not started',
}
const URGENCY: Record<string, number> = { struggling: 0, untouched: 1, in_progress: 2, mastered: 3 }

// ── Types ────────────────────────────────────────────────────────────────────

interface MLNode {
  id: string
  mastery: number
  status: 'mastered' | 'in_progress' | 'struggling' | 'untouched'
}

interface VNode {
  id: string
  label: string
  short: string
  mastery: number
  status: MLNode['status']
  depth: number
  x: number
  y: number
  isTarget: boolean
}

interface VEdge {
  x1: number; y1: number; x2: number; y2: number
  needsWork: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fuzzyResolve(query: string): string | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  if (ML_TO_LABEL[q]) return q
  const via = resolveConceptId(query)
  if (ML_TO_LABEL[via]) return via
  for (const [id, lbl] of Object.entries(ML_TO_LABEL))
    if (lbl.toLowerCase().includes(q)) return id
  for (const [name, id] of Object.entries(LEGACY_TO_ML))
    if (name.toLowerCase().includes(q)) return id
  return null
}

function trunc(str: string, n: number) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

// ── Graph builder ────────────────────────────────────────────────────────────

function buildGraph(targetId: string, nodeMap: Map<string, MLNode>) {
  // BFS through prerequisite tree from target outward
  const depthMap = new Map<string, number>()
  const queue: { id: string; d: number }[] = [{ id: targetId, d: 0 }]

  while (queue.length) {
    const { id, d } = queue.shift()!
    if (depthMap.has(id)) continue
    depthMap.set(id, d)
    if (d < MAX_DEPTH)
      for (const pre of PREREQUISITES[id] ?? [])
        if (!depthMap.has(pre)) queue.push({ id: pre, d: d + 1 })
  }

  // Group by depth level
  const byDepth = new Map<number, string[]>()
  for (const [id, d] of depthMap)
    byDepth.set(d, [...(byDepth.get(d) ?? []), id])

  const maxD = Math.max(...depthMap.values(), 0)

  // Assign 2-D positions: target top-center, prerequisites cascade downward
  const posMap = new Map<string, { x: number; y: number }>()
  for (const [d, ids] of byDepth) {
    const y = VPAD_T + (maxD > 0 ? d / maxD : 0) * (H - VPAD_T - VPAD_B)
    const step = (W - 32) / ids.length
    ids.forEach((id, i) => posMap.set(id, { x: 16 + step * i + step / 2, y }))
  }

  // Build node list
  const nodes: VNode[] = [...depthMap.keys()].map(id => {
    const ml  = nodeMap.get(id)
    const { x, y } = posMap.get(id)!
    const label = ML_TO_LABEL[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return {
      id, label, short: trunc(label, 11),
      mastery: ml?.mastery ?? 0,
      status:  ml?.status  ?? 'untouched',
      depth: depthMap.get(id)!,
      x, y, isTarget: id === targetId,
    }
  })

  // Build edge list (parent concept → its prerequisite)
  const edges: VEdge[] = []
  for (const id of depthMap.keys()) {
    const from = posMap.get(id)!
    for (const pre of PREREQUISITES[id] ?? []) {
      if (!depthMap.has(pre)) continue
      const to = posMap.get(pre)!
      const needsWork =
        (nodeMap.get(id)?.status  ?? 'untouched') !== 'mastered' ||
        (nodeMap.get(pre)?.status ?? 'untouched') !== 'mastered'
      edges.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, needsWork })
    }
  }

  // Action list: non-target nodes sorted by urgency for the list below the graph
  const actionList = nodes
    .filter(n => !n.isTarget)
    .sort((a, b) => (URGENCY[a.status] - URGENCY[b.status]) || (a.depth - b.depth) || (a.mastery - b.mastery))
    .slice(0, 4)

  const mastered = nodes.filter(n => !n.isTarget && n.status === 'mastered').length
  const total    = nodes.length - 1

  return { nodes, edges, actionList, mastered, total }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LearningGPS({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [query,       setQuery]       = useState('')
  const [result,      setResult]      = useState<ReturnType<typeof buildGraph> | null>(null)
  const [targetLabel, setTargetLabel] = useState('')
  const [hovered,     setHovered]     = useState<string | null>(null)
  const [notFound,    setNotFound]    = useState(false)
  const [loading,     setLoading]     = useState(false)

  async function search() {
    const id = fuzzyResolve(query)
    if (!id) { setNotFound(true); setResult(null); return }

    setNotFound(false)
    setTargetLabel(ML_TO_LABEL[id] ?? id)
    setLoading(true)

    const nodeMap = new Map<string, MLNode>()
    if (userId && ML_API_URL) {
      try {
        const res = await fetch(`${ML_API_URL}/knowledge-graph/${userId}`)
        if (res.ok) {
          const { nodes }: { nodes: MLNode[] } = await res.json()
          nodes.forEach(n => nodeMap.set(n.id, n))
        }
      } catch { /* constellation not yet available — all concepts show as untouched */ }
    }

    setResult(buildGraph(id, nodeMap))
    setLoading(false)
  }

  return (
    <div className={s.card}>

      {/* Header */}
      <div className={s.header}>
        <span className={s.headerIcon}>◈</span>
        <span className={s.headerTitle}>Learning GPS</span>
        <span className={s.headerSub}>Map your path to mastery</span>
      </div>

      {/* Search */}
      <div className={s.searchRow}>
        <input
          className={s.input}
          placeholder="Enter a concept…"
          value={query}
          onChange={e => { setQuery(e.target.value); setNotFound(false) }}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button className={s.searchBtn} onClick={search} disabled={!query.trim() || loading}>
          {loading ? <span className={s.spin} /> : '→'}
        </button>
      </div>

      {notFound && <p className={s.notFound}>Not found — try "Logarithms", "Derivatives", "Probability"…</p>}
      {!result && !notFound && (
        <p className={s.hint}>Type any concept to see your personal constellation path to mastery.</p>
      )}

      {/* Results */}
      {result && (
        <>
          {/* ── Mini constellation graph ── */}
          <div className={s.graphWrap}>
            <p className={s.graphTitle}>
              {result.total === 0
                ? `${targetLabel} — no prerequisites`
                : `Path to ${targetLabel}`}
            </p>

            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className={s.svg}>

              {/* Prerequisite edges */}
              {result.edges.map((e, i) => (
                <line key={i}
                  x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={e.needsWork ? 'rgba(124,58,237,0.22)' : 'rgba(88,204,2,0.18)'}
                  strokeWidth={e.needsWork ? 1.3 : 0.9}
                  strokeDasharray={e.needsWork ? undefined : '3 2'}
                />
              ))}

              {/* Nodes — render deeper nodes first so target sits on top */}
              {[...result.nodes].sort((a, b) => b.depth - a.depth).map(n => {
                const color = n.isTarget ? '#7C3AED' : STATUS_COLOR[n.status]
                const r     = n.isTarget ? TARGET_R : NODE_R
                const isH   = hovered === n.id
                const lY    = n.y + r + 9

                return (
                  <g key={n.id}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => navigate('/practice', { state: { problemText: `Help me practice ${n.label}` } })}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Hover glow */}
                    {isH && (
                      <circle cx={n.x} cy={n.y} r={r + 5}
                        fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />
                    )}

                    {/* Node circle */}
                    <circle cx={n.x} cy={n.y} r={r}
                      fill={n.isTarget ? '#EDE9FE' : 'var(--surface)'}
                      stroke={color}
                      strokeWidth={n.isTarget ? 2.5 : 1.8}
                    />

                    {/* Mastery fill (non-target only) */}
                    {!n.isTarget && n.mastery > 0 && (
                      <circle cx={n.x} cy={n.y} r={r - 2.5}
                        fill={color}
                        fillOpacity={0.2 + n.mastery * 0.65}
                      />
                    )}

                    {/* Target center dot */}
                    {n.isTarget && (
                      <circle cx={n.x} cy={n.y} r={3} fill="#7C3AED" fillOpacity="0.75" />
                    )}

                    {/* Label */}
                    <text
                      x={n.x} y={lY}
                      textAnchor="middle"
                      fontSize={n.isTarget ? 9 : 7.5}
                      fontWeight={n.isTarget ? 700 : 500}
                      fill={n.isTarget ? '#4C1D95' : '#888898'}
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {n.isTarget ? trunc(n.label, 16) : n.short}
                    </text>

                    {/* Hover tooltip */}
                    {isH && !n.isTarget && (
                      <g>
                        <rect x={n.x - 46} y={n.y - r - 23} width={92} height={18}
                          rx={4} fill="rgba(26,26,46,0.9)" />
                        <text x={n.x} y={n.y - r - 11}
                          textAnchor="middle" fontSize={8} fill="#fff"
                          fontFamily="system-ui, sans-serif"
                        >
                          {trunc(n.label, 18)} · {Math.round(n.mastery * 100)}%
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Color legend */}
            <div className={s.legend}>
              {(['mastered','in_progress','struggling','untouched'] as const).map(st => (
                <span key={st} className={s.legendItem}>
                  <span className={s.legendDot} style={{ background: STATUS_COLOR[st] }} />
                  {STATUS_LABEL[st]}
                </span>
              ))}
            </div>
          </div>

          {/* Overall progress */}
          {result.total > 0 && (
            <div className={s.progressRow}>
              <div className={s.progressBar}>
                <div className={s.progressFill}
                  style={{ width: `${Math.round((result.mastered / result.total) * 100)}%` }} />
              </div>
              <span className={s.progressText}>{result.mastered}/{result.total} mastered</span>
            </div>
          )}

          {/* Action list — top concepts to focus on */}
          {result.actionList.length > 0 && (
            <ul className={s.actionList}>
              {result.actionList.map(n => (
                <li key={n.id} className={s.actionItem}
                  onClick={() => navigate('/practice', { state: { problemText: `Help me practice ${n.label}` } })}
                >
                  <span className={s.actionDot} style={{ background: STATUS_COLOR[n.status] }} />
                  <span className={s.actionLabel}>{n.label}</span>
                  <span className={s.actionPct} style={{ color: STATUS_COLOR[n.status] }}>
                    {Math.round(n.mastery * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* CTA */}
          {result.actionList[0] ? (
            <button className={s.cta}
              onClick={() => navigate('/practice', {
                state: { problemText: `Help me practice ${result.actionList[0].label}` }
              })}
            >
              Start: {result.actionList[0].label} →
            </button>
          ) : (
            <p className={s.allDone}>All prerequisites mastered — you're ready!</p>
          )}
        </>
      )}
    </div>
  )
}
