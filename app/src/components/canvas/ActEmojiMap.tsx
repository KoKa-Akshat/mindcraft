/**
 * Full-canvas ACT topic map: icon constellation with GPS-style focus panel.
 * Tap a node to highlight its route and show where you are / what to do under the map.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../App'
import { ACT_TOC_SECTIONS, actConceptLabel } from '../../lib/actToc'
import { getConceptContent } from '../../lib/conceptContent'
import { conceptIconUrl } from '../../lib/conceptIcon'
import { fetchKnowledgeGraph } from '../../lib/graphCache'
import { getRecommendations } from '../../lib/mlApi'
import s from './ActEmojiMap.module.css'

type Props = {
  sparkId?: string | null
  onOpenLesson: (conceptId: string) => void
}

type Placed = {
  id: string
  section: string
  x: number
  y: number
}

type NodeMeta = {
  mastery: number
  status: string
}

/** Real ontology-derived edge from GET /knowledge-graph (Beta-Binomial
 * posterior weight, seeded from ontology prior strength so it is populated
 * even for a brand-new student with zero practice events). Same shape
 * KnowledgeGraph.tsx / ConstellationCard.tsx already consume. */
type KgEdge = { from: string; to: string; weight: number; relation: string }

type RouteStep = {
  id: string
  name: string
  mastery: number
  status: string
  reason: string
  isTarget: boolean
}

type StatusKind = 'stable' | 'progress' | 'needs' | 'unknown'

const KIND_COLOR: Record<StatusKind, string> = {
  stable: '#00875a',
  progress: '#4361ee',
  needs: '#d63e3e',
  unknown: '#9aabb6',
}
const KIND_LABEL: Record<StatusKind, string> = {
  stable: 'Stable',
  progress: 'Repairing',
  needs: 'Open Gap',
  unknown: 'Unexplored',
}

function statusKind(status: string): StatusKind {
  if (['mastered', 'stable', 'comeback_built', 'ready_for_challenge'].includes(status)) return 'stable'
  if (['in_progress', 'repairing'].includes(status)) return 'progress'
  if (['struggling', 'open_gap'].includes(status)) return 'needs'
  return 'unknown'
}

function whatToDo(kind: StatusKind, isSpark: boolean): string {
  if (isSpark) return 'This is today’s spark, open the lesson or run a quick drill next.'
  if (kind === 'needs') return 'This gap needs repair. Walk the path below, then practice the target.'
  if (kind === 'progress') return 'You’re mid-repair here. Keep going until it feels solid.'
  if (kind === 'stable') return 'Solid so far. Open the lesson to review, or plot a stretch path.'
  return 'Untouched so far. Open the lesson for the story, then try a short drill.'
}

/** Spread nodes by TOC section so edges read clearly, no pile-up in the middle. */
function layoutNodes(): Placed[] {
  const out: Placed[] = []
  const sections = ACT_TOC_SECTIONS.filter(sec => sec.conceptIds.length > 0)
  const nSec = sections.length

  sections.forEach((sec, si) => {
    const ids = sec.conceptIds
    const colX = nSec <= 1 ? 50 : 10 + (si / (nSec - 1)) * 80
    const count = ids.length
    ids.forEach((id, ti) => {
      const row = Math.floor(ti / 2)
      const side = ti % 2 === 0 ? -1 : 1
      const rowSpan = Math.max(1, Math.ceil(count / 2) - 1)
      const y = 14 + (rowSpan === 0 ? 0 : (row / rowSpan) * 72)
      const x = colX + side * (6 + (ti % 3) * 2.2)
      out.push({
        id,
        section: sec.title,
        x: Math.min(94, Math.max(6, x)),
        y: Math.min(88, Math.max(10, y)),
      })
    })
  })
  return out
}

/** Fallback ONLY: a synthetic "same section, in list order" chain plus one
 * hub-to-hub link per section boundary. This is NOT real prerequisite data,
 * it is just enough of a line to look connected while the real graph is
 * still loading (or if the ML fetch fails). Root cause of Akshat's "the Map
 * is missing so many connections" complaint (2026-07-23): this synthetic
 * scheme used to be the ONLY edge source the Map ever drew, full stop, never
 * touching the real ontology graph at all. `realEdgesFor` below is the fix,
 * see the `links` useMemo. */
function syntheticFallbackEdges(nodes: Placed[]): Array<[Placed, Placed, string]> {
  const bySection = new Map<string, Placed[]>()
  for (const n of nodes) {
    const list = bySection.get(n.section) ?? []
    list.push(n)
    bySection.set(n.section, list)
  }
  const edges: Array<[Placed, Placed, string]> = []
  for (const list of bySection.values()) {
    for (let i = 0; i < list.length - 1; i++) {
      edges.push([list[i], list[i + 1], 'fallback'])
    }
  }
  const hubs = [...bySection.values()].map(list => list[0]).filter(Boolean)
  for (let i = 0; i < hubs.length - 1; i++) {
    edges.push([hubs[i], hubs[i + 1], 'fallback'])
  }
  return edges
}

/** Real prerequisite/bridge edges from the ontology graph, same source and
 * same weight threshold (0.2) KnowledgeGraph.tsx and ConstellationCard.tsx
 * already use, restricted to node pairs actually placed on this Map. */
function realEdgesFor(
  nodes: Placed[],
  kgEdges: KgEdge[],
): Array<[Placed, Placed, string]> {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const out: Array<[Placed, Placed, string]> = []
  for (const e of kgEdges) {
    if (e.weight <= 0.2) continue
    const a = byId.get(e.from)
    const b = byId.get(e.to)
    if (!a || !b) continue
    out.push([a, b, e.relation])
  }
  return out
}

/** Dash pattern per relation type, same visual grammar KnowledgeGraph.tsx
 * uses (edgeStyle()) so a "prerequisite" line reads the same everywhere in
 * the app: solid = prerequisite (the strongest, most load-bearing relation),
 * looser dashes for the weaker related/application/discovered priors. */
function relationDash(relation: string): string | undefined {
  switch (relation) {
    case 'prerequisite': return undefined
    case 'related':      return '2.2 1.4'
    case 'application':  return '1 1.2'
    case 'discovered':   return '0.6 1.6'
    default:              return undefined
  }
}

export default function ActEmojiMap({ sparkId, onOpenLesson }: Props) {
  const user = useUser()
  const navigate = useNavigate()
  const [focus, setFocus] = useState(sparkId ?? '')
  const [q, setQ] = useState('')
  const [metaById, setMetaById] = useState<Record<string, NodeMeta>>({})
  const [kgEdges, setKgEdges] = useState<KgEdge[] | null>(null)
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([])
  const [routeLoading, setRouteLoading] = useState(false)

  const all = useMemo(() => layoutNodes(), [])

  useEffect(() => {
    if (sparkId && !focus) setFocus(sparkId)
  }, [sparkId, focus])

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    void fetchKnowledgeGraph(user.uid).then(kg => {
      if (cancelled || !kg?.nodes) return
      const next: Record<string, NodeMeta> = {}
      for (const n of kg.nodes as Array<{ id?: string; mastery?: number; status?: string }>) {
        if (!n.id) continue
        next[n.id] = { mastery: n.mastery ?? 0, status: n.status ?? 'untouched' }
      }
      setMetaById(next)
      // Real prerequisite/bridge edges (from mindcraft_graph's Beta-Binomial
      // posterior over the ontology, seeded from ontology prior strength
      // even before any practice), same field KnowledgeGraph.tsx /
      // ConstellationCard.tsx already render. Previously never read here at
      // all, see `syntheticFallbackEdges`'s header comment.
      const { edges } = kg as { edges?: unknown }
      setKgEdges(Array.isArray(edges) ? (edges as KgEdge[]) : [])
    })
    return () => { cancelled = true }
  }, [user?.uid])

  useEffect(() => {
    if (!focus || !user?.uid) {
      setRouteSteps([])
      setRouteLoading(false)
      return
    }
    let cancelled = false
    setRouteLoading(true)
    void getRecommendations(user.uid, [focus], 'curriculum')
      .then(result => {
        if (cancelled) return
        const chain = result?.canonicalChain?.length ? result.canonicalChain : [focus]
        const recMap = new Map((result?.recommendations ?? []).map(r => [r.conceptId, r]))
        setRouteSteps(chain.map((id, i) => {
          const isTarget = id === focus
          const rec = recMap.get(id)
          return {
            id,
            name: actConceptLabel(id),
            mastery: 0,
            status: 'untouched',
            reason: rec?.reason ?? (isTarget
              ? 'This is your target. Focus your practice here.'
              : `Step ${i + 1}: strengthen this prerequisite first.`),
            isTarget,
          }
        }))
      })
      .catch(() => {
        if (!cancelled) {
          setRouteSteps([{
            id: focus,
            name: actConceptLabel(focus),
            mastery: 0,
            status: 'untouched',
            reason: 'This is your target. Focus your practice here.',
            isTarget: true,
          }])
        }
      })
      .finally(() => { if (!cancelled) setRouteLoading(false) })
    return () => { cancelled = true }
  }, [focus, user?.uid])

  // Merge live mastery/status onto route steps once the graph cache arrives.
  useEffect(() => {
    if (!Object.keys(metaById).length) return
    setRouteSteps(prev => {
      if (!prev.length) return prev
      let changed = false
      const next = prev.map(step => {
        const meta = metaById[step.id]
        if (!meta) return step
        if (step.mastery === meta.mastery && step.status === meta.status) return step
        changed = true
        return { ...step, mastery: meta.mastery, status: meta.status }
      })
      return changed ? next : prev
    })
  }, [metaById])

  const nodes = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return all
    return all.filter(n => {
      const label = actConceptLabel(n.id).toLowerCase()
      return label.includes(needle) || n.id.includes(needle) || n.section.toLowerCase().includes(needle)
    })
  }, [all, q])

  // Real ontology edges once loaded; synthetic chain only as a loading/error
  // fallback so the map isn't a bare field of disconnected icons while the
  // graph fetch is in flight. See `realEdgesFor`/`syntheticFallbackEdges`.
  const links = useMemo(() => {
    const real = kgEdges && kgEdges.length > 0 ? realEdgesFor(nodes, kgEdges) : []
    return real.length > 0 ? real : syntheticFallbackEdges(nodes)
  }, [nodes, kgEdges])
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])

  const routeIds = useMemo(() => new Set(routeSteps.map(step => step.id)), [routeSteps])

  const neighborIds = useMemo(() => {
    if (!focus) return new Set<string>()
    const set = new Set<string>([focus])
    for (const [a, b] of links) {
      if (a.id === focus) set.add(b.id)
      if (b.id === focus) set.add(a.id)
    }
    return set
  }, [focus, links])

  const litIds = useMemo(() => {
    if (!focus) return new Set<string>()
    if (routeIds.size > 1) return routeIds
    return neighborIds
  }, [focus, routeIds, neighborIds])

  const focusNode = focus ? byId.get(focus) ?? all.find(n => n.id === focus) : null
  const focusMeta = focus ? metaById[focus] : null
  const focusKind = statusKind(focusMeta?.status ?? 'untouched')
  const masteryPct = Math.round((focusMeta?.mastery ?? 0) * 100)
  const content = focus ? getConceptContent(focus) : null
  const isSpark = !!focus && focus === sparkId

  function startStep(conceptId: string, isTarget: boolean) {
    navigate('/practice', {
      state: {
        conceptId,
        missionType: isTarget ? 'learn' : 'weakness',
      },
    })
  }

  return (
    <div className={s.root}>
      <div className={s.top}>
        <input
          className={s.search}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Find a topic…"
          aria-label="Find topic"
        />
        <p className={s.hint}>tap an icon · double-tap to open</p>
      </div>

      <div className={s.sky} aria-label="ACT topic map">
        <svg className={s.links} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {links.map(([a, b, relation]) => {
            const lit = focus
              && ((routeIds.size > 1 && routeIds.has(a.id) && routeIds.has(b.id))
                || (routeIds.size <= 1 && (a.id === focus || b.id === focus)))
            return (
              <line
                key={`${a.id}-${b.id}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={lit ? s.linkLit : (focus ? s.linkDim : s.link)}
                strokeDasharray={relationDash(relation)}
              />
            )
          })}
          {/* Draw curriculum route as an ordered polyline through placed nodes */}
          {focus && routeSteps.length > 1 && (() => {
            const pts = routeSteps
              .map(step => byId.get(step.id) ?? all.find(n => n.id === step.id))
              .filter((n): n is Placed => !!n)
            if (pts.length < 2) return null
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
            return <path d={d} className={s.routePath} fill="none" />
          })()}
        </svg>

        {nodes.map(n => {
          const isSparkNode = n.id === sparkId
          const isFocus = n.id === focus
          const onRoute = litIds.has(n.id)
          const dimmed = !!focus && !onRoute
          return (
            <button
              key={n.id}
              type="button"
              className={[
                s.node,
                isSparkNode ? s.nodeSpark : '',
                isFocus ? s.nodeFocus : '',
                onRoute && !isFocus ? s.nodeRoute : '',
                dimmed ? s.nodeDim : '',
              ].filter(Boolean).join(' ')}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
              onClick={() => setFocus(n.id)}
              onDoubleClick={() => onOpenLesson(n.id)}
              title={actConceptLabel(n.id)}
              aria-label={actConceptLabel(n.id)}
              aria-pressed={isFocus}
            >
              <img className={s.emoji} src={conceptIconUrl(n.id)} alt="" draggable={false} />
            </button>
          )
        })}
      </div>

      {focus && focusNode && (
        <aside className={s.dock} aria-live="polite">
          <div className={s.dockHead}>
            <img className={s.dockEmoji} src={conceptIconUrl(focus)} alt="" draggable={false} />
            <div className={s.dockCopy}>
              <div className={s.dockStatus}>
                <span className={s.statusDot} style={{ background: KIND_COLOR[focusKind] }} />
                <span style={{ color: KIND_COLOR[focusKind] }}>{KIND_LABEL[focusKind]}</span>
                <span className={s.dockSection}>{focusNode.section}</span>
                {isSpark && <span className={s.dockHint}>today’s spark</span>}
              </div>
              <h2 className={s.dockName}>{actConceptLabel(focus)}</h2>
              <p className={s.dockTagline}>
                {content?.tagline ?? 'A stop on your ACT math map.'}
              </p>
            </div>
          </div>

          <div className={s.dockBody}>
            <div className={s.metric}>
              <span className={s.metricLabel}>how solid</span>
              <div className={s.metricBarRow}>
                <div className={s.metricBar}>
                  <div
                    className={s.metricBarFill}
                    style={{ width: `${masteryPct}%`, background: KIND_COLOR[focusKind] }}
                  />
                </div>
                <span className={s.metricPct}>{masteryPct}%</span>
              </div>
            </div>

            <p className={s.caption}>{whatToDo(focusKind, isSpark)}</p>

            <div className={s.routeBlock}>
              <div className={s.routeHead}>
                <span className={s.routeTitle}>Your Next Route</span>
                {!routeLoading && routeSteps.length > 0 && (
                  <span className={s.routeMeta}>
                    {routeSteps.length} step{routeSteps.length === 1 ? '' : 's'} · curriculum
                  </span>
                )}
              </div>
              {routeLoading && <p className={s.routeLoading}>Plotting your path…</p>}
              {!routeLoading && (
                <ol className={s.routeList}>
                  {routeSteps.map((step, i) => (
                    <li key={step.id}>
                      <button
                        type="button"
                        className={`${s.routeStep} ${step.isTarget ? s.routeStepTarget : ''}`}
                        onClick={() => {
                          if (step.id === focus) startStep(step.id, step.isTarget)
                          else setFocus(step.id)
                        }}
                      >
                        <span className={s.stepNum}>{i + 1}</span>
                        <span className={s.stepBody}>
                          <span className={s.stepName}>{step.name}</span>
                          <span className={s.stepReason}>{step.reason}</span>
                        </span>
                        <span className={s.stepChip}>{Math.round(step.mastery * 100)}%</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className={s.dockActions}>
              <button type="button" className={s.dockGo} onClick={() => onOpenLesson(focus)}>
                Open lesson →
              </button>
              <button
                type="button"
                className={s.dockGhost}
                onClick={() => startStep(routeSteps[0]?.id ?? focus, routeSteps[0]?.isTarget ?? true)}
              >
                Begin path
              </button>
              <button
                type="button"
                className={s.dockGhost}
                onClick={() => startStep(focus, true)}
              >
                Quick drill
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
