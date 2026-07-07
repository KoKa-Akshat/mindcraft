/**
 * ParentDashboard.tsx
 *
 * View for parents (role: 'parent'). Shows:
 *  - Link to child by email (one-time setup)
 *  - "This week" hero with stat pills (avg mastery / week avg / concepts)
 *  - What they're working on (top active concepts, horizontal pills)
 *  - Strengths + open gaps
 *  - Assigned tutor card + weekly digest callout
 */

import { useEffect, useState, useMemo } from 'react'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useNavigate, Link } from 'react-router-dom'
import {
  doc, getDoc, getDocs,
  collection, query, where, orderBy, limit,
} from 'firebase/firestore'
import { useUser } from '../App'
import { WEBHOOK_BASE } from '../lib/mlApi'
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

// Test account — digest / dashboard content disabled
const TEST_UID = 'gBFn9vUGIIa7tAiTTQSl8CbPSao2'

// ── types ─────────────────────────────────────────────────────────────────────

interface WeekPoint { week: string; avg: number; count: number }

interface GraphNode {
  id: string; name: string; mastery: number
  strengthScore: number; eventCount: number; status: string
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
  const [tutorName,    setTutorName]    = useState<string | null>(null)
  const [tutorEmail,   setTutorEmail]   = useState<string | null>(null)
  const [isAdmin,      setIsAdmin]      = useState(false)

  // ── load parent doc ──
  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const data = snap.data() ?? {}
      if (data.role !== 'parent' && data.role !== 'admin') navigate('/dashboard', { replace: true })
      if (data.role === 'admin') setIsAdmin(true)
      if (data.childId) setChildId(data.childId)
      else setLoading(false)
    })
  }, [user, navigate])

  // ── load child data once linked ──
  useEffect(() => {
    if (!childId) return
    if (childId === TEST_UID) { setLoading(false); return }
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
      getDocs(
        query(
          collection(db, 'sessions'),
          where('studentId', '==', childId),
          orderBy('scheduledAt', 'desc'),
          limit(1),
        ),
      ).catch(() => null),
    ]).then(([userSnap, interSnap, graphSnap, sessSnap]) => {
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

      // Latest session → assigned tutor (name + email via users/{tutorId})
      if (sessSnap && !sessSnap.empty) {
        const sd = sessSnap.docs[0].data()
        if (sd.tutorName) setTutorName(sd.tutorName)
        if (sd.tutorId) {
          getDoc(doc(db, 'users', sd.tutorId)).then(ts => {
            const td = ts.data()
            if (td?.email) setTutorEmail(td.email)
            if (!sd.tutorName && td?.displayName) setTutorName(td.displayName)
          }).catch(() => {})
        }
      }
    }).finally(() => setLoading(false))
  }, [childId])

  // ── link child by email ──
  async function handleLink() {
    const email = linkEmail.trim().toLowerCase()
    if (!email) return
    setLinking(true)
    setLinkError('')
    try {
      const token = await auth.currentUser?.getIdToken(true)
      if (!token) {
        setLinkError('Please sign in again.')
        return
      }
      const res = await fetch(`${WEBHOOK_BASE}/api/link-child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ childEmail: email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLinkError(data.error ?? 'Something went wrong. Try again.')
        return
      }
      setChildId(data.childId)
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
          {isAdmin && (
            <Link to="/admin" className={s.navRole} style={{ textDecoration: 'none' }}>
              Admin Panel
            </Link>
          )}
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

        {/* ── test account ── */}
        {!loading && childId === TEST_UID && (
          <div className={s.testBanner}>Test account — digest not available.</div>
        )}

        {/* ── main content ── */}
        {!loading && childId && childId !== TEST_UID && (
          <>
            {/* Hero — this week at a glance */}
            <div className={s.hero}>
              <div className={s.heroTop}>
                <h1 className={s.heroName}>This week for {childName}</h1>
                {childExam && <span className={s.examBadge}>{childExam} track</span>}
              </div>
              <div className={s.heroStats}>
                {avgMastery !== null && (
                  <div className={s.statPill}>
                    <span className={s.statNum}>{Math.round(avgMastery * 100)}%</span>
                    <span className={s.statLabel}>Avg Mastery</span>
                  </div>
                )}
                {latestWeekAvg !== null && (
                  <div className={s.statPill}>
                    <span className={s.statNum}>{Math.round(latestWeekAvg * 100)}%</span>
                    <span className={s.statLabel}>This Week</span>
                  </div>
                )}
                <div className={s.statPill}>
                  <span className={s.statNum}>{activeNodes.length}</span>
                  <span className={s.statLabel}>Concepts Practiced</span>
                </div>
              </div>
            </div>

            {/* What they're working on */}
            <div className={s.workSection}>
              <div className={s.sectionLabel}>What they're working on</div>
              {activeNodes.length === 0 ? (
                <div className={s.emptyState}>
                  <p>No practice data yet. Encourage your child to complete a session.</p>
                </div>
              ) : (
                <div className={s.workScroll}>
                  {activeNodes.slice(0, 5).map(n => (
                    <div key={n.id} className={s.workPill}>
                      <span className={s.workName}>{n.name || conceptLabel(n.id)}</span>
                      <div className={s.workBar}>
                        <div
                          className={s.workFill}
                          style={{ width: `${Math.round(n.mastery * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strengths | Open Gaps */}
            <div className={s.grid}>
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
              </div>

              <div className={s.card}>
                <div className={s.cardHeader}>
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

            {/* Your tutor */}
            <div className={`${s.card} ${s.tutorCard}`}>
              <div className={s.cardHeader}>
                <span className={s.cardLabel}>Your tutor</span>
              </div>
              {tutorName ? (
                <div className={s.tutorRow}>
                  <div className={s.tutorAvatar}>{tutorName[0]?.toUpperCase()}</div>
                  <div>
                    <div className={s.tutorName}>{tutorName}</div>
                    {tutorEmail && (
                      <a
                        className={s.tutorMail}
                        href={`mailto:${tutorEmail}?subject=${encodeURIComponent(`About ${childName}`)}`}
                      >
                        Message tutor
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className={s.emptyState}><p>A tutor will be assigned soon.</p></div>
              )}
            </div>

            {/* Weekly digest callout */}
            <div className={s.digestCallout}>
              You'll receive a weekly progress summary every Sunday. No need to check in
              here — it comes to you.
            </div>
          </>
        )}
      </main>
    </div>
  )
}
