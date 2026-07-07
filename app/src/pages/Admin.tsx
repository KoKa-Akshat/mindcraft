/**
 * Admin.tsx
 *
 * Internal ops dashboard — accessible only to users with role: 'admin'.
 *
 * Layout: fixed dark left sidebar (Overview / Students / Tutors / Parents /
 * Sessions / Settings) + light main content area.
 *
 * Features:
 *   - Overview: platform stats, recent sessions, 7-day activity chart
 *   - Students: activity + mastery snapshot, ML profile modal
 *   - Tutors: load, last session, assign-to-student
 *   - Parents: child links + weekly digest mailto
 *   - Sessions: all sessions table + Book Session modal
 *   - Settings: gap-scan testing + ACT bank coverage
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  collection, query, orderBy, onSnapshot,
  doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocs, where, deleteField, limit,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../firebase'
import { useUser } from '../App'
import { useToast } from '../hooks/useToast'
import { fmtDateTime } from '../utils/format'
import { listAllActConceptCoverage, coverageSummaryLine, formatQuestionSources, type ConceptCoverage } from '../lib/ontologyBankCoverage'
import StudentIntelPanel from '../components/StudentIntelPanel'
import s from './Admin.module.css'

// Admin sees a flattened view of sessions — simpler than tutor/student views
interface AdminSession {
  id:           string
  studentName:  string
  studentEmail: string
  studentId:    string | null
  tutorName:    string
  tutorId:      string | null
  subject:      string
  date:         string
  duration:     string
  scheduledAt:  number
  status:       'scheduled' | 'completed' | 'cancelled'
  meetingUrl:   string | null
}

interface AdminStudent {
  id:                string
  displayName:       string
  email:             string
  assignedTutorName?: string | null
}

interface AdminParent {
  id:          string
  displayName: string
  email:       string
  childId:     string | null
}

interface AdminTutor {
  id:          string
  displayName: string
  email:       string
}

interface StudentMeta {
  lastActive:   number | null
  avgMastery:   number | null
  conceptCount: number
}

type AdminTab = 'overview' | 'students' | 'tutors' | 'parents' | 'sessions' | 'settings'

function activityBadge(lastActive: number | null): { label: string; cls: 'active' | 'slowing' | 'inactive' } {
  if (!lastActive) return { label: 'Inactive', cls: 'inactive' }
  const days = (Date.now() - lastActive) / 86400000
  if (days < 7)   return { label: 'Active',   cls: 'active' }
  if (days <= 21) return { label: 'Slowing',  cls: 'slowing' }
  return { label: 'Inactive', cls: 'inactive' }
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#247a4d',
  completed: '#2b6cb0',
  cancelled: '#8A8F98',
}

const SUBJECTS = [
  'AP Calculus', 'Pre-Calculus', 'Algebra', 'Statistics',
  'AP Physics', 'Chemistry', 'SAT Prep', 'Other',
]

const NAV_ITEMS: { id: AdminTab; label: string; icon: JSX.Element }[] = [
  {
    id: 'overview', label: 'Overview',
    icon: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  },
  {
    id: 'students', label: 'Students',
    icon: <svg viewBox="0 0 24 24"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/></svg>,
  },
  {
    id: 'tutors', label: 'Tutors',
    icon: <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  },
  {
    id: 'parents', label: 'Parents',
    icon: <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  },
  {
    id: 'sessions', label: 'Sessions',
    icon: <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    id: 'settings', label: 'Settings',
    icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  },
]

const TAB_TITLES: Record<AdminTab, { title: string; sub: string }> = {
  overview: { title: 'Overview',  sub: 'Platform health at a glance' },
  students: { title: 'Students',  sub: 'Activity, mastery, and ML profiles' },
  tutors:   { title: 'Tutors',    sub: 'Load, recency, and student assignment' },
  parents:  { title: 'Parents',   sub: 'Child links and weekly digests' },
  sessions: { title: 'Sessions',  sub: 'Every session across all tutors' },
  settings: { title: 'Settings',  sub: 'Platform configuration and testing tools' },
}

export default function Admin() {
  const user = useUser()
  const navigate = useNavigate()

  const { toast, showToast } = useToast()
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [parents, setParents]   = useState<AdminParent[]>([])
  const [tutors, setTutors]     = useState<AdminTutor[]>([])
  const [childNames, setChildNames]   = useState<Record<string, string>>({})
  const [studentMeta, setStudentMeta] = useState<Record<string, StudentMeta>>({})
  const [metaLoaded, setMetaLoaded]   = useState(false)
  const [intelStudent, setIntelStudent] = useState<{ id: string; name: string } | null>(null)
  const [assignPick, setAssignPick]   = useState<Record<string, string>>({})
  const [tab, setTab]           = useState<AdminTab>('overview')
  const [bookOpen, setBookOpen] = useState(false)
  const [coverageRows]          = useState<ConceptCoverage[]>(() => listAllActConceptCoverage())
  const [coverageSummary]       = useState(() => coverageSummaryLine())
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  // New session form
  const [form, setForm] = useState({
    studentEmail: '', studentName: '',
    subject: 'AP Calculus', duration: '60',
    date: '', time: '', meetingUrl: '',
  })

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.data()?.role !== 'admin') navigate('/dashboard', { replace: true })
    })
  }, [user, navigate])

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'sessions'), orderBy('scheduledAt', 'desc')),
      snap => {
        setSessions(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AdminSession, 'id'>) })))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])

  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'student')))
      .then(snap => setStudents(
        snap.docs.map(d => ({
          id: d.id,
          displayName: d.data().displayName,
          email: d.data().email,
          assignedTutorName: d.data().assignedTutorName ?? null,
        }))
      ))
      .catch(() => {})
  }, [])

  // Parents + tutors — loaded once (parents feed the stats too)
  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'parent')))
      .then(snap => setParents(snap.docs.map(d => ({
        id: d.id,
        displayName: d.data().displayName ?? '',
        email: d.data().email ?? '',
        childId: d.data().childId ?? null,
      }))))
      .catch(() => {})
    getDocs(query(collection(db, 'users'), where('role', '==', 'tutor')))
      .then(snap => setTutors(snap.docs.map(d => ({
        id: d.id,
        displayName: d.data().displayName ?? '',
        email: d.data().email ?? '',
      }))))
      .catch(() => {})
  }, [])

  // Resolve parents' childId → child display name (batch, reuses students list first)
  useEffect(() => {
    const ids = [...new Set(parents.map(p => p.childId).filter(Boolean))] as string[]
    if (ids.length === 0) return
    const known: Record<string, string> = {}
    const missing: string[] = []
    ids.forEach(id => {
      const st = students.find(x => x.id === id)
      if (st) known[id] = st.displayName || st.email
      else missing.push(id)
    })
    Promise.all(missing.map(id =>
      getDoc(doc(db, 'users', id))
        .then(snap => { const d = snap.data(); if (d) known[id] = d.displayName || d.email || id })
        .catch(() => {})
    )).then(() => setChildNames(prev => ({ ...prev, ...known })))
  }, [parents, students])

  // Per-student meta (last active + mastery) — lazy-loaded when Students tab opens
  useEffect(() => {
    if (tab !== 'students' || metaLoaded || students.length === 0) return
    setMetaLoaded(true)
    Promise.all(students.map(async st => {
      const [interSnap, graphSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'interactions'),
          where('studentId', '==', st.id),
          orderBy('timestamp', 'desc'),
          limit(1),
        )).catch(() => null),
        getDoc(doc(db, 'knowledge_graphs', st.id)).catch(() => null),
      ])
      let lastActive: number | null = null
      if (interSnap && !interSnap.empty) {
        const t = interSnap.docs[0].data().timestamp
        lastActive = t?.toMillis?.() ?? (typeof t === 'number' ? t : null)
      }
      const nodes = (graphSnap?.data()?.nodes ?? []) as { mastery?: number; eventCount?: number }[]
      const active = nodes.filter(n => (n.eventCount ?? 0) > 0)
      const avgMastery = active.length
        ? active.reduce((sum, n) => sum + (n.mastery ?? 0), 0) / active.length
        : null
      return [st.id, { lastActive, avgMastery, conceptCount: active.length }] as const
    })).then(entries => setStudentMeta(Object.fromEntries(entries)))
  }, [tab, students, metaLoaded])

  async function createSession() {
    if (!form.studentEmail || !form.date || !form.time) {
      showToast('Fill in student email, date, and time.')
      return
    }
    setSaving(true)

    const scheduledAt = new Date(`${form.date}T${form.time}`).getTime()
    const dateStr = new Date(scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const timeStr = new Date(scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

    const userSnap = await getDocs(
      query(collection(db, 'users'), where('email', '==', form.studentEmail.trim()))
    )
    const studentDoc = userSnap.empty ? null : userSnap.docs[0]
    const studentId  = studentDoc?.id ?? null

    const tutorName = user.displayName || 'Akshat K.'
    const ref = doc(collection(db, 'sessions'))
    await setDoc(ref, {
      studentEmail: form.studentEmail.trim(),
      studentName:  form.studentName.trim() || form.studentEmail.split('@')[0],
      studentId,
      tutorId:   user.uid,
      tutorName,
      subject:   form.subject,
      duration:  `${form.duration} min`,
      date:      dateStr,
      scheduledAt,
      status:    'scheduled',
      meetingUrl:   form.meetingUrl.trim() || null,
      createdAt: serverTimestamp(),
    })

    if (studentDoc) {
      await updateDoc(studentDoc.ref, {
        nextSession: { subject: form.subject, time: timeStr, tutor: tutorName }
      })
    }

    setForm({ studentEmail: '', studentName: '', subject: 'AP Calculus', duration: '60', date: '', time: '', meetingUrl: '' })
    setBookOpen(false)
    showToast('Session created!')
    setSaving(false)
  }

  async function updateStatus(id: string, status: AdminSession['status']) {
    await updateDoc(doc(db, 'sessions', id), { status })
    showToast(`Marked as ${status}`)
  }

  async function retakeGapScan(uid: string) {
    await updateDoc(doc(db, 'users', uid), {
      diagnosticCompleted: deleteField(),
      diagnosticCompletedAt: deleteField(),
    })
    showToast('Gap scan reset — user will be prompted on next login.')
  }

  function tutorForStudent(st: AdminStudent): string | null {
    const sess = sessions
      .filter(x => x.studentId === st.id || (st.email && x.studentEmail === st.email))
      .sort((a, b) => b.scheduledAt - a.scheduledAt)[0]
    return sess?.tutorName ?? st.assignedTutorName ?? null
  }

  function tutorLoad(tutorId: string): number {
    return new Set(
      sessions
        .filter(x => x.tutorId === tutorId)
        .map(x => x.studentId || x.studentEmail)
        .filter(Boolean)
    ).size
  }

  function tutorLastSession(tutorId: string): number | null {
    const sess = sessions
      .filter(x => x.tutorId === tutorId)
      .sort((a, b) => b.scheduledAt - a.scheduledAt)[0]
    return sess?.scheduledAt ?? null
  }

  // Assign a student to a tutor (per-tutor dropdown on the Tutors tab)
  async function assignStudentToTutor(tutorId: string) {
    const t = tutors.find(x => x.id === tutorId)
    const sid = assignPick[tutorId] || students[0]?.id
    const st = students.find(x => x.id === sid)
    if (!t || !st) { showToast('Pick a student to assign.'); return }
    try {
      await updateDoc(doc(db, 'users', st.id), {
        assignedTutorId:   t.id,
        assignedTutorName: t.displayName || t.email,
      })
      setStudents(prev => prev.map(x =>
        x.id === st.id ? { ...x, assignedTutorName: t.displayName || t.email } : x
      ))
      showToast(`Assigned ${st.displayName || st.email} → ${t.displayName || t.email}`)
    } catch {
      showToast('Assignment failed — check permissions.')
    }
  }

  function digestMailto(p: AdminParent): string {
    const childName = (p.childId && childNames[p.childId]) || 'your child'
    const parentName = p.displayName || 'there'
    const subject = `MindCraft weekly update for ${childName}`
    const body =
      `Hi ${parentName},\n\n` +
      `Here's a quick look at ${childName}'s week on MindCraft — recent practice, ` +
      `strengths, and where we're focusing next. Reply to this email any time with questions.\n\n` +
      `Best,\nThe MindCraft Team`
    return `mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  // ── Overview computations ─────────────────────────────────────────────────
  // Sessions-per-day buckets for the last 7 days (drives the SVG chart + stat)
  const chartData = useMemo(() => {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - (6 - i))
      return d
    })
    return days.map(d => ({
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      count: sessions.filter(x =>
        x.scheduledAt >= d.getTime() && x.scheduledAt < d.getTime() + 86400000 && x.status !== 'cancelled'
      ).length,
    }))
  }, [sessions])

  const sessionsThisWeek = chartData.reduce((sum, d) => sum + d.count, 0)
  const maxChartCount = Math.max(1, ...chartData.map(d => d.count))
  const recentSessions = sessions.slice(0, 10)

  const stats = [
    { label: 'Total Students',     val: students.length,                       cls: s.statGreen },
    { label: 'Active Tutors',      val: tutors.length,                         cls: s.statBlue },
    { label: 'Sessions This Week', val: sessionsThisWeek,                      cls: s.statAmber },
    { label: 'Parents Linked',     val: parents.filter(p => p.childId).length, cls: s.statPurple },
  ]

  const sessionsTable = (rows: AdminSession[], withActions: boolean) => (
    <table className={s.table}>
      <thead>
        <tr>
          <th>Student</th><th>Tutor</th><th>Subject</th><th>Scheduled</th><th>Status</th>
          {withActions && <><th>Zoom</th><th>Actions</th></>}
        </tr>
      </thead>
      <tbody>
        {rows.map(sess => (
          <tr key={sess.id}>
            <td>
              <div className={s.studentName}>{sess.studentName}</div>
              <div className={s.studentEmail}>{sess.studentEmail}</div>
            </td>
            <td className={s.tutorCell}>{sess.tutorName || '—'}</td>
            <td><span className={s.subject}>{sess.subject}</span></td>
            <td className={s.dateCell}>{fmtDateTime(sess.scheduledAt)}</td>
            <td>
              <span className={s.statusBadge} style={{ color: STATUS_COLOR[sess.status], background: STATUS_COLOR[sess.status] + '1a' }}>
                {sess.status}
              </span>
            </td>
            {withActions && (
              <>
                <td>
                  {sess.meetingUrl ? (
                    <a href={sess.meetingUrl} target="_blank" rel="noopener" className={s.zoomLink}>Join</a>
                  ) : <span className={s.noZoom}>—</span>}
                </td>
                <td>
                  <div className={s.actions}>
                    {sess.status === 'scheduled' && (
                      <button className={s.actionBtn} onClick={() => updateStatus(sess.id, 'completed')}>Complete</button>
                    )}
                    {sess.status !== 'cancelled' && (
                      <button className={`${s.actionBtn} ${s.cancelBtn}`} onClick={() => updateStatus(sess.id, 'cancelled')}>Cancel</button>
                    )}
                  </div>
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div className={s.shell}>
      {/* ── Fixed dark sidebar ── */}
      <aside className={s.sidebar}>
        <Link to="/" className={s.sideLogo}>Mind<span>Craft</span></Link>
        <span className={s.sideRole}>Admin</span>
        <nav className={s.sideNav}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              className={`${s.sideItem} ${tab === item.id ? s.sideItemActive : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className={s.signOutBtn}
          onClick={() => signOut(auth).then(() => navigate('/login', { replace: true }))}
        >
          <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </aside>

      {/* ── Main content ── */}
      <main className={s.main}>
        <div className={s.pageHead}>
          <div>
            <h1 className={s.pageTitle}>{TAB_TITLES[tab].title}</h1>
            <p className={s.pageSub}>{TAB_TITLES[tab].sub}</p>
          </div>
          <div className={s.pageHeadRight}>
            {tab === 'sessions' && (
              <button type="button" className={s.primaryBtn} onClick={() => setBookOpen(true)}>
                + Book session
              </button>
            )}
            <a href="https://calendly.com/joinmindcraft/30min" target="_blank" rel="noopener" className={s.calendlyBtn}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Calendly
            </a>
            <span className={s.headEmail}>{user.email}</span>
          </div>
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <div className={s.overviewTop}>
              <div className={s.statGrid}>
                {stats.map(st => (
                  <div key={st.label} className={`${s.statCard} ${st.cls}`}>
                    <div className={s.statVal}>{st.val}</div>
                    <div className={s.statLabel}>{st.label}</div>
                  </div>
                ))}
              </div>

              <div className={s.card}>
                <div className={s.cardTitleRow}>
                  <span className={s.cardTitle}>Platform activity</span>
                  <span className={s.cardHint}>Sessions per day · last 7 days</span>
                </div>
                <svg viewBox="0 0 364 150" className={s.chart} role="img" aria-label="Sessions per day, last 7 days">
                  <line x1="8" y1="118" x2="356" y2="118" className={s.chartAxis} />
                  {chartData.map((d, i) => {
                    const h = (d.count / maxChartCount) * 92
                    const x = 12 + i * 50
                    const isToday = i === 6
                    return (
                      <g key={`${d.label}-${i}`}>
                        <rect
                          x={x} y={116 - Math.max(h, 3)}
                          width={32} height={Math.max(h, 3)} rx={5}
                          className={d.count === 0 ? s.chartBarEmpty : isToday ? s.chartBarToday : s.chartBar}
                        />
                        {d.count > 0 && (
                          <text x={x + 16} y={108 - h} textAnchor="middle" className={s.chartVal}>{d.count}</text>
                        )}
                        <text x={x + 16} y={136} textAnchor="middle" className={s.chartDay}>{d.label}</text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>

            <div className={s.card}>
              <div className={s.cardTitleRow}>
                <span className={s.cardTitle}>Recent sessions</span>
                <button type="button" className={s.cardLink} onClick={() => setTab('sessions')}>View all →</button>
              </div>
              {loading ? (
                <div className={s.empty}>Loading…</div>
              ) : recentSessions.length === 0 ? (
                <div className={s.empty}>No sessions yet. Book one or wait for Calendly bookings.</div>
              ) : (
                <div className={s.tableScroll}>{sessionsTable(recentSessions, false)}</div>
              )}
            </div>
          </>
        )}

        {/* ── STUDENTS ── */}
        {tab === 'students' && (
          <div className={s.card}>
            {students.length === 0 ? (
              <div className={s.empty}>No students yet.</div>
            ) : (
              <div className={s.rowList}>
                {students.map(st => {
                  const meta  = studentMeta[st.id]
                  const badge = activityBadge(meta?.lastActive ?? null)
                  const tutorName = tutorForStudent(st)
                  const name = st.displayName || st.email?.split('@')[0] || 'Student'
                  return (
                    <div key={st.id} className={s.studentRow}>
                      <div className={s.rowAvatar}>{name[0]?.toUpperCase()}</div>
                      <div className={s.rowMain}>
                        <div className={s.studentName}>{name}</div>
                        <div className={s.studentEmail}>{st.email}</div>
                      </div>
                      <span className={`${s.statusBadge} ${
                        badge.cls === 'active' ? s.badgeActive :
                        badge.cls === 'slowing' ? s.badgeSlowing : s.badgeInactive
                      }`}>
                        {badge.label}
                      </span>
                      <div className={s.rowStat}>
                        <span className={s.rowStatNum}>
                          {meta?.avgMastery != null ? `${Math.round(meta.avgMastery * 100)}%` : '—'}
                        </span>
                        <span className={s.rowStatLabel}>Avg mastery</span>
                      </div>
                      <div className={s.rowStat}>
                        <span className={s.rowStatNum}>{meta ? meta.conceptCount : '—'}</span>
                        <span className={s.rowStatLabel}>Concepts</span>
                      </div>
                      <div className={s.rowStat}>
                        <span className={s.rowStatNum} style={{ fontSize: 13 }}>{tutorName ?? '—'}</span>
                        <span className={s.rowStatLabel}>Tutor</span>
                      </div>
                      <button
                        type="button"
                        className={s.actionBtn}
                        onClick={() => setIntelStudent({ id: st.id, name })}
                      >
                        View ML
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TUTORS ── */}
        {tab === 'tutors' && (
          <div className={s.card}>
            {tutors.length === 0 ? (
              <div className={s.empty}>No tutor accounts yet.</div>
            ) : (
              <div className={s.rowList}>
                {tutors.map(t => {
                  const name = t.displayName || t.email?.split('@')[0] || 'Tutor'
                  const load = tutorLoad(t.id)
                  const last = tutorLastSession(t.id)
                  return (
                    <div key={t.id} className={s.studentRow}>
                      <div className={`${s.rowAvatar} ${s.tutorAvatar}`}>{name[0]?.toUpperCase()}</div>
                      <div className={s.rowMain}>
                        <div className={s.studentName}>{name}</div>
                        <div className={s.studentEmail}>{t.email}</div>
                      </div>
                      <div className={s.rowStat}>
                        <span className={s.rowStatNum}>{load}</span>
                        <span className={s.rowStatLabel}>{load === 1 ? 'Student' : 'Students'}</span>
                      </div>
                      <div className={s.rowStat}>
                        <span className={s.rowStatNum} style={{ fontSize: 12 }}>
                          {last ? fmtDateTime(last) : '—'}
                        </span>
                        <span className={s.rowStatLabel}>Last session</span>
                      </div>
                      <select
                        className={s.assignSelect}
                        value={assignPick[t.id] ?? students[0]?.id ?? ''}
                        onChange={e => setAssignPick(prev => ({ ...prev, [t.id]: e.target.value }))}
                      >
                        {students.map(st => (
                          <option key={st.id} value={st.id}>{st.displayName || st.email}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={s.actionBtn}
                        onClick={() => assignStudentToTutor(t.id)}
                        disabled={students.length === 0}
                      >
                        Assign to student
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PARENTS ── */}
        {tab === 'parents' && (
          <div className={s.card}>
            {parents.length === 0 ? (
              <div className={s.empty}>No parent accounts yet.</div>
            ) : (
              <div className={s.rowList}>
                {parents.map(p => {
                  const name = p.displayName || p.email?.split('@')[0] || 'Parent'
                  const childName = p.childId ? (childNames[p.childId] ?? '…') : null
                  return (
                    <div key={p.id} className={s.studentRow}>
                      <div className={`${s.rowAvatar} ${s.parentAvatar}`}>{name[0]?.toUpperCase()}</div>
                      <div className={s.rowMain}>
                        <div className={s.studentName}>{name}</div>
                        <div className={s.studentEmail}>{p.email}</div>
                      </div>
                      <div className={s.rowStat}>
                        <span className={s.rowStatNum} style={{ fontSize: 13 }}>{childName ?? '—'}</span>
                        <span className={s.rowStatLabel}>Child</span>
                      </div>
                      <span className={`${s.statusBadge} ${p.childId ? s.badgeActive : s.badgeInactive}`}>
                        {p.childId ? 'Linked' : 'Not linked'}
                      </span>
                      {p.childId && p.email ? (
                        <a
                          href={digestMailto(p)}
                          target="_blank"
                          rel="noopener"
                          className={`${s.actionBtn} ${s.linkAction}`}
                        >
                          Send digest
                        </a>
                      ) : (
                        <span className={s.noZoom}>—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SESSIONS ── */}
        {tab === 'sessions' && (
          <div className={s.card}>
            {loading ? (
              <div className={s.empty}>Loading…</div>
            ) : sessions.length === 0 ? (
              <div className={s.empty}>No sessions yet. Book one or wait for Calendly bookings.</div>
            ) : (
              <div className={s.tableScroll}>{sessionsTable(sessions, true)}</div>
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <>
            <div className={s.card} style={{ marginBottom: 20 }}>
              <div className={s.cardTitleRow}>
                <span className={s.cardTitle}>Admin settings</span>
              </div>
              <div className={s.empty} style={{ padding: '20px 0' }}>Admin settings coming soon.</div>
            </div>

            <div className={s.card} style={{ marginBottom: 20 }}>
              <div className={s.cardTitleRow}>
                <span className={s.cardTitle}>Gap scan testing</span>
              </div>
              <p className={s.settingsNote}>
                Clears <code>diagnosticCompleted</code> so the student re-takes exam pick + confidence
                ratings on next login.
              </p>
              <div className={s.btnCluster}>
                {students.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    className={s.actionBtn}
                    onClick={() => retakeGapScan(st.id)}
                  >
                    Retake: {st.displayName || st.email}
                  </button>
                ))}
                <button type="button" className={s.actionBtn} onClick={() => retakeGapScan(user.uid)}>
                  Retake: me
                </button>
              </div>
            </div>

            <div className={s.card}>
              <div className={s.cardTitleRow}>
                <span className={s.cardTitle}>ACT question bank coverage</span>
              </div>
              <p className={s.settingsNote}>
                {coverageSummary}. Static questions live in{' '}
                <code>app/src/lib/questionBank.ts</code>; verified generated batches merge from{' '}
                <code>app/src/data/generatedQuestions.json</code>. Re-run{' '}
                <code>python3 ml/scripts/audit_act_ontology_question_bank.py</code> after edits.
              </p>
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>concept_id</th>
                      <th>Name</th>
                      <th>Level</th>
                      <th>Status</th>
                      <th>L1</th>
                      <th>L2</th>
                      <th>L3</th>
                      <th>Source file</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverageRows.map(row => (
                      <tr key={row.conceptId}>
                        <td><code>{row.conceptId}</code></td>
                        <td>{row.name}</td>
                        <td>{row.ontologyLevel}</td>
                        <td>
                          <span
                            className={s.statusBadge}
                            style={{
                              color: row.status === 'full' ? '#247a4d' : '#b07a00',
                              background: row.status === 'full' ? 'rgba(36,122,77,.1)' : 'rgba(245,158,11,.12)',
                            }}
                          >
                            {row.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>{row.questionCounts.L1}</td>
                        <td>{row.questionCounts.L2}</td>
                        <td>{row.questionCounts.L3}</td>
                        <td>
                          {row.questionSources?.length ? (
                            <div className={s.sourceCell}>
                              {row.questionSources.map(src => (
                                <div key={`${src.file}-${src.bankConceptId}`} className={s.sourceLine}>
                                  <code>{src.file}</code>
                                  {src.bankConceptId !== row.conceptId && (
                                    <span className={s.sourceAlias}> as {src.bankConceptId}</span>
                                  )}
                                  <span className={s.sourceCount}> ({src.count})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className={s.noZoom}>—</span>
                          )}
                        </td>
                        <td>
                          <div className={s.actions}>
                            <button
                              type="button"
                              className={s.actionBtn}
                              onClick={() => {
                                void navigator.clipboard.writeText(row.conceptId)
                                showToast(`Copied ${row.conceptId}`)
                              }}
                            >
                              Copy id
                            </button>
                            {row.questionSources?.length ? (
                              <button
                                type="button"
                                className={s.actionBtn}
                                onClick={() => {
                                  void navigator.clipboard.writeText(formatQuestionSources(row))
                                  showToast('Copied source paths')
                                }}
                              >
                                Copy file
                              </button>
                            ) : null}
                            {row.status !== 'full' ? (
                              <button
                                type="button"
                                className={s.actionBtn}
                                onClick={() => {
                                  void navigator.clipboard.writeText(row.message)
                                  showToast('Copied gap details')
                                }}
                              >
                                Copy details
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Book Session modal ── */}
      {bookOpen && (
        <div className={s.overlay} onClick={() => setBookOpen(false)}>
          <div className={s.overlayCard} onClick={e => e.stopPropagation()}>
            <div className={s.overlayHead}>
              <span className={s.overlayTitle}>Book a Session</span>
              <button
                type="button"
                className={s.overlayClose}
                onClick={() => setBookOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className={s.formGrid}>
              <div className={s.field}>
                <label>Student Email *</label>
                <input type="email" placeholder="student@email.com"
                  value={form.studentEmail}
                  onChange={e => setForm(f => ({ ...f, studentEmail: e.target.value }))} />
              </div>
              <div className={s.field}>
                <label>Student Name</label>
                <input type="text" placeholder="Jane Smith"
                  value={form.studentName}
                  onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))} />
              </div>
              <div className={s.field}>
                <label>Subject *</label>
                <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                  {SUBJECTS.map(sub => <option key={sub}>{sub}</option>)}
                </select>
              </div>
              <div className={s.field}>
                <label>Duration (min)</label>
                <select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}>
                  {['30', '45', '60', '90'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className={s.field}>
                <label>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className={s.field}>
                <label>Time *</label>
                <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div className={`${s.field} ${s.fullWidth}`}>
                <label>Zoom Link</label>
                <input type="url" placeholder="https://zoom.us/j/..."
                  value={form.meetingUrl}
                  onChange={e => setForm(f => ({ ...f, meetingUrl: e.target.value }))} />
              </div>
            </div>
            <button className={s.submitBtn} onClick={createSession} disabled={saving}>
              {saving ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </div>
      )}

      {/* ── ML profile modal ── */}
      {intelStudent && (
        <div className={s.overlay} onClick={() => setIntelStudent(null)}>
          <div className={s.overlayCard} onClick={e => e.stopPropagation()}>
            <div className={s.overlayHead}>
              <span className={s.overlayTitle}>ML profile — {intelStudent.name}</span>
              <button
                type="button"
                className={s.overlayClose}
                onClick={() => setIntelStudent(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <StudentIntelPanel studentId={intelStudent.id} studentName={intelStudent.name} />
          </div>
        </div>
      )}

      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  )
}
