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
    case 'mastered':    return '#A8E063'
    case 'in_progress': return '#5B9BD5'
    case 'struggling':  return '#FF6B6B'
    default:            return '#FFFFFF'
  }
}

function glowColor(status: string): string {
  switch (status) {
    case 'mastered':    return 'rgba(168,224,99,0.55)'
    case 'in_progress': return 'rgba(91,155,213,0.50)'
    case 'struggling':  return 'rgba(255,107,107,0.55)'
    default:            return 'rgba(255,230,109,0.40)'  // golden for untouched
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

// Deterministic background star field — computed once
const BG_STARS = Array.from({ length: 55 }, (_, i) => ({
  x:       ((i * 157.3 + 17) % SVG_W),
  y:       ((i * 89.7  + 43) % SVG_H),
  r:       i % 4 === 0 ? 1.2 : 0.75,
  opacity: 0.06 + (i % 4) * 0.04,
  twinkle: i % 7 === 0,
}))

const FETCH_TIMEOUT_MS = 8_000

export default function ConstellationCard({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [data,    setData]    = useState<GraphResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [timedOut, setTimedOut] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  function load() {
    if (!userId || !ML_API_URL) { setLoading(false); return }
    setLoading(true)
    setTimedOut(false)

    const ctrl    = new AbortController()
    const timer   = setTimeout(() => { ctrl.abort(); setTimedOut(true); setLoading(false) }, FETCH_TIMEOUT_MS)

    fetch(`${ML_API_URL}/knowledge-graph/${userId}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d  => { clearTimeout(timer); setData(d); setLoading(false) })
      .catch(err => { clearTimeout(timer); if (err.name !== 'AbortError') setLoading(false) })
  }

  useEffect(() => { load() }, [userId])

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

  if (timedOut) {
    return (
      <div className={s.card}>
        <div className={s.empty}>
          <div className={s.emptyOrb}>✦</div>
          <p className={s.emptyTitle}>Constellation warming up…</p>
          <p className={s.emptySub}>
            The knowledge engine is starting up. Usually takes under 30 seconds on first load.
          </p>
          <button className={s.ctaBtn} onClick={load}>Retry →</button>
        </div>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className={s.card}>
        <div className={s.empty}>
          <div className={s.emptyOrb}>✦</div>
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
            <filter id="cGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background star field */}
          {BG_STARS.map((star, i) => (
            <circle
              key={i}
              cx={star.x} cy={star.y} r={star.r}
              fill="#FFFFFF"
              opacity={star.opacity}
              className={star.twinkle ? s.twinkleStar : undefined}
            />
          ))}

          {/* Constellation lines */}
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
                  stroke="#5AA5AF"
                  strokeWidth={isNearHovered ? 1.5 : 1}
                  strokeOpacity={isNearHovered ? 0.60 : 0.30}
                  strokeDasharray="4 4"
                  style={isNearHovered ? { filter: 'drop-shadow(0 0 3px rgba(90,165,175,0.5))' } : undefined}
                />
              )
            })}

          {/* Stars / nodes */}
          {data.nodes.map(node => {
            const pos   = positions.get(node.id)
            if (!pos) return null
            const r     = 4 + Math.min(node.eventCount * 0.7, 5)
            const color = statusColor(node.status)
            const glow  = glowColor(node.status)
            const isH   = hovered === node.id

            return (
              <g
                key={node.id}
                transform={`translate(${pos.sx}, ${pos.sy})`}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow layer (blurred copy behind) */}
                <circle
                  r={isH ? r + 8 : r + 4}
                  fill={glow}
                  style={{ filter: 'blur(5px)' }}
                />

                {/* Star core */}
                <circle
                  r={isH ? r + 1.5 : r}
                  fill={color}
                  className={node.status === 'untouched' ? s.twinkleStar : undefined}
                  style={{ transition: 'r 0.12s ease' }}
                />

                {/* Mastery ring */}
                {node.mastery > 0 && node.status !== 'untouched' && (
                  <circle
                    r={r + 3}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.2"
                    strokeOpacity="0.5"
                    strokeDasharray={`${node.mastery * 2 * Math.PI * (r + 3)} ${2 * Math.PI * (r + 3)}`}
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
        <span className={s.statItem} style={{ color: '#A8E063' }}>
          <span className={s.dot} style={{ background: '#A8E063' }} />
          {mastered} mastered
        </span>
        <span className={s.statItem} style={{ color: '#5B9BD5' }}>
          <span className={s.dot} style={{ background: '#5B9BD5' }} />
          {inProgress} in progress
        </span>
        {struggling > 0 && (
          <span className={s.statItem} style={{ color: '#FF6B6B' }}>
            <span className={s.dot} style={{ background: '#FF6B6B' }} />
            {struggling} needs work
          </span>
        )}
        <span className={s.total}>{data.nodes.length} concepts</span>
      </div>
    </div>
  )
}
