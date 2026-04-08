import { useEffect, useState, useRef } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate, Link } from 'react-router-dom'
import {
  collection, query, where, orderBy, onSnapshot, getDocs,
  doc, getDoc, limit,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import s from './TutorDashboard.module.css'

interface Session {
  id: string
  studentName: string
  studentEmail: string
  studentId: string | null
  subject: string
  date: string
  scheduledAt: number
  endAt: number
  duration: string
  status: 'scheduled' | 'completed' | 'cancelled'
  meetingUrl: string | null
  summaryStatus?: 'pending' | 'draft' | 'published'
}

interface Student {
  id: string
  displayName: string
  email: string
  lastSession?: { title?: string; subject?: string; date?: string; bullets?: string[] }
  messages?: { name: string; initial: string; isTutor: boolean; text: string; time: string }[]
}

function fmt(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    + ' · ' + new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function timeUntil(ms: number) {
  const diff = ms - Date.now()
  if (diff < 0) return 'Now'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `in ${Math.floor(h / 24)}d`
  if (h > 0) return `in ${h}h ${m}m`
  return `in ${m}m`
}

const FIFTEEN_MIN = 15 * 60 * 1000

export default function TutorDashboard() {
  const user = useUser()
  const navigate = useNavigate()

  const [sessions, setSessions]         = useState<Session[]>([])
  const [toReview, setToReview]         = useState<Session[]>([])
  const [students, setStudents]         = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [uploading, setUploading]       = useState(false)
  const [toast, setToast]               = useState('')
  const [loading, setLoading]           = useState(true)
  const [calendlyConnected, setCalendlyConnected] = useState<string | null>(null)
  const [calendlyToken, setCalendlyToken] = useState('')
  const [connectingCalendly, setConnectingCalendly] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const data = snap.data()
      if (data?.role !== 'tutor' && data?.role !== 'admin') navigate('/dashboard', { replace: true })
      if (data?.calendlyEmail) setCalendlyConnected(data.calendlyEmail)
    })
  }, [user, navigate])

  async function handleConnectCalendly() {
    if (!calendlyToken.trim()) return
    setConnectingCalendly(true)
    try {
      const res = await fetch('https://mindcraft-webhook.vercel.app/api/register-calendly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorId: user.uid, calendlyToken: calendlyToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCalendlyConnected(data.calendlyEmail)
      setCalendlyToken('')
      showToast('Calendly connected — bookings will now flow automatically')
    } catch (err: any) {
      showToast(err.message ?? 'Failed to connect Calendly')
    } finally {
      setConnectingCalendly(false)
    }
  }

  useEffect(() => {
    // Single query by tutorId only — no composite index needed, filter client-side
    const unsub = onSnapshot(
      query(collection(db, 'sessions'), where('tutorId', '==', user.uid)),
      snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Session, 'id'>) }))
        const now = Date.now()
        const upcoming = all
          .filter(s => s.status === 'scheduled' && s.scheduledAt > now - 15 * 60 * 1000)
          .sort((a, b) => a.scheduledAt - b.scheduledAt)
          .slice(0, 10)
        const completed = all
          .filter(s => s.status === 'completed')
          .sort((a, b) => b.scheduledAt - a.scheduledAt)
          .slice(0, 20)
        setSessions(upcoming)
        setToReview(completed.filter(s => s.summaryStatus !== 'published'))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return () => unsub()
  }, [user])

  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('tutorId', '==', user.uid)))
      .then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
        setStudents(list)
        if (list.length > 0) setSelectedStudent(list[0].id)
      })
      .catch(() => {})
  }, [user])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      showToast(`"${file.name}" attached`)
      e.target.value = ''
    }, 1200)
  }

  const nextSession = sessions[0] ?? null
  const now = Date.now()
  const sessionLive = nextSession &&
    now >= nextSession.scheduledAt - FIFTEEN_MIN &&
    now <= nextSession.endAt + FIFTEEN_MIN
  const canJoin = sessionLive && !!nextSession?.meetingUrl

  const selectedStudentData = students.find(st => st.id === selectedStudent)
  const recentMessages = selectedStudentData?.messages?.slice(-2) ?? []

  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <Link to="/login" className={s.logo}>Mind<span>Craft</span></Link>
        <div className={s.navRight}>
          <span className={s.navRole}>Tutor</span>
          <div className={s.avatar} onClick={() => signOut(auth).then(() => navigate('/login', { replace: true }))}
            title="Sign out">
            {(user.displayName?.[0] || user.email?.[0] || 'T').toUpperCase()}
          </div>
        </div>
      </nav>

      <aside className={s.sidebar}>
        <p className={s.sideLabel}>Manage</p>
        <a href="#" className={`${s.sideItem} ${s.sideActive}`}>
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Sessions
        </a>
        <a href="#" className={s.sideItem}>
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          Students
        </a>
        <div className={s.sideDivider} />
        <p className={s.sideLabel}>Tools</p>
        <a href="#" className={s.sideItem}>
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Documents
        </a>
        <a href="/admin" className={s.sideItem}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          Admin Panel
        </a>
      </aside>

      <main className={s.page}>
        <div className={s.hero}>
          <div className={s.heroLeft}>
            <h1>Welcome back, <em>{user.displayName?.split(' ')[0] || user.email?.split('@')[0]}</em></h1>
            {nextSession ? (
              <div className={s.pill}>
                <div className={s.pillDot} style={sessionLive ? {} : { background: 'var(--bd)', animation: 'none' }} />
                <div className={s.pillText}>
                  {nextSession.subject} · {new Date(nextSession.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  <span> · {nextSession.studentName}</span>
                </div>
              </div>
            ) : (
              <div className={s.pill}>
                <div className={s.pillDot} style={{ background: 'var(--bd)', animation: 'none' }} />
                <div className={s.pillText} style={{ color: 'var(--mu)' }}>No upcoming sessions</div>
              </div>
            )}
            <div className={s.heroBtns}>
              {canJoin
                ? <a href={nextSession!.meetingUrl!} target="_blank" rel="noopener" className={`${s.btnPrimary} ${s.btnLive}`}>Join Session →</a>
                : <button className={s.btnPrimary} disabled>Join Session →</button>
              }
              <button className={s.btnSecondary} onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : '↑ Upload Doc'}
              </button>
              <input ref={fileRef} type="file" style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.txt,.png,.jpg"
                onChange={handleUpload} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <div className={s.grid}>
            <div className={s.col}>
              {/* Sessions to Review */}
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Sessions to Review</span>
                  {toReview.length > 0 && (
                    <span className={s.reviewBadge}>{toReview.length}</span>
                  )}
                </div>
                {toReview.length === 0 ? (
                  <div className={s.emptyState}>
                    <span>All caught up</span>
                    <p>Completed sessions pending your review will appear here.</p>
                  </div>
                ) : (
                  <div className={s.sessionList}>
                    {toReview.slice(0, 5).map(sess => (
                      <Link key={sess.id} to={`/tutor/session/${sess.id}`} className={s.reviewRow}>
                        <div className={s.sessionLeft}>
                          <div className={s.sessionName}>{sess.studentName}</div>
                          <div className={s.sessionMeta}>{sess.subject} · {sess.duration}</div>
                          <div className={s.sessionDate}>{fmt(sess.scheduledAt)}</div>
                        </div>
                        <div className={s.sessionRight}>
                          <span className={`${s.sessionBadge} ${
                            sess.summaryStatus === 'draft' ? s.badgeDraft :
                            sess.summaryStatus === 'pending' ? s.badgePending : s.badgeNeedsReview
                          }`}>
                            {sess.summaryStatus === 'draft' ? 'Draft' :
                             sess.summaryStatus === 'pending' ? 'Has transcript' : 'Needs review'}
                          </span>
                          <span className={s.reviewArrow}>→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Session Summary (existing) */}
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Session Summary</span>
                  {students.length > 0 && (
                    <select className={s.studentPicker}
                      value={selectedStudent}
                      onChange={e => setSelectedStudent(e.target.value)}>
                      {students.map(st => (
                        <option key={st.id} value={st.id}>{st.displayName || st.email}</option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedStudentData?.lastSession ? (
                  <>
                    <div className={s.summaryMeta}>
                      <span className={s.tag}>{selectedStudentData.lastSession.subject}</span>
                      <span className={s.date}>{selectedStudentData.lastSession.date}</span>
                    </div>
                    <div className={s.summaryTitle}>{selectedStudentData.lastSession.title || 'Session Summary'}</div>
                    {selectedStudentData.lastSession.bullets?.length ? (
                      <ul className={s.bullets}>
                        {selectedStudentData.lastSession.bullets.slice(0, 3).map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <div className={s.emptyState}>
                    <span>No session summary yet</span>
                    <p>Summaries appear here after sessions are completed.</p>
                  </div>
                )}

                <div className={s.divider} />

                <div className={s.cardLabel} style={{ marginBottom: 10 }}>Recent Chat</div>
                {recentMessages.length > 0 ? recentMessages.map((msg, i) => (
                  <div key={i} className={s.msgRow}>
                    <div className={`${s.msgAv} ${msg.isTutor ? s.msgAvTutor : ''}`}>{msg.initial}</div>
                    <div className={s.msgBody}>
                      <div className={s.msgMeta}>
                        <span className={s.msgName}>{msg.name}</span>
                        <span className={s.msgTime}>{msg.time}</span>
                      </div>
                      <div className={s.msgText}>{msg.text}</div>
                    </div>
                  </div>
                )) : (
                  <div className={s.emptyState} style={{ padding: '12px 0 0' }}>
                    <span>No messages yet</span>
                  </div>
                )}
              </div>
            </div>

            <div className={s.col}>
              {/* Connect Calendly */}
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Calendly</span>
                  {calendlyConnected && <span className={s.reviewBadge} style={{ background: 'rgba(88,204,2,.12)', color: 'var(--gdd)' }}>Connected</span>}
                </div>
                {calendlyConnected ? (
                  <div style={{ fontSize: 13, color: 'var(--mu)', fontWeight: 600 }}>
                    ✓ {calendlyConnected} — bookings and Fireflies bot are wired automatically.
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 12, color: 'var(--mu)', fontWeight: 600, marginBottom: 12, lineHeight: 1.5 }}>
                      Paste your Calendly Personal Access Token to auto-register your bookings and Fireflies recording.
                    </p>
                    <input
                      className={s.tokenInput}
                      type="password"
                      placeholder="eyJraWQi..."
                      value={calendlyToken}
                      onChange={e => setCalendlyToken(e.target.value)}
                    />
                    <button className={s.btnPrimary} style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                      onClick={handleConnectCalendly} disabled={connectingCalendly || !calendlyToken.trim()}>
                      {connectingCalendly ? 'Connecting…' : 'Connect Calendly →'}
                    </button>
                    <p style={{ fontSize: 11, color: '#C4C9D4', marginTop: 8, fontWeight: 600 }}>
                      Get it at calendly.com → Integrations → API & Webhooks
                    </p>
                  </>
                )}
              </div>

              <div className={s.card}>
                <div className={s.cardLabel} style={{ marginBottom: 16 }}>Upcoming Sessions</div>
                {sessions.length === 0 ? (
                  <div className={s.emptyState}>
                    <span>No sessions scheduled</span>
                    <p>New bookings from Calendly will appear here automatically.</p>
                  </div>
                ) : (
                  <div className={s.sessionList}>
                    {sessions.slice(0, 5).map(sess => {
                      const live = now >= sess.scheduledAt - FIFTEEN_MIN && now <= sess.endAt + FIFTEEN_MIN
                      return (
                        <div key={sess.id} className={`${s.sessionRow} ${live ? s.sessionRowLive : ''}`}>
                          <div className={s.sessionLeft}>
                            <div className={s.sessionName}>{sess.studentName}</div>
                            <div className={s.sessionMeta}>{sess.subject} · {sess.duration}</div>
                            <div className={s.sessionDate}>{fmt(sess.scheduledAt)}</div>
                          </div>
                          <div className={s.sessionRight}>
                            <div className={`${s.sessionBadge} ${live ? s.badgeLive : ''}`}>
                              {live ? 'Live now' : timeUntil(sess.scheduledAt)}
                            </div>
                            {sess.meetingUrl && (
                              <a href={sess.meetingUrl} target="_blank" rel="noopener" className={s.joinLink}>
                                Join →
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  )
}
