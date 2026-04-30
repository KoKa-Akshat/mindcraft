import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ML_TO_LABEL, LEGACY_TO_ML, PREREQUISITES, resolveConceptId } from '../lib/conceptMap'
import s from './LearningGPS.module.css'

const ML_API_URL = import.meta.env.VITE_ML_API_URL ?? ''

// Reverse graph: concept → concepts it directly unlocks
const DEPENDENTS: Record<string, string[]> = {}
for (const [id, prereqs] of Object.entries(PREREQUISITES)) {
  for (const pre of prereqs) {
    (DEPENDENTS[pre] ??= []).push(id)
  }
}

// ── Canvas ───────────────────────────────────────────────────────────────────
const W = 268, H = 330
const VPAD_T = 24, VPAD_B = 42
const TARGET_R = 10, NODE_R = 6
const MAX_PREREQ_DEPTH = 3
const MAX_PER_LEVEL    = 5

const STATUS_COLOR: Record<string, string> = {
  mastered:    '#A8E063',
  in_progress: '#5B9BD5',
  struggling:  '#FF6B6B',
  untouched:   '#8B9BA8',
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
  depth: number   // 0 = target, positive = prerequisite, negative = unlock
  x: number
  y: number
  isTarget: boolean
  isUnlock: boolean
}

interface VEdge {
  x1: number; y1: number; x2: number; y2: number
  needsWork: boolean
  isUnlock: boolean
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

// ── Graph builder ─────────────────────────────────────────────────────────────
// depth 0  = target (center)
// depth  1+ = prerequisites (drawn below target — "foundations")
// depth -1  = direct unlocks (drawn above target — "where this leads")

function buildGraph(targetId: string, nodeMap: Map<string, MLNode>) {
  const depthMap = new Map<string, number>()
  const unlockSet = new Set<string>()

  // BFS through prerequisites (positive depths, rendered below)
  const q: { id: string; d: number }[] = [{ id: targetId, d: 0 }]
  while (q.length) {
    const { id, d } = q.shift()!
    if (depthMap.has(id)) continue
    depthMap.set(id, d)
    if (d < MAX_PREREQ_DEPTH)
      for (const pre of PREREQUISITES[id] ?? [])
        if (!depthMap.has(pre)) q.push({ id: pre, d: d + 1 })
  }

  // Add direct unlocks (depth -1, rendered above)
  for (const dep of (DEPENDENTS[targetId] ?? []).slice(0, MAX_PER_LEVEL)) {
    if (!depthMap.has(dep)) {
      depthMap.set(dep, -1)
      unlockSet.add(dep)
    }
  }

  const minD = Math.min(...depthMap.values())          // -1 when unlocks exist
  const maxD = Math.max(...depthMap.values(), 0)
  const range = maxD - minD || 1

  // Group by depth, cap crowded levels (keep most-urgent nodes first)
  const byDepth = new Map<number, string[]>()
  for (const [id, d] of depthMap) {
    const arr = byDepth.get(d) ?? []
    byDepth.set(d, arr)
    if (id === targetId || arr.length < MAX_PER_LEVEL) arr.push(id)
  }

  // Assign 2-D positions
  const posMap = new Map<string, { x: number; y: number }>()
  for (const [d, ids] of byDepth) {
    // minD → VPAD_T (top), maxD → H-VPAD_B (bottom)
    const baseY = VPAD_T + ((d - minD) / range) * (H - VPAD_T - VPAD_B)
    const count = ids.length
    const step  = (W - 32) / Math.max(count, 1)
    ids.forEach((id, i) => {
      // Stagger alternate nodes when ≥ 3 in a row to reduce label collisions
      const stagger = count >= 3 && i % 2 === 1 ? 15 : 0
      posMap.set(id, { x: 16 + step * i + step / 2, y: baseY + stagger })
    })
  }

  // Build node list
  const nodes: VNode[] = []
  for (const id of depthMap.keys()) {
    const pos = posMap.get(id)
    if (!pos) continue
    const ml    = nodeMap.get(id)
    const label = ML_TO_LABEL[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    nodes.push({
      id, label, short: trunc(label, 11),
      mastery: ml?.mastery ?? 0,
      status:  ml?.status  ?? 'untouched',
      depth: depthMap.get(id)!,
      x: pos.x, y: pos.y,
      isTarget: id === targetId,
      isUnlock: unlockSet.has(id),
    })
  }

  // Build edge list
  const edges: VEdge[] = []
  for (const id of depthMap.keys()) {
    const from = posMap.get(id)!
    // Prerequisite edges
    for (const pre of PREREQUISITES[id] ?? []) {
      if (!depthMap.has(pre) || unlockSet.has(pre)) continue
      const to = posMap.get(pre)!
      const needsWork =
        (nodeMap.get(id)?.status  ?? 'untouched') !== 'mastered' ||
        (nodeMap.get(pre)?.status ?? 'untouched') !== 'mastered'
      edges.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, needsWork, isUnlock: false })
    }
    // Unlock edges (target → its dependents)
    if (id === targetId) {
      for (const dep of unlockSet) {
        const to = posMap.get(dep)
        if (!to) continue
        edges.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, needsWork: false, isUnlock: true })
      }
    }
  }

  const prereqNodes = nodes.filter(n => !n.isTarget && !n.isUnlock)
  const actionList  = prereqNodes
    .sort((a, b) => (URGENCY[a.status] - URGENCY[b.status]) || (a.depth - b.depth) || (a.mastery - b.mastery))
    .slice(0, 4)

  const mastered = prereqNodes.filter(n => n.status === 'mastered').length
  const total    = prereqNodes.length

  return { nodes, edges, actionList, mastered, total, unlockCount: unlockSet.size }
}

// ── Component ─────────────────────────────────────────────────────────────────

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
      } catch { /* all concepts fall back to untouched */ }
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

      {notFound && <p className={s.notFound}>Not found — try "Probability", "Derivatives", "Logarithms"…</p>}
      {!result && !notFound && (
        <p className={s.hint}>Type any concept to map prerequisites and what it unlocks.</p>
      )}

      {result && (
        <>
          {/* ── Mini constellation graph ── */}
          <div className={s.graphWrap}>
            <p className={s.graphTitle}>
              {result.unlockCount > 0
                ? `${targetLabel} · ${result.total} prereqs · ${result.unlockCount} unlock${result.unlockCount > 1 ? 's' : ''}`
                : result.total === 0
                  ? `${targetLabel} — no prerequisites`
                  : `Path to ${targetLabel}`}
            </p>

            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className={s.svg}>

              {/* Edges */}
              {result.edges.map((e, i) => (
                <line key={i}
                  x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={
                    e.isUnlock    ? 'rgba(74,158,255,0.40)' :
                    e.needsWork   ? 'rgba(124,58,237,0.28)' :
                                    'rgba(88,204,2,0.22)'
                  }
                  strokeWidth={e.isUnlock ? 1.4 : e.needsWork ? 1.3 : 0.9}
                  strokeDasharray={e.isUnlock ? '4 3' : e.needsWork ? undefined : '3 2'}
                />
              ))}

              {/* Nodes — deepest (furthest from target) rendered first */}
              {[...result.nodes].sort((a, b) => Math.abs(b.depth) - Math.abs(a.depth)).map(n => {
                const color = n.isTarget ? '#7C3AED' : n.isUnlock ? '#4A9EFF' : STATUS_COLOR[n.status]
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
                      fill={
                        n.isTarget  ? 'rgba(124,58,237,0.25)' :
                        n.isUnlock  ? 'rgba(74,158,255,0.14)' :
                                      'var(--surface)'
                      }
                      stroke={color}
                      strokeWidth={n.isTarget ? 2.5 : 1.8}
                      strokeDasharray={n.isUnlock ? '3 2' : undefined}
                    />

                    {/* Mastery fill for prerequisite nodes */}
                    {!n.isTarget && !n.isUnlock && n.mastery > 0 && (
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
                      fill={
                        n.isTarget  ? '#D4AAFF' :
                        n.isUnlock  ? 'rgba(74,158,255,0.9)' :
                                      'rgba(255,255,255,0.58)'
                      }
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {n.isTarget ? trunc(n.label, 16) : n.short}
                    </text>

                    {/* Hover tooltip */}
                    {isH && !n.isTarget && (
                      <g>
                        <rect x={n.x - 50} y={n.y - r - 24} width={100} height={18}
                          rx={4} fill="rgba(10,35,45,0.96)" />
                        <text x={n.x} y={n.y - r - 12}
                          textAnchor="middle" fontSize={8} fill="#fff"
                          fontFamily="system-ui, sans-serif"
                        >
                          {trunc(n.label, 20)} {n.isUnlock ? '(unlocks)' : `· ${Math.round(n.mastery * 100)}%`}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Legend */}
            <div className={s.legend}>
              {(['mastered','in_progress','struggling','untouched'] as const).map(st => (
                <span key={st} className={s.legendItem}>
                  <span className={s.legendDot} style={{ background: STATUS_COLOR[st] }} />
                  {STATUS_LABEL[st]}
                </span>
              ))}
              {result.unlockCount > 0 && (
                <span className={s.legendItem}>
                  <span className={s.legendDot} style={{ background: '#4A9EFF' }} />
                  Unlocks
                </span>
              )}
            </div>
          </div>

          {/* Overall progress bar */}
          {result.total > 0 && (
            <div className={s.progressRow}>
              <div className={s.progressBar}>
                <div className={s.progressFill}
                  style={{ width: `${Math.round((result.mastered / result.total) * 100)}%` }} />
              </div>
              <span className={s.progressText}>{result.mastered}/{result.total} prereqs mastered</span>
            </div>
          )}

          {/* Action list */}
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
