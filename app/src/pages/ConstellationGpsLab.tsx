/**
 * ConstellationGpsLab — experimental merge of full knowledge graph + Learning GPS.
 * Dashboard Lab tile links here. Production /knowledge-graph stays unchanged.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import Sidebar from '../components/Sidebar'
import { mlIdToLabel } from '../lib/conceptMap'
import { fetchKnowledgeGraph } from '../lib/graphCache'
import {
  buildGraph, fetchLearningPath,
  GPS_W, GPS_H,
  STATUS_COLOR, STATUS_LABEL,
  type GPSMLNode, type GPSGraph,
} from '../lib/learningPathGraph'
import s from './ConstellationGpsLab.module.css'

const MAP_W = 700, MAP_H = 460, MAP_PAD = 40

function nodeColor(status: string): string {
  switch (status) {
    case 'mastered': case 'stable':             return '#19A974'
    case 'comeback_built':                       return '#14B8A6'
    case 'ready_for_challenge':                  return '#7C3AED'
    case 'struggling': case 'open_gap':          return '#FF6B5A'
    case 'in_progress': case 'repairing':        return '#4A7BF7'
    default:                                     return '#3E4559'
  }
}

function isUnexplored(status: string) {
  return status === 'untouched' || status === 'unexplored'
}

function scalePositions(nodes: Array<{ id: string; x: number; y: number }>) {
  if (!nodes.length) return new Map<string, { sx: number; sy: number }>()
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.x > maxX) maxX = n.x
    if (n.y < minY) minY = n.y
    if (n.y > maxY) maxY = n.y
  }
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1
  const plotW = MAP_W - MAP_PAD * 2, plotH = MAP_H - MAP_PAD * 2
  const out = new Map<string, { sx: number; sy: number }>()
  for (const n of nodes) {
    out.set(n.id, {
      sx: MAP_PAD + ((n.x - minX) / rangeX) * plotW,
      sy: MAP_PAD + ((n.y - minY) / rangeY) * plotH,
    })
  }
  return out
}

interface MapNode {
  id: string; name: string; x: number; y: number
  mastery: number; status: string; eventCount: number; level: string
}
interface MapEdge { from: string; to: string; weight: number; relation: string }
interface MapGraph { nodes: MapNode[]; edges: MapEdge[] }

export default function ConstellationGpsLab() {
  const user = useUser()
  const navigate = useNavigate()

  const [mapData,    setMapData]    = useState<MapGraph | null>(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [hovered,    setHovered]    = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gpsGraph,   setGpsGraph]   = useState<GPSGraph | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const pendingRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    setMapLoading(true)
    fetchKnowledgeGraph(user.uid)
      .then(data => setMapData(data as MapGraph | null))
      .finally(() => setMapLoading(false))
  }, [user?.uid])

  async function selectConcept(id: string) {
    setSelectedId(id)
    setGpsGraph(null)
    setGpsLoading(true)
    pendingRef.current = id
    try {
      const nodeMap = new Map<string, GPSMLNode>(
        (mapData?.nodes ?? []).map(n => [n.id, { id: n.id, mastery: n.mastery, status: n.status }]),
      )
      const { chain, unlocks } = await fetchLearningPath(user.uid, id)
      if (pendingRef.current !== id) return
      setGpsGraph(buildGraph(id, chain, unlocks, nodeMap))
    } finally {
      if (pendingRef.current === id) setGpsLoading(false)
    }
  }

  const positions    = mapData ? scalePositions(mapData.nodes) : new Map()
  const selectedNode = mapData?.nodes.find(n => n.id === selectedId) ?? null

  return (
    <div className={s.page}>
      <Sidebar />
      <main className={s.main}>
        <header className={s.header}>
          <button type="button" className={s.back} onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
          <div className={s.headerText}>
            <span className={s.labBadge}>Lab</span>
            <h1 className={s.title}>Constellation × GPS</h1>
            <p className={s.sub}>
              Click any star to see the prerequisite path, your mastery, and what it unlocks.
            </p>
          </div>
        </header>

        <div className={s.layout}>
          {/* ── Left: full constellation map ── */}
          <section className={s.mapPane} aria-label="Constellation map">
            <div className={s.paneLabel}>
              Full constellation · {mapData?.nodes.length ?? '–'} concepts
            </div>

            {mapLoading && (
              <div className={s.loadState}>
                <div className={s.loadDot} />
                <p>Loading constellation…</p>
              </div>
            )}

            {!mapLoading && !mapData && (
              <div className={s.mapPlaceholder}>
                <span className={s.mapGlyph}>✦</span>
                <p>No graph data yet</p>
                <p className={s.hint}>Complete questions or a session to populate your map</p>
              </div>
            )}

            {!mapLoading && mapData && (
              <div className={s.mapWrap}>
                <svg
                  viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                  className={s.mapSvg}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <filter id="labGlow" x="-60%" y="-60%" width="220%" height="220%">
                      <feGaussianBlur stdDeviation="5" result="blur"/>
                      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>

                  {mapData.edges.filter(e => e.weight > 0.2).map((edge, i) => {
                    const sp = positions.get(edge.from)
                    const tp = positions.get(edge.to)
                    if (!sp || !tp) return null
                    const lit = hovered === edge.from || hovered === edge.to
                             || selectedId === edge.from || selectedId === edge.to
                    return (
                      <line key={`e-${i}`}
                        x1={sp.sx} y1={sp.sy} x2={tp.sx} y2={tp.sy}
                        stroke="rgba(140,170,200,0.55)"
                        strokeWidth={lit ? 1.6 : 0.7}
                        strokeOpacity={lit ? 0.32 : 0.09}
                        strokeLinecap="round"
                      />
                    )
                  })}

                  {mapData.nodes.map(node => {
                    const pos = positions.get(node.id)
                    if (!pos) return null
                    const isHov = hovered === node.id
                    const isSel = selectedId === node.id
                    const color = nodeColor(node.status)
                    const r = 5 + Math.min(node.eventCount * 1.2, 10)
                    const label = mlIdToLabel(node.id)
                    const showLabel = isHov || isSel || node.eventCount > 0

                    return (
                      <g key={node.id}
                        transform={`translate(${pos.sx}, ${pos.sy})`}
                        onClick={() => selectConcept(node.id)}
                        onMouseEnter={() => setHovered(node.id)}
                        onMouseLeave={() => setHovered(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {isSel && (
                          <circle r={r + 9} fill="none"
                            stroke="#C4F547" strokeWidth="2" strokeOpacity="0.9"
                            filter="url(#labGlow)"
                          />
                        )}
                        {isHov && !isSel && (
                          <circle r={r + 6} fill="none"
                            stroke={color} strokeWidth="1.5" strokeOpacity="0.45"
                          />
                        )}
                        <circle
                          r={isHov || isSel ? r + 1.5 : r}
                          fill={color}
                          fillOpacity={isUnexplored(node.status) ? 0.42 : 0.88}
                          stroke={isSel ? '#C4F547' : color}
                          strokeWidth={isSel ? 2 : 1.2}
                          strokeOpacity={isUnexplored(node.status) ? 0.38 : 0.85}
                          filter={isSel ? 'url(#labGlow)' : undefined}
                        />
                        {node.mastery > 0 && !isUnexplored(node.status) && (
                          <circle r={r - 2.5} fill="none"
                            stroke="rgba(255,255,255,0.8)" strokeWidth="1.8"
                            strokeDasharray={`${node.mastery * 2 * Math.PI * (r - 2.5)} ${2 * Math.PI * (r - 2.5)}`}
                            strokeLinecap="round" strokeOpacity="0.75" transform="rotate(-90)"
                          />
                        )}
                        {showLabel && (
                          <g transform={`translate(0, ${r + 13})`}>
                            <rect
                              x={-(Math.min(label.length, 16) * 2.5) - 7}
                              y={-8} rx={7}
                              width={(Math.min(label.length, 16) * 5) + 14}
                              height={16}
                              fill={isSel ? 'rgba(196,245,71,0.12)' : 'rgba(4,9,15,0.8)'}
                              stroke={isSel ? 'rgba(196,245,71,0.45)' : 'rgba(255,255,255,0.1)'}
                            />
                            <text y={4} textAnchor="middle" fontSize={8}
                              fontWeight={isSel ? 800 : 600}
                              fill={isSel ? '#C4F547' : 'rgba(255,255,255,0.82)'}
                              fontFamily="var(--f)" style={{ userSelect: 'none' }}
                            >
                              {label.length > 16 ? `${label.slice(0, 15)}…` : label}
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  })}
                </svg>

                <div className={s.mapLegend}>
                  {[
                    { color: '#19A974', label: 'Mastered' },
                    { color: '#4A7BF7', label: 'In progress' },
                    { color: '#FF6B5A', label: 'Needs work' },
                    { color: '#3E4559', label: 'Unexplored' },
                  ].map(item => (
                    <span key={item.label} className={s.mapLegendItem}>
                      <span className={s.mapLegendDot} style={{ background: item.color }} />
                      {item.label}
                    </span>
                  ))}
                  {selectedId && (
                    <span className={s.mapLegendSelected}>◎ {mlIdToLabel(selectedId)}</span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── Right: GPS panel ── */}
          <aside className={s.gpsPane} aria-label="GPS detail panel">
            <div className={s.paneLabel}>GPS detail panel</div>

            {!selectedId && (
              <div className={s.gpsPlaceholder}>
                <p className={s.gpsEmptyTitle}>Select a concept</p>
                <p className={s.gpsEmptySub}>
                  Tap any star on the map to see the prerequisite path, your mastery, and what it unlocks.
                </p>
              </div>
            )}

            {selectedId && gpsLoading && (
              <div className={s.loadState}>
                <div className={s.loadDot} />
                <p>Mapping path…</p>
              </div>
            )}

            {selectedId && !gpsLoading && gpsGraph && selectedNode && (
              <div className={s.gpsContent}>
                <div className={s.gpsConceptHeader}>
                  <div className={s.gpsStatusBadge} style={{
                    color: nodeColor(selectedNode.status),
                    borderColor: `${nodeColor(selectedNode.status)}40`,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: nodeColor(selectedNode.status),
                      display: 'inline-block', marginRight: 5, flexShrink: 0,
                    }} />
                    {STATUS_LABEL[selectedNode.status] ?? selectedNode.status}
                  </div>
                  <h2 className={s.gpsConceptName}>{mlIdToLabel(selectedId)}</h2>
                </div>

                <div className={s.gpsMasteryRow}>
                  <span className={s.gpsMasteryLabel}>Mastery</span>
                  <div className={s.gpsMasteryBar}>
                    <div className={s.gpsMasteryFill} style={{
                      width: `${Math.round(selectedNode.mastery * 100)}%`,
                      background: nodeColor(selectedNode.status),
                    }} />
                  </div>
                  <span className={s.gpsMasteryPct}>{Math.round(selectedNode.mastery * 100)}%</span>
                </div>

                <div className={s.gpsGraphSection}>
                  <div className={s.gpsGraphTitle}>
                    {gpsGraph.unlockCount > 0
                      ? `${gpsGraph.total} prereqs · ${gpsGraph.unlockCount} unlock${gpsGraph.unlockCount !== 1 ? 's' : ''}`
                      : gpsGraph.total === 0 ? 'No prerequisites' : `${gpsGraph.total} prerequisites`}
                  </div>

                  <svg viewBox={`0 0 ${GPS_W} ${GPS_H}`} width="100%" height={GPS_H} className={s.gpsSvg}>
                    {gpsGraph.edges.map((e, i) => (
                      <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                        stroke={
                          e.isUnlock  ? 'rgba(74,158,255,0.38)' :
                          e.needsWork ? 'rgba(124,58,237,0.26)' :
                                        'rgba(88,204,2,0.20)'
                        }
                        strokeWidth={e.isUnlock ? 1.4 : e.needsWork ? 1.3 : 0.9}
                        strokeDasharray={e.isUnlock ? '4 3' : e.needsWork ? undefined : '3 2'}
                      />
                    ))}

                    {[...gpsGraph.nodes].sort((a, b) => Math.abs(b.depth) - Math.abs(a.depth)).map(n => {
                      const color = n.isTarget ? '#7C3AED' : n.isUnlock ? '#4A9EFF' : STATUS_COLOR[n.status]
                      const r = n.isTarget ? 10 : 6
                      return (
                        <g key={n.id}
                          onClick={() => navigate('/practice', { state: { conceptId: n.id } })}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle cx={n.x} cy={n.y} r={r}
                            fill={
                              n.isTarget ? 'rgba(124,58,237,0.22)' :
                              n.isUnlock ? 'rgba(74,158,255,0.12)' :
                                           'rgba(20,30,40,0.5)'
                            }
                            stroke={color} strokeWidth={n.isTarget ? 2.5 : 1.8}
                            strokeDasharray={n.isUnlock ? '3 2' : undefined}
                          />
                          {!n.isTarget && !n.isUnlock && n.mastery > 0 && (
                            <circle cx={n.x} cy={n.y} r={r - 2.5}
                              fill={color} fillOpacity={0.2 + n.mastery * 0.65}
                            />
                          )}
                          {n.isTarget && (
                            <circle cx={n.x} cy={n.y} r={3} fill="#7C3AED" fillOpacity="0.75" />
                          )}
                          <text x={n.x} y={n.y + r + 9}
                            textAnchor="middle" fontSize={n.isTarget ? 9 : 7.5}
                            fontWeight={n.isTarget ? 700 : 500}
                            fill={
                              n.isTarget  ? '#D4AAFF' :
                              n.isUnlock  ? 'rgba(74,158,255,0.9)' :
                                            'rgba(255,255,255,0.55)'
                            }
                            fontFamily="system-ui, -apple-system, sans-serif"
                          >
                            {n.short}
                          </text>
                        </g>
                      )
                    })}
                  </svg>

                  {gpsGraph.total > 0 && (
                    <p className={s.gpsProgress}>
                      {gpsGraph.mastered}/{gpsGraph.total} prereqs mastered
                    </p>
                  )}
                </div>

                {gpsGraph.unlockCount > 0 && (
                  <div className={s.gpsUnlockSection}>
                    <div className={s.gpsUnlockLabel}>Unlocks</div>
                    <div className={s.gpsUnlockChips}>
                      {gpsGraph.nodes.filter(n => n.isUnlock).map(n => (
                        <span key={n.id} className={s.gpsUnlockChip}
                          onClick={() => selectConcept(n.id)}
                        >
                          {n.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button className={s.gpsStartBtn}
                  onClick={() => navigate('/practice', { state: { conceptId: selectedId } })}
                >
                  Start Practice: {mlIdToLabel(selectedId)} →
                </button>

                <button className={s.gpsMicroLink}
                  onClick={() => navigate(`/knowledge-graph/${encodeURIComponent(selectedId)}`)}
                >
                  View in Learning World →
                </button>
              </div>
            )}
          </aside>
        </div>

        <footer className={s.footer}>
          <span>Student: {user.uid.slice(0, 8)}…</span>
          <button type="button" className={s.linkBtn} onClick={() => navigate('/knowledge-graph')}>
            Compare with live graph →
          </button>
        </footer>
      </main>
    </div>
  )
}
