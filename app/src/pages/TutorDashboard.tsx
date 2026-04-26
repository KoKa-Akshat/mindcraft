/**
 * TutorDashboard.tsx
 *
 * Main dashboard for tutors. Shows:
 *   - Sidebar: student list derived from their sessions (auto-populates as students book)
 *   - Sessions to Review: completed sessions waiting for a summary
 *   - Session Summary + Recent Chat: filtered to the selected student
 *   - Upcoming Sessions: scheduled future sessions
 *   - Calendly card: connect/display integration status
 *
 * Selecting a student in the sidebar filters ALL cards to that student.
 * Selecting "All Students" resets filters.
 */

import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate, Link } from 'react-router-dom'
import {
  collection, query, where, onSnapshot, getDocs,
  doc, getDoc, updateDoc, orderBy, limit,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import { useToast } from '../hooks/useToast'
import { fmtDateTime, timeUntil } from '../utils/format'
import type { Session, TutorStudent as Student } from '../types'
import StudentIntelPanel from '../components/StudentIntelPanel'
import s from './TutorDashboard.module.css'

const FIFTEEN_MIN = 15 * 60 * 1000

export default function TutorDashboard() {
  const user = useUser()
  const navigate = useNavigate()

  const { toast, showToast } = useToast()

  const [sessions, setSessions]           = useState<Session[]>([])
  const [toReview, setToReview]           = useState<Session[]>([])
  const [studentIdByEmail, setStudentIdByEmail] = useState<Record<string, string>>({})
  const [students, setStudents]           = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent]   = useState<string>('all')
  const [chatMessages, setChatMessages]   = useState<{ senderId: string; text: string; createdAt: any }[]>([])
  const [loading, setLoading]             = useState(true)
  const [calendlyConnected, setCalendlyConnected] = useState<string | null>(null)
  const [calendlyToken, setCalendlyToken] = useState('')
  const [connectingCalendly, setConnectingCalendly] = useState(false)

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
      async snap => {
        const all = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...(d.data() as Omit<Session, 'id'>) }))
        const now = Date.now()

        // Auto-complete any sessions whose end time has passed but are still 'scheduled'
        all
          .filter(s => s.status === 'scheduled' && (s.endAt ?? s.scheduledAt + 90 * 60 * 1000) < now)
          .forEach(s => updateDoc((s as any).ref, {
            status: 'completed',
            summaryStatus: (s as any).summaryStatus ?? 'pending',
          }).catch(() => {}))

        // Deduplicate by calendlyEventUri (webhook can fire twice)
        const seen = new Set<string>()
        const deduped = all.filter(s => {
          const key = (s as any).calendlyEventUri || s.id
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        const upcoming = deduped
          .filter(s => s.status === 'scheduled' && (s.endAt ?? s.scheduledAt + 90 * 60 * 1000) > now)
          .sort((a, b) => a.scheduledAt - b.scheduledAt)
          .slice(0, 10)
        const completed = deduped
          .filter(s => s.status === 'completed')
          .sort((a, b) => b.scheduledAt - a.scheduledAt)
          .slice(0, 20)
        setSessions(upcoming)
        setToReview(completed.filter(s => s.summaryStatus !== 'published'))
        setLoading(false)

        // Resolve studentId for sessions missing it
        const missingEmails = [...new Set(
          all.filter(s => !s.studentId && s.studentEmail).map(s => s.studentEmail)
        )]
        if (missingEmails.length === 0) return
        const userSnap = await getDocs(
          query(collection(db, 'users'), where('email', 'in', missingEmails.slice(0, 10)))
        )
        const map: Record<string, string> = {}
        userSnap.docs.forEach(d => {
          const email = d.data().email
          if (email) map[email] = d.id
        })
        setStudentIdByEmail(prev => ({ ...prev, ...map }))
        // Also backfill studentId on the session docs
        all.filter(s => !s.studentId && s.studentEmail && map[s.studentEmail]).forEach(s => {
          updateDoc((s as any).ref, { studentId: map[s.studentEmail] }).catch(() => {})
        })
      },
      () => setLoading(false)
    )
    return () => unsub()
  }, [user])

  // Derive students from sessions (unique emails) and look up their user docs
  useEffect(() => {
    if (Object.keys(studentIdByEmail).length === 0 && sessions.length === 0 && toReview.length === 0) return
    const allSessions = [...sessions, ...toReview]
    const emails = [...new Set(allSessions.map(s => s.studentEmail).filter(Boolean))]
    if (emails.length === 0) return
    getDocs(query(collection(db, 'users'), where('email', 'in', emails.slice(0, 10))))
      .then(snap => {
        const list: Student[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
        // Fill in any students we have email for but no user doc (guest bookings)
        emails.forEach(email => {
          if (!list.find(s => s.email === email)) {
            const sid = studentIdByEmail[email]
            if (sid) list.push({ id: sid, displayName: email.split('@')[0], email })
          }
        })
        setStudents(list)
      })
      .catch(() => {})
  }, [sessions, toReview, studentIdByEmail])

  // Live chat messages for selected student
  useEffect(() => {
    if (!selectedStudent || selectedStudent === 'all') { setChatMessages([]); return }
    const chatId = [user.uid, selectedStudent].sort().join('_')
    const unsub = onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(20)),
      snap => setChatMessages(snap.docs.map(d => d.data() as any)),
      () => setChatMessages([])
    )
    return () => unsub()
  }, [selectedStudent, user.uid])

  // Default to next session's student on first load
  useEffect(() => {
    if (selectedStudent !== 'all') return
    const next = sessions[0]
    if (!next) return
    const sid = next.studentId ?? studentIdByEmail[next.studentEmail] ?? null
    if (sid) setSelectedStudent(sid)
  }, [sessions, studentIdByEmail])



  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('Delete this session?')) return
    try {
      const res = await fetch('https://mindcraft-webhook.vercel.app/api/delete-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, tutorId: user.uid }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
    } catch (err: any) {
      showToast(err.message ?? 'Delete failed')
    }
  }

const nextSession = sessions[0] ?? null
  const now = Date.now()
  const sessionLive = nextSession &&
    now >= nextSession.scheduledAt - FIFTEEN_MIN &&
    now <= nextSession.endAt + FIFTEEN_MIN
  const canJoin = sessionLive && !!nextSession?.meetingUrl

  const selectedStudentData = students.find(st => st.id === selectedStudent)


  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <a href="https://koka-akshat.github.io/mindcraft/" className={s.logo}>Mind<span>Craft</span></a>
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
        {students.length > 0 && (
          <>
            <div className={s.sideDivider} />
            <p className={s.sideLabel}>Students</p>
            <button
              className={`${s.sideItem} ${selectedStudent === 'all' ? s.sideActive : ''}`}
              onClick={() => setSelectedStudent('all')}
            >
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              All Students
            </button>
            {students.map(st => (
              <button
                key={st.id}
                className={`${s.sideItem} ${selectedStudent === st.id ? s.sideActive : ''}`}
                onClick={() => setSelectedStudent(st.id)}
              >
                <div className={s.sideAvatar}>{(st.displayName || st.email)?.[0]?.toUpperCase()}</div>
                {st.displayName || st.email?.split('@')[0]}
              </button>
            ))}
          </>
        )}
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
                  {toReview.length > 0 && <span className={s.reviewBadge}>{toReview.length}</span>}
                </div>
                {(() => {
                  const filtered = selectedStudent === 'all' ? toReview : toReview.filter(s => s.studentId === selectedStudent || studentIdByEmail[s.studentEmail] === selectedStudent)
                  return filtered.length === 0 ? (
                    <div className={s.emptyState}>
                      <span>All caught up</span>
                      <p>Completed sessions pending your review will appear here.</p>
                    </div>
                  ) : (
                    <div className={s.sessionList}>
                      {filtered.slice(0, 4).map(sess => (
                        <Link key={sess.id} to={`/tutor/session/${sess.id}`} className={s.reviewRow}>
                          <div className={s.sessionLeft}>
                            <div className={s.sessionName}>{sess.studentName}</div>
                            <div className={s.sessionMeta}>{sess.subject} · {sess.duration}</div>
                            <div className={s.sessionDate}>{fmtDateTime(sess.scheduledAt)}</div>
                          </div>
                          <div className={s.sessionRight}>
                            <span className={`${s.sessionBadge} ${
                              sess.summaryStatus === 'draft' ? s.badgeDraft :
                              sess.summaryStatus === 'pending' ? s.badgePending : s.badgeNeedsReview
                            }`}>
                              {sess.summaryStatus === 'draft' ? 'Draft' :
                               sess.summaryStatus === 'pending' ? 'Has transcript' : 'Needs review'}
                            </span>
                            <button className={s.deleteRowBtn} onClick={e => handleDeleteSession(sess.id, e)} title="Delete">✕</button>
                            <span className={s.reviewArrow}>→</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* Session Summary */}
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Session Summary</span>
                  {selectedStudentData && (
                    <span style={{ fontSize: 12, color: 'var(--mu)', fontWeight: 600 }}>
                      {selectedStudentData.displayName || selectedStudentData.email?.split('@')[0]}
                    </span>
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

                {/* Student ML intelligence — only when a specific student is selected */}
                {selectedStudent !== 'all' && (
                  <StudentIntelPanel
                    studentId={selectedStudent}
                    studentName={selectedStudentData?.displayName || selectedStudentData?.email?.split('@')[0] || 'Student'}
                  />
                )}

                <div className={s.divider} />

                <div className={s.cardHeader} style={{ marginBottom: 10 }}>
                  <span className={s.cardLabel}>Recent Chat</span>
                  {selectedStudent && selectedStudent !== 'all' && (
                    <Link to={`/chat/${selectedStudent}`} style={{ fontSize: 12, color: 'var(--gdd)', fontWeight: 600 }}>Open chat →</Link>
                  )}
                </div>
                {chatMessages.length > 0 ? chatMessages.slice(-3).map((msg, i) => {
                  const isMe = msg.senderId === user.uid
                  const name = isMe ? 'You' : (selectedStudentData?.displayName || selectedStudentData?.email?.split('@')[0] || 'Student')
                  return (
                    <div key={i} className={s.msgRow}>
                      <div className={`${s.msgAv} ${isMe ? s.msgAvTutor : ''}`}>{name[0]?.toUpperCase()}</div>
                      <div className={s.msgBody}>
                        <div className={s.msgMeta}>
                          <span className={s.msgName}>{name}</span>
                        </div>
                        <div className={s.msgText}>{msg.text || '📎 File'}</div>
                      </div>
                    </div>
                  )
                }) : (
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
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Upcoming Sessions</span>
                </div>
                {(() => {
                  const filtered = selectedStudent === 'all' ? sessions : sessions.filter(s => s.studentId === selectedStudent || studentIdByEmail[s.studentEmail] === selectedStudent)
                  return filtered.length === 0 ? (
                    <div className={s.emptyState}>
                      <span>No sessions scheduled</span>
                      <p>New bookings from Calendly will appear here automatically.</p>
                    </div>
                  ) : (
                  <div className={s.sessionList}>
                    {filtered.slice(0, 5).map(sess => {
                      const live = now >= sess.scheduledAt - FIFTEEN_MIN && now <= sess.endAt + FIFTEEN_MIN
                      return (
                        <div key={sess.id} className={`${s.sessionRow} ${live ? s.sessionRowLive : ''}`}>
                          <div className={s.sessionLeft}>
                            <div className={s.sessionName}>{sess.studentName}</div>
                            <div className={s.sessionMeta}>{sess.subject} · {sess.duration}</div>
                            <div className={s.sessionDate}>{fmtDateTime(sess.scheduledAt)}</div>
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
                            {(sess.studentId || studentIdByEmail[sess.studentEmail]) && (
                              <Link to={`/chat/${sess.studentId || studentIdByEmail[sess.studentEmail]}`} className={s.joinLink} style={{ background: 'rgba(59,130,246,.1)', color: '#1d5aab' }}>
                                💬
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}
      </main>

      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  )
}
