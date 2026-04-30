import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import s from './ConstellationCard.module.css'

const ML_API_URL      = import.meta.env.VITE_ML_API_URL ?? ''
const FETCH_TIMEOUT   = 8_000

const SVG_W = 700
const SVG_H = 250
const PAD   = 32

interface MLNode {
  id: string; x: number; y: number
  mastery: number; eventCount: number
  status: 'mastered' | 'struggling' | 'in_progress' | 'untouched'
}
interface MLEdge  { from: string; to: string; weight: number }
interface GraphResp { nodes: MLNode[]; edges: MLEdge[] }

function starColor(status: string) {
  return { mastered: '#A8E063', in_progress: '#60C8FF', struggling: '#FF6B6B', untouched: '#E8E8FF' }[status] ?? '#E8E8FF'
}

function scaleNodes(nodes: MLNode[]) {
  const m = new Map<string, { sx: number; sy: number }>()
  if (!nodes.length) return m
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y
  }
  const pw = SVG_W - PAD * 2, ph = SVG_H - PAD * 2
  const rx = maxX - minX || 1, ry = maxY - minY || 1
  for (const n of nodes)
    m.set(n.id, { sx: PAD + ((n.x - minX) / rx) * pw, sy: PAD + ((n.y - minY) / ry) * ph })
  return m
}

// Deterministic star field — computed once
const BG_STARS = Array.from({ length: 70 }, (_, i) => ({
  x: ((i * 173.7 + 23) % SVG_W),
  y: ((i * 91.3  + 47) % SVG_H),
  r: i % 5 === 0 ? 1.3 : i % 3 === 0 ? 1.0 : 0.65,
  opacity: 0.20 + (i % 5) * 0.12,
  twinkle: i % 6 === 0,
  delay: (i % 4) * 0.8,
}))

export default function ConstellationCard({ userId }: { userId: string }) {
  const navigate  = useNavigate()
  const [data,     setData]     = useState<GraphResp | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [timedOut, setTimedOut] = useState(false)
  const [hovered,  setHovered]  = useState<string | null>(null)

  function load() {
    if (!userId || !ML_API_URL) { setLoading(false); return }
    setLoading(true); setTimedOut(false)
    const ctrl  = new AbortController()
    const timer = setTimeout(() => { ctrl.abort(); setTimedOut(true); setLoading(false) }, FETCH_TIMEOUT)
    fetch(`${ML_API_URL}/knowledge-graph/${userId}`, { signal: ctrl.signal })
      .then(r  => r.ok ? r.json() : null)
      .then(d  => { clearTimeout(timer); setData(d); setLoading(false) })
      .catch(e => { clearTimeout(timer); if (e.name !== 'AbortError') setLoading(false) })
  }

  useEffect(() => { load() }, [userId])

  if (loading) return (
    <div className={s.card}>
      <div className={s.loadRow}><div className={s.spinner} /><span>Mapping your constellation…</span></div>
    </div>
  )

  if (timedOut) return (
    <div className={s.card}>
      <div className={s.empty}>
        <div className={s.emptyOrb}>✦</div>
        <p className={s.emptyTitle}>Constellation warming up…</p>
        <p className={s.emptySub}>The knowledge engine is starting — usually under 30s on first load.</p>
        <button className={s.ctaBtn} onClick={load}>Retry →</button>
      </div>
    </div>
  )

  if (!data || data.nodes.length === 0) return (
    <div className={s.card}>
      <div className={s.empty}>
        <div className={s.emptyOrb}>✦</div>
        <p className={s.emptyTitle}>Your constellation awaits</p>
        <p className={s.emptySub}>Complete a practice session to start mapping your knowledge</p>
        <button className={s.ctaBtn} onClick={() => navigate('/practice')}>Start first practice →</button>
      </div>
    </div>
  )

  const positions  = scaleNodes(data.nodes)
  const mastered   = data.nodes.filter(n => n.status === 'mastered').length
  const inProgress = data.nodes.filter(n => n.status === 'in_progress').length
  const struggling = data.nodes.filter(n => n.status === 'struggling').length

  return (
    <div className={s.card}>
      <div className={s.svgWrap} onClick={() => navigate('/knowledge-graph')} title="Explore full constellation">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className={s.svg}>
          <defs>
            {/* Bloom filter stack */}
            <filter id="bloom4"  x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="4"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="bloom10" x="-250%" y="-250%" width="600%" height="600%">
              <feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="bloom20" x="-350%" y="-350%" width="800%" height="800%">
              <feGaussianBlur stdDeviation="20" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Space background */}
          <rect width={SVG_W} height={SVG_H} fill="#04090F" />

          {/* Background star field */}
          {BG_STARS.map((star, i) => (
            <g key={i}>
              <circle cx={star.x} cy={star.y} r={star.r * 2.5} fill="#FFFFFF"
                opacity={star.opacity * 0.15} filter="url(#bloom4)" />
              <circle cx={star.x} cy={star.y} r={star.r} fill="#FFFFFF"
                opacity={star.opacity}
                className={star.twinkle ? s.twinkleStar : undefined}
                style={star.twinkle ? { animationDelay: `${star.delay}s` } : undefined} />
            </g>
          ))}

          {/* Constellation lines */}
          {data.edges.filter(e => e.weight > 0.3).map((edge, i) => {
            const sp = positions.get(edge.from), tp = positions.get(edge.to)
            if (!sp || !tp) return null
            const lit = hovered === edge.from || hovered === edge.to
            return (
              <line key={i}
                x1={sp.sx} y1={sp.sy} x2={tp.sx} y2={tp.sy}
                stroke={lit ? '#60C8FF' : '#3A8CA0'}
                strokeWidth={lit ? 1.2 : 0.7}
                strokeOpacity={lit ? 0.60 : 0.22}
                strokeDasharray="5 5"
              />
            )
          })}

          {/* Stars — render untouched first, mastered on top */}
          {[...data.nodes].sort((a, b) => {
            const o = { untouched: 0, struggling: 1, in_progress: 2, mastered: 3 }
            return (o[a.status] ?? 0) - (o[b.status] ?? 0)
          }).map(node => {
            const pos  = positions.get(node.id)
            if (!pos) return null
            const r    = 3.5 + Math.min(node.eventCount * 0.8, 5.5)
            const col  = starColor(node.status)
            const isH  = hovered === node.id
            const bright = node.status === 'mastered' || node.status === 'in_progress'

            return (
              <g key={node.id}
                transform={`translate(${pos.sx},${pos.sy})`}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer ambient glow — very wide */}
                <circle r={r * 4.5} fill={col} opacity={isH ? 0.18 : 0.10} filter="url(#bloom20)" />
                {/* Mid bloom */}
                <circle r={r * 2.2} fill={col} opacity={isH ? 0.45 : 0.30} filter="url(#bloom10)" />
                {/* Inner halo */}
                <circle r={r * 1.3} fill={col} opacity={0.70} filter="url(#bloom4)" />
                {/* Colored star body */}
                <circle r={r} fill={col} opacity={0.90} />
                {/* Bright white core */}
                <circle r={r * 0.42} fill="#FFFFFF" opacity={0.96} />

                {/* Diffraction spikes for bright/hovered stars */}
                {(bright || isH) && (
                  <g opacity={isH ? 0.45 : 0.22} stroke="#FFFFFF" strokeWidth={0.7}>
                    <line x1={-(r + 14)} y1={0} x2={(r + 14)} y2={0} />
                    <line x1={0} y1={-(r + 14)} x2={0} y2={(r + 14)} />
                  </g>
                )}
              </g>
            )
          })}
        </svg>
        <div className={s.svgHint}>Explore full constellation →</div>
      </div>

      <div className={s.stats}>
        <span className={s.statItem} style={{ color: '#A8E063' }}>
          <span className={s.dot} style={{ background: '#A8E063', boxShadow: '0 0 6px #A8E063' }} />
          {mastered} mastered
        </span>
        <span className={s.statItem} style={{ color: '#60C8FF' }}>
          <span className={s.dot} style={{ background: '#60C8FF', boxShadow: '0 0 6px #60C8FF' }} />
          {inProgress} in progress
        </span>
        {struggling > 0 && (
          <span className={s.statItem} style={{ color: '#FF6B6B' }}>
            <span className={s.dot} style={{ background: '#FF6B6B', boxShadow: '0 0 6px #FF6B6B' }} />
            {struggling} needs work
          </span>
        )}
        <span className={s.total}>{data.nodes.length} concepts mapped</span>
      </div>
    </div>
  )
}
