/**
 * TutorDashboard.tsx
 *
 * Home: photo (click = home) + Profile; right-side Calendly / GMeet / Location squares.
 * Student briefing only after a student is picked. Location uses an interactive map pin.
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
import TutorBriefingPanel from '../components/TutorBriefingPanel'
import SessionCallCard from '../components/SessionCallCard'
import TutorProfilePanel, { type TutorProfileData } from '../components/TutorProfilePanel'
import TutorLocationPin from '../components/TutorLocationPin'
import type { LatLng } from '../lib/geo'
import s from './TutorDashboard.module.css'
import { MARKETING_BASE } from '../lib/siteUrls'
import { getStudentProfile, conceptLabel, type StudentProfileResult } from '../lib/mlApi'
import { fetchKnowledgeGraph } from '../lib/graphCache'

type DashPanel = 'home' | 'student' | 'profile' | 'notes'
const CALENDLY_GUIDE = '/guides/calendly-setup.html'
const GMEET_GUIDE = '/guides/gmeet-setup.html'

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
  const [selectedStudent, setSelectedStudent]   = useState<string | null>(null)
  const [chatMessages, setChatMessages]   = useState<{ senderId: string; text: string; createdAt: any }[]>([])
  const [loading, setLoading]             = useState(true)
  const [calendlyConnected, setCalendlyConnected] = useState<string | null>(null)
  const [calendlyToken, setCalendlyToken] = useState('')
  const [connectingCalendly, setConnectingCalendly] = useState(false)
  // Google Meet - the tutor's permanent personal room, used as the join-link
  // fallback for sessions that Calendly didn't stamp with a meetingUrl.
  const [meetUrl, setMeetUrl] = useState<string | null>(null)
  const [meetUrlInput, setMeetUrlInput] = useState('')
  const [savingMeetUrl, setSavingMeetUrl] = useState(false)
  const [editingMeetUrl, setEditingMeetUrl] = useState(false)
  // Real tutor location (FIND_A_TUTOR_MAP_PLAN groundwork) - see handleSaveLocation
  // below for the full rationale. Geocoded once here, read by FindTutor.tsx and
  // the marketing site's map panel the moment it exists on this doc.
  const [locationAddress, setLocationAddress] = useState<string | null>(null)
  const [locationInput, setLocationInput] = useState('')
  const [savingLocation, setSavingLocation] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [flaggedQs, setFlaggedQs] = useState<FlaggedQuestion[]>([])
  const [panel, setPanel] = useState<DashPanel>('home')
  const [locationLatLng, setLocationLatLng] = useState<LatLng | null>(null)
  const [tutorProfile, setTutorProfile] = useState<TutorProfileData>({
    displayName: user.displayName || user.email?.split('@')[0] || 'Tutor',
    email: user.email || '',
    bio: '',
    photoUrl: null,
    resumeUrl: null,
    locationAddress: null,
  })
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionNotesId, setSessionNotesId] = useState<string | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [connectChip, setConnectChip] = useState<null | 'calendly' | 'meet' | 'location'>(null)

  // ── Assigned student (hero card) ──────────────────────────────────────────
  const [assignedStudent, setAssignedStudent] = useState<AssignedStudent | null>(null)
  const [profile, setProfile]           = useState<StudentProfileResult | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [conceptBars, setConceptBars]   = useState<ConceptBar[]>([])
  const [lastActiveTs, setLastActiveTs] = useState<number | null>(null)

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

  // Only after the tutor picks a student (home clears selection).
  const focusStudent: AssignedStudent | null = useMemo(() => {
    if (!selectedStudent) return null
    const st = students.find(x => x.id === selectedStudent)
    if (!st) return null
    return {
      id: st.id,
      name: st.displayName || st.email?.split('@')[0] || 'Student',
      email: st.email || '',
      examTrack: st.id === heroStudent?.id ? (heroStudent?.examTrack || 'ACT') : 'ACT',
    }
  }, [selectedStudent, students, heroStudent])

  // ML profile + knowledge graph + last-active for the focused student
  useEffect(() => {
    const sid = focusStudent?.id
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
  }, [focusStudent?.id])

  // Live activity feed - realtime interactions for the focused student
  useEffect(() => {
    const sid = focusStudent?.id
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
  }, [focusStudent?.id])

  // Live chat for focused student (comment strip under briefing)
  useEffect(() => {
    const sid = focusStudent?.id
    if (!sid) { setChatMessages([]); return }
    const chatId = [user.uid, sid].sort().join('_')
    const unsub = onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(20)),
      snap => setChatMessages(snap.docs.map(d => d.data() as { senderId: string; text: string; createdAt: unknown })),
      () => setChatMessages([]),
    )
    return () => unsub()
  }, [focusStudent?.id, user.uid])

  // Latest session notes for Tools → Notes
  useEffect(() => {
    if (panel !== 'notes') return
    const sid = focusStudent?.id
    const latest = [...toReview, ...sessions].find(sess =>
      sid ? (sess.studentId === sid || studentIdByEmail[sess.studentEmail] === sid) : true,
    )
    if (!latest) {
      setSessionNotesId(null)
      setSessionNotes('')
      return
    }
    setSessionNotesId(latest.id)
    setSessionNotes(typeof (latest as Session & { tutorNotes?: string }).tutorNotes === 'string'
      ? (latest as Session & { tutorNotes?: string }).tutorNotes!
      : '')
  }, [panel, focusStudent?.id, toReview, sessions, studentIdByEmail])

  async function saveSessionNotes() {
    if (!sessionNotesId) { showToast('No session to note yet'); return }
    setSavingNotes(true)
    try {
      await updateDoc(doc(db, 'sessions', sessionNotesId), { tutorNotes: sessionNotes.trim() })
      showToast('Notes saved')
    } catch {
      showToast('Could not save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  // Flagged questions - students tag questions mid-practice for their tutor.
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

  // One-time parent lookup + mailto - no extra state needed
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
      if (typeof data?.googleMeetUrl === 'string' && data.googleMeetUrl) setMeetUrl(data.googleMeetUrl)
      const hasRealLocation = data?.location
        && typeof data.location.lat === 'number' && typeof data.location.lng === 'number'
      if (hasRealLocation) {
        setLocationLatLng({ lat: data.location.lat, lng: data.location.lng })
        if (typeof data?.locationAddress === 'string') setLocationAddress(data.locationAddress)
      }
      setTutorProfile({
        displayName: data?.displayName || user.displayName || user.email?.split('@')[0] || 'Tutor',
        email: data?.email || user.email || '',
        bio: typeof data?.bio === 'string' ? data.bio : '',
        photoUrl: typeof data?.photoUrl === 'string' ? data.photoUrl : null,
        resumeUrl: typeof data?.resumeUrl === 'string' ? data.resumeUrl : null,
        locationAddress: typeof data?.locationAddress === 'string' ? data.locationAddress : null,
      })
    })
  }, [user, navigate])

  // Roster: assignedTutorId students (admin will wire links later)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const extras: Student[] = []
        const assignedSnap = await getDocs(
          query(collection(db, 'users'), where('assignedTutorId', '==', user.uid), limit(30)),
        )
        assignedSnap.docs.forEach(d => {
          extras.push({ id: d.id, ...(d.data() as Omit<Student, 'id'>) })
        })
        if (!cancelled) setExtraStudents(extras)
      } catch {
        if (!cancelled) setExtraStudents([])
      }
    })()
    return () => { cancelled = true }
  }, [user.uid])

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
      showToast('Calendly connected. Bookings will now flow automatically')
    } catch (err: any) {
      showToast(err.message ?? 'Failed to connect Calendly')
    } finally {
      setConnectingCalendly(false)
    }
  }

  /**
   * Save the tutor's permanent Google Meet room link. Unlike Calendly (which
   * needs the register-calendly webhook to validate the token server-side and
   * subscribe to booking events), this is just a URL string on the tutor's own
   * user doc - Firestore rules allow non-privileged self-writes, so a direct
   * update is the right pattern. NO Google OAuth / Calendar API involved.
   */
  async function handleSaveMeetUrl() {
    const raw = meetUrlInput.trim()
    if (!raw) return
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    if (!/^https:\/\/meet\.google\.com\/[a-z0-9-]+/i.test(normalized)) {
      showToast('That doesn’t look like a Meet link, expected meet.google.com/xxx-xxxx-xxx')
      return
    }
    setSavingMeetUrl(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { googleMeetUrl: normalized })
      setMeetUrl(normalized)
      setMeetUrlInput('')
      setEditingMeetUrl(false)
      showToast('Meet room saved. Sessions without their own link will use it')
    } catch {
      showToast('Could not save Meet link. Try again')
    } finally {
      setSavingMeetUrl(false)
    }
  }

  /**
   * Save the tutor's real location (FindTutor.tsx "Find a tutor near you"
   * groundwork). Until this shipped, no tutor doc ever had a `location`
   * field, so FindTutor.tsx and the marketing site's map both plotted every
   * tutor at the studio's default address (see FindTutor.tsx's own header
   * comment). This is the one place that gap gets closed: geocode the
   * tutor's own address via the Google Maps Geocoding API (same
   * VITE_GOOGLE_MAPS_API_KEY already used for the map itself, called as a
   * plain fetch - the Geocoding web service supports CORS, no need to load
   * the full Maps JS SDK just for this), then write `{lat, lng}` to
   * `users/{uid}.location` - not privileged (unlike role/childId/tutorId/
   * classroomId), so this is a normal self-write under firestore.rules, same
   * as googleMeetUrl above. The moment this saves, `hasRealLocation` flips to
   * true for this tutor everywhere that field is read.
   */
  async function handleSaveLocation() {
    const raw = locationInput.trim()
    if (!raw) return
    const key = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
    if (!key) {
      showToast('Maps API key not configured for this environment')
      return
    }
    setSavingLocation(true)
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(raw)}&key=${key}`
      )
      const data = await res.json()
      const result = data.results?.[0]
      if (data.status !== 'OK' || !result) {
        showToast('Could not find that address. Try adding a city and state')
        return
      }
      const { lat, lng } = result.geometry.location
      const formatted: string = result.formatted_address || raw
      await updateDoc(doc(db, 'users', user.uid), {
        location: { lat, lng },
        locationAddress: formatted,
      })
      setLocationAddress(formatted)
      setLocationLatLng({ lat, lng })
      setTutorProfile(prev => ({ ...prev, locationAddress: formatted }))
      setLocationInput('')
      setEditingLocation(false)
      showToast('Location saved. Students will see you here on Find a Tutor')
    } catch {
      showToast('Could not save location. Try again')
    } finally {
      setSavingLocation(false)
    }
  }

  useEffect(() => {
    // Single query by tutorId only - no composite index needed, filter client-side
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

  // Home starts with no student selected; tutor picks one from the sidebar.

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
  const heroFirstName = focusStudent?.name.split(' ')[0] ?? 'Your student'

  const reviewFiltered = focusStudent
    ? toReview.filter(sess => sess.studentId === focusStudent.id || studentIdByEmail[sess.studentEmail] === focusStudent.id)
    : toReview
  const upcomingFiltered = focusStudent
    ? sessions.filter(sess => sess.studentId === focusStudent.id || studentIdByEmail[sess.studentEmail] === focusStudent.id)
    : sessions

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const callSession = sessions.find(sess => sess.meetingUrl ?? meetUrl) ?? null
  const callUrl = callSession ? (callSession.meetingUrl ?? meetUrl) : null
  const tutorInitial = (tutorProfile.displayName || 'T')[0]?.toUpperCase()

  function goHome() {
    setPanel('home')
    setSelectedStudent(null)
    setConnectChip(null)
  }

  function openChip(chip: 'calendly' | 'meet' | 'location') {
    setPanel('home')
    setSelectedStudent(null)
    if (connectChip === chip) {
      setConnectChip(null)
      return
    }
    setConnectChip(chip)
  }

  return (
    <div className={s.shell}>
      <header className={s.topBar}>
        <div className={s.topLeft}>
          <a href={MARKETING_BASE} className={s.logo}>Mind<span>Craft</span></a>
          <span className={s.topLabel}>Tutor Dashboard</span>
        </div>
        <div className={s.topRight}>
          <span className={s.topName}>{tutorProfile.displayName}</span>
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
        <div className={s.tutorHead}>
          <button
            type="button"
            className={s.tutorPhotoBtn}
            onClick={goHome}
            aria-label="Back to tutor home"
            title="Home"
          >
            <div className={s.tutorPhoto}>
              {tutorProfile.photoUrl
                ? <img src={tutorProfile.photoUrl} alt="" />
                : <span>{tutorInitial}</span>}
            </div>
          </button>
          <button
            type="button"
            className={`${s.profileBtn} ${panel === 'profile' ? s.profileBtnActive : ''}`}
            onClick={() => { setPanel('profile'); setConnectChip(null) }}
          >
            Profile
          </button>
        </div>

        <div className={s.sideDivider} />
        <p className={s.sideLabel}>Students</p>
        {students.length === 0 ? (
          <p className={s.sideEmpty}>No students linked yet</p>
        ) : students.map(st => (
          <button
            key={st.id}
            type="button"
            className={`${s.sideItem} ${panel === 'student' && selectedStudent === st.id ? s.sideActive : ''}`}
            onClick={() => { setPanel('student'); setSelectedStudent(st.id); setConnectChip(null) }}
          >
            <div className={s.sideAvatar}>{(st.displayName || st.email)?.[0]?.toUpperCase()}</div>
            {st.displayName || st.email?.split('@')[0]}
          </button>
        ))}

        <div className={s.sideDivider} />
        <p className={s.sideLabel}>Tools</p>
        <button
          type="button"
          className={`${s.sideItem} ${panel === 'notes' ? s.sideActive : ''}`}
          onClick={() => { setPanel('notes'); setConnectChip(null) }}
        >
          Notes
        </button>
        <button
          type="button"
          className={s.sideItem}
          onClick={() => {
            if (!focusStudent) { showToast('Pick a student first'); return }
            navigate(`/tutor/student/${focusStudent.id}`)
          }}
        >
          Admin
        </button>
      </aside>

      <main className={s.page}>
        {loading ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : panel === 'profile' ? (
          <TutorProfilePanel
            user={user}
            initial={tutorProfile}
            onSaved={next => {
              setTutorProfile(next)
              if (next.locationAddress) setLocationAddress(next.locationAddress)
            }}
            onToast={showToast}
          />
        ) : panel === 'notes' ? (
          <div className={s.card}>
            <div className={s.cardHeader}>
              <span className={s.cardLabel}>Session notes</span>
              <button
                type="button"
                className={s.btnPrimary}
                disabled={savingNotes || !sessionNotesId}
                onClick={() => void saveSessionNotes()}
              >
                {savingNotes ? 'Saving…' : 'Save'}
              </button>
            </div>
            <p className={s.calendlyHint}>
              {focusStudent
                ? `Notes for ${focusStudent.name}. Visible to you on review.`
                : 'Pick a student, then capture the session summary here.'}
            </p>
            <textarea
              className={s.notesArea}
              rows={12}
              value={sessionNotes}
              onChange={e => setSessionNotes(e.target.value)}
              placeholder="What clicked. What to drill next. Parent note if needed."
            />
          </div>
        ) : panel === 'home' ? (
          <div className={s.homeLayout}>
            <div className={s.homeMain}>
              {!connectChip && (
                <div className={s.card}>
                  <div className={s.cardHeader}>
                    <span className={s.cardLabel}>Tutor home</span>
                  </div>
                  <p className={s.heroEmpty}>
                    Connect Calendly, Meet, and your work pin on the right. Open a student from the left when you are ready to brief.
                  </p>
                  {sessions.length > 0 && (
                    <div className={s.sessionList}>
                      {sessions.slice(0, 4).map(sess => {
                        const joinUrl = sess.meetingUrl ?? meetUrl
                        return (
                          <div key={sess.id} className={s.sessionRow}>
                            <div className={s.sessionLeft}>
                              <div className={s.sessionName}>{sess.studentName}</div>
                              <div className={s.sessionMeta}>{sess.subject} · {fmtDateTime(sess.scheduledAt)}</div>
                            </div>
                            {joinUrl && (
                              <a href={joinUrl} target="_blank" rel="noopener" className={s.joinLink}>Join →</a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {connectChip === 'calendly' && (
                <div className={s.card}>
                  <div className={s.cardHeader}>
                    <span className={s.cardLabel}>Calendly</span>
                    {calendlyConnected && <span className={`${s.reviewBadge} ${s.connectedBadge}`}>Connected</span>}
                    <a className={s.guideLink} href={CALENDLY_GUIDE} target="_blank" rel="noopener">Setup guide</a>
                  </div>
                  {calendlyConnected ? (
                    <div className={s.calendlyDone}>Connected · {calendlyConnected}</div>
                  ) : (
                    <>
                      <p className={s.calendlyHint}>Finish the guide, then paste your Personal Access Token.</p>
                      <input
                        className={s.tokenInput}
                        type="password"
                        autoComplete="off"
                        placeholder="Personal Access Token"
                        value={calendlyToken}
                        onChange={e => setCalendlyToken(e.target.value)}
                      />
                      <button
                        type="button"
                        className={s.btnPrimary}
                        onClick={() => void handleConnectCalendly()}
                        disabled={connectingCalendly || !calendlyToken.trim()}
                      >
                        {connectingCalendly ? 'Connecting…' : 'Connect Calendly'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {connectChip === 'meet' && (
                <div className={s.card}>
                  <div className={s.cardHeader}>
                    <span className={s.cardLabel}>Google Meet</span>
                    {meetUrl && <span className={`${s.reviewBadge} ${s.connectedBadge}`}>Saved</span>}
                    <a className={s.guideLink} href={GMEET_GUIDE} target="_blank" rel="noopener">Setup guide</a>
                  </div>
                  {meetUrl && !editingMeetUrl ? (
                    <>
                      <div className={s.calendlyDone}>{meetUrl.replace(/^https:\/\//, '')}</div>
                      <button
                        type="button"
                        className={s.intelToggle}
                        onClick={() => { setEditingMeetUrl(true); setMeetUrlInput(meetUrl) }}
                      >
                        Change room link
                      </button>
                    </>
                  ) : (
                    <>
                      <p className={s.calendlyHint}>Paste your personal Meet room. Sessions without a link use it.</p>
                      <input
                        className={s.tokenInput}
                        type="text"
                        autoComplete="off"
                        placeholder="https://meet.google.com/xxx-xxxx-xxx"
                        value={meetUrlInput}
                        onChange={e => setMeetUrlInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void handleSaveMeetUrl() }}
                      />
                      <button
                        type="button"
                        className={s.btnPrimary}
                        onClick={() => void handleSaveMeetUrl()}
                        disabled={savingMeetUrl || !meetUrlInput.trim()}
                      >
                        {savingMeetUrl ? 'Saving…' : 'Save Meet room'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {connectChip === 'location' && (
                <div className={s.card}>
                  <div className={s.cardHeader}>
                    <span className={s.cardLabel}>Work location</span>
                    {locationAddress && <span className={`${s.reviewBadge} ${s.connectedBadge}`}>Pinned</span>}
                  </div>
                  <TutorLocationPin
                    uid={user.uid}
                    initialLatLng={locationLatLng}
                    initialAddress={locationAddress}
                    onSaved={(latLng, address) => {
                      setLocationLatLng(latLng)
                      setLocationAddress(address)
                      setTutorProfile(prev => ({ ...prev, locationAddress: address }))
                    }}
                    onToast={showToast}
                  />
                </div>
              )}
            </div>

            <div className={s.squareCol}>
              <button
                type="button"
                className={`${s.square} ${calendlyConnected ? s.squareOn : ''} ${connectChip === 'calendly' ? s.squareActive : ''}`}
                onClick={() => openChip('calendly')}
              >
                <span className={s.squareTitle}>Calendly</span>
                <span className={s.squareMeta}>{calendlyConnected ? 'Connected' : 'Set up'}</span>
              </button>
              <button
                type="button"
                className={`${s.square} ${meetUrl ? s.squareOn : ''} ${connectChip === 'meet' ? s.squareActive : ''}`}
                onClick={() => openChip('meet')}
              >
                <span className={s.squareTitle}>GMeet</span>
                <span className={s.squareMeta}>{meetUrl ? 'Saved' : 'Set up'}</span>
              </button>
              <button
                type="button"
                className={`${s.square} ${locationAddress ? s.squareOn : ''} ${connectChip === 'location' ? s.squareActive : ''}`}
                onClick={() => openChip('location')}
              >
                <span className={s.squareTitle}>Location</span>
                <span className={s.squareMeta}>{locationAddress ? 'Pinned' : 'Pin map'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className={s.grid}>
            <div className={s.col}>
              <div className={`${s.card} ${s.heroCard}`}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Student</span>
                  {lastActiveTs && (
                    <span className={s.lastActive}>Last active {timeAgo(lastActiveTs)}</span>
                  )}
                </div>
                {focusStudent ? (
                  <>
                    <div className={s.heroTop}>
                      <div className={s.heroAvatar}>{focusStudent.name[0]?.toUpperCase()}</div>
                      <div className={s.heroId}>
                        <span className={s.heroName}>{focusStudent.name}</span>
                        <span className={s.heroEmail}>{focusStudent.email}</span>
                      </div>
                      <span className={s.examBadge}>{focusStudent.examTrack}</span>
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
                      </>
                    ) : (
                      <p className={s.heroEmpty}>
                        {heroFirstName} hasn&apos;t practiced yet. Share the dashboard link to get started.
                      </p>
                    )}
                  </>
                ) : (
                  <p className={s.heroEmpty}>Pick a student from the left.</p>
                )}
              </div>

              {focusStudent && (
                <TutorBriefingPanel
                  studentId={focusStudent.id}
                  studentName={focusStudent.name}
                  examTrack={focusStudent.examTrack}
                />
              )}

              {focusStudent && (
                <div className={s.card}>
                  <div className={s.cardHeader}>
                    <span className={s.cardLabel}>Live comment</span>
                    <Link to={`/chat/${focusStudent.id}`} state={{ from: '/tutor' }} className={s.openChatLink}>Open chat →</Link>
                  </div>
                  {chatMessages.length === 0 ? (
                    <p className={s.emptyText}>No messages yet. Chat stays live once you both write.</p>
                  ) : (
                    chatMessages.slice(-4).map((msg, i) => {
                      const isMe = msg.senderId === user.uid
                      const name = isMe ? 'You' : heroFirstName
                      return (
                        <div key={i} className={s.msgRow}>
                          <div className={`${s.msgAv} ${isMe ? s.msgAvTutor : ''}`}>{name[0]?.toUpperCase()}</div>
                          <div className={s.msgBody}>
                            <div className={s.msgMeta}><span className={s.msgName}>{name}</span></div>
                            <div className={s.msgText}>{msg.text || 'File'}</div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

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
                          <button type="button" className={s.deleteRowBtn} onClick={e => handleDeleteSession(sess.id, e)} title="Delete">✕</button>
                          <span className={s.reviewArrow}>→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {upcomingFiltered.length > 0 && (
                <div className={s.card}>
                  <div className={s.cardHeader}>
                    <span className={s.cardLabel}>Upcoming Sessions</span>
                  </div>
                  <div className={s.sessionList}>
                    {upcomingFiltered.slice(0, 5).map(sess => {
                      const live = now >= sess.scheduledAt - FIFTEEN_MIN && now <= sess.endAt + FIFTEEN_MIN
                      const joinUrl = sess.meetingUrl ?? meetUrl
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
                            {joinUrl && (
                              <a href={joinUrl} target="_blank" rel="noopener" className={s.joinLink}>Join →</a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className={s.col}>
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabel}>Quick Actions</span>
                </div>
                <div className={s.actionList}>
                  <a
                    className={s.actionBtn}
                    href={focusStudent?.email
                      ? `mailto:${focusStudent.email}?subject=${encodeURIComponent('MindCraft Update')}`
                      : undefined}
                    onClick={e => { if (!focusStudent?.email) { e.preventDefault(); showToast('No student email yet') } }}
                  >
                    Email student
                  </a>
                  <button
                    type="button"
                    className={s.actionBtn}
                    onClick={() => {
                      if (!focusStudent) { showToast('No student yet'); return }
                      void emailParent(focusStudent.id, focusStudent.name)
                    }}
                  >
                    Email parent
                  </button>
                  <button
                    type="button"
                    className={s.actionBtn}
                    onClick={() => {
                      if (!focusStudent) { showToast('No student yet'); return }
                      navigate(`/knowledge-graph`, { state: { studentId: focusStudent.id } })
                    }}
                  >
                    View map
                  </button>
                </div>
              </div>

              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardLabelRow}>
                    {activityLiveNow && <span className={s.livePip} />}
                    <span className={s.cardLabel}>Live practice</span>
                  </span>
                </div>
                {activity.length === 0 ? (
                  <p className={s.emptyText}>Their practice answers show up here as they work.</p>
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

            </div>
          </div>
        )}
      </main>

      {callSession && callUrl && (
        <SessionCallCard
          sessionId={callSession.id}
          meetingUrl={callUrl}
          personName={callSession.studentName || 'Your student'}
          subject={callSession.subject}
          scheduledAt={callSession.scheduledAt}
          endAt={callSession.endAt}
        />
      )}

      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  )
}
