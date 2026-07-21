/**
 * Constellation + GPS route explorer — embeddable (dashboard) or full lab header.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { mlIdToLabel } from '../lib/conceptMap'
import { getConceptContent } from '../lib/conceptContent'
import { fetchKnowledgeGraph } from '../lib/graphCache'
import { getRecommendations } from '../lib/mlApi'
import { loadDiagnostic } from '../lib/practiceState'
import type { ConceptRecommendation } from '../lib/mlApi'
import { buildGraph, GPS_W, GPS_H, STATUS_COLOR } from '../lib/learningPathGraph'
import type { GPSGraph, GPSMLNode } from '../lib/learningPathGraph'
import s from '../pages/ConstellationGpsLab.module.css'
import p from './DashboardPanels.module.css'

interface MLNode {
  id: string; name: string; level: string
  x: number; y: number
  mastery: number; strengthScore: number; eventCount: number
  status: string
  ingredients: { id: string; name: string; description: string }[]
  tags: string[]
}
interface MLEdge { from: string; to: string; weight: number; relation: string }
interface StudentPoint { x: number; y: number; label: string }
interface KGData {
  nodes: MLNode[]
  edges: MLEdge[]
  studentPoints?: { mastery: StudentPoint; strength: StudentPoint }
  axisLabels?: { x: string; y: string }
}

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

function diamondPoints(cx: number, cy: number, r: number) {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
}

function scalePositions(nodes: MLNode[], extras: { x: number; y: number }[] = []) {
  const pts = [
    ...nodes.map(n => ({ x: n.x, y: n.y })),
    ...extras,
  ]
  if (!pts.length) {
    return {
      positions: new Map<string, { sx: number; sy: number }>(),
      minX: 0,
      minY: 0,
      rX: 1,
      rY: 1,
    }
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
  }
  const rX = maxX - minX || 1, rY = maxY - minY || 1
  const out = new Map<string, { sx: number; sy: number }>()
  for (const n of nodes) {
    out.set(n.id, {
      sx: PAD + ((n.x - minX) / rX) * (SVG_W - PAD * 2),
      sy: PAD + ((n.y - minY) / rY) * (SVG_H - PAD * 2),
    })
  }
  return { positions: out, minX, minY, rX, rY }
}

function scaleRawPoint(
  point: { x: number; y: number },
  bounds: { minX: number; minY: number; rX: number; rY: number },
) {
  return {
    sx: PAD + ((point.x - bounds.minX) / bounds.rX) * (SVG_W - PAD * 2),
    sy: PAD + ((point.y - bounds.minY) / bounds.rY) * (SVG_H - PAD * 2),
  }
}

export default function ConstellationGpsExplorer({
  embedded = false,
  onBack,
  autoPlotConceptId,
  onStartRoute,
}: {
  embedded?: boolean
  onBack?: () => void
  autoPlotConceptId?: string | null
  onStartRoute?: (targetId: string) => void
}) {
  const user = useUser()
  const navigate = useNavigate()
  const c = embedded ? p : s

  const [kgData,     setKgData]     = useState<KGData | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [hovered,    setHovered]    = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panel,      setPanel]      = useState<PanelState>({ mode: 'none' })
  const [search,     setSearch]     = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [levelFilter,setLevelFilter]= useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusKind | null>(null)
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{
    x: number; y: number; tx: number; ty: number; moved: boolean
  } | null>(null)
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

  const positionsBundle = useMemo(() => {
    if (!kgData) return null
    const extras: { x: number; y: number }[] = []
    const sp = kgData.studentPoints
    if (sp?.mastery) extras.push(sp.mastery)
    if (sp?.strength) extras.push(sp.strength)
    return scalePositions(kgData.nodes, extras)
  }, [kgData])

  const positions = positionsBundle?.positions ?? new Map<string, { sx: number; sy: number }>()

  const studentScreenPoints = useMemo(() => {
    if (!kgData?.studentPoints || !positionsBundle) return null
    const { mastery, strength } = kgData.studentPoints
    return {
      mastery: scaleRawPoint(mastery, positionsBundle),
      strength: scaleRawPoint(strength, positionsBundle),
      masteryLabel: mastery.label,
      strengthLabel: strength.label,
    }
  }, [kgData, positionsBundle])

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

  function resetView() { setView({ scale: 1, tx: 0, ty: 0 }) }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setView(v => ({ ...v, scale: Math.min(4, Math.max(0.5, v.scale * delta)) }))
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    if ((e.target as Element).closest('[data-mc-node]')) return
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      tx: view.tx,
      ty: view.ty,
      moved: false,
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    if (!dragRef.current.moved) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
      dragRef.current.moved = true
      setIsDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setView(v => ({
      ...v,
      tx: dragRef.current!.tx + dx,
      ty: dragRef.current!.ty + dy,
    }))
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.moved) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    }
    dragRef.current = null
    setIsDragging(false)
  }

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
      const diagnostic = await loadDiagnostic(user.uid)
      const excluded = diagnostic?.excludedConcepts ?? []
      const result = await getRecommendations(user.uid, [targetId], 'curriculum', diagnostic?.exam ?? 'ACT', excluded)
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

  const visibleNodes = useMemo(() => {
    let nodes = kgData?.nodes ?? []
    if (levelFilter) nodes = nodes.filter(n => n.level === levelFilter)
    if (statusFilter) nodes = nodes.filter(n => statusKind(n.status) === statusFilter)
    return nodes
  }, [kgData, levelFilter, statusFilter])

  const filterRow = (levels.length > 0 || kgData) && (
    <div className={c.filters} role="group" aria-label="Map filters">
      <button
        className={`${c.chip} ${!statusFilter ? c.chipActive : ''}`}
        onClick={() => setStatusFilter(null)}
      >All status</button>
      {(['stable', 'progress', 'needs', 'unknown'] as const).map(kind => (
        <button
          key={kind}
          className={`${c.chip} ${statusFilter === kind ? c.chipActive : ''}`}
          onClick={() => setStatusFilter(statusFilter === kind ? null : kind)}
        >
          {KIND_LABEL[kind]}
        </button>
      ))}
      {levels.length > 0 && (
        <>
          <span className={c.filterSep} aria-hidden />
          <button
            className={`${c.chip} ${!levelFilter ? c.chipActive : ''}`}
            onClick={() => setLevelFilter(null)}
          >All levels</button>
          {levels.map(lv => (
            <button key={lv}
              className={`${c.chip} ${levelFilter === lv ? c.chipActive : ''}`}
              onClick={() => setLevelFilter(levelFilter === lv ? null : lv)}
            >
              {lv.replace(/_/g, ' ')}
            </button>
          ))}
        </>
      )}
    </div>
  )

  const searchForm = (
    <form className={c.searchRow} onSubmit={handleSearchSubmit}>
      <div className={c.searchWrap}>
        <svg className={c.searchIcon} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className={c.searchInput}
          placeholder="Type a concept to plot your route…"
          value={search}
          onChange={e => { setSearch(e.target.value); setSearchOpen(true) }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 160)}
          autoComplete="off"
        />
        {search && (
          <button type="button" className={c.searchClear}
            onClick={() => { setSearch(''); setSearchOpen(false) }}>✕</button>
        )}
      </div>
      <button type="submit" className={c.searchBtn} disabled={!search.trim()}>
        Plot route →
      </button>
      {searchOpen && searchMatches.size > 0 && (
        <div className={c.suggestions} role="listbox">
          {Array.from(searchMatches).slice(0, 7).map(id => {
            const n = nodeMap.get(id)
            if (!n) return null
            const kind = statusKind(n.status)
            return (
              <button key={id} role="option" className={c.suggItem}
                onMouseDown={() => { setSearch(mlIdToLabel(id)); setSearchOpen(false); plotRoute(id) }}
              >
                <span className={c.suggDot} style={{ background: KIND_COLOR[kind] }} />
                <span className={c.suggName}>{mlIdToLabel(id)}</span>
                <span className={c.suggStatus}>{KIND_LABEL[kind]}</span>
              </button>
            )
          })}
        </div>
      )}
    </form>
  )

  const edgeLit = embedded ? 'rgba(29, 58, 138, 0.42)' : 'rgba(255,255,255,0.62)'
  const edgeDim = embedded ? 'rgba(29, 58, 138, 0.14)' : 'rgba(255,255,255,0.18)'
  const axisFill = embedded ? 'rgba(111, 106, 97, 0.72)' : 'rgba(255,255,255,0.42)'

  return (
    <div className={embedded ? p.paperExplorerRoot : s.explorerStandalone}>
      {embedded ? (
        <div className={p.paperSearchSection}>{searchForm}</div>
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
          </div>
        </header>
      )}

      {filterRow && <div className={c.filterBar}>{filterRow}</div>}

      <div className={`${c.mapArea} ${embedded ? c.mapAreaEmbedded : ''}`}>
        <div className={c.mapWrap}>
          {loading && (
            <div className={c.mapState}>
              <span className={c.mapDot} />
              <span>Loading your learning world…</span>
            </div>
          )}

          {!loading && !kgData && (
            <div className={c.mapState}>
              <p>No learning data yet — complete a session or answer practice questions to populate your map.</p>
            </div>
          )}

          {kgData && (
            <>
            <div className={c.zoomControls}>
              <button type="button" className={c.zoomBtn} onClick={() => setView(v => ({ ...v, scale: Math.min(4, v.scale * 1.2) }))}>+</button>
              <button type="button" className={c.zoomBtn} onClick={() => setView(v => ({ ...v, scale: Math.max(0.5, v.scale * 0.8) }))}>−</button>
              <button type="button" className={c.zoomBtn} onClick={resetView}>Reset</button>
            </div>
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className={c.mapSvg}
              xmlns="http://www.w3.org/2000/svg" aria-label="Knowledge constellation"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onDoubleClick={e => { if (e.target === e.currentTarget) resetView() }}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              <g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
              {kgData.axisLabels && (
                <>
                  <text x={SVG_W / 2} y={SVG_H - 10} textAnchor="middle"
                    fontSize="9" fill={axisFill}
                    fontFamily="system-ui, sans-serif" fontWeight="600"
                    pointerEvents="none">
                    {kgData.axisLabels.x}
                  </text>
                  <text x={14} y={SVG_H / 2} textAnchor="middle"
                    fontSize="9" fill={axisFill}
                    fontFamily="system-ui, sans-serif" fontWeight="600"
                    transform={`rotate(-90, 14, ${SVG_H / 2})`}
                    pointerEvents="none">
                    {kgData.axisLabels.y}
                  </text>
                </>
              )}
              {kgData.edges.filter(e => e.weight > 0.1).map((edge, i) => {
                const sp = positions.get(edge.from)
                const tp = positions.get(edge.to)
                if (!sp || !tp) return null
                const lit = hovered === edge.from || hovered === edge.to
                  || selectedId === edge.from || selectedId === edge.to
                return (
                  <line key={i}
                    x1={sp.sx} y1={sp.sy} x2={tp.sx} y2={tp.sy}
                    stroke={lit ? edgeLit : edgeDim}
                    strokeWidth={lit ? 1.6 : 0.9}
                    strokeLinecap="round"
                  />
                )
              })}

              {studentScreenPoints && (
                <g pointerEvents="none">
                  <line
                    x1={studentScreenPoints.mastery.sx}
                    y1={studentScreenPoints.mastery.sy}
                    x2={studentScreenPoints.strength.sx}
                    y2={studentScreenPoints.strength.sy}
                    stroke="#7c3aed"
                    strokeWidth="1.5"
                    strokeOpacity="0.65"
                    strokeDasharray="4 3"
                  />
                  <polygon
                    points={diamondPoints(studentScreenPoints.mastery.sx, studentScreenPoints.mastery.sy, 9)}
                    fill="#4361ee"
                    stroke="#fff"
                    strokeWidth="1.2"
                  />
                  <text x={studentScreenPoints.mastery.sx} y={studentScreenPoints.mastery.sy - 14}
                    textAnchor="middle" fontSize="8" fontWeight="700" fill="#4361ee"
                    fontFamily="system-ui, sans-serif">
                    {studentScreenPoints.masteryLabel}
                  </text>
                  <polygon
                    points={diamondPoints(studentScreenPoints.strength.sx, studentScreenPoints.strength.sy, 9)}
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="2"
                  />
                  <text x={studentScreenPoints.strength.sx} y={studentScreenPoints.strength.sy - 14}
                    textAnchor="middle" fontSize="8" fontWeight="700" fill="#7c3aed"
                    fontFamily="system-ui, sans-serif">
                    {studentScreenPoints.strengthLabel}
                  </text>
                </g>
              )}

              {visibleNodes.map(node => {
                const pos = positions.get(node.id)
                if (!pos) return null
                const isHov = hovered === node.id
                const isSel = selectedId === node.id
                const accent = nodeColor(node.status)
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
                    data-mc-node
                    transform={`translate(${pos.sx}, ${pos.sy})`}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => selectNode(node)}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: 'pointer' }}
                    aria-label={mlIdToLabel(node.id)}
                  >
                    {isSel && (
                      <circle r={r + 9}
                        fill={accent} fillOpacity="0.12"
                        stroke={accent} strokeWidth="1.5" strokeOpacity="0.45"
                      />
                    )}
                    <circle r={r}
                      fill={embedded
                        ? (dimmed ? 'rgba(29, 58, 138, 0.06)' : '#fbf8f4')
                        : (dimmed ? 'rgba(255,255,255,0.22)' : '#ffffff')}
                      fillOpacity={embedded
                        ? (dimmed ? 1 : (isSel ? 1 : isHov ? 0.98 : hasData ? 0.95 : 0.7))
                        : (dimmed ? 1 : (isSel ? 1 : isHov ? 0.96 : hasData ? 0.9 : 0.55))}
                      stroke={isSel ? accent : (embedded ? '#c8c2b8' : 'rgba(255,255,255,0.85)')}
                      strokeWidth={isSel ? 2.2 : 1}
                      strokeOpacity={dimmed ? 0.3 : 1}
                    />
                    {node.mastery > 0.05 && !dimmed && (
                      <circle r={r - 2.5}
                        fill="none"
                        stroke={accent} strokeWidth="1.8"
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
                        fill={embedded
                          ? (isSel ? '#1d3a8a' : dimmed ? 'rgba(111, 106, 97, 0.38)' : '#6f6a61')
                          : (isSel ? '#ffffff' : dimmed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.72)')}
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
              </g>
            </svg>
            </>
          )}

          <div className={c.legend}>
            <div className={c.legendItems}>
              {([
                ['#00875a', 'Got it'],
                ['#4361ee', 'Working on it'],
                ['#d63e3e', 'Needs love'],
                ['#9aabb6', 'Not started'],
              ] as const).map(([color, label]) => (
                <span key={label} className={c.legendItem}>
                  <span className={c.legendDot} style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
            <div className={c.coverage}>
              <span className={c.coverageLabel}>Coverage</span>
              <div className={c.coverageBar} role="progressbar"
                aria-valuenow={coveragePct} aria-valuemin={0} aria-valuemax={100}>
                <div className={c.coverageFill} style={{ width: `${coveragePct}%` }} />
              </div>
              <span className={c.coverageText}>{stats.stable} of {stats.total} stable</span>
            </div>
          </div>
        </div>

        {panel.mode !== 'none' && (
          <aside className={c.panel}>
            {panel.mode === 'detail' && (() => {
              const node = panel.node
              const kind = statusKind(node.status)
              const masteryPct = Math.round(node.mastery * 100)
              const content = getConceptContent(node.id)
              return (
                <div className={c.panelDetail}>
                  <button className={c.panelClose} onClick={closePanel} aria-label="Close panel">✕</button>

                  <div className={c.detailStatus}>
                    <span className={c.statusDot} style={{ background: KIND_COLOR[kind] }} />
                    <span className={c.statusLabel} style={{ color: KIND_COLOR[kind] }}>
                      {KIND_LABEL[kind]}
                    </span>
                  </div>

                  <h2 className={c.detailName}>{mlIdToLabel(node.id)}</h2>
                  {content?.tagline && (
                    <p className={c.detailTagline}>{content.tagline}</p>
                  )}

                  <div className={c.metric}>
                    <span className={c.metricLabel}>how solid</span>
                    <div className={c.metricBarRow}>
                      <div className={c.metricBar}>
                        <div className={c.metricBarFill}
                          style={{ width: `${masteryPct}%`, background: KIND_COLOR[kind] }} />
                      </div>
                      <span className={c.metricPct}>{masteryPct}%</span>
                    </div>
                  </div>

                  <p className={c.sectionHint}>
                    Tap Open lesson to work this topic in your notebook — same cozy pages as the dashboard.
                  </p>

                  <div className={c.detailActions}>
                    <button
                      className={c.btnPrimary}
                      onClick={() => navigate(`/concept/${encodeURIComponent(node.id)}`, {
                        state: { fromGps: true, fromDashboard: true },
                      })}
                    >
                      Open lesson →
                    </button>
                    <button className={c.btnGhost} onClick={() => plotRoute(node.id)}>
                      See path
                    </button>
                    <button className={c.btnGhost}
                      onClick={() => navigate('/practice', { state: { conceptId: node.id, missionType: 'learn' } })}
                    >
                      Quick practice
                    </button>
                  </div>
                </div>
              )
            })()}

            {panel.mode === 'route' && (
              <div className={c.panelRoute}>
                <button className={c.panelBack}
                  onClick={() => {
                    const n = selectedId ? nodeMap.get(selectedId) : null
                    n ? setPanel({ mode: 'detail', node: n }) : closePanel()
                  }}
                  aria-label="Back"
                >← Back</button>

                <div className={c.routeHeader}>
                  <span className={c.routeTitle}>Your Next Route</span>
                  {!panel.loading && panel.steps.length > 0 && (
                    <span className={c.routeMeta}>
                      {panel.steps.length} step{panel.steps.length !== 1 ? 's' : ''} · curriculum mode
                    </span>
                  )}
                </div>

                {panel.loading && (
                  <div className={c.routeLoading}>
                    <span className={c.routeDot} />
                    <span>Building your path…</span>
                  </div>
                )}

                {!panel.loading && panel.steps.length === 0 && (
                  <p className={c.routeEmpty}>
                    Route unavailable — the ML service may be warming up. Try again in a moment.
                  </p>
                )}

                {!panel.loading && panel.steps.length > 0 && (
                  <>
                    {panel.gpsGraph && (
                      <div className={c.miniMapWrap}>
                        <svg viewBox={`0 0 ${GPS_W} ${GPS_H}`} width="100%" height={170} className={c.miniMapSvg}>
                          {panel.gpsGraph.edges.map((e, i) => (
                            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                              stroke={embedded
                                ? (e.needsWork ? 'rgba(29, 58, 138, 0.35)' : 'rgba(29, 58, 138, 0.18)')
                                : (e.needsWork ? 'rgba(124,58,237,0.28)' : 'rgba(0,135,90,0.2)')}
                              strokeWidth={e.needsWork ? 1.4 : 1}
                              strokeDasharray={e.needsWork ? undefined : '3 2'}
                            />
                          ))}
                          {[...panel.gpsGraph.nodes]
                            .sort((a, b) => Math.abs(b.depth) - Math.abs(a.depth))
                            .map(n => {
                              const color = embedded
                                ? (n.isTarget ? '#1d3a8a' : (STATUS_COLOR[n.status] ?? '#9aabb6'))
                                : (n.isTarget ? '#7c3aed' : (STATUS_COLOR[n.status] ?? '#9aabb6'))
                              const r = n.isTarget ? 9 : 6
                              return (
                                <g key={n.id}>
                                  <circle cx={n.x} cy={n.y} r={r}
                                    fill={embedded
                                      ? (n.isTarget ? 'rgba(29, 58, 138, 0.08)' : 'rgba(251, 248, 244, 0.9)')
                                      : (n.isTarget ? 'rgba(124,58,237,0.12)' : 'rgba(20,30,40,0.05)')}
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
                                    fill={embedded
                                      ? (n.isTarget ? '#1d3a8a' : '#6f6a61')
                                      : (n.isTarget ? '#5b21b6' : '#607d8b')}
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

                    <div className={c.routeSteps}>
                      {panel.steps.map((step, i) => (
                        <div key={step.id}
                          className={`${c.routeStep} ${step.isTarget ? c.routeStepTarget : ''}`}
                          onClick={() => {
                            const n = nodeMap.get(step.id)
                            if (n) { setSelectedId(step.id); setPanel({ mode: 'detail', node: n }) }
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              const n = nodeMap.get(step.id)
                              if (n) { setSelectedId(step.id); setPanel({ mode: 'detail', node: n }) }
                            }
                          }}
                        >
                          <div className={c.stepNum}>
                            {i + 1}
                          </div>
                          <div className={c.stepBody}>
                            <div className={`${c.stepName} ${step.isTarget ? c.stepNameTarget : ''}`}>
                              {step.name}
                            </div>
                            <div className={c.stepReason}>{step.reason}</div>
                          </div>
                          <div className={c.stepBadge}>
                            {Math.round(step.mastery * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>

                    <button className={c.btnPrimary}
                      onClick={() => {
                        const firstId = panel.steps[0]?.id ?? panel.targetId
                        if (onStartRoute) onStartRoute(firstId)
                        else navigate(`/concept/${encodeURIComponent(firstId)}`, {
                          state: { fromGps: true, fromDashboard: true },
                        })
                      }}
                    >
                      Open {panel.steps[0] ? mlIdToLabel(panel.steps[0].id) : 'first lesson'} →
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
