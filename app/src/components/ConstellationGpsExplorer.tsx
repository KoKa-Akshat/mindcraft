/**
 * Constellation + GPS route explorer — embeddable (dashboard) or full lab header.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { mlIdToLabel } from '../lib/conceptMap'
import { fetchKnowledgeGraph } from '../lib/graphCache'
import { getRecommendations } from '../lib/mlApi'
import type { ConceptRecommendation } from '../lib/mlApi'
import { buildGraph, GPS_W, GPS_H, STATUS_COLOR } from '../lib/learningPathGraph'
import type { GPSGraph, GPSMLNode } from '../lib/learningPathGraph'
import s from '../pages/ConstellationGpsLab.module.css'

interface MLNode {
  id: string; name: string; level: string
  x: number; y: number
  mastery: number; strengthScore: number; eventCount: number
  status: string
  ingredients: { id: string; name: string; description: string }[]
  tags: string[]
}
interface MLEdge { from: string; to: string; weight: number; relation: string }
interface KGData { nodes: MLNode[]; edges: MLEdge[] }

interface RouteStep {
  id: string; name: string
  mastery: number; status: string
  reason: string; isTarget: boolean
}

type PanelState =
  | { mode: 'none' }
  | { mode: 'detail'; node: MLNode }
  | { mode: 'route'; steps: RouteStep[]; gpsGraph: GPSGraph | null; loading: boolean; targetId: string }

const SVG_W = 820, SVG_H = 480, PAD = 44

type StatusKind = 'stable' | 'progress' | 'needs' | 'unknown'

function statusKind(status: string): StatusKind {
  if (['mastered','stable','comeback_built','ready_for_challenge'].includes(status)) return 'stable'
  if (['in_progress','repairing'].includes(status)) return 'progress'
  if (['struggling','open_gap'].includes(status)) return 'needs'
  return 'unknown'
}

const KIND_COLOR: Record<StatusKind, string> = {
  stable: '#00875a', progress: '#4361ee', needs: '#d63e3e', unknown: '#9aabb6',
}
const KIND_LABEL: Record<StatusKind, string> = {
  stable: 'Stable', progress: 'Repairing', needs: 'Open Gap', unknown: 'Unexplored',
}

function nodeColor(status: string) { return KIND_COLOR[statusKind(status)] }

function scalePositions(nodes: MLNode[]) {
  if (!nodes.length) return new Map<string, { sx: number; sy: number }>()
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y
  }
  const rX = maxX - minX || 1, rY = maxY - minY || 1
  const out = new Map<string, { sx: number; sy: number }>()
  for (const n of nodes) {
    out.set(n.id, {
      sx: PAD + ((n.x - minX) / rX) * (SVG_W - PAD * 2),
      sy: PAD + ((n.y - minY) / rY) * (SVG_H - PAD * 2),
    })
  }
  return out
}

export default function ConstellationGpsExplorer({
  embedded = false,
  onBack,
  autoPlotConceptId,
}: {
  embedded?: boolean
  onBack?: () => void
  autoPlotConceptId?: string | null
}) {
  const user = useUser()
  const navigate = useNavigate()

  const [kgData,     setKgData]     = useState<KGData | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [hovered,    setHovered]    = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panel,      setPanel]      = useState<PanelState>({ mode: 'none' })
  const [search,     setSearch]     = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [levelFilter,setLevelFilter]= useState<string | null>(null)
  const routeToken = useRef<string | null>(null)
  const autoPlotted = useRef<string | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    setLoading(true)
    fetchKnowledgeGraph(user.uid)
      .then(d => setKgData(d as KGData | null))
      .finally(() => setLoading(false))
  }, [user?.uid])

  useEffect(() => {
    if (!autoPlotConceptId || !kgData || autoPlotted.current === autoPlotConceptId) return
    autoPlotted.current = autoPlotConceptId
    void plotRoute(autoPlotConceptId)
  // plotRoute closes over kgData/nodeMap — only re-run when concept or graph loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlotConceptId, kgData])

  const nodeMap = useMemo(() => {
    const m = new Map<string, MLNode>()
    for (const n of kgData?.nodes ?? []) m.set(n.id, n)
    return m
  }, [kgData])

  const positions = useMemo(
    () => kgData ? scalePositions(kgData.nodes) : new Map<string, { sx: number; sy: number }>(),
    [kgData],
  )

  const stats = useMemo(() => {
    if (!kgData) return { stable: 0, progress: 0, needs: 0, total: 0 }
    const ns = kgData.nodes
    return {
      stable:   ns.filter(n => statusKind(n.status) === 'stable').length,
      progress: ns.filter(n => statusKind(n.status) === 'progress').length,
      needs:    ns.filter(n => statusKind(n.status) === 'needs').length,
      total:    ns.length,
    }
  }, [kgData])

  const levels = useMemo(() => {
    const set = new Set<string>()
    for (const n of kgData?.nodes ?? []) if (n.level) set.add(n.level)
    return Array.from(set).sort()
  }, [kgData])

  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return new Set<string>()
    const out = new Set<string>()
    for (const n of kgData?.nodes ?? []) {
      if (mlIdToLabel(n.id).toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) out.add(n.id)
    }
    return out
  }, [search, kgData])

  const coveragePct = stats.total ? Math.round((stats.stable / stats.total) * 100) : 0

  function selectNode(node: MLNode) {
    setSelectedId(node.id)
    setSearch('')
    setSearchOpen(false)
    setPanel({ mode: 'detail', node })
  }

  async function plotRoute(targetId: string) {
    const token = targetId + Date.now()
    routeToken.current = token
    setSelectedId(targetId)
    setPanel({ mode: 'route', steps: [], gpsGraph: null, loading: true, targetId })
    try {
      const result = await getRecommendations(user.uid, [targetId], 'curriculum')
      if (routeToken.current !== token) return
      if (!result) {
        setPanel({ mode: 'route', steps: [], gpsGraph: null, loading: false, targetId })
        return
      }
      const chain = result.canonicalChain?.length ? result.canonicalChain : [targetId]
      const recMap = new Map<string, ConceptRecommendation>()
      for (const r of result.recommendations ?? []) recMap.set(r.conceptId, r)

      const steps: RouteStep[] = chain.map((id, i) => {
        const n = nodeMap.get(id)
        const rec = recMap.get(id)
        const isTarget = id === targetId
        return {
          id,
          name: mlIdToLabel(id),
          mastery: n?.mastery ?? 0,
          status: n?.status ?? 'untouched',
          reason: rec?.reason ?? (isTarget
            ? 'This is your target. Focus your practice here.'
            : `Step ${i + 1}: strengthen this prerequisite first.`),
          isTarget,
        }
      })
      const gpsNodeMap = new Map<string, GPSMLNode>(
        chain.map(id => {
          const n = nodeMap.get(id)
          return [id, { id, mastery: n?.mastery ?? 0, status: n?.status ?? 'untouched' }]
        }),
      )
      const gpsGraph = buildGraph(targetId, chain, [], gpsNodeMap)
      setPanel({ mode: 'route', steps, gpsGraph, loading: false, targetId })
    } catch {
      if (routeToken.current === token) setPanel({ mode: 'route', steps: [], gpsGraph: null, loading: false, targetId })
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = search.trim().toLowerCase()
    if (!q) return
    const match = kgData?.nodes.find(n => mlIdToLabel(n.id).toLowerCase().includes(q))
    if (match) { setSearchOpen(false); plotRoute(match.id) }
  }

  function closePanel() {
    setPanel({ mode: 'none' })
    setSelectedId(null)
  }

  const visibleNodes = levelFilter
    ? kgData?.nodes.filter(n => n.level === levelFilter) ?? []
    : kgData?.nodes ?? []

  const searchForm = (
    <form className={s.searchRow} onSubmit={handleSearchSubmit}>
      <div className={s.searchWrap}>
        <svg className={s.searchIcon} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className={s.searchInput}
          placeholder="Type a concept to plot your route…"
          value={search}
          onChange={e => { setSearch(e.target.value); setSearchOpen(true) }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 160)}
          autoComplete="off"
        />
        {search && (
          <button type="button" className={s.searchClear}
            onClick={() => { setSearch(''); setSearchOpen(false) }}>✕</button>
        )}
      </div>
      <button type="submit" className={s.searchBtn} disabled={!search.trim()}>
        Plot route →
      </button>
      {searchOpen && searchMatches.size > 0 && (
        <div className={s.suggestions} role="listbox">
          {Array.from(searchMatches).slice(0, 7).map(id => {
            const n = nodeMap.get(id)
            if (!n) return null
            const kind = statusKind(n.status)
            return (
              <button key={id} role="option" className={s.suggItem}
                onMouseDown={() => { setSearch(mlIdToLabel(id)); setSearchOpen(false); plotRoute(id) }}
              >
                <span className={s.suggDot} style={{ background: KIND_COLOR[kind] }} />
                <span className={s.suggName}>{mlIdToLabel(id)}</span>
                <span className={s.suggStatus}>{KIND_LABEL[kind]}</span>
              </button>
            )
          })}
        </div>
      )}
    </form>
  )

  return (
    <div className={embedded ? s.embeddedRoot : s.explorerStandalone}>
      {embedded ? (
        <header className={s.embeddedHeader}>
          {onBack && (
            <button type="button" className={s.embeddedBack} onClick={onBack}>
              ← Practice path
            </button>
          )}
          {searchForm}
        </header>
      ) : (
        <header className={s.hero}>
          <div className={s.heroInner}>
            <nav className={s.breadcrumb} aria-label="breadcrumb">
              <button className={s.crumbBtn} onClick={() => navigate('/dashboard')}>Dashboard</button>
              <span className={s.crumbSep} aria-hidden>›</span>
              <span>Learning World</span>
              <span className={s.labPill}>Lab</span>
            </nav>

            <div className={s.heroBody}>
              <div className={s.heroLeft}>
                <h1 className={s.heroTitle}>
                  Mistakes become maps.<br />
                  Comebacks become progress.
                </h1>
                <p className={s.heroSub}>
                  Click any star to explore. Type a concept name to plot your learning route.
                </p>
              </div>

              <div className={s.heroStats}>
                <div className={s.heroStat}>
                  <span className={s.heroStatNum} style={{ color: '#00d68f' }}>{stats.stable}</span>
                  <span className={s.heroStatLabel}>stable</span>
                </div>
                <div className={s.heroStat}>
                  <span className={s.heroStatNum} style={{ color: '#748ffc' }}>{stats.progress}</span>
                  <span className={s.heroStatLabel}>repairing</span>
                </div>
                <div className={s.heroStat}>
                  <span className={s.heroStatNum} style={{ color: '#ff6b6b' }}>{stats.needs}</span>
                  <span className={s.heroStatLabel}>needs work</span>
                </div>
              </div>
            </div>

            {searchForm}

            {levels.length > 0 && (
              <div className={s.filters} role="group" aria-label="Filter by level">
                <button
                  className={`${s.chip} ${!levelFilter ? s.chipActive : ''}`}
                  onClick={() => setLevelFilter(null)}
                >All</button>
                {levels.map(lv => (
                  <button key={lv}
                    className={`${s.chip} ${levelFilter === lv ? s.chipActive : ''}`}
                    onClick={() => setLevelFilter(levelFilter === lv ? null : lv)}
                  >
                    {lv.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
      )}

      <div className={`${s.mapArea} ${embedded ? s.mapAreaEmbedded : ''}`}>
        <div className={s.mapWrap}>
          {loading && (
            <div className={s.mapState}>
              <span className={s.mapDot} />
              <span>Loading your learning world…</span>
            </div>
          )}

          {!loading && !kgData && (
            <div className={s.mapState}>
              <p>No learning data yet — complete a session or answer practice questions to populate your map.</p>
            </div>
          )}

          {kgData && (
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className={s.mapSvg}
              xmlns="http://www.w3.org/2000/svg" aria-label="Knowledge constellation">
              {kgData.edges.filter(e => e.weight > 0.1).map((edge, i) => {
                const sp = positions.get(edge.from)
                const tp = positions.get(edge.to)
                if (!sp || !tp) return null
                const lit = hovered === edge.from || hovered === edge.to
                  || selectedId === edge.from || selectedId === edge.to
                return (
                  <line key={i}
                    x1={sp.sx} y1={sp.sy} x2={tp.sx} y2={tp.sy}
                    stroke={lit ? 'rgba(67,97,238,0.22)' : 'rgba(0,0,0,0.06)'}
                    strokeWidth={lit ? 1.8 : 0.8}
                    strokeLinecap="round"
                  />
                )
              })}

              {visibleNodes.map(node => {
                const pos = positions.get(node.id)
                if (!pos) return null
                const isHov = hovered === node.id
                const isSel = selectedId === node.id
                const color = nodeColor(node.status)
                const dimmed = searchMatches.size > 0 && !searchMatches.has(node.id)
                const hasData = node.eventCount > 0
                const r = hasData
                  ? (isSel ? 10 : isHov ? 8.5 : 7)
                  : (isSel ? 7.5 : isHov ? 6.5 : 5)

                const showLabel = isSel || isHov
                  || (searchMatches.size > 0 && searchMatches.has(node.id))
                  || node.eventCount > 3

                return (
                  <g key={node.id}
                    transform={`translate(${pos.sx}, ${pos.sy})`}
                    onClick={() => selectNode(node)}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: 'pointer' }}
                    aria-label={mlIdToLabel(node.id)}
                  >
                    {isSel && (
                      <circle r={r + 9}
                        fill={color} fillOpacity="0.1"
                        stroke={color} strokeWidth="1.5" strokeOpacity="0.3"
                      />
                    )}
                    <circle r={r}
                      fill={color}
                      fillOpacity={dimmed ? 0.18 : isSel ? 1 : isHov ? 0.9 : hasData ? 0.78 : 0.45}
                      stroke={isSel ? 'white' : color}
                      strokeWidth={isSel ? 2 : 0.8}
                      strokeOpacity={dimmed ? 0.25 : 0.9}
                    />
                    {node.mastery > 0.05 && !dimmed && (
                      <circle r={r - 2.5}
                        fill="none"
                        stroke="rgba(255,255,255,0.75)" strokeWidth="1.8"
                        strokeDasharray={`${node.mastery * 2 * Math.PI * (r - 2.5)} ${2 * Math.PI * (r - 2.5)}`}
                        strokeLinecap="round"
                        transform="rotate(-90)"
                      />
                    )}
                    {showLabel && (
                      <text
                        y={r + 12}
                        textAnchor="middle"
                        fontSize={isSel ? 9.5 : 8.5}
                        fontWeight={isSel ? 700 : 500}
                        fill={isSel ? '#1a1f2e' : dimmed ? 'rgba(50,60,80,0.4)' : 'rgba(50,60,80,0.72)'}
                        fontFamily="system-ui, -apple-system, sans-serif"
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                      >
                        {(() => {
                          const lbl = mlIdToLabel(node.id)
                          return lbl.length > 18 ? lbl.slice(0, 17) + '…' : lbl
                        })()}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          )}

          <div className={s.legend}>
            <div className={s.legendItems}>
              {([
                ['#00875a', 'Stable'],
                ['#4361ee', 'Repairing'],
                ['#d63e3e', 'Open Gap'],
                ['#9aabb6', 'Unexplored'],
              ] as const).map(([color, label]) => (
                <span key={label} className={s.legendItem}>
                  <span className={s.legendDot} style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
            <div className={s.coverage}>
              <span className={s.coverageLabel}>Coverage</span>
              <div className={s.coverageBar} role="progressbar"
                aria-valuenow={coveragePct} aria-valuemin={0} aria-valuemax={100}>
                <div className={s.coverageFill} style={{ width: `${coveragePct}%` }} />
              </div>
              <span className={s.coverageText}>{stats.stable} of {stats.total} stable</span>
            </div>
          </div>
        </div>

        {panel.mode !== 'none' && (
          <aside className={s.panel}>
            {panel.mode === 'detail' && (() => {
              const node = panel.node
              const kind = statusKind(node.status)
              const masteryPct = Math.round(node.mastery * 100)
              const mom = node.strengthScore
              return (
                <div className={s.panelDetail}>
                  <button className={s.panelClose} onClick={closePanel} aria-label="Close panel">✕</button>

                  <div className={s.detailStatus}>
                    <span className={s.statusDot} style={{ background: KIND_COLOR[kind] }} />
                    <span className={s.statusLabel} style={{ color: KIND_COLOR[kind] }}>
                      {KIND_LABEL[kind].toUpperCase()}
                    </span>
                  </div>

                  <h2 className={s.detailName}>{mlIdToLabel(node.id)}</h2>

                  <div className={s.metric}>
                    <span className={s.metricLabel}>ROUTE STRENGTH</span>
                    <div className={s.metricBarRow}>
                      <div className={s.metricBar}>
                        <div className={s.metricBarFill}
                          style={{ width: `${masteryPct}%`, background: KIND_COLOR[kind] }} />
                      </div>
                      <span className={s.metricPct}>{masteryPct}%</span>
                    </div>
                  </div>

                  <div className={s.metric}>
                    <span className={s.metricLabel}>MOMENTUM</span>
                    <span className={s.momentumVal}
                      style={{ color: mom < 0 ? '#d63e3e' : mom > 0 ? '#00875a' : '#9aabb6' }}
                    >
                      {mom > 0 ? '+' : ''}{mom.toFixed(2)}
                    </span>
                  </div>

                  <div className={s.detailMeta}>
                    <span>{node.eventCount} INTERACTION{node.eventCount !== 1 ? 'S' : ''}</span>
                    {node.level && <><span className={s.metaDot} /><span>{node.level.toUpperCase()}</span></>}
                  </div>

                  {node.tags?.length > 0 && (
                    <div className={s.section}>
                      <div className={s.sectionLabel}>Topic tags</div>
                      <div className={s.tagList}>
                        {node.tags.slice(0, 10).map(t => (
                          <span key={t} className={s.tag}>{t.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {node.ingredients?.length > 0 && (
                    <div className={s.section}>
                      <div className={s.sectionLabel}>
                        {kind !== 'stable'
                          ? `Repair ingredients (${node.ingredients.length})`
                          : `Ingredients (${node.ingredients.length})`}
                      </div>
                      {kind !== 'stable' && (
                        <p className={s.sectionHint}>
                          Tap one ingredient to practice the smallest repairable piece
                        </p>
                      )}
                      <div className={s.ingredientList}>
                        {node.ingredients.slice(0, 4).map(ing => (
                          <div key={ing.id} className={s.ingredientCard}>
                            <div className={s.ingredientName}>{ing.name}</div>
                            <div className={s.ingredientDesc}>{ing.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={s.detailActions}>
                    <button className={s.btnPrimary} onClick={() => plotRoute(node.id)}>
                      Plot route →
                    </button>
                    <button className={s.btnGhost}
                      onClick={() => navigate('/practice', { state: { concept: node.id } })}
                    >
                      Start practice
                    </button>
                  </div>
                </div>
              )
            })()}

            {panel.mode === 'route' && (
              <div className={s.panelRoute}>
                <button className={s.panelBack}
                  onClick={() => {
                    const n = selectedId ? nodeMap.get(selectedId) : null
                    n ? setPanel({ mode: 'detail', node: n }) : closePanel()
                  }}
                  aria-label="Back"
                >← Back</button>

                <div className={s.routeHeader}>
                  <span className={s.routeTitle}>Your Next Route</span>
                  {!panel.loading && panel.steps.length > 0 && (
                    <span className={s.routeMeta}>
                      {panel.steps.length} step{panel.steps.length !== 1 ? 's' : ''} · curriculum mode
                    </span>
                  )}
                </div>

                {panel.loading && (
                  <div className={s.routeLoading}>
                    <span className={s.routeDot} />
                    <span>Building your path…</span>
                  </div>
                )}

                {!panel.loading && panel.steps.length === 0 && (
                  <p className={s.routeEmpty}>
                    Route unavailable — the ML service may be warming up. Try again in a moment.
                  </p>
                )}

                {!panel.loading && panel.steps.length > 0 && (
                  <>
                    {panel.gpsGraph && (
                      <div className={s.miniMapWrap}>
                        <svg viewBox={`0 0 ${GPS_W} ${GPS_H}`} width="100%" height={170} className={s.miniMapSvg}>
                          {panel.gpsGraph.edges.map((e, i) => (
                            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                              stroke={e.needsWork ? 'rgba(124,58,237,0.28)' : 'rgba(0,135,90,0.2)'}
                              strokeWidth={e.needsWork ? 1.4 : 1}
                              strokeDasharray={e.needsWork ? undefined : '3 2'}
                            />
                          ))}
                          {[...panel.gpsGraph.nodes]
                            .sort((a, b) => Math.abs(b.depth) - Math.abs(a.depth))
                            .map(n => {
                              const color = n.isTarget ? '#7c3aed' : (STATUS_COLOR[n.status] ?? '#9aabb6')
                              const r = n.isTarget ? 9 : 6
                              return (
                                <g key={n.id}>
                                  <circle cx={n.x} cy={n.y} r={r}
                                    fill={n.isTarget ? 'rgba(124,58,237,0.12)' : 'rgba(20,30,40,0.05)'}
                                    stroke={color} strokeWidth={n.isTarget ? 2.2 : 1.6}
                                  />
                                  {n.mastery > 0.05 && (
                                    <circle cx={n.x} cy={n.y} r={r - 2}
                                      fill={color} fillOpacity={0.18 + n.mastery * 0.6}
                                    />
                                  )}
                                  <text x={n.x} y={n.y + r + 9}
                                    textAnchor="middle"
                                    fontSize={n.isTarget ? 8.5 : 7.5}
                                    fontWeight={n.isTarget ? 700 : 500}
                                    fill={n.isTarget ? '#5b21b6' : '#607d8b'}
                                    fontFamily="system-ui, -apple-system, sans-serif"
                                  >
                                    {n.short}
                                  </text>
                                </g>
                              )
                            })}
                        </svg>
                      </div>
                    )}

                    <div className={s.routeSteps}>
                      {panel.steps.map((step, i) => (
                        <div key={step.id}
                          className={`${s.routeStep} ${step.isTarget ? s.routeStepTarget : ''}`}
                          onClick={() => {
                            const n = nodeMap.get(step.id)
                            if (n) { setSelectedId(step.id); setPanel({ mode: 'detail', node: n }) }
                          }}
                        >
                          <div className={`${s.stepNum} ${step.isTarget ? s.stepNumTarget : ''}`}>
                            {i + 1}
                          </div>
                          <div className={s.stepBody}>
                            <div className={`${s.stepName} ${step.isTarget ? s.stepNameTarget : ''}`}>
                              {step.name}
                            </div>
                            <div className={s.stepReason}>{step.reason}</div>
                          </div>
                          <div className={s.stepBadge}
                            style={step.isTarget
                              ? { background: '#ede9ff', color: '#7c3aed' }
                              : { background: '#e6f6f0', color: '#00875a' }}
                          >
                            {Math.round(step.mastery * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>

                    <button className={s.btnPrimary}
                      onClick={() => navigate('/practice', { state: { concept: panel.steps[0]?.id } })}
                    >
                      Start with {panel.steps[0] ? mlIdToLabel(panel.steps[0].id) : 'step 1'} →
                    </button>
                  </>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
