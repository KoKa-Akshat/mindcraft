/**
 * KnowledgeGraph.tsx
 *
 * Interactive concept knowledge graph using PCA-projected positions
 * from the ML engine. Concepts are positioned in semantically meaningful
 * space — algebraic concepts cluster together, geometric ones cluster
 * separately — rather than arbitrary radial rings.
 *
 * - Concept nodes colored by mastery status (mastered/struggling/in_progress/untouched)
 * - Edges from ontology with weight-based thickness
 * - Student mastery + strength points with displacement arrow
 * - Click a concept → detail panel with ingredients, mastery, strength
 * - ML learning path panel below the graph
 * - Student profile panel with strengths/weaknesses
 */

import { useEffect, useRef, useState } from 'react'
import { signOut }      from 'firebase/auth'
import { auth }         from '../firebase'
import { useNavigate, useParams } from 'react-router-dom'
import { useUser }      from '../App'
import { logEvent }     from '../lib/logEvent'
import Navbar           from '../components/Navbar'
import Sidebar          from '../components/Sidebar'
import { resolveConceptId, mlIdToLabel } from '../lib/conceptMap'
import { getRecommendations, type RecommendResult } from '../lib/mlApi'
import s                from './KnowledgeGraph.module.css'

// ── ML API base URL ──
const ML_API_URL =
  import.meta.env.VITE_ML_API_URL ??
  import.meta.env.VITE_ML_URL ??
  ''

// ── SVG viewport ──
const SVG_W = 880
const SVG_H = 580
const PAD   = 60
const ZOOM_MIN = 0.75
const ZOOM_MAX = 1.8
const ZOOM_STEP = 0.15

// ── Types from ML API ──
interface MLNode {
  id:             string
  name:           string
  level:          string
  x:              number
  y:              number
  mastery:        number
  strengthScore:  number
  eventCount:     number
  status:         'mastered' | 'struggling' | 'in_progress' | 'untouched'
  ingredients:    { id: string; name: string; description: string }[]
  tags:           string[]
}

interface MLEdge {
  from:     string
  to:       string
  weight:   number
  relation: string
}

interface StudentPoint {
  x:     number
  y:     number
  label: string
}

interface MLGraphResponse {
  nodes:          MLNode[]
  edges:          MLEdge[]
  studentPoints:  { mastery: StudentPoint; strength: StudentPoint }
  axisLabels:     { x: string; y: string }
  conceptCount:   number
  edgeCount:      number
}

interface IngredientPreview {
  id: string
  name: string
  description: string
}

// ── Status → color mapping (MindCraft palette) ──
function statusColor(status: string): string {
  switch (status) {
    case 'mastered':     return '#58CC02'
    case 'struggling':   return '#FF4B4B'
    case 'in_progress':  return '#4A7BF7'
    case 'untouched':
    default:             return '#3E4559'
  }
}

function statusGlow(status: string): string {
  switch (status) {
    case 'mastered':     return 'rgba(88, 204, 2, 0.4)'
    case 'struggling':   return 'rgba(255, 75, 75, 0.3)'
    case 'in_progress':  return 'rgba(74, 123, 247, 0.3)'
    default:             return 'rgba(62, 69, 89, 0.15)'
  }
}

function edgeStyle(relation: string): { dash: string; opacity: number } {
  switch (relation) {
    case 'prerequisite': return { dash: '',        opacity: 0.25 }
    case 'related':      return { dash: '6 4',     opacity: 0.12 }
    case 'application':  return { dash: '3 3',     opacity: 0.18 }
    case 'discovered':   return { dash: '2 4',     opacity: 0.15 }
    default:             return { dash: '',        opacity: 0.15 }
  }
}

// ── Scale PCA coordinates to SVG viewport ──
function scaleNodes(nodes: MLNode[]): Map<string, { sx: number; sy: number }> {
  if (nodes.length === 0) return new Map()

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.x > maxX) maxX = n.x
    if (n.y < minY) minY = n.y
    if (n.y > maxY) maxY = n.y
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const plotW  = SVG_W - PAD * 2
  const plotH  = SVG_H - PAD * 2

  const positions = new Map<string, { sx: number; sy: number }>()
  for (const n of nodes) {
    positions.set(n.id, {
      sx: PAD + ((n.x - minX) / rangeX) * plotW,
      sy: PAD + ((n.y - minY) / rangeY) * plotH,
    })
  }

  return positions
}

function scalePoint(
  point: StudentPoint,
  nodes: MLNode[],
): { sx: number; sy: number } {
  if (nodes.length === 0) return { sx: SVG_W / 2, sy: SVG_H / 2 }

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.x > maxX) maxX = n.x
    if (n.y < minY) minY = n.y
    if (n.y > maxY) maxY = n.y
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const plotW  = SVG_W - PAD * 2
  const plotH  = SVG_H - PAD * 2

  return {
    sx: PAD + ((point.x - minX) / rangeX) * plotW,
    sy: PAD + ((point.y - minY) / rangeY) * plotH,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// ── Exam prep concept chips ──
const QUICK_CONCEPTS = [
  'derivatives', 'integrals', 'quadratic_equations',
  'trigonometry_basics', 'logarithmic_functions', 'linear_equations',
]

export default function KnowledgeGraph() {
  const user     = useUser()
  const navigate = useNavigate()
  const { concept: urlConcept } = useParams<{ concept?: string }>()
  const svgWrapRef = useRef<HTMLDivElement | null>(null)

  const [search,    setSearch]    = useState(urlConcept ? decodeURIComponent(urlConcept) : '')
  const [graphData, setGraphData] = useState<MLGraphResponse | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [slowLoad,  setSlowLoad]  = useState(false)
  const [error,     setError]     = useState('')
  const [selected,  setSelected]  = useState<MLNode | null>(null)
  const [hovered,   setHovered]   = useState<string | null>(null)
  const [mlResult,  setMlResult]  = useState<RecommendResult | null>(null)
  const [zoom,      setZoom]      = useState(1)
  const [pan,       setPan]       = useState({ x: 0, y: 0 })
  const [dragging,  setDragging]  = useState(false)
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null)
  const [activeIngredient, setActiveIngredient] = useState<IngredientPreview | null>(null)

  // Scaled positions
  const positions = graphData ? scaleNodes(graphData.nodes) : new Map()

  // ── Fetch graph from ML API ──
  async function fetchGraph(conceptInput?: string) {
    if (!user?.uid) return
    setLoading(true)
    setSlowLoad(false)
    setError('')
    setSelected(null)
    setActiveIngredient(null)
    if (!conceptInput) setMlResult(null)

    // After 6s with no response, show a warm-up message
    const slowTimer = setTimeout(() => setSlowLoad(true), 6000)

    try {
      // Fetch the full knowledge graph from ML API
      const graphRes = await fetch(`${ML_API_URL}/knowledge-graph/${user.uid}`)
      if (!graphRes.ok) throw new Error('Failed to fetch knowledge graph')
      const data: MLGraphResponse = await graphRes.json()

      if (data.nodes.length === 0) {
        setError('No graph data yet. Complete a session to start building your knowledge graph.')
        setGraphData(null)
      } else {
        setGraphData(data)
      }

      // If a concept was specified, also get recommendations for it
      if (conceptInput) {
        const conceptId = resolveConceptId(conceptInput)
        const mlRes = await getRecommendations(user.uid, [conceptId], 'curriculum')
        setMlResult(mlRes)
        navigate(`/knowledge-graph/${encodeURIComponent(conceptInput)}`, { replace: true })
        logEvent(user.uid, 'graph_search', {
          concept: conceptId,
          nodeCount: data.nodes.length,
          edgeCount: data.edges.length,
        })
      } else {
        setMlResult(null)
      }
    } catch (err) {
      console.error('Knowledge graph fetch error:', err)
      setError('Could not load knowledge graph. The ML server may still be warming up — try again in a moment.')
    } finally {
      clearTimeout(slowTimer)
      setSlowLoad(false)
      setLoading(false)
    }
  }

  // Auto-fetch on mount
  useEffect(() => {
    if (user?.uid) {
      fetchGraph(urlConcept ? decodeURIComponent(urlConcept) : undefined)
    }
  }, [user?.uid, urlConcept])

  function adjustZoom(delta: number) {
    setZoom(current => clamp(Number((current + delta).toFixed(2)), ZOOM_MIN, ZOOM_MAX))
  }

  function handleWheelZoom(e: React.WheelEvent<HTMLDivElement>) {
    if (!graphData || loading) return
    e.preventDefault()
    adjustZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
  }

  function handlePointerDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!graphData || loading) return
    if ((e.target as HTMLElement).closest('button')) return
    setDragging(true)
    setDragOrigin({ x: e.clientX, y: e.clientY })
  }

  function handlePointerMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragging || !dragOrigin || !svgWrapRef.current) return

    const rect = svgWrapRef.current.getBoundingClientRect()
    const scaleX = SVG_W / Math.max(rect.width, 1)
    const scaleY = SVG_H / Math.max(rect.height, 1)
    const dx = (e.clientX - dragOrigin.x) * scaleX
    const dy = (e.clientY - dragOrigin.y) * scaleY

    setPan(current => ({ x: current.x + dx, y: current.y + dy }))
    setDragOrigin({ x: e.clientX, y: e.clientY })
  }

  function stopDragging() {
    setDragging(false)
    setDragOrigin(null)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) fetchGraph(search.trim())
  }

  function openNode(node: MLNode) {
    setSelected(node)
    setActiveIngredient(null)
    logEvent(user?.uid, 'graph_node_click', {
      node: node.id,
      status: node.status,
      mastery: node.mastery,
      strengthScore: node.strengthScore,
    })
  }

  function openIngredientCard(ingredient: IngredientPreview) {
    setActiveIngredient(ingredient)
  }

  // ── Render ──
  const masteredCount  = graphData?.nodes.filter(n => n.status === 'mastered').length ?? 0
  const totalCount     = graphData?.nodes.length ?? 0
  const hasStudentData = graphData?.studentPoints?.mastery && graphData?.studentPoints?.strength
  const viewportTranslate = `${SVG_W / 2 * (1 - zoom) + pan.x} ${SVG_H / 2 * (1 - zoom) + pan.y}`

  return (
    <div className={s.shell}>
      <Navbar user={user} onSignOut={() => signOut(auth).then(() => navigate('/login', { replace: true }))} />
      <Sidebar />

      <main className={s.page}>
        {/* ── Top bar ── */}
        <div className={s.topBar}>
          <button className={s.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <div className={s.titleRow}>
            <span className={s.pageTitle}>Knowledge Graph</span>
          </div>
        </div>

        {/* ── Search ── */}
        <div className={s.searchRow}>
          <form className={s.searchForm} onSubmit={handleSearch}>
            <div className={s.searchWrap}>
              <svg className={s.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className={s.searchInput}
                placeholder="Search a concept — e.g. Derivatives, Trigonometry, Algebra…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className={s.searchBtn} disabled={!search.trim() || loading}>
              {loading ? 'Loading…' : 'Explore →'}
            </button>
          </form>

          <div className={s.examChips}>
            <span className={s.examLabel}>Quick explore:</span>
            {QUICK_CONCEPTS.map(c => (
              <button key={c} className={s.examChip} onClick={() => {
                setSearch(mlIdToLabel(c))
                fetchGraph(c)
              }}>
                {mlIdToLabel(c)}
              </button>
            ))}
          </div>
        </div>

        {error && <div className={s.error}>{error}</div>}

        {/* ── Graph area ── */}
        <div className={s.graphArea}>
          <div
            ref={svgWrapRef}
            className={`${s.svgWrap} ${dragging ? s.dragging : ''}`}
            onWheel={handleWheelZoom}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={stopDragging}
            onMouseLeave={stopDragging}
          >
            {graphData && !loading && (
              <>
                <div className={s.graphHud}>
                  <div className={s.legend}>
                    <span className={s.legendTitle}>Legend</span>
                    <span className={s.legendItem}><span className={s.legendDot} style={{ background: '#58CC02' }} />Mastered</span>
                    <span className={s.legendItem}><span className={s.legendDot} style={{ background: '#4A7BF7' }} />In progress</span>
                    <span className={s.legendItem}><span className={s.legendDot} style={{ background: '#FF4B4B' }} />Needs work</span>
                    <span className={s.legendItem}><span className={s.legendDot} style={{ background: '#748095' }} />Untouched</span>
                  </div>
                </div>

                <div className={s.zoomControls}>
                  <button type="button" className={s.zoomBtn} onClick={() => adjustZoom(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN}>
                    −
                  </button>
                  <span className={s.zoomValue}>{Math.round(zoom * 100)}%</span>
                  <button type="button" className={s.zoomBtn} onClick={() => adjustZoom(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX}>
                    +
                  </button>
                  <button type="button" className={s.zoomReset} onClick={() => setZoom(1)} disabled={zoom === 1}>
                    Reset
                  </button>
                  <button type="button" className={s.zoomReset} onClick={() => setPan({ x: 0, y: 0 })} disabled={pan.x === 0 && pan.y === 0}>
                    Center
                  </button>
                </div>
              </>
            )}

            {/* Empty state */}
            {!graphData && !loading && (
              <div className={s.emptyState}>
                <div className={s.emptyOrb}>
                  <div className={s.emptyRing} />
                  <span className={s.emptyJ}>J</span>
                </div>
                <p className={s.emptyText}>Your knowledge graph will appear here</p>
                <p className={s.emptySub}>Complete sessions to see concepts connect</p>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className={s.emptyState}>
                <div className={s.loadingOrb}>
                  <div className={s.loadRing} />
                  <div className={s.loadRing2} />
                  <span className={s.emptyJ}>J</span>
                </div>
                <p className={s.emptyText}>Building your knowledge graph…</p>
                {slowLoad && (
                  <p className={s.emptySub} style={{ maxWidth: 320, textAlign: 'center' }}>
                    The ML engine is waking up — this first load takes ~30–60 seconds. Hang tight.
                  </p>
                )}
              </div>
            )}

            {/* SVG Graph */}
            {graphData && !loading && (
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className={s.svg}
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <filter id="glowStrong" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="6" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  {/* Star marker for student points */}
                  <marker id="arrowHead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6 Z" fill="mediumpurple" opacity="0.7" />
                  </marker>
                </defs>

                <g transform={`translate(${viewportTranslate}) scale(${zoom})`}>
                  {/* Axis labels */}
                  {graphData.axisLabels && (
                    <>
                      <text x={SVG_W / 2} y={SVG_H - 8} textAnchor="middle"
                        fontSize="10" fill="rgba(17,24,39,0.42)"
                        fontFamily="var(--f)" fontWeight="700">
                        {graphData.axisLabels.x}
                      </text>
                      <text x={12} y={SVG_H / 2} textAnchor="middle"
                        fontSize="10" fill="rgba(17,24,39,0.42)"
                        fontFamily="var(--f)" fontWeight="700"
                        transform={`rotate(-90, 12, ${SVG_H / 2})`}>
                        {graphData.axisLabels.y}
                      </text>
                    </>
                  )}

                  {/* Edges */}
                  {graphData.edges.filter(e => e.weight > 0.2).map((edge, i) => {
                    const sp = positions.get(edge.from)
                    const tp = positions.get(edge.to)
                    if (!sp || !tp) return null

                    const isHighlighted = hovered === edge.from || hovered === edge.to
                    const style = edgeStyle(edge.relation)
                    const strokeW = Math.max(0.75, edge.weight * 2.5)

                    return (
                      <line
                        key={`e-${i}`}
                        x1={sp.sx} y1={sp.sy}
                        x2={tp.sx} y2={tp.sy}
                        stroke="rgba(70, 85, 105, 0.65)"
                        strokeWidth={isHighlighted ? strokeW * 1.8 : strokeW}
                        strokeOpacity={isHighlighted ? Math.max(style.opacity * 2.6, 0.58) : style.opacity + 0.08}
                        strokeDasharray={style.dash}
                        strokeLinecap="round"
                      />
                    )
                  })}

                  {/* Displacement arrow (mastery → strength) */}
                  {hasStudentData && (() => {
                    const mp = scalePoint(graphData.studentPoints.mastery, graphData.nodes)
                    const sp = scalePoint(graphData.studentPoints.strength, graphData.nodes)
                    const dx = sp.sx - mp.sx
                    const dy = sp.sy - mp.sy
                    const len = Math.sqrt(dx * dx + dy * dy)
                    if (len < 5) return null

                    const mx = (mp.sx + sp.sx) / 2 + dy * 0.15
                    const my = (mp.sy + sp.sy) / 2 - dx * 0.15

                    return (
                      <g key="displacement">
                        <path
                          d={`M ${mp.sx} ${mp.sy} Q ${mx} ${my} ${sp.sx} ${sp.sy}`}
                          stroke="mediumpurple"
                          strokeWidth="2.5"
                          strokeOpacity="0.78"
                          fill="none"
                          markerEnd="url(#arrowHead)"
                          strokeLinecap="round"
                        />
                        <text x={mx} y={my - 10} textAnchor="middle"
                          fontSize="9" fill="rgba(109,40,217,0.92)"
                          fontFamily="var(--f)" fontWeight="800">
                          effort → strength
                        </text>
                      </g>
                    )
                  })()}

                  {/* Student points */}
                  {hasStudentData && (() => {
                    const mp = scalePoint(graphData.studentPoints.mastery, graphData.nodes)
                    const sp = scalePoint(graphData.studentPoints.strength, graphData.nodes)

                    return (
                      <g key="student-points">
                        <polygon
                          points={starPoints(mp.sx, mp.sy, 12, 6, 5)}
                          fill="#ef4444" stroke="#ffffff" strokeWidth="1"
                          filter="url(#glow)" opacity="0.96"
                        />
                        <text x={mp.sx} y={mp.sy + 22} textAnchor="middle"
                          fontSize="9" fontWeight="800" fill="#b91c1c"
                          fontFamily="var(--f)">
                          mastery
                        </text>

                        <polygon
                          points={starPoints(sp.sx, sp.sy, 12, 6, 5)}
                          fill="#f59e0b" stroke="#ffffff" strokeWidth="1"
                          filter="url(#glow)" opacity="0.96"
                        />
                        <text x={sp.sx} y={sp.sy + 22} textAnchor="middle"
                          fontSize="9" fontWeight="800" fill="#b45309"
                          fontFamily="var(--f)">
                          strength
                        </text>
                      </g>
                    )
                  })()}

                  {/* Concept nodes */}
                  {graphData.nodes.map(node => {
                    const pos = positions.get(node.id)
                    if (!pos) return null

                    const isHovered = hovered === node.id
                    const isSelected = selected?.id === node.id
                    const color = statusColor(node.status)
                    const r = 6 + Math.min(node.eventCount * 1.5, 12)
                    const label = mlIdToLabel(node.id)
                    const showLabel = isHovered || isSelected || node.status === 'struggling' || node.eventCount > 0

                    return (
                      <g key={node.id}
                        className={s.nodeG}
                        transform={`translate(${pos.sx}, ${pos.sy})`}
                        onClick={() => openNode(node)}
                        onMouseEnter={() => setHovered(node.id)}
                        onMouseLeave={() => setHovered(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {(isHovered || isSelected) && (
                          <circle r={r + 9} fill="none"
                            stroke={color} strokeWidth="1.75"
                            strokeOpacity="0.62"
                            filter="url(#glow)"
                          />
                        )}

                        <circle
                          r={isHovered || isSelected ? r + 2 : r}
                          fill={color}
                          fillOpacity={node.status === 'untouched' ? 0.58 : 0.92}
                          stroke={isSelected ? '#ffffff' : color}
                          strokeWidth={isSelected ? 2.4 : 1.4}
                          strokeOpacity={node.status === 'untouched' ? 0.45 : 0.9}
                          filter={isHovered ? 'url(#glowStrong)' : undefined}
                          style={{ transition: 'r 0.15s, fill-opacity 0.15s' }}
                        />

                        {node.mastery > 0 && node.status !== 'untouched' && (
                          <circle r={r - 3}
                            fill="none"
                            stroke="rgba(255,255,255,0.86)"
                            strokeWidth="2"
                            strokeDasharray={`${node.mastery * 2 * Math.PI * (r - 3)} ${2 * Math.PI * (r - 3)}`}
                            strokeLinecap="round"
                            strokeOpacity="0.8"
                            transform="rotate(-90)"
                          />
                        )}

                        {showLabel && (
                          <g transform={`translate(0, ${r + 15})`}>
                            <rect
                              x={-(Math.min(label.length, 18) * 2.6) - 8}
                              y={-9}
                              rx="8"
                              width={(Math.min(label.length, 18) * 5.2) + 16}
                              height="18"
                              fill={isSelected ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.82)'}
                              stroke={isSelected ? 'rgba(34,211,238,0.4)' : 'rgba(148,163,184,0.35)'}
                            />
                            <text
                              y={4}
                              textAnchor="middle"
                              fontSize="8.5"
                              fontWeight="800"
                              fill={isSelected ? 'rgba(236,254,255,0.98)' : 'rgba(15,23,42,0.8)'}
                              fontFamily="var(--f)"
                              style={{ userSelect: 'none' }}
                            >
                              {label.length > 18 ? `${label.slice(0, 17)}…` : label}
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  })}
                </g>
              </svg>
            )}
          </div>

          {/* ── Detail Panel ── */}
          {selected && (
            <div className={s.detailPanel}>
              <button className={s.closePanel} onClick={() => setSelected(null)}>✕</button>

              <div className={s.detailBadge} style={{ color: statusColor(selected.status) }}>
                <span className={s.dotGreen} style={{ background: statusColor(selected.status) }} />
                {selected.status === 'mastered' && 'Mastered'}
                {selected.status === 'struggling' && 'Needs Work'}
                {selected.status === 'in_progress' && 'In Progress'}
                {selected.status === 'untouched' && 'Not Yet Studied'}
              </div>

              <h2 className={s.detailTitle}>{mlIdToLabel(selected.id)}</h2>

              {/* Mastery bar */}
              <div className={s.masteryRow}>
                <span className={s.masteryLabel}>Mastery</span>
                <div className={s.masteryBar}>
                  <div className={s.masteryFill} style={{
                    width: `${selected.mastery * 100}%`,
                    background: statusColor(selected.status),
                  }} />
                </div>
                <span className={s.masteryPct}>{Math.round(selected.mastery * 100)}%</span>
              </div>

              {/* Strength score */}
              <div className={s.masteryRow}>
                <span className={s.masteryLabel}>Strength</span>
                <div className={s.masteryBar}>
                  <div className={s.masteryFill} style={{
                    width: `${Math.min(Math.abs(selected.strengthScore) * 20, 100)}%`,
                    background: selected.strengthScore > 0 ? '#58CC02' : '#FF4B4B',
                  }} />
                </div>
                <span className={s.masteryPct} style={{
                  color: selected.strengthScore > 0 ? '#58CC02' : selected.strengthScore < 0 ? '#FF4B4B' : 'var(--mu)',
                }}>
                  {selected.strengthScore > 0 ? '+' : ''}{selected.strengthScore.toFixed(2)}
                </span>
              </div>

              {/* Event count */}
              <div className={s.detailMeta}>
                <span>{selected.eventCount} interaction{selected.eventCount !== 1 ? 's' : ''}</span>
                <span>{selected.level}</span>
              </div>

              {/* Tags */}
              {selected.tags.length > 0 && (
                <>
                  <span className={s.ingredientHint}>Topic tags</span>
                  <div className={s.tagRow}>
                    {selected.tags.map(tag => (
                      <span key={tag} className={s.tag}>{tag}</span>
                    ))}
                  </div>
                </>
              )}

              {/* Ingredients (click to expand) */}
              {selected.ingredients.length > 0 && (
                <div className={s.ingredientSection}>
                  <span className={s.ingredientLabel}>
                    Building Blocks ({selected.ingredients.length})
                  </span>
                  <span className={s.ingredientHint}>Tap a building block to open its flash card</span>
                  <ul className={s.ingredientList}>
                    {selected.ingredients.map(ing => (
                      <li
                        key={ing.id}
                        className={`${s.ingredientItem} ${activeIngredient?.id === ing.id ? s.ingredientItemActive : ''}`}
                        onClick={() => openIngredientCard(ing)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openIngredientCard(ing)
                          }
                        }}
                      >
                        <span className={s.ingredientName}>{ing.name}</span>
                        <span className={s.ingredientDesc}>{ing.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeIngredient && (
                <div className={s.flashcardPanel}>
                  <div className={s.flashcardTop}>
                    <span className={s.flashcardTag}>Flash Card</span>
                    <button className={s.flashcardClose} onClick={() => setActiveIngredient(null)}>✕</button>
                  </div>
                  <div className={s.flashcardCard}>
                    <div className={s.flashcardFace}>
                      <div className={s.flashcardFaceLabel}>Building block</div>
                      <h3 className={s.flashcardTitle}>{activeIngredient.name}</h3>
                      <p className={s.flashcardBody}>{activeIngredient.description}</p>
                    </div>
                    <div className={s.flashcardDivider} />
                    <div className={s.flashcardFace}>
                      <div className={s.flashcardFaceLabel}>Prompt</div>
                      <p className={s.flashcardPrompt}>
                        In your own words, how would you explain <strong>{activeIngredient.name}</strong> and when would you use it inside {mlIdToLabel(selected.id)}?
                      </p>
                    </div>
                  </div>
                  <div className={s.flashcardActions}>
                    <button className={s.flashcardAction} onClick={() => navigate('/practice')}>
                      Practice this concept →
                    </button>
                    <button className={s.flashcardActionSecondary} onClick={() => navigate('/organize-notes')}>
                      Add to notes
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              {selected.status === 'untouched' && (
                <button className={s.bookBtn} onClick={() => navigate('/book')}>
                  Book a Session on {mlIdToLabel(selected.id)} →
                </button>
              )}
              {selected.status === 'struggling' && (
                <button className={s.bookBtn} onClick={() => navigate('/book')}>
                  Get Help with {mlIdToLabel(selected.id)} →
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── ML Learning Path Panel ── */}
        {mlResult && mlResult.recommendations.length > 0 && (
          <div className={s.mlPanel}>
            <div className={s.mlHeader}>
              <span className={s.mlTitle}>Your Learning Path</span>
              <span className={s.mlSub}>
                {mlResult.recommendations.length} steps · {mlResult.mode} mode
              </span>
            </div>
            <div className={s.mlChain}>
              {mlResult.recommendations.filter(r => !r.isSupplement).map((rec, i) => (
                <div key={rec.conceptId} className={s.mlStep}>
                  <div className={s.mlStepNum}>{i + 1}</div>
                  <div className={s.mlStepContent}>
                    <div className={s.mlConceptName}>{mlIdToLabel(rec.conceptId)}</div>
                    <div className={s.mlReason}>{rec.reason}</div>
                  </div>
                  {rec.alignmentScore !== null && rec.alignmentScore > 0.2 && (
                    <div className={s.mlAlignBadge} title="Aligns with your learning style">
                      ✦ {Math.round(rec.alignmentScore * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Coverage bar ── */}
        {graphData && graphData.nodes.length > 0 && (
          <div className={s.coverage}>
            <span className={s.coverageLabel}>Coverage</span>
            <div className={s.coverageBar}>
              <div className={s.coverageFill} style={{
                width: `${(masteredCount / Math.max(totalCount, 1)) * 100}%`
              }} />
            </div>
            <span className={s.coverageTxt}>
              {masteredCount} of {totalCount} concepts mastered
            </span>
          </div>
        )}
      </main>
    </div>
  )
}

// ── SVG star path helper ──
function starPoints(cx: number, cy: number, outerR: number, innerR: number, points: number): string {
  const coords: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * i) / points - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    coords.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return coords.join(' ')
}
