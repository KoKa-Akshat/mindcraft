import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  collection, query, orderBy, onSnapshot,
  doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocs, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import s from './Admin.module.css'

interface Session {
  id: string
  studentName: string
  studentEmail: string
  studentId: string | null
  tutorName: string
  tutorId: string | null
  subject: string
  date: string
  duration: string
  scheduledAt: number
  status: 'scheduled' | 'completed' | 'cancelled'
  meetingUrl: string | null
}

interface Student {
  id: string
  displayName: string
  email: string
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#3A8500',
  completed: '#4A7BF7',
  cancelled: '#8A8F98',
}

const SUBJECTS = ['AP Calculus', 'Pre-Calculus', 'Algebra', 'Statistics', 'AP Physics', 'Chemistry', 'SAT Prep', 'Other']

function fmt(ms: number) {
  const d = new Date(ms)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function Admin() {
  const user = useUser()
  const navigate = useNavigate()

  const [sessions, setSessions]     = useState<Session[]>([])
  const [students, setStudents]     = useState<Student[]>([])
  const [tab, setTab]               = useState<'sessions' | 'new'>('sessions')
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState('')

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
        setSessions(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Session, 'id'>) })))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])

  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'student')))
      .then(snap => setStudents(
        snap.docs.map(d => ({ id: d.id, displayName: d.data().displayName, email: d.data().email }))
      ))
      .catch(() => {})
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

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

  async function updateStatus(id: string, status: Session['status']) {
    await updateDoc(doc(db, 'sessions', id), { status })
    showToast(`Marked as ${status}`)
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
          <button className={`${s.tab} ${tab === 'new' ? s.tabActive : ''}`} onClick={() => setTab('new')}>
            + Book Session
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
                      <td className={s.dateCell}>{fmt(sess.scheduledAt)}</td>
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
      </div>

      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  )
}
