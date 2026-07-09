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
import { ML_BASE, WEBHOOK_BASE } from '../lib/mlApi'
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

type AdminTab = 'overview' | 'students' | 'tutors' | 'parents' | 'sessions' | 'health' | 'settings'
type HealthStatus = 'checking' | 'healthy' | 'warning' | 'down' | 'unknown'

interface HealthCheck {
  id: string
  label: string
  status: HealthStatus
  plain: string
  detail: string
  action: string
  meta?: string
}

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
    id: 'health', label: 'Health',
    icon: <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 8L9 4l-3 8H2"/><path d="M12 21a9 9 0 1 0-8.5-12"/></svg>,
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
  health:   { title: 'System Health', sub: 'Plain-English status for backend, data flow, content, and routes' },
  settings: { title: 'Settings',  sub: 'Platform configuration and testing tools' },
}

function statusCopy(status: HealthStatus): string {
  if (status === 'healthy') return 'Working'
  if (status === 'warning') return 'Needs attention'
  if (status === 'down') return 'Down'
  if (status === 'checking') return 'Checking'
  return 'Unknown'
}

function statusClass(status: HealthStatus): string {
  if (status === 'healthy') return s.healthGood
  if (status === 'warning') return s.healthWarn
  if (status === 'down') return s.healthBad
  if (status === 'checking') return s.healthCheck
  return s.healthUnknown
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
  const [parentMatch, setParentMatch] = useState<Record<string, string>>({})
  const [tab, setTab]           = useState<AdminTab>('overview')
  const [bookOpen, setBookOpen] = useState(false)
  const [coverageRows]          = useState<ConceptCoverage[]>(() => listAllActConceptCoverage())
  const [coverageSummary]       = useState(() => coverageSummaryLine())
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([])
  const [healthLoading, setHealthLoading] = useState(false)
  const [openHealth, setOpenHealth] = useState<string>('backend')
  const [healthUpdatedAt, setHealthUpdatedAt] = useState<number | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  const storyCount = coverageRows.length
  const generatedQuestionCount = coverageRows.reduce((sum, row) => (
    sum + (row.questionSources ?? [])
      .filter(src => src.file.includes('generatedQuestions'))
      .reduce((inner, src) => inner + src.count, 0)
  ), 0)
  const contextFrameCount = coverageRows.length
  const diagnosticConceptCount = coverageRows.filter(row => row.questionCounts.L1 + row.questionCounts.L2 + row.questionCounts.L3 > 0).length

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

  async function refreshHealth() {
    setHealthLoading(true)
    const checks: HealthCheck[] = []

    const mlStartedAt = Date.now()
    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 9000)
      const res = await fetch(`${ML_BASE}/health`, { signal: controller.signal })
      window.clearTimeout(timeout)
      const elapsed = Date.now() - mlStartedAt
      if (res.ok) {
        const data = await res.json().catch(() => ({})) as {
          conceptCount?: number
          actTestedConceptCount?: number
          ingredientCount?: number
          edgeCount?: number
          embeddingsLoaded?: boolean
        }
        checks.push({
          id: 'backend',
          label: 'ML backend',
          status: data.embeddingsLoaded === false ? 'warning' : 'healthy',
          plain: 'Route intelligence is reachable.',
          detail: `Cloud Run responded in ${elapsed}ms. Concepts: ${data.conceptCount ?? 'unknown'}, ACT-tested: ${data.actTestedConceptCount ?? 'unknown'}, ingredients: ${data.ingredientCount ?? 'unknown'}, graph edges: ${data.edgeCount ?? 'unknown'}.`,
          action: data.embeddingsLoaded === false
            ? 'Embeddings did not report as loaded. Check the Cloud Run image and startup logs.'
            : 'No action needed. Recommendations, knowledge map, and live gap detection can run.',
          meta: ML_BASE,
        })
      } else {
        checks.push({
          id: 'backend',
          label: 'ML backend',
          status: 'down',
          plain: 'Route intelligence is not serving requests.',
          detail: `/health returned HTTP ${res.status}. The app can still show static fallback paths, but live gaps, recommendations, and the knowledge map are degraded.`,
          action: 'Read Cloud Run logs for mindcraft-ml, then redeploy with FIRESTORE_PROJECT and ML_SERVICE_SECRET set.',
          meta: ML_BASE,
        })
      }
    } catch (err) {
      checks.push({
        id: 'backend',
        label: 'ML backend',
        status: 'down',
        plain: 'Route intelligence could not be reached.',
        detail: err instanceof Error ? err.message : 'The browser could not complete the health request.',
        action: 'Confirm the Cloud Run service is up and that VITE_ML_URL points to the live service.',
        meta: ML_BASE,
      })
    }

    try {
      const [userProbe, sessionProbe, graphProbe, interactionProbe] = await Promise.all([
        getDocs(query(collection(db, 'users'), limit(1))),
        getDocs(query(collection(db, 'sessions'), limit(1))),
        getDocs(query(collection(db, 'knowledge_graphs'), limit(1))).catch(() => null),
        getDocs(query(collection(db, 'interactions'), limit(1))).catch(() => null),
      ])
      const graphReadable = graphProbe !== null
      const interactionReadable = interactionProbe !== null
      checks.push({
        id: 'firestore',
        label: 'Firestore data',
        status: graphReadable && interactionReadable ? 'healthy' : 'warning',
        plain: 'Core app data is readable.',
        detail: `Users collection: ${userProbe.empty ? 'empty' : 'readable'}. Sessions collection: ${sessionProbe.empty ? 'empty' : 'readable'}. Knowledge graphs: ${graphReadable ? 'readable' : 'blocked or missing'}. Interactions: ${interactionReadable ? 'readable' : 'blocked or missing'}.`,
        action: graphReadable && interactionReadable
          ? 'No action needed for basic admin reads.'
          : 'Check Firestore rules, indexes, and whether the ML service is writing graph/interactions documents.',
      })
    } catch (err) {
      checks.push({
        id: 'firestore',
        label: 'Firestore data',
        status: 'down',
        plain: 'Admin could not read core Firestore data.',
        detail: err instanceof Error ? err.message : 'Firestore read failed.',
        action: 'Check Firebase auth role, Firestore rules, and project mindcraft-93858.',
      })
    }

    const fullCoverage = coverageRows.filter(row => row.status === 'full').length
    const playableCoverage = coverageRows.filter(row => row.questionCounts.L1 + row.questionCounts.L2 + row.questionCounts.L3 > 0).length
    checks.push({
      id: 'questions',
      label: 'Question banks',
      status: fullCoverage === coverageRows.length ? 'healthy' : playableCoverage > 0 ? 'warning' : 'down',
      plain: fullCoverage === coverageRows.length
        ? 'ACT question coverage is complete.'
        : 'Some concepts need more questions.',
      detail: `${coverageSummary}. ${playableCoverage}/${coverageRows.length} ACT concepts have at least one playable question. Generated verified questions bundled: ${generatedQuestionCount}.`,
      action: fullCoverage === coverageRows.length
        ? 'Keep auditing after every question-bank edit.'
        : 'Open Settings > ACT question bank coverage and fill the partial or empty concepts first.',
    })

    checks.push({
      id: 'stories',
      label: 'Stories and context',
      status: storyCount > 0 && contextFrameCount > 0 ? 'healthy' : 'warning',
      plain: 'Story content is bundled into the app.',
      detail: `${storyCount} concept stories and ${contextFrameCount} question context frames are available. These power the chapter/story feel around practice questions.`,
      action: storyCount > 0 && contextFrameCount > 0
        ? 'No action needed. Review story quality as routes expand.'
        : 'Add missing concept stories or context frames so practice does not feel generic.',
    })

    checks.push({
      id: 'diagnostic',
      label: 'Diagnostic pipeline',
      status: diagnosticConceptCount > 0 ? 'healthy' : 'warning',
      plain: 'Diagnostic content exists; backend health decides whether it becomes a live route.',
      detail: `Diagnostic concept/question seed count: ${diagnosticConceptCount}. The frontend writes confidence through seedAssessment and practice outcomes through recordOutcomes.`,
      action: 'If students see "no gap found", verify ML backend health first, then confirm /seed-assessment and /record-outcomes succeed after a diagnostic.',
    })

    checks.push({
      id: 'webhook',
      label: 'Webhook and AI helpers',
      status: WEBHOOK_BASE ? 'unknown' : 'warning',
      plain: WEBHOOK_BASE ? 'Webhook URL is configured, but not deeply probed from the browser.' : 'Webhook URL is missing.',
      detail: `Configured webhook base: ${WEBHOOK_BASE || 'none'}. This supports parent linking, agent check-ins, generated questions, summaries, and story modules.`,
      action: 'For deeper verification, test Vercel function logs and server-to-server secrets. Browser admin should avoid calling mutating webhook endpoints as a health check.',
      meta: WEBHOOK_BASE,
    })

    if (WEBHOOK_BASE) {
      try {
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 8000)
        const res = await fetch(`${WEBHOOK_BASE}/api/story-module`, {
          method: 'OPTIONS',
          signal: controller.signal,
        })
        window.clearTimeout(timeout)
        checks.push({
          id: 'story-agent',
          label: 'Story module (Groq)',
          status: res.ok ? 'healthy' : 'warning',
          plain: res.ok ? 'Story agent endpoint is reachable.' : 'Story agent responded with an error.',
          detail: res.ok
            ? 'OPTIONS /api/story-module succeeded. Practice sessions can request story-wrapped stems when GROQ_API_KEY is set on Vercel.'
            : `OPTIONS /api/story-module returned HTTP ${res.status}. Students will see plain question stems until this is fixed.`,
          action: res.ok
            ? 'If stems still feel generic, bump story_module_cache version and redeploy webhook.'
            : 'Redeploy webhook (≤12 functions), confirm story-module is in vercel.json, and verify GROQ_API_KEY.',
          meta: `${WEBHOOK_BASE}/api/story-module`,
        })
      } catch (err) {
        checks.push({
          id: 'story-agent',
          label: 'Story module (Groq)',
          status: 'down',
          plain: 'Story agent could not be reached.',
          detail: err instanceof Error ? err.message : 'Network error probing story-module.',
          action: 'Deploy webhook to Vercel prod and confirm CORS allows the admin origin.',
          meta: `${WEBHOOK_BASE}/api/story-module`,
        })
      }
    }

    setHealthChecks(checks)
    setHealthUpdatedAt(Date.now())
    setHealthLoading(false)
  }

  useEffect(() => {
    if (tab !== 'health' || healthChecks.length > 0 || healthLoading) return
    void refreshHealth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

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
    // Clear all diagnostic state: Firestore flags + practice drafts.
    // Local storage (practiceState.ts keys) is cleared by the student's
    // own browser on their next page load once diagnosticCompleted is gone.
    await updateDoc(doc(db, 'users', uid), {
      diagnosticCompleted: deleteField(),
      diagnosticCompletedAt: deleteField(),
      practiceDrafts: deleteField(),
      practiceDraftAt: deleteField(),
    })
    showToast('Diagnostic fully reset — student will re-run gap scan on next visit.')
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

  async function linkParentChild(parentUid: string) {
    const childEmail = (parentMatch[parentUid] ?? '').trim().toLowerCase()
    if (!childEmail) { showToast('Enter the child email first.'); return }
    try {
      const token = await auth.currentUser?.getIdToken(true)
      if (!token) { showToast('Sign in again.'); return }
      const res = await fetch(`${WEBHOOK_BASE}/api/link-child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ parentUid, childEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? 'Parent link failed.')
        return
      }
      setParents(prev => prev.map(p => p.id === parentUid ? { ...p, childId: data.childId } : p))
      setParentMatch(prev => ({ ...prev, [parentUid]: '' }))
      showToast('Parent linked.')
    } catch {
      showToast('Parent link failed.')
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

  const systemStatus: HealthStatus = healthChecks.some(x => x.status === 'down')
    ? 'down'
    : healthChecks.some(x => x.status === 'warning')
      ? 'warning'
      : healthChecks.some(x => x.status === 'checking')
        ? 'checking'
        : healthChecks.length > 0 ? 'healthy' : 'unknown'

  const healthCounts = {
    working: healthChecks.filter(x => x.status === 'healthy').length,
    attention: healthChecks.filter(x => x.status === 'warning').length,
    down: healthChecks.filter(x => x.status === 'down').length,
    unknown: healthChecks.filter(x => x.status === 'unknown').length,
  }

  const healthById = Object.fromEntries(healthChecks.map(check => [check.id, check]))

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
        <div className={s.sideDivider} />
        <span className={s.sideRole} style={{ padding: '0 4px' }}>View dashboards</span>
        <Link to="/tutor" className={s.sideItem}>
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          Tutor Dashboard
        </Link>
        <Link to="/parent" className={s.sideItem}>
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Parent Dashboard
        </Link>
        <Link to="/dashboard" className={s.sideItem}>
          <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Student Dashboard
        </Link>
        <Link to="/practice" className={s.sideItem}>
          <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
          Practice
        </Link>
        <Link to="/knowledge-graph" className={s.sideItem}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          Map
        </Link>
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
                        <>
                          <input
                            className={s.assignSelect}
                            type="email"
                            placeholder="child@email.com"
                            value={parentMatch[p.id] ?? ''}
                            onChange={e => setParentMatch(prev => ({ ...prev, [p.id]: e.target.value }))}
                          />
                          <button
                            type="button"
                            className={s.actionBtn}
                            onClick={() => linkParentChild(p.id)}
                            disabled={!parentMatch[p.id]?.trim()}
                          >
                            Match
                          </button>
                        </>
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

        {/* ── HEALTH ── */}
        {tab === 'health' && (
          <>
            <div className={`${s.healthHero} ${statusClass(systemStatus)}`}>
              <div>
                <span className={s.healthKicker}>system health</span>
                <h2>
                  {systemStatus === 'healthy' ? 'All systems working.'
                    : systemStatus === 'down' ? 'Something is down.'
                    : systemStatus === 'warning' ? 'A few things need attention.'
                    : healthLoading ? 'Running checks…' : 'Not checked yet.'}
                </h2>
                <p>
                  Plain-English status for the pieces students actually feel: the route
                  intelligence, the data store, question and story content, the diagnostic
                  loop, and the AI helpers.
                </p>
              </div>
              <div className={s.healthHeroRight}>
                <span className={`${s.healthOverall} ${statusClass(systemStatus)}`}>
                  {statusCopy(systemStatus)}
                </span>
                {healthUpdatedAt && (
                  <span className={s.healthUpdated}>checked {fmtDateTime(healthUpdatedAt)}</span>
                )}
                <button
                  type="button"
                  className={s.actionBtn}
                  onClick={() => void refreshHealth()}
                  disabled={healthLoading}
                >
                  {healthLoading ? 'Checking…' : 'Re-run checks'}
                </button>
              </div>
            </div>

            <div className={s.healthMetricGrid}>
              <div className={s.healthMetric}><span>{healthCounts.working}</span><p>working</p></div>
              <div className={s.healthMetric}><span>{healthCounts.attention}</span><p>need attention</p></div>
              <div className={s.healthMetric}><span>{healthCounts.down}</span><p>down</p></div>
              <div className={s.healthMetric}><span>{healthCounts.unknown}</span><p>not probed</p></div>
            </div>

            <div className={s.healthLayout}>
              <div className={s.healthList}>
                {healthChecks.length === 0 && (
                  <div className={s.card}>
                    <div className={s.empty}>
                      {healthLoading ? 'Running health checks…' : 'No checks run yet.'}
                    </div>
                  </div>
                )}
                {healthChecks.map(check => {
                  const open = openHealth === check.id
                  return (
                    <article key={check.id} className={s.healthItem}>
                      <button
                        type="button"
                        className={s.healthItemHead}
                        onClick={() => setOpenHealth(open ? '' : check.id)}
                        aria-expanded={open}
                      >
                        <span className={`${s.healthDot} ${statusClass(check.status)}`} aria-hidden="true" />
                        <span className={s.healthItemMain}>
                          <strong>{check.label}</strong>
                          <small>{check.plain}</small>
                        </span>
                        <span className={`${s.healthPill} ${statusClass(check.status)}`}>
                          {statusCopy(check.status)}
                        </span>
                      </button>
                      {open && (
                        <div className={s.healthDetail}>
                          {check.meta && <code>{check.meta}</code>}
                          <p>{check.detail}</p>
                          <strong>what to do</strong>
                          <p>{check.action}</p>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>

              <div className={s.healthList}>
                <div className={s.card}>
                  <div className={s.cardTitleRow}>
                    <span className={s.cardTitle}>Content inventory</span>
                  </div>
                  <div className={s.inventoryGrid}>
                    <div><strong>{coverageRows.length}</strong><span>ACT concepts tracked</span></div>
                    <div><strong>{diagnosticConceptCount}</strong><span>concepts with playable questions</span></div>
                    <div><strong>{storyCount}</strong><span>concept stories bundled</span></div>
                    <div><strong>{generatedQuestionCount}</strong><span>verified generated questions</span></div>
                  </div>
                </div>

                <div className={s.card}>
                  <div className={s.cardTitleRow}>
                    <span className={s.cardTitle}>How a student flows through</span>
                  </div>
                  <div className={s.flowGrid}>
                    <div className={s.flowStep}>
                      <span>1</span>
                      <strong>Gap scan</strong>
                      <p>Confidence ratings seed the knowledge graph via /seed-assessment.</p>
                    </div>
                    <div className={s.flowStep}>
                      <span>2</span>
                      <strong>Route</strong>
                      <p>/recommend turns the graph into a trimmed study path with severities.</p>
                    </div>
                    <div className={s.flowStep}>
                      <span>3</span>
                      <strong>Practice</strong>
                      <p>Outcomes flow back through /record-outcomes and the loop tightens.</p>
                    </div>
                  </div>
                  <div className={s.healthNarrative}>
                    <p>
                      If any check above is down, this loop is where students feel it —
                      "no gap found" on the dashboard almost always means the ML backend
                      check failed, not that the student has no gaps ({healthById.backend
                        ? statusCopy(healthById.backend.status).toLowerCase()
                        : 'unchecked'} right now).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
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
