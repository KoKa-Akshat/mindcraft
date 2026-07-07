/**
 * TutorDashboard.tsx
 *
 * Main dashboard for tutors. Layout:
 *   - Dark top bar: logo + "Tutor Dashboard" · tutor name + date + sign out
 *   - Left sidebar: student list derived from sessions + classroom code (kept)
 *   - Left column: "Your Student" hero card (assigned student + ML profile),
 *     Sessions to Review (hidden when empty), Upcoming Sessions (hidden when empty)
 *   - Right column: Live Activity feed, Quick Actions, Calendly, Session Notes stub
 *
 * The hero student is the first user whose `assignedTutorId` matches this tutor;
 * falls back to the first student derived from sessions.
 */

import { useEffect, useState, useMemo } from 'react'
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
import { MARKETING_BASE } from '../lib/siteUrls'
import { WEBHOOK_BASE, getStudentProfile, conceptLabel, type StudentProfileResult } from '../lib/mlApi'
import { fetchKnowledgeGraph } from '../lib/graphCache'

const FIFTEEN_MIN = 15 * 60 * 1000
const FIVE_MIN = 5 * 60 * 1000

interface ActivityItem {
  studentId: string
  conceptId: string
  outcome:   number
  ts:        number
}

interface FlaggedQuestion {
  id: string
  studentId: string
  studentName: string
  conceptName: string | null
  questionLabel: string | null
  questionText: string
  ts: number
}

interface AssignedStudent {
  id: string
  name: string
  email: string
  examTrack: string
}

interface ConceptBar {
  id: string
  name: string
  mastery: number
}

function timeAgo(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60_000)     return 'just now'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function conceptTitle(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function mergeStudents(...lists: Student[][]): Student[] {
  const map = new Map<string, Student>()
  for (const list of lists) {
    for (const st of list) {
      if (!st.id) continue
      map.set(st.id, { ...map.get(st.id), ...st })
    }
  }
  return Array.from(map.values())
}

export default function TutorDashboard() {
  const user = useUser()
  const navigate = useNavigate()

  const { toast, showToast } = useToast()

  const [sessions, setSessions]           = useState<Session[]>([])
  const [toReview, setToReview]           = useState<Session[]>([])
  const [studentIdByEmail, setStudentIdByEmail] = useState<Record<string, string>>({})
  const [sessionStudents, setSessionStudents] = useState<Student[]>([])
  const [extraStudents, setExtraStudents] = useState<Student[]>([])
  const students = useMemo(
    () => mergeStudents(sessionStudents, extraStudents),
    [sessionStudents, extraStudents],
  )
  const [selectedStudent, setSelectedStudent]   = useState<string>('all')
  const [chatMessages, setChatMessages]   = useState<{ senderId: string; text: string; createdAt: any }[]>([])
  const [loading, setLoading]             = useState(true)
  const [calendlyConnected, setCalendlyConnected] = useState<string | null>(null)
  const [calendlyToken, setCalendlyToken] = useState('')
  const [connectingCalendly, setConnectingCalendly] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [flaggedQs, setFlaggedQs] = useState<FlaggedQuestion[]>([])
  const [classroom, setClassroom] = useState<{ code: string; studentIds: string[] } | null>(null)
  const [classroomLoading, setClassroomLoading] = useState(true)

  // ── Assigned student (hero card) ──────────────────────────────────────────
  const [assignedStudent, setAssignedStudent] = useState<AssignedStudent | null>(null)
  const [profile, setProfile]           = useState<StudentProfileResult | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [conceptBars, setConceptBars]   = useState<ConceptBar[]>([])
  const [lastActiveTs, setLastActiveTs] = useState<number | null>(null)
  const [showIntel, setShowIntel]       = useState(false)

  // Load the first assigned student (users.assignedTutorId === tutor uid)
  useEffect(() => {
    let cancelled = false
    getDocs(query(collection(db, 'users'), where('assignedTutorId', '==', user.uid), limit(1)))
      .then(snap => {
        if (cancelled || snap.empty) return
        const d = snap.docs[0]
        const data = d.data()
        setAssignedStudent({
          id: d.id,
          name: data.displayName || data.email?.split('@')[0] || 'Student',
          email: data.email || '',
          examTrack: data.examTrack || data.exam || data.diagnosticExam || 'ACT',
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user.uid])

  // Hero student: assigned student, else the first session-derived student
  const heroStudent: AssignedStudent | null = useMemo(() => {
    if (assignedStudent) return assignedStudent
    const first = students[0]
    if (!first) return null
    return {
      id: first.id,
      name: first.displayName || first.email?.split('@')[0] || 'Student',
      email: first.email || '',
      examTrack: 'ACT',
    }
  }, [assignedStudent, students])

  // ML profile + knowledge graph + last-active for the hero student
  useEffect(() => {
    const sid = heroStudent?.id
    if (!sid) { setProfile(null); setConceptBars([]); setLastActiveTs(null); return }
    let cancelled = false
    setProfileLoading(true)

    getStudentProfile(sid)
      .then(p => { if (!cancelled) setProfile(p) })
      .finally(() => { if (!cancelled) setProfileLoading(false) })

    fetchKnowledgeGraph(sid)
      .then(kg => {
        if (cancelled || !kg?.nodes) return
        const nodes = (kg.nodes as Array<Record<string, unknown>>)
          .map(n => ({
            id: String(n.id ?? ''),
            name: String(n.name ?? conceptTitle(String(n.id ?? ''))),
            mastery: Number(n.mastery ?? 0),
            eventCount: Number(n.eventCount ?? 0),
          }))
          .filter(n => n.id && n.eventCount > 0)
          .sort((a, b) => b.eventCount - a.eventCount || b.mastery - a.mastery)
          .slice(0, 6)
        setConceptBars(nodes)
      })
      .catch(() => {})

    getDocs(query(
      collection(db, 'interactions'),
      where('studentId', '==', sid),
      orderBy('timestamp', 'desc'),
      limit(1),
    ))
      .then(snap => {
        if (cancelled || snap.empty) return
        const raw = snap.docs[0].data().timestamp
        const ts = raw?.toMillis?.() ?? (typeof raw === 'number' ? raw : 0)
        if (ts) setLastActiveTs(ts)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [heroStudent?.id])

  // Live activity feed — realtime interactions for the hero student
  useEffect(() => {
    const sid = heroStudent?.id
    if (!sid) { setActivity([]); return }
    const unsub = onSnapshot(
      query(
        collection(db, 'interactions'),
        where('studentId', '==', sid),
        orderBy('timestamp', 'desc'),
        limit(10),
      ),
      snap => setActivity(snap.docs.map(d => {
        const data = d.data()
        const raw = data.timestamp
        const ts = raw?.toMillis?.() ?? (typeof raw === 'number' ? raw : 0)
        return {
          studentId: data.studentId ?? '',
          conceptId: data.conceptId ?? '',
          outcome:   Number(data.outcome ?? 0),
          ts,
        }
      })),
      () => setActivity([])
    )
    return () => unsub()
  }, [heroStudent?.id])

  // Flagged questions — students tag questions mid-practice for their tutor.
  // Single-field query (tutorId only) so no composite index is needed;
  // unresolved filter + recency sort happen client-side.
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'flagged_questions'), where('tutorId', '==', user.uid)),
      snap => {
        const rows: FlaggedQuestion[] = snap.docs
          .map(d => {
            const data = d.data()
            if (data.resolved) return null
            return {
              id: d.id,
              studentId: data.studentId ?? '',
              studentName: data.studentName || 'Student',
              conceptName: data.conceptName ?? null,
              questionLabel: data.questionLabel ?? null,
              questionText: data.questionText ?? '',
              ts: data.createdAt?.toMillis?.() ?? 0,
            }
          })
          .filter((r): r is FlaggedQuestion => r !== null)
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 12)
        setFlaggedQs(rows)
      },
      () => setFlaggedQs([]),
    )
    return () => unsub()
  }, [user.uid])

  async function resolveFlag(flagId: string) {
    try {
      await updateDoc(doc(db, 'flagged_questions', flagId), { resolved: true })
    } catch {
      showToast('Could not update flag')
    }
  }

  // One-time parent lookup + mailto — no extra state needed
  async function emailParent(studentId: string, studentName: string) {
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('childId', '==', studentId), limit(1))
      )
      const parentEmail = snap.empty ? null : snap.docs[0].data().email
      if (!parentEmail) { showToast('No parent linked'); return }
      window.open(`mailto:${parentEmail}?subject=${encodeURIComponent(`Update on ${studentName}`)}`)
    } catch {
      showToast('No parent linked')
    }
  }

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const data = snap.data()
      if (data?.role !== 'tutor' && data?.role !== 'admin') navigate('/dashboard', { replace: true })
      if (data?.calendlyEmail) setCalendlyConnected(data.calendlyEmail)
    })
  }, [user, navigate])

  // Classroom code + roster sources beyond session bookings (join-code + admin Match stub)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setClassroomLoading(true)
      try {
        const token = await user.getIdToken()
        const extras: Student[] = []

        const cr = await fetch(`${WEBHOOK_BASE}/api/create-classroom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        })
        if (cr.ok) {
          const data = await cr.json()
          const studentIds: string[] = data.studentIds ?? []
          if (!cancelled) {
            setClassroom({ code: data.code, studentIds })
          }
          const idSnaps = await Promise.all(
            studentIds.slice(0, 30).map((id: string) => getDoc(doc(db, 'users', id))),
          )
          idSnaps.forEach(snap => {
            if (snap.exists()) {
              extras.push({ id: snap.id, ...(snap.data() as Omit<Student, 'id'>) })
            }
          })
        }

        const assignedSnap = await getDocs(
          query(collection(db, 'users'), where('assignedTutorId', '==', user.uid), limit(30)),
        )
        assignedSnap.docs.forEach(d => {
          extras.push({ id: d.id, ...(d.data() as Omit<Student, 'id'>) })
        })

        if (!cancelled) setExtraStudents(extras)
      } catch {
        if (!cancelled) setExtraStudents([])
      } finally {
        if (!cancelled) setClassroomLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  async function copyClassroomCode() {
    if (!classroom?.code) return
    try {
      await navigator.clipboard.writeText(classroom.code)
      showToast('Classroom code copied')
    } catch {
      showToast(classroom.code)
    }
  }

  async function handleConnectCalendly() {
    if (!calendlyToken.trim()) return
    setConnectingCalendly(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('https://mindcraft-webhook.vercel.app/api/register-calendly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
        setSessionStudents(list)
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

  // Default the selection to the assigned student, else the next session's student
  useEffect(() => {
    if (selectedStudent !== 'all') return
    if (heroStudent) { setSelectedStudent(heroStudent.id); return }
    const next = sessions[0]
    if (!next) return
    const sid = next.studentId ?? studentIdByEmail[next.studentEmail] ?? null
    if (sid) setSelectedStudent(sid)
  }, [heroStudent, sessions, studentIdByEmail])

  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('Delete this session?')) return
    try {
      const token = await user.getIdToken()
      const res = await fetch('https://mindcraft-webhook.vercel.app/api/delete-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sessionId: id }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
    } catch (err: any) {
      showToast(err.message ?? 'Delete failed')
    }
  }

  const now = Date.now()
  const selectedStudentData = students.find(st => st.id === selectedStudent)

  // ── Derived hero-card values ───────────────────────────────────────────────
  const hasMlData = !!profile && profile.eventCount > 0
  const masteryPct = useMemo(() => {
    if (!profile) return null
    const vals = Object.values(profile.masteryByConcept ?? {})
    if (vals.length > 0) return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100)
    if (profile.topStrengths.length > 0) {
      return Math.round(
        (profile.topStrengths.reduce((a, b) => a + b.strength, 0) / profile.topStrengths.length) * 100
      )
    }
    return null
  }, [profile])

  const activityLiveNow = activity.length > 0 && now - activity[0].ts < FIVE_MIN
  const heroFirstName = heroStudent?.name.split(' ')[0] ?? 'Your student'

  const reviewFiltered = selectedStudent === 'all'
    ? toReview
    : toReview.filter(s => s.studentId === selectedStudent || studentIdByEmail[s.studentEmail] === selectedStudent)
  const upcomingFiltered = selectedStudent === 'all'
    ? sessions
    : sessions.filter(s => s.studentId === selectedStudent || studentIdByEmail[s.studentEmail] === selectedStudent)

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className={s.shell}>
      {/* ── Top bar ── */}
      <header className={s.topBar}>
        <div className={s.topLeft}>
          <a href={MARKETING_BASE} className={s.logo}>Mind<span>Craft</span></a>
          <span className={s.topLabel}>Tutor Dashboard</span>
        </div>
        <div className={s.topRight}>
          <span className={s.topName}>{user.displayName || user.email?.split('@')[0]}</span>
          <span className={s.topDate}>{todayLabel}</span>
          <button
            className={s.signOutBtn}
            onClick={() => signOut(auth).then(() => navigate('/login', { replace: true }))}
          >
            Sign out
          </button>
        </div>
      </header>

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
              <div key={st.id}>
                <button
                  className={`${s.sideItem} ${selectedStudent === st.id ? s.sideActive : ''}`}
                  onClick={() => setSelectedStudent(st.id)}
                >
                  <div className={s.sideAvatar}>{(st.displayName || st.email)?.[0]?.toUpperCase()}</div>
                  {st.displayName || st.email?.split('@')[0]}
                </button>
                {selectedStudent === st.id && (
                  <button
                    type="button"
                    className={s.emailParentLink}
                    onClick={() => emailParent(st.id, st.displayName || st.email?.split('@')[0] || 'your student')}
                  >
                    ✉ Email parent
                  </button>
                )}
              </div>
            ))}
          </>
        )}
        <div className={s.sideDivider} />
        <p className={s.sideLabel}>My Classroom</p>
        <div className={s.classroomCard}>
          {classroomLoading ? (
            <span className={s.classroomMeta}>Loading…</span>
          ) : classroom ? (
            <>
              <div className={s.classroomCode}>{classroom.code}</div>
              <button type="button" className={s.classroomCopy} onClick={copyClassroomCode}>
                Copy code
              </button>
              <span className={s.classroomMeta}>
                {classroom.studentIds.length} student{classroom.studentIds.length !== 1 ? 's' : ''} joined via code
              </span>
            </>
          ) : (
            <span className={s.classroomMeta}>Could not load classroom</span>
          )}
        </div>
        <div className={s.sideDivider} />
        <p className={s.sideLabel}>Tools</p>
        <a href="#" className={s.sideItem}>
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Documents
        </a>
        <Link to="/admin" className={s.sideItem}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          Admin Panel
        </Link>
      </aside>

      <main className={s.page}>
        {loading ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <div className={s.grid}>
            {/* ══════════ LEFT COLUMN ══════════ */}
            <div className={s.col}>
              {/* Your Student — hero card */}
              <div className={`${s.card} ${s.heroCard}`}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Your Student</span>
                  {lastActiveTs && (
                    <span className={s.lastActive}>Last active {timeAgo(lastActiveTs)}</span>
                  )}
                </div>

                {heroStudent ? (
                  <>
                    <div className={s.heroTop}>
                      <div className={s.heroAvatar}>{heroStudent.name[0]?.toUpperCase()}</div>
                      <div className={s.heroId}>
                        <span className={s.heroName}>{heroStudent.name}</span>
                        <span className={s.heroEmail}>{heroStudent.email}</span>
                      </div>
                      <span className={s.examBadge}>{heroStudent.examTrack}</span>
                    </div>

                    {profileLoading ? (
                      <div className={s.loadRow}><div className={s.spinnerSm} /> Loading profile…</div>
                    ) : hasMlData ? (
                      <>
                        {masteryPct !== null && (
                          <div className={s.masteryRow}>
                            <span className={s.masteryNum}>{masteryPct}%</span>
                            <div className={s.masteryMeta}>
                              <span className={s.masteryLabel}>Overall mastery</span>
                              <span className={s.masterySub}>{profile!.eventCount} recorded interactions</span>
                            </div>
                          </div>
                        )}

                        {profile!.topStrengths.length > 0 && (
                          <div className={s.pillSection}>
                            <span className={s.pillTitle}>Strengths</span>
                            <div className={s.pillRow}>
                              {profile!.topStrengths.slice(0, 3).map(sw => (
                                <span key={sw.conceptId} className={s.pillStrength}>
                                  {conceptLabel(sw.conceptId)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {profile!.topWeaknesses.length > 0 && (
                          <div className={s.pillSection}>
                            <span className={s.pillTitle}>Weak spots</span>
                            <div className={s.pillRow}>
                              {profile!.topWeaknesses.slice(0, 3).map(sw => (
                                <span key={sw.conceptId} className={s.pillWeak}>
                                  {conceptLabel(sw.conceptId)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {conceptBars.length > 0 && (
                          <div className={s.barSection}>
                            <span className={s.pillTitle}>Concept mastery</span>
                            {conceptBars.map(c => (
                              <div key={c.id} className={s.barRow}>
                                <span className={s.barLabel}>{c.name}</span>
                                <div className={s.barTrack}>
                                  <div
                                    className={s.barFill}
                                    style={{ width: `${Math.round(Math.max(0, Math.min(1, c.mastery)) * 100)}%` }}
                                  />
                                </div>
                                <span className={s.barPct}>{Math.round(c.mastery * 100)}%</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <button className={s.intelToggle} onClick={() => setShowIntel(v => !v)}>
                          {showIntel ? 'Hide Intelligence Report' : 'Full Intelligence Report →'}
                        </button>
                        {showIntel && (
                          <StudentIntelPanel studentId={heroStudent.id} studentName={heroStudent.name} />
                        )}
                      </>
                    ) : (
                      <p className={s.heroEmpty}>
                        {heroFirstName} hasn't practiced yet — share the dashboard link to get started
                      </p>
                    )}
                  </>
                ) : (
                  <p className={s.heroEmpty}>
                    No students assigned yet — students appear here once they book a session or join with your classroom code.
                  </p>
                )}
              </div>

              {/* Sessions to Review — hidden entirely when empty */}
              {reviewFiltered.length > 0 && (
                <div className={s.card}>
                  <div className={s.cardHeader}>
                    <span className={s.cardLabel}>Sessions to Review</span>
                    <span className={s.reviewBadge}>{reviewFiltered.length}</span>
                  </div>
                  <div className={s.sessionList}>
                    {reviewFiltered.slice(0, 4).map(sess => (
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
                </div>
              )}

              {/* Upcoming Sessions — hidden entirely when empty */}
              {upcomingFiltered.length > 0 && (
                <div className={s.card}>
                  <div className={s.cardHeader}>
                    <span className={s.cardLabel}>Upcoming Sessions</span>
                  </div>
                  <div className={s.sessionList}>
                    {upcomingFiltered.slice(0, 5).map(sess => {
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
                              <Link to={`/chat/${sess.studentId || studentIdByEmail[sess.studentEmail]}`} className={`${s.joinLink} ${s.chatLink}`}>
                                💬
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Session summary + recent chat — hidden when both empty */}
              {(selectedStudentData?.lastSession || chatMessages.length > 0) && (
                <div className={s.card}>
                  {selectedStudentData?.lastSession && (
                    <>
                      <div className={s.cardHeader}>
                        <span className={s.cardLabel}>Session Summary</span>
                        <span className={s.cardSubName}>
                          {selectedStudentData.displayName || selectedStudentData.email?.split('@')[0]}
                        </span>
                      </div>
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
                  )}

                  {chatMessages.length > 0 && (
                    <>
                      {selectedStudentData?.lastSession && <div className={s.divider} />}
                      <div className={s.cardHeader}>
                        <span className={s.cardLabel}>Recent Chat</span>
                        {selectedStudent && selectedStudent !== 'all' && (
                          <Link to={`/chat/${selectedStudent}`} className={s.openChatLink}>Open chat →</Link>
                        )}
                      </div>
                      {chatMessages.slice(-3).map((msg, i) => {
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
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ══════════ RIGHT COLUMN ══════════ */}
            <div className={s.col}>
              {/* Flagged questions — students tagged these mid-practice */}
              {flaggedQs.length > 0 && (
                <div className={s.card}>
                  <div className={s.cardHeader}>
                    <span className={s.cardLabel}>Flagged Questions</span>
                    <span className={s.cardSubName}>{flaggedQs.length} open</span>
                  </div>
                  <div className={s.flagList}>
                    {flaggedQs.map(f => (
                      <div key={f.id} className={s.flagRow}>
                        <div className={s.flagBody}>
                          <div className={s.flagMeta}>
                            <span className={s.flagStudent}>{f.studentName}</span>
                            {f.conceptName && <span className={s.flagConcept}>{f.conceptName}</span>}
                            <span className={s.flagTime}>{timeAgo(f.ts)}</span>
                          </div>
                          <div className={s.flagText}>
                            {f.questionLabel ? `${f.questionLabel} · ` : ''}{f.questionText}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={s.flagResolve}
                          onClick={() => void resolveFlag(f.id)}
                          title="Mark reviewed"
                          aria-label="Mark reviewed"
                        >
                          ✓
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Activity */}
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabelRow}>
                    {activityLiveNow && <span className={s.livePip} />}
                    <span className={s.cardLabel}>Live Activity</span>
                  </span>
                </div>
                {activity.length === 0 ? (
                  <p className={s.emptyText}>No practice activity yet</p>
                ) : (
                  <div className={s.feedList}>
                    {activity.map((a, i) => {
                      const mark = a.outcome > 0.3
                        ? { sym: '✓', cls: s.feedGood }
                        : a.outcome < -0.1
                          ? { sym: '✗', cls: s.feedBad }
                          : { sym: '~', cls: s.feedMid }
                      return (
                        <div key={`${a.studentId}-${a.ts}-${i}`} className={s.feedRow}>
                          <span className={`${s.feedMark} ${mark.cls}`}>{mark.sym}</span>
                          <span className={s.feedText}>{conceptTitle(a.conceptId) || 'Practice'}</span>
                          <span className={s.feedTime}>{timeAgo(a.ts)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Quick Actions</span>
                </div>
                <div className={s.actionList}>
                  <a
                    className={s.actionBtn}
                    href={heroStudent?.email
                      ? `mailto:${heroStudent.email}?subject=${encodeURIComponent('MindCraft Update')}`
                      : undefined}
                    onClick={e => { if (!heroStudent?.email) { e.preventDefault(); showToast('No student email yet') } }}
                  >
                    ✉ Email student
                  </a>
                  <button
                    className={s.actionBtn}
                    onClick={() => {
                      if (!heroStudent) { showToast('No student assigned yet'); return }
                      void emailParent(heroStudent.id, heroStudent.name)
                    }}
                  >
                    ✉ Email parent
                  </button>
                  <button className={s.actionBtn} onClick={() => navigate('/knowledge-graph')}>
                    📋 View Map →
                  </button>
                </div>
              </div>

              {/* Calendly */}
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Calendly</span>
                  {calendlyConnected && <span className={`${s.reviewBadge} ${s.connectedBadge}`}>Connected</span>}
                </div>
                {calendlyConnected ? (
                  <div className={s.calendlyDone}>✓ Connected · {calendlyConnected}</div>
                ) : (
                  <>
                    <p className={s.calendlyHint}>
                      Paste your Calendly Personal Access Token to auto-register your bookings and Fireflies recording.
                    </p>
                    <input
                      className={s.tokenInput}
                      type="password"
                      autoComplete="off"
                      placeholder="Personal Access Token"
                      value={calendlyToken}
                      onChange={e => setCalendlyToken(e.target.value)}
                    />
                    <button className={s.btnPrimary}
                      onClick={handleConnectCalendly} disabled={connectingCalendly || !calendlyToken.trim()}>
                      {connectingCalendly ? 'Connecting…' : 'Connect Calendly →'}
                    </button>
                    <p className={s.calendlyFoot}>
                      Get it at calendly.com → Integrations → API & Webhooks
                    </p>
                  </>
                )}
              </div>

              {/* Session Notes (stub) */}
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Notes</span>
                </div>
                <p className={s.emptyText}>
                  Session notes coming soon — use Fireflies transcript in session review.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  )
}
