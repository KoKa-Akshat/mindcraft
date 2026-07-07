/**
 * Admin.tsx
 *
 * Internal admin panel — accessible only to users with role: 'admin'.
 *
 * Features:
 *   - View all sessions across all tutors and students
 *   - Manually create sessions (useful for non-Calendly bookings)
 *   - Update session status
 */

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  collection, query, orderBy, onSnapshot,
  doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocs, where, deleteField, limit,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import { useToast } from '../hooks/useToast'
import { fmtDateTime } from '../utils/format'
import { listAllActConceptCoverage, coverageSummaryLine, formatQuestionSources, type ConceptCoverage } from '../lib/ontologyBankCoverage'
import StudentIntelPanel from '../components/StudentIntelPanel'
import s from './Admin.module.css'

// Test account — excluded / flagged everywhere in admin views
const TEST_EMAIL = 'shreeyutk@gmail.com'

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

function activityBadge(lastActive: number | null): { label: string; cls: 'active' | 'slowing' | 'inactive' } {
  if (!lastActive) return { label: 'Inactive', cls: 'inactive' }
  const days = (Date.now() - lastActive) / 86400000
  if (days < 7)   return { label: 'Active',   cls: 'active' }
  if (days <= 21) return { label: 'Slowing',  cls: 'slowing' }
  return { label: 'Inactive', cls: 'inactive' }
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#3A8500',
  completed: '#4A7BF7',
  cancelled: '#8A8F98',
}

const SUBJECTS = [
  'AP Calculus', 'Pre-Calculus', 'Algebra', 'Statistics',
  'AP Physics', 'Chemistry', 'SAT Prep', 'Other',
]

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
  const [matchTutorPick, setMatchTutorPick] = useState<Record<string, string>>({})
  const [tab, setTab]           = useState<'sessions' | 'students' | 'parents' | 'match' | 'new' | 'testing'>('sessions')
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

  // Parents + tutors — loaded once (parents feed the stats bar too)
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
    const real = students.filter(st => st.email !== TEST_EMAIL)
    Promise.all(real.map(async st => {
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

    const ref = doc(collection(db, 'sessions'))
    await setDoc(ref, {
      studentEmail: form.studentEmail.trim(),
      studentName:  form.studentName.trim() || form.studentEmail.split('@')[0],
      studentId,
      tutorId:   user.uid,
      tutorName: 'Akshat K.',
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
        nextSession: { subject: form.subject, time: timeStr, tutor: 'Akshat K.' }
      })
    }

    setForm({ studentEmail: '', studentName: '', subject: 'AP Calculus', duration: '60', date: '', time: '', meetingUrl: '' })
    setTab('sessions')
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

  async function assignTutor(studentId: string) {
    const tid = matchTutorPick[studentId] || tutors[0]?.id
    const t = tutors.find(x => x.id === tid)
    if (!t) { showToast('No tutors available to assign.'); return }
    try {
      await updateDoc(doc(db, 'users', studentId), {
        assignedTutorId:   t.id,
        assignedTutorName: t.displayName || t.email,
      })
      setStudents(prev => prev.map(st =>
        st.id === studentId ? { ...st, assignedTutorName: t.displayName || t.email } : st
      ))
      showToast(`Assigned ${t.displayName || t.email}`)
    } catch {
      showToast('Assignment failed — check permissions.')
    }
  }

  const realStudents = students.filter(st => st.email !== TEST_EMAIL)

  const thirtyDaysAgo = Date.now() - 30 * 86400000
  const unmatchedStudents = realStudents.filter(st =>
    !sessions.some(x =>
      (x.studentId === st.id || (st.email && x.studentEmail === st.email)) &&
      x.scheduledAt > thirtyDaysAgo
    )
  )

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

  const counts = {
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    completed: sessions.filter(s => s.status === 'completed').length,
  }

  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <Link to="/" className={s.logo}>Mind<span>Craft</span> <em>Admin</em></Link>
        <div className={s.navRight}>
          <span className={s.navEmail}>{user.email}</span>
          <Link to="/" className={s.navLink}>Dashboard →</Link>
        </div>
      </nav>

      <div className={s.body}>
        <div className={s.stats}>
          {[
            { label: 'Upcoming', val: counts.scheduled, color: '#3A8500', bg: 'rgba(88,204,2,.08)' },
            { label: 'Completed', val: counts.completed, color: '#4A7BF7', bg: 'rgba(74,123,247,.08)' },
            { label: 'Students', val: students.length, color: '#F59E0B', bg: 'rgba(245,158,11,.08)' },
            { label: 'Parents linked', val: parents.filter(p => p.childId).length, color: '#8B5CF6', bg: 'rgba(139,92,246,.08)' },
          ].map(st => (
            <div key={st.label} className={s.statCard} style={{ background: st.bg, border: `1px solid ${st.bg}` }}>
              <div className={s.statVal} style={{ color: st.color }}>{st.val}</div>
              <div className={s.statLabel}>{st.label}</div>
            </div>
          ))}
          <a href="https://calendly.com/joinmindcraft/30min" target="_blank" rel="noopener" className={s.calendlyBtn}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            View Calendly
          </a>
        </div>

        <div className={s.tabs}>
          <button className={`${s.tab} ${tab === 'sessions' ? s.tabActive : ''}`} onClick={() => setTab('sessions')}>
            All Sessions
          </button>
          <button className={`${s.tab} ${tab === 'students' ? s.tabActive : ''}`} onClick={() => setTab('students')}>
            Students
          </button>
          <button className={`${s.tab} ${tab === 'parents' ? s.tabActive : ''}`} onClick={() => setTab('parents')}>
            Parents
          </button>
          <button className={`${s.tab} ${tab === 'match' ? s.tabActive : ''}`} onClick={() => setTab('match')}>
            Match
          </button>
          <button className={`${s.tab} ${tab === 'new' ? s.tabActive : ''}`} onClick={() => setTab('new')}>
            + Book Session
          </button>
          <button className={`${s.tab} ${tab === 'testing' ? s.tabActive : ''}`} onClick={() => setTab('testing')}>
            Testing
          </button>
        </div>

        {tab === 'sessions' && (
          <div className={s.tableWrap}>
            {loading ? (
              <div className={s.empty}>Loading…</div>
            ) : sessions.length === 0 ? (
              <div className={s.empty}>No sessions yet. Book one or wait for Calendly bookings.</div>
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Student</th><th>Subject</th><th>Scheduled</th><th>Duration</th><th>Status</th><th>Zoom</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(sess => (
                    <tr key={sess.id}>
                      <td>
                        <div className={s.studentName}>{sess.studentName}</div>
                        <div className={s.studentEmail}>{sess.studentEmail}</div>
                      </td>
                      <td><span className={s.subject}>{sess.subject}</span></td>
                      <td className={s.dateCell}>{fmtDateTime(sess.scheduledAt)}</td>
                      <td>{sess.duration}</td>
                      <td>
                        <span className={s.statusBadge} style={{ color: STATUS_COLOR[sess.status], background: STATUS_COLOR[sess.status] + '18' }}>
                          {sess.status}
                        </span>
                      </td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'students' && (
          <div className={s.tableWrap}>
            {realStudents.length === 0 ? (
              <div className={s.empty}>No students yet.</div>
            ) : (
              <div className={s.rowList}>
                {realStudents.map(st => {
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

        {tab === 'parents' && (
          <div className={s.tableWrap}>
            {parents.length === 0 ? (
              <div className={s.empty}>No parent accounts yet.</div>
            ) : (
              <div className={s.rowList}>
                {parents.map(p => {
                  const name = p.displayName || p.email?.split('@')[0] || 'Parent'
                  const childName = p.childId ? (childNames[p.childId] ?? '…') : null
                  return (
                    <div key={p.id} className={s.studentRow}>
                      <div className={s.rowAvatar}>{name[0]?.toUpperCase()}</div>
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

        {tab === 'match' && (
          <>
            <div className={s.matchBanner}>
              Full classroom model is coming — this is a manual assignment stub.
            </div>
            <div className={s.matchGrid}>
              <div className={s.tableWrap}>
                <div className={s.matchColTitle}>Unmatched Students</div>
                {unmatchedStudents.length === 0 ? (
                  <div className={s.empty}>Every student has had a session in the last 30 days.</div>
                ) : (
                  <div className={s.rowList}>
                    {unmatchedStudents.map(st => {
                      const name = st.displayName || st.email?.split('@')[0] || 'Student'
                      return (
                        <div key={st.id} className={s.studentRow}>
                          <div className={s.rowAvatar}>{name[0]?.toUpperCase()}</div>
                          <div className={s.rowMain}>
                            <div className={s.studentName}>{name}</div>
                            <div className={s.studentEmail}>{st.email}</div>
                          </div>
                          <select
                            className={s.matchSelect}
                            value={matchTutorPick[st.id] ?? tutors[0]?.id ?? ''}
                            onChange={e => setMatchTutorPick(prev => ({ ...prev, [st.id]: e.target.value }))}
                          >
                            {tutors.map(t => (
                              <option key={t.id} value={t.id}>{t.displayName || t.email}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={s.actionBtn}
                            onClick={() => assignTutor(st.id)}
                            disabled={tutors.length === 0}
                          >
                            Assign
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className={s.tableWrap}>
                <div className={s.matchColTitle}>Active Tutors</div>
                {tutors.length === 0 ? (
                  <div className={s.empty}>No tutor accounts yet.</div>
                ) : (
                  <div className={s.rowList}>
                    {tutors.map(t => {
                      const name = t.displayName || t.email?.split('@')[0] || 'Tutor'
                      const load = tutorLoad(t.id)
                      return (
                        <div key={t.id} className={s.studentRow}>
                          <div className={s.rowAvatar}>{name[0]?.toUpperCase()}</div>
                          <div className={s.rowMain}>
                            <div className={s.studentName}>{name}</div>
                            <div className={s.studentEmail}>{t.email}</div>
                          </div>
                          <div className={s.rowStat}>
                            <span className={s.rowStatNum}>{load}</span>
                            <span className={s.rowStatLabel}>{load === 1 ? 'Student' : 'Students'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'new' && (
          <div className={s.formCard}>
            <h2 className={s.formTitle}>Book a Session</h2>
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
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
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
        )}

        {tab === 'testing' && (
          <>
            <div className={s.formCard}>
              <h2 className={s.formTitle}>Gap scan testing</h2>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--mu)', lineHeight: 1.5 }}>
                Clears <code>diagnosticCompleted</code> so the student re-takes exam pick + confidence
                ratings on next login.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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

            <div className={`${s.formCard} ${s.formCardWide}`} style={{ marginTop: 20 }}>
              <h2 className={s.formTitle}>ACT question bank coverage</h2>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--mu)', lineHeight: 1.5 }}>
                {coverageSummary}. Static questions live in{' '}
                <code>app/src/lib/questionBank.ts</code>; verified generated batches merge from{' '}
                <code>app/src/data/generatedQuestions.json</code>. Re-run{' '}
                <code>python3 ml/scripts/audit_act_ontology_question_bank.py</code> after edits.
              </p>
              <div className={s.tableWrap}>
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
                              color: row.status === 'full' ? '#3A8500' : '#F59E0B',
                              background: row.status === 'full' ? 'rgba(88,204,2,.08)' : 'rgba(245,158,11,.08)',
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
      </div>

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
