/**
 * Route mission dashboard — step list for a GPS-plotted path.
 * Shown when user clicks "Start with …" from the GPS route panel.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { mlIdToLabel } from '../lib/conceptMap'
import { fetchKnowledgeGraph } from '../lib/graphCache'
import { getRecommendations } from '../lib/mlApi'
import type { ConceptRecommendation } from '../lib/mlApi'
import { buildGraph, GPS_W, GPS_H, STATUS_COLOR } from '../lib/learningPathGraph'
import type { GPSGraph, GPSMLNode } from '../lib/learningPathGraph'
import n from './DashboardPanels.module.css'

interface RouteStep {
  id: string
  name: string
  mastery: number
  status: string
  reason: string
  isTarget: boolean
}

type KGNode = { id: string; mastery?: number; status?: string }

export default function DashboardRoutePanel({
  targetId,
}: {
  targetId: string
  onBack?: () => void
}) {
  const user = useUser()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState<RouteStep[]>([])
  const [gpsGraph, setGpsGraph] = useState<GPSGraph | null>(null)

  useEffect(() => {
    if (!user?.uid || !targetId) return
    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const kg = await fetchKnowledgeGraph(user.uid)
        const nodes = (kg?.nodes ?? []) as KGNode[]
        const map = new Map(nodes.map(nd => [nd.id, nd]))
        if (cancelled) return

        const result = await getRecommendations(user.uid, [targetId], 'curriculum')
        if (cancelled) return

        const chain = result?.canonicalChain?.length ? result.canonicalChain : [targetId]
        const recMap = new Map<string, ConceptRecommendation>()
        for (const r of result?.recommendations ?? []) recMap.set(r.conceptId, r)

        const routeSteps: RouteStep[] = chain.map((id, i) => {
          const nd = map.get(id)
          const rec = recMap.get(id)
          const isTarget = id === targetId
          return {
            id,
            name: mlIdToLabel(id),
            mastery: nd?.mastery ?? 0,
            status: nd?.status ?? 'untouched',
            reason: rec?.reason ?? (isTarget
              ? 'This is your target. Focus your practice here.'
              : `Step ${i + 1}: strengthen this prerequisite first.`),
            isTarget,
          }
        })

        const gpsNodeMap = new Map<string, GPSMLNode>(
          chain.map(id => {
            const nd = map.get(id)
            return [id, { id, mastery: nd?.mastery ?? 0, status: nd?.status ?? 'untouched' }]
          }),
        )
        setSteps(routeSteps)
        setGpsGraph(buildGraph(targetId, chain, [], gpsNodeMap))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [user?.uid, targetId])

  const targetLabel = useMemo(() => mlIdToLabel(targetId), [targetId])

  function startStep(conceptId: string, isTarget: boolean) {
    navigate('/practice', {
      state: {
        conceptId,
        missionType: isTarget ? 'learn' : 'weakness',
      },
    })
  }

  return (
    <div className={n.routeBody}>
      <div>
        <span className={n.routeEyebrow}>mission path</span>
        <span className={n.routeMeta}> · {targetLabel}</span>
      </div>

      {loading ? (
        <p className={n.paperEmptyHint}>Plotting your route…</p>
      ) : steps.length === 0 ? (
        <p className={n.paperEmptyHint}>No route found for this concept yet.</p>
      ) : (
        <>
          <p className={n.routeMeta}>{steps.length} steps · curriculum mode</p>

          {gpsGraph && (
            <div className={n.miniMapWrap}>
              <svg viewBox={`0 0 ${GPS_W} ${GPS_H}`} width="100%" height={170} className={n.miniMapSvg}>
                {gpsGraph.edges.map((e, i) => (
                  <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke={e.needsWork ? 'rgba(124,58,237,0.35)' : 'rgba(29,58,138,0.18)'}
                    strokeWidth={e.needsWork ? 1.4 : 1}
                    strokeDasharray={e.needsWork ? undefined : '3 2'}
                  />
                ))}
                {[...gpsGraph.nodes]
                  .sort((a, b) => Math.abs(b.depth) - Math.abs(a.depth))
                  .map(nd => {
                    const color = nd.isTarget ? '#1d3a8a' : (STATUS_COLOR[nd.status] ?? '#9aabb6')
                    const r = nd.isTarget ? 9 : 6
                    return (
                      <g key={nd.id}>
                        <circle cx={nd.x} cy={nd.y} r={r}
                          fill={nd.isTarget ? 'rgba(29,58,138,0.08)' : 'rgba(251,248,244,0.9)'}
                          stroke={color} strokeWidth={nd.isTarget ? 2.2 : 1.6}
                        />
                        <text x={nd.x} y={nd.y + r + 9} textAnchor="middle"
                          fontSize={nd.isTarget ? 8.5 : 7.5}
                          fontWeight={nd.isTarget ? 700 : 500}
                          fill={nd.isTarget ? '#1d3a8a' : '#6f6a61'}
                          fontFamily="system-ui, -apple-system, sans-serif"
                        >
                          {nd.short}
                        </text>
                      </g>
                    )
                  })}
              </svg>
            </div>
          )}

          <div className={n.routeSteps}>
            {steps.map((step, i) => (
              <button
                key={step.id}
                type="button"
                className={`${n.routeStep} ${step.isTarget ? n.routeStepTarget : ''}`}
                onClick={() => startStep(step.id, step.isTarget)}
              >
                <div className={n.stepNum}>{i + 1}</div>
                <div className={n.stepBody}>
                  <div className={`${n.stepName} ${step.isTarget ? n.stepNameTarget : ''}`}>
                    {step.name}
                  </div>
                  <div className={n.stepReason}>{step.reason}</div>
                </div>
                <span className={n.stepChip}>{Math.round(step.mastery * 100)}%</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={n.paperSubmit}
            onClick={() => startStep(steps[0].id, steps[0].isTarget)}
          >
            Begin with {steps[0].name} →
          </button>
        </>
      )}
    </div>
  )
}
