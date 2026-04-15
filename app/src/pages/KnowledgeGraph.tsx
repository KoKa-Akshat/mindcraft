/**
 * KnowledgeGraph.tsx
 *
 * Interactive concept knowledge graph. Given a concept name (from URL param
 * or search), fetches the student's personalized subgraph and renders it as
 * an SVG force-like radial layout.
 *
 * - Center node = queried concept
 * - Ring 1 (radius 165px) = direct connections (session + ontology)
 * - Ring 2 (radius 310px) = second-degree connections
 * - Click a node → session detail panel slides in from right
 * - JARVIS mic button to speak a concept name
 * - Exam prep shortcut chips
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut }      from 'firebase/auth'
import { auth, db }     from '../firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { useNavigate, useParams } from 'react-router-dom'
import { useUser }      from '../App'
import { logEvent }     from '../lib/logEvent'
import Navbar           from '../components/Navbar'
import Sidebar          from '../components/Sidebar'
import s                from './KnowledgeGraph.module.css'

const GRAPH_URL = 'https://mindcraft-webhook.vercel.app/api/concept-graph'

const CX = 440
const CY = 290
const R1 = 165
const R2 = 308

interface GraphNode {
  id:             string
  name:           string
  level:          0 | 1 | 2
  hasSession:     boolean
  sessionIds:     string[]
  mastery:        number
  sessionTitle?:  string
  sessionBullets?: string[]
  sessionDate?:   string
  sessionSubject?: string
}

interface GraphEdge {
  source: string
  target: string
  weight: number
  type:   'session' | 'ontology' | 'both'
}

function radialPos(i: number, total: number, radius: number, angleOffset = -Math.PI / 2) {
  const angle = angleOffset + (2 * Math.PI * i) / total
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) }
}

function nodeColor(node: GraphNode): string {
  if (node.level === 0) return '#00d2c8'
  if (node.hasSession) return `rgba(0,210,200,${0.9 - node.level * 0.2})`
  return 'rgba(0,210,200,0.28)'
}

function edgeColor(edge: GraphEdge): string {
  if (edge.type === 'both') return `rgba(0,210,200,${edge.weight * 0.7})`
  if (edge.type === 'session') return `rgba(0,210,200,${edge.weight * 0.6})`
  return `rgba(0,210,200,${edge.weight * 0.3})`
}

const EXAM_CONCEPTS = ['Logarithms', 'Derivatives', 'Calculus 1', 'Algebra', 'Exponents', 'Integrals']

const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

export default function KnowledgeGraph() {
  const user      = useUser()
  const navigate  = useNavigate()
  const { concept: urlConcept } = useParams<{ concept?: string }>()

  const [search,   setSearch]   = useState(urlConcept ? decodeURIComponent(urlConcept) : '')
  const [nodes,    setNodes]    = useState<GraphNode[]>([])
  const [edges,    setEdges]    = useState<GraphEdge[]>([])
  const [loading,  setLoading]  = useState(false)
  const [concept,  setConcept]  = useState(urlConcept ? decodeURIComponent(urlConcept) : '')
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [hovered,  setHovered]  = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [error,    setError]    = useState('')
  const recogRef = useRef<any>(null)

  // Node positions (computed once per graph)
  const posMap = useRef<Record<string, { x: number; y: number }>>({})

  function computePositions(ns: GraphNode[]) {
    const pm: Record<string, { x: number; y: number }> = {}
    const l1 = ns.filter(n => n.level === 1)
    const l2 = ns.filter(n => n.level === 2)
    ns.filter(n => n.level === 0).forEach(n => { pm[n.name] = { x: CX, y: CY } })
    l1.forEach((n, i) => { pm[n.name] = radialPos(i, l1.length, R1) })
    l2.forEach((n, i) => { pm[n.name] = radialPos(i, l2.length, R2) })
    posMap.current = pm
  }

  async function fetchGraph(conceptName: string) {
    if (!conceptName.trim() || !user?.email) return
    setLoading(true)
    setError('')
    setSelected(null)
    try {
      const res = await fetch(GRAPH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ concept: conceptName.trim(), studentEmail: user.email }),
      })
      const data = await res.json()
      if (data.nodes) {
        computePositions(data.nodes)
        setNodes(data.nodes)
        setEdges(data.edges)
        setConcept(data.concept)
        navigate(`/knowledge-graph/${encodeURIComponent(data.concept)}`, { replace: true })
        logEvent(user?.uid, 'graph_search', { concept: data.concept, nodeCount: data.nodes.length, edgeCount: data.edges.length })
      } else {
        setError('No graph found for that concept.')
      }
    } catch {
      setError('Could not reach graph server.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch if URL has concept
  useEffect(() => {
    if (urlConcept && user?.email) fetchGraph(decodeURIComponent(urlConcept))
  }, [user?.email])

  function startListening() {
    if (!SR) return
    if (listening) { recogRef.current?.stop(); setListening(false); return }
    setListening(true)
    const r = new SR()
    recogRef.current = r
    r.lang = 'en-US'; r.continuous = false; r.interimResults = false
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript
      setSearch(t)
      setListening(false)
      fetchGraph(t)
    }
    r.onerror  = () => setListening(false)
    r.onend    = () => setListening(false)
    r.start()
  }

  // Find session detail for selected node (fetch from Firestore if needed)
  async function openNode(node: GraphNode) {
    setSelected(node)
    logEvent(user?.uid, 'graph_node_click', { node: node.name, level: node.level, hasSession: node.hasSession, mastery: node.mastery })
    if (node.sessionTitle) return  // already have it

    if (node.sessionIds.length === 0) return
    // Fetch session from Firestore
    try {
      const snap = await getDocs(query(
        collection(db, 'sessions'),
        where('studentEmail', '==', user?.email ?? ''),
      ))
      const match = snap.docs.find(d => node.sessionIds.includes(d.id))
      if (match) {
        const data = match.data()
        setSelected({ ...node, sessionTitle: data.summary?.title, sessionBullets: data.summary?.bullets, sessionDate: data.summary?.date, sessionSubject: data.subject })
      }
    } catch { /* ignore */ }
  }

  const masterySessions = nodes.filter(n => n.hasSession).length
  const totalNodes = nodes.length

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
            {concept && <span className={s.conceptBadge}>{concept}</span>}
          </div>
        </div>

        {/* ── Search / exam prep ── */}
        <div className={s.searchRow}>
          <form className={s.searchForm} onSubmit={e => { e.preventDefault(); fetchGraph(search) }}>
            <div className={s.searchWrap}>
              <svg className={s.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                className={s.searchInput}
                placeholder="Search a concept — e.g. Logarithms, Derivatives, Algebra…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button
                type="button"
                className={`${s.micBtn} ${listening ? s.micActive : ''}`}
                onClick={startListening}
                title="Speak a concept"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>
            </div>
            <button type="submit" className={s.searchBtn} disabled={!search.trim() || loading}>
              {loading ? 'Building…' : 'Explore →'}
            </button>
          </form>

          {/* Exam-prep chips */}
          <div className={s.examChips}>
            <span className={s.examLabel}>Quick explore:</span>
            {EXAM_CONCEPTS.map(c => (
              <button key={c} className={s.examChip} onClick={() => { setSearch(c); fetchGraph(c) }}>{c}</button>
            ))}
          </div>
        </div>

        {error && <div className={s.error}>{error}</div>}

        {/* ── Main area ── */}
        <div className={s.graphArea}>

          {/* SVG Canvas */}
          <div className={s.svgWrap}>
            {nodes.length === 0 && !loading && (
              <div className={s.emptyState}>
                <div className={s.emptyOrb}>
                  <div className={s.emptyRing} />
                  <span className={s.emptyJ}>J</span>
                </div>
                <p className={s.emptyText}>Search a concept above to explore your knowledge graph</p>
                <p className={s.emptySub}>JARVIS will map how your sessions connect</p>
              </div>
            )}

            {loading && (
              <div className={s.emptyState}>
                <div className={s.loadingOrb}>
                  <div className={s.loadRing} />
                  <div className={s.loadRing2} />
                  <span className={s.emptyJ}>J</span>
                </div>
                <p className={s.emptyText}>Building your knowledge graph…</p>
              </div>
            )}

            {nodes.length > 0 && !loading && (
              <svg
                viewBox={`0 0 ${CX * 2} ${CY * 2}`}
                className={s.svg}
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Glow filter for nodes */}
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <filter id="glowStrong" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="8" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  {/* Radial gradient for nodes */}
                  <radialGradient id="nodeGrad0" cx="40%" cy="35%">
                    <stop offset="0%" stopColor="#00f5e8"/>
                    <stop offset="100%" stopColor="#008a83"/>
                  </radialGradient>
                  <radialGradient id="nodeGradHas" cx="40%" cy="35%">
                    <stop offset="0%" stopColor="#00d2c8"/>
                    <stop offset="100%" stopColor="#006b66"/>
                  </radialGradient>
                  <radialGradient id="nodeGradNo" cx="40%" cy="35%">
                    <stop offset="0%" stopColor="rgba(0,210,200,0.5)"/>
                    <stop offset="100%" stopColor="rgba(0,80,80,0.3)"/>
                  </radialGradient>
                </defs>

                {/* Edges — draw first (behind nodes) */}
                {edges.map((edge, i) => {
                  const sp = posMap.current[edge.source]
                  const tp = posMap.current[edge.target]
                  if (!sp || !tp) return null
                  const isHighlighted = hovered === edge.source || hovered === edge.target
                  const strokeWidth = edge.type === 'both' ? 2 : edge.type === 'session' ? 1.5 : 1
                  const opacity = isHighlighted ? Math.max(edge.weight, 0.6) : edge.weight * 0.4 + 0.1
                  // Curved path: pull midpoint slightly toward center
                  const mx = (sp.x + tp.x) / 2 + (CX - (sp.x + tp.x) / 2) * 0.15
                  const my = (sp.y + tp.y) / 2 + (CY - (sp.y + tp.y) / 2) * 0.15
                  return (
                    <path
                      key={i}
                      d={`M ${sp.x} ${sp.y} Q ${mx} ${my} ${tp.x} ${tp.y}`}
                      stroke={edgeColor(edge)}
                      strokeWidth={isHighlighted ? strokeWidth * 2 : strokeWidth}
                      strokeOpacity={opacity}
                      fill="none"
                      strokeLinecap="round"
                    />
                  )
                })}

                {/* Nodes */}
                {nodes.map(node => {
                  const pos = posMap.current[node.name]
                  if (!pos) return null
                  const r = node.level === 0 ? 42 : node.level === 1 ? 32 : 24
                  const isHovered  = hovered  === node.name
                  const isSelected = selected?.name === node.name
                  const fillId = node.level === 0 ? 'url(#nodeGrad0)' : node.hasSession ? 'url(#nodeGradHas)' : 'url(#nodeGradNo)'

                  return (
                    <g key={node.name}
                      className={s.nodeG}
                      transform={`translate(${pos.x},${pos.y})`}
                      onClick={() => openNode(node)}
                      onMouseEnter={() => setHovered(node.name)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {/* Outer glow ring */}
                      {(isHovered || isSelected || node.level === 0) && (
                        <circle r={r + 8} fill="none"
                          stroke={node.level === 0 ? '#00f5e8' : '#00d2c8'}
                          strokeWidth="1"
                          strokeOpacity={isSelected ? 0.8 : 0.4}
                          filter="url(#glow)"
                        />
                      )}

                      {/* Main circle */}
                      <circle r={isHovered || isSelected ? r + 3 : r}
                        fill={fillId}
                        stroke={node.level === 0 ? '#00f5e8' : node.hasSession ? '#00d2c8' : 'rgba(0,210,200,0.35)'}
                        strokeWidth={node.level === 0 ? 2 : isSelected ? 2 : 1}
                        filter={node.level === 0 || isHovered ? 'url(#glowStrong)' : isSelected ? 'url(#glow)' : undefined}
                        style={{ transition: 'r .15s' }}
                      />

                      {/* Mastery arc for level 1 nodes with sessions */}
                      {node.hasSession && node.level === 1 && node.mastery > 0 && (
                        <circle r={r - 6}
                          fill="none"
                          stroke="#00f5e8"
                          strokeWidth="3"
                          strokeDasharray={`${node.mastery * 2 * Math.PI * (r - 6)} ${2 * Math.PI * (r - 6)}`}
                          strokeLinecap="round"
                          strokeOpacity="0.7"
                          transform={`rotate(-90)`}
                        />
                      )}

                      {/* Label */}
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={node.level === 0 ? 11 : node.level === 1 ? 9 : 8}
                        fontWeight={node.level === 0 ? '900' : '700'}
                        fill={node.level === 0 ? '#00f5e8' : node.hasSession ? '#00d2c8' : 'rgba(0,210,200,0.55)'}
                        style={{ fontFamily: 'var(--f)', userSelect: 'none' }}
                      >
                        {node.name.length > 12 ? node.name.slice(0, 11) + '…' : node.name}
                      </text>

                      {/* Session dot */}
                      {node.hasSession && node.level > 0 && (
                        <circle cx={r - 5} cy={-(r - 5)} r={4}
                          fill="#58CC02"
                          stroke="#fff"
                          strokeWidth="1"
                          filter="url(#glow)"
                        />
                      )}
                    </g>
                  )
                })}
              </svg>
            )}
          </div>

          {/* ── Session Detail Panel ── */}
          {selected && (
            <div className={s.detailPanel}>
              <button className={s.closePanel} onClick={() => setSelected(null)}>✕</button>

              <div className={s.detailBadge} style={{ opacity: selected.hasSession ? 1 : 0.5 }}>
                {selected.hasSession
                  ? <><span className={s.dotGreen} />Session covered</>
                  : <><span className={s.dotDim} />Not yet studied</>
                }
              </div>

              <h2 className={s.detailTitle}>{selected.name}</h2>

              {selected.hasSession && selected.sessionTitle ? (
                <>
                  <div className={s.detailMeta}>
                    <span>{selected.sessionSubject}</span>
                    {selected.sessionDate && <span>{selected.sessionDate}</span>}
                  </div>
                  <p className={s.detailSessionTitle}>{selected.sessionTitle}</p>
                  <ul className={s.detailBullets}>
                    {(selected.sessionBullets ?? []).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  {selected.sessionIds[0] && (
                    <button
                      className={s.viewSessionBtn}
                      onClick={() => navigate(`/tutor/session/${selected.sessionIds[0]}`)}
                    >
                      View Full Session →
                    </button>
                  )}
                </>
              ) : selected.hasSession ? (
                <p className={s.detailLoading}>Loading session details…</p>
              ) : (
                <>
                  <p className={s.notStudied}>You haven't covered this concept in a session yet.</p>
                  <button className={s.bookBtn} onClick={() => navigate('/book')}>
                    Book a Session on {selected.name} →
                  </button>
                </>
              )}

              {/* Mastery indicator */}
              {selected.hasSession && (
                <div className={s.masteryRow}>
                  <span className={s.masteryLabel}>Mastery</span>
                  <div className={s.masteryBar}>
                    <div className={s.masteryFill} style={{ width: `${selected.mastery * 100}%` }} />
                  </div>
                  <span className={s.masteryPct}>{Math.round(selected.mastery * 100)}%</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Coverage bar ── */}
        {nodes.length > 0 && (
          <div className={s.coverage}>
            <span className={s.coverageLabel}>Coverage</span>
            <div className={s.coverageBar}>
              <div className={s.coverageFill} style={{ width: `${(masterySessions / Math.max(totalNodes, 1)) * 100}%` }} />
            </div>
            <span className={s.coverageTxt}>{masterySessions} of {totalNodes} concepts studied</span>
          </div>
        )}
      </main>
    </div>
  )
}
