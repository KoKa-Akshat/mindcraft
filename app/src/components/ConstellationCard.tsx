import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import s from './ConstellationCard.module.css'

const ML_API_URL = import.meta.env.VITE_ML_API_URL ?? ''

const SVG_W = 700
const SVG_H = 280
const PAD   = 32

interface MLNode {
  id: string
  x: number
  y: number
  mastery: number
  eventCount: number
  status: 'mastered' | 'struggling' | 'in_progress' | 'untouched'
}

interface MLEdge {
  from: string
  to: string
  weight: number
}

interface GraphResp {
  nodes: MLNode[]
  edges: MLEdge[]
}

function statusColor(status: string): string {
  switch (status) {
    case 'mastered':    return '#58CC02'
    case 'in_progress': return '#4A7BF7'
    case 'struggling':  return '#FF4B4B'
    default:            return '#C4C4CE'
  }
}

function scaleNodes(nodes: MLNode[]) {
  const m = new Map<string, { sx: number; sy: number }>()
  if (!nodes.length) return m

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y
  }

  const rx = maxX - minX || 1
  const ry = maxY - minY || 1
  const pw = SVG_W - PAD * 2
  const ph = SVG_H - PAD * 2

  for (const n of nodes) {
    m.set(n.id, {
      sx: PAD + ((n.x - minX) / rx) * pw,
      sy: PAD + ((n.y - minY) / ry) * ph,
    })
  }
  return m
}

export default function ConstellationCard({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [data,    setData]    = useState<GraphResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !ML_API_URL) { setLoading(false); return }
    fetch(`${ML_API_URL}/knowledge-graph/${userId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d  => { setData(d); setLoading(false) })
      .catch(()  => setLoading(false))
  }, [userId])

  if (loading) {
    return (
      <div className={s.card}>
        <div className={s.loadRow}>
          <div className={s.spinner} />
          <span>Loading constellation…</span>
        </div>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className={s.card}>
        <div className={s.empty}>
          <div className={s.emptyOrb}>◎</div>
          <p className={s.emptyTitle}>Your constellation awaits</p>
          <p className={s.emptySub}>
            Complete a practice session to start mapping your knowledge
          </p>
          <button className={s.ctaBtn} onClick={() => navigate('/practice')}>
            Start first practice →
          </button>
        </div>
      </div>
    )
  }

  const positions  = scaleNodes(data.nodes)
  const mastered   = data.nodes.filter(n => n.status === 'mastered').length
  const inProgress = data.nodes.filter(n => n.status === 'in_progress').length
  const struggling = data.nodes.filter(n => n.status === 'struggling').length

  return (
    <div className={s.card}>
      <div
        className={s.svgWrap}
        onClick={() => navigate('/knowledge-graph')}
        title="Explore your full constellation"
      >
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className={s.svg}>
          <defs>
            <filter id="cGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.5" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Edges (thin, low opacity) */}
          {data.edges
            .filter(e => e.weight > 0.3)
            .map((edge, i) => {
              const sp = positions.get(edge.from)
              const tp = positions.get(edge.to)
              if (!sp || !tp) return null
              const isNearHovered = hovered === edge.from || hovered === edge.to
              return (
                <line
                  key={i}
                  x1={sp.sx} y1={sp.sy}
                  x2={tp.sx} y2={tp.sy}
                  stroke="rgba(26,26,46,0.13)"
                  strokeWidth={isNearHovered ? 1.5 : 0.75}
                  strokeOpacity={isNearHovered ? 0.45 : 1}
                />
              )
            })}

          {/* Nodes */}
          {data.nodes.map(node => {
            const pos = positions.get(node.id)
            if (!pos) return null
            const r     = 3.5 + Math.min(node.eventCount * 0.9, 6)
            const color = statusColor(node.status)
            const isH   = hovered === node.id

            return (
              <g
                key={node.id}
                transform={`translate(${pos.sx}, ${pos.sy})`}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                {isH && (
                  <circle
                    r={r + 7}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.2"
                    strokeOpacity="0.4"
                  />
                )}
                <circle
                  r={isH ? r + 1.5 : r}
                  fill={color}
                  fillOpacity={node.status === 'untouched' ? 0.22 : 0.85}
                  filter={isH ? 'url(#cGlow)' : undefined}
                  style={{ transition: 'r 0.12s ease' }}
                />
                {node.mastery > 0 && node.status !== 'untouched' && (
                  <circle
                    r={r - 1.5}
                    fill="none"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth="1.5"
                    strokeDasharray={`${node.mastery * 2 * Math.PI * (r - 1.5)} ${2 * Math.PI * (r - 1.5)}`}
                    strokeLinecap="round"
                    transform="rotate(-90)"
                  />
                )}
              </g>
            )
          })}
        </svg>

        <div className={s.svgHint}>Explore full constellation →</div>
      </div>

      <div className={s.stats}>
        <span className={s.statItem} style={{ color: '#58CC02' }}>
          <span className={s.dot} style={{ background: '#58CC02' }} />
          {mastered} mastered
        </span>
        <span className={s.statItem} style={{ color: '#4A7BF7' }}>
          <span className={s.dot} style={{ background: '#4A7BF7' }} />
          {inProgress} in progress
        </span>
        {struggling > 0 && (
          <span className={s.statItem} style={{ color: '#FF4B4B' }}>
            <span className={s.dot} style={{ background: '#FF4B4B' }} />
            {struggling} needs work
          </span>
        )}
        <span className={s.total}>{data.nodes.length} concepts</span>
      </div>
    </div>
  )
}
