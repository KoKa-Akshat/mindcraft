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
import s from '../pages/ConstellationGpsLab.module.css'

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
  onBack,
}: {
  targetId: string
  onBack: () => void
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
        const map = new Map(nodes.map(n => [n.id, n]))
        if (cancelled) return

        const result = await getRecommendations(user.uid, [targetId], 'curriculum')
        if (cancelled) return

        const chain = result?.canonicalChain?.length ? result.canonicalChain : [targetId]
        const recMap = new Map<string, ConceptRecommendation>()
        for (const r of result?.recommendations ?? []) recMap.set(r.conceptId, r)

        const routeSteps: RouteStep[] = chain.map((id, i) => {
          const n = map.get(id)
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
            const n = map.get(id)
            return [id, { id, mastery: n?.mastery ?? 0, status: n?.status ?? 'untouched' }]
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
    <div className={s.embeddedRoot}>
      <div className={s.embeddedHeader}>
        <button type="button" className={s.embeddedBack} onClick={onBack}>
          ← Back to map
        </button>
        <div className={s.embeddedTitleRow}>
          <h2 className={s.embeddedTitle}>Your Route</h2>
          <span className={s.embeddedSub}>{targetLabel}</span>
        </div>
      </div>

      <div className={s.panelRoute}>
        {loading ? (
          <p className={s.sectionHint}>Plotting your route…</p>
        ) : steps.length === 0 ? (
          <p className={s.sectionHint}>No route found for this concept yet.</p>
        ) : (
          <>
            <div className={s.routeHeader}>
              <span className={s.routeEyebrow}>Mission path</span>
              <span className={s.routeMeta}>{steps.length} steps · curriculum mode</span>
            </div>

            {gpsGraph && (
              <div className={s.miniMapWrap}>
                <svg viewBox={`0 0 ${GPS_W} ${GPS_H}`} width="100%" height={170} className={s.miniMapSvg}>
                  {gpsGraph.edges.map((e, i) => (
                    <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                      stroke={e.needsWork ? 'rgba(124,58,237,0.28)' : 'rgba(0,135,90,0.2)'}
                      strokeWidth={e.needsWork ? 1.4 : 1}
                      strokeDasharray={e.needsWork ? undefined : '3 2'}
                    />
                  ))}
                  {[...gpsGraph.nodes]
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
                          <text x={n.x} y={n.y + r + 9} textAnchor="middle"
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
              {steps.map((step, i) => (
                <button
                  key={step.id}
                  type="button"
                  className={`${s.routeStep} ${step.isTarget ? s.routeStepTarget : ''}`}
                  onClick={() => startStep(step.id, step.isTarget)}
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
                </button>
              ))}
            </div>

            <button
              type="button"
              className={s.btnPrimary}
              onClick={() => startStep(steps[0].id, steps[0].isTarget)}
            >
              Begin with {steps[0].name} →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
