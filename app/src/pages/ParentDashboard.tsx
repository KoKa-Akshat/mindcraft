/**
 * ParentDashboard.tsx
 *
 * View for parents (role: 'parent'). Shows:
 *  - Link to child by email (one-time setup)
 *  - Child's current curriculum (active concepts from knowledge graph)
 *  - SVG performance line chart: weekly avg outcome over last 12 weeks
 *  - Top strengths / open gaps from ML profile
 */

import { useEffect, useState, useMemo } from 'react'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useNavigate } from 'react-router-dom'
import {
  doc, getDoc, getDocs, updateDoc,
  collection, query, where, orderBy, limit,
} from 'firebase/firestore'
import { useUser } from '../App'
import { MARKETING_BASE } from '../lib/siteUrls'
import s from './ParentDashboard.module.css'

// ── helpers ──────────────────────────────────────────────────────────────────

function isoWeek(ts: number): string {
  const d = new Date(ts)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function conceptLabel(id: string) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── types ─────────────────────────────────────────────────────────────────────

interface WeekPoint { week: string; avg: number; count: number }

interface GraphNode {
  id: string; name: string; mastery: number
  strengthScore: number; eventCount: number; status: string
}

// ── SVG line chart ────────────────────────────────────────────────────────────

function PerfGraph({ points }: { points: WeekPoint[] }) {
  const W = 560, H = 160, PAD = { t: 16, r: 16, b: 28, l: 36 }
  const inner = { w: W - PAD.l - PAD.r, h: H - PAD.t - PAD.b }

  if (points.length < 2) {
    return (
      <div className={s.graphEmpty}>
        <p>Not enough data yet — performance will chart as your child completes practice.</p>
      </div>
    )
  }

  const vals = points.map(p => p.avg)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo < 0.05 ? 0.2 : hi - lo
  const yOf = (v: number) => PAD.t + inner.h * (1 - (v - lo) / span)
  const xOf = (i: number) => PAD.l + (i / (points.length - 1)) * inner.w

  // smooth bezier path
  const path = points.reduce((acc, p, i) => {
    const x = xOf(i), y = yOf(p.avg)
    if (i === 0) return `M${x},${y}`
    const px = xOf(i - 1), py = yOf(points[i - 1].avg)
    const cx = (px + x) / 2
    return `${acc} C${cx},${py} ${cx},${y} ${x},${y}`
  }, '')

  // fill under the curve
  const fill = `${path} L${xOf(points.length - 1)},${PAD.t + inner.h} L${PAD.l},${PAD.t + inner.h} Z`

  // axis labels: first, middle, last week label
  const labelIdxs = [0, Math.floor((points.length - 1) / 2), points.length - 1]
  const shortWeek = (w: string) => {
    const [, wk] = w.split('-W')
    return `Wk ${wk}`
  }

  // y grid lines at 0%, 50%, 100% of range
  const gridVals = [lo, (lo + hi) / 2, hi]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.graphSvg} aria-label="Performance over time">
      <defs>
        <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--g)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--g)" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* grid */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.l} y1={yOf(v)} x2={PAD.l + inner.w} y2={yOf(v)}
            stroke="rgba(0,0,0,0.06)" strokeWidth="1"
          />
          <text x={PAD.l - 6} y={yOf(v) + 4} textAnchor="end"
            fontSize="9" fill="rgba(0,0,0,0.35)" fontFamily="system-ui">
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}

      {/* fill */}
      <path d={fill} fill="url(#perfGrad)" />

      {/* line */}
      <path d={path} fill="none" stroke="var(--g)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* dots */}
      {points.map((p, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(p.avg)} r="3.5"
          fill="white" stroke="var(--g)" strokeWidth="2" />
      ))}

      {/* x labels */}
      {labelIdxs.map(i => (
        <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
          fontSize="9" fill="rgba(0,0,0,0.4)" fontFamily="system-ui">
          {shortWeek(points[i].week)}
        </text>
      ))}
    </svg>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function ParentDashboard() {
  const user     = useUser()
  const navigate = useNavigate()

  const [childId,    setChildId]    = useState<string | null>(null)
  const [childName,  setChildName]  = useState('')
  const [childExam,  setChildExam]  = useState('')
  const [linkEmail,  setLinkEmail]  = useState('')
  const [linkError,  setLinkError]  = useState('')
  const [linking,    setLinking]    = useState(false)
  const [loading,    setLoading]    = useState(true)

  const [interactions, setInteractions] = useState<{ outcome: number; ts: number }[]>([])
  const [graphNodes,   setGraphNodes]   = useState<GraphNode[]>([])

  // ── load parent doc ──
  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const data = snap.data() ?? {}
      if (data.role !== 'parent') navigate('/dashboard', { replace: true })
      if (data.childId) setChildId(data.childId)
      else setLoading(false)
    })
  }, [user, navigate])

  // ── load child data once linked ──
  useEffect(() => {
    if (!childId) return
    setLoading(true)

    Promise.all([
      getDoc(doc(db, 'users', childId)),
      getDocs(
        query(
          collection(db, 'interactions'),
          where('studentId', '==', childId),
          orderBy('timestamp', 'desc'),
          limit(300),
        ),
      ),
      getDoc(doc(db, 'knowledge_graphs', childId)),
    ]).then(([userSnap, interSnap, graphSnap]) => {
      const ud = userSnap.data() ?? {}
      setChildName(ud.displayName || ud.email?.split('@')[0] || 'Your child')
      setChildExam(ud.examTrack || ud.exam || '')

      setInteractions(
        interSnap.docs.map(d => {
          const data = d.data()
          const ts = data.timestamp?.toMillis?.() ?? data.timestamp ?? 0
          return { outcome: Number(data.outcome ?? 0), ts: Number(ts) }
        }).filter(x => x.ts > 0),
      )

      const gd = graphSnap.data()
      if (gd?.nodes) setGraphNodes(gd.nodes as GraphNode[])
    }).finally(() => setLoading(false))
  }, [childId])

  // ── link child by email ──
  async function handleLink() {
    const email = linkEmail.trim().toLowerCase()
    if (!email) return
    setLinking(true)
    setLinkError('')
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('email', '==', email), limit(1))
      )
      if (snap.empty) {
        setLinkError('No account found with that email. Make sure your child has signed up.')
        return
      }
      const childDoc = snap.docs[0]
      const cid = childDoc.id
      await updateDoc(doc(db, 'users', user.uid), { childId: cid })
      setChildId(cid)
      setLinkEmail('')
    } catch {
      setLinkError('Something went wrong. Try again.')
    } finally {
      setLinking(false)
    }
  }

  // ── compute weekly performance points ──
  const weekPoints = useMemo<WeekPoint[]>(() => {
    if (interactions.length === 0) return []
    const byWeek: Record<string, number[]> = {}
    interactions.forEach(({ outcome, ts }) => {
      const wk = isoWeek(ts)
      if (!byWeek[wk]) byWeek[wk] = []
      // normalize outcome (-1..+1) to (0..1)
      byWeek[wk].push((outcome + 1) / 2)
    })
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([week, vals]) => ({
        week,
        avg: vals.reduce((s, v) => s + v, 0) / vals.length,
        count: vals.length,
      }))
  }, [interactions])

  // ── derive curriculum data ──
  const activeNodes = graphNodes
    .filter(n => n.eventCount > 0)
    .sort((a, b) => b.eventCount - a.eventCount)

  const strengths = graphNodes
    .filter(n => n.strengthScore > 0.1)
    .sort((a, b) => b.strengthScore - a.strengthScore)
    .slice(0, 4)

  const gaps = graphNodes
    .filter(n => n.strengthScore < -0.05 || (n.mastery < 0.4 && n.eventCount > 0))
    .sort((a, b) => a.strengthScore - b.strengthScore)
    .slice(0, 4)

  const avgMastery = activeNodes.length
    ? activeNodes.reduce((s, n) => s + n.mastery, 0) / activeNodes.length
    : null

  const latestWeekAvg = weekPoints.length > 0
    ? weekPoints[weekPoints.length - 1].avg
    : null

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <a href={MARKETING_BASE} className={s.logo}>Mind<span>Craft</span></a>
        <div className={s.navRight}>
          <span className={s.navRole}>Parent</span>
          <div className={s.avatar}
            onClick={() => signOut(auth).then(() => navigate('/login', { replace: true }))}
            title="Sign out">
            {(user.displayName?.[0] || user.email?.[0] || 'P').toUpperCase()}
          </div>
        </div>
      </nav>

      <main className={s.page}>
        {/* ── not linked yet ── */}
        {!childId && !loading && (
          <div className={s.linkCard}>
            <div className={s.linkIcon}>👨‍👩‍👦</div>
            <h2 className={s.linkTitle}>Link your child's account</h2>
            <p className={s.linkSub}>
              Enter the email address your child used to sign up for MindCraft.
              You'll see their curriculum, progress, and weekly performance.
            </p>
            <div className={s.linkRow}>
              <input
                className={s.linkInput}
                type="email"
                placeholder="child@email.com"
                value={linkEmail}
                onChange={e => setLinkEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLink()}
              />
              <button className={s.linkBtn} onClick={handleLink} disabled={linking || !linkEmail.trim()}>
                {linking ? 'Linking…' : 'Link →'}
              </button>
            </div>
            {linkError && <p className={s.linkError}>{linkError}</p>}
          </div>
        )}

        {/* ── loading ── */}
        {loading && (
          <div className={s.spinner}><div className={s.spinnerDot} /></div>
        )}

        {/* ── main content ── */}
        {!loading && childId && (
          <>
            <div className={s.hero}>
              <div>
                <div className={s.heroEyebrow}>Viewing progress for</div>
                <h1 className={s.heroName}>{childName}</h1>
                {childExam && <span className={s.examBadge}>{childExam} track</span>}
              </div>
              <div className={s.heroStats}>
                {avgMastery !== null && (
                  <div className={s.stat}>
                    <span className={s.statNum}>{Math.round(avgMastery * 100)}%</span>
                    <span className={s.statLabel}>Avg Mastery</span>
                  </div>
                )}
                {latestWeekAvg !== null && (
                  <div className={s.stat}>
                    <span className={s.statNum}>{Math.round(latestWeekAvg * 100)}%</span>
                    <span className={s.statLabel}>This Week</span>
                  </div>
                )}
                <div className={s.stat}>
                  <span className={s.statNum}>{activeNodes.length}</span>
                  <span className={s.statLabel}>Concepts Practiced</span>
                </div>
              </div>
            </div>

            <div className={s.grid}>
              {/* Performance graph */}
              <div className={`${s.card} ${s.cardWide}`}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Performance Over Time</span>
                  <span className={s.cardSub}>Weekly avg — higher is better</span>
                </div>
                <PerfGraph points={weekPoints} />
              </div>

              {/* Curriculum — what they're working on */}
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Current Curriculum</span>
                </div>
                {activeNodes.length === 0 ? (
                  <div className={s.emptyState}>
                    <p>No practice data yet. Encourage your child to complete a session.</p>
                  </div>
                ) : (
                  <div className={s.conceptList}>
                    {activeNodes.slice(0, 10).map(n => (
                      <div key={n.id} className={s.conceptRow}>
                        <div className={s.conceptLeft}>
                          <span className={s.conceptName}>{n.name || conceptLabel(n.id)}</span>
                          <span className={`${s.conceptStatus} ${s[`status_${n.status}`]}`}>
                            {n.status === 'mastered' ? 'Mastered' :
                             n.status === 'struggling' ? 'Needs work' :
                             n.status === 'in_progress' ? 'In progress' : 'Started'}
                          </span>
                        </div>
                        <div className={s.masteryBar}>
                          <div
                            className={s.masteryFill}
                            style={{ width: `${Math.round(n.mastery * 100)}%` }}
                          />
                          <span className={s.masteryPct}>{Math.round(n.mastery * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Strengths + Gaps */}
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Strengths</span>
                </div>
                {strengths.length === 0 ? (
                  <div className={s.emptyState}><p>Strengths emerge as your child practices.</p></div>
                ) : (
                  <div className={s.pillList}>
                    {strengths.map(n => (
                      <span key={n.id} className={`${s.pill} ${s.pillGreen}`}>
                        {n.name || conceptLabel(n.id)}
                      </span>
                    ))}
                  </div>
                )}

                <div className={s.divider} />

                <div className={s.cardHeader} style={{ marginTop: 0 }}>
                  <span className={s.cardLabel}>Open Gaps</span>
                </div>
                {gaps.length === 0 ? (
                  <div className={s.emptyState}><p>No significant gaps detected yet.</p></div>
                ) : (
                  <div className={s.pillList}>
                    {gaps.map(n => (
                      <span key={n.id} className={`${s.pill} ${s.pillRed}`}>
                        {n.name || conceptLabel(n.id)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
