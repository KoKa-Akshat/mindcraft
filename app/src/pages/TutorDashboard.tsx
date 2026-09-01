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
  doc, getDoc, updateDoc, addDoc, setDoc, orderBy, limit, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import { useToast } from '../hooks/useToast'
import { fmtDateTime, timeUntil } from '../utils/format'
import type { Session, TutorStudent as Student } from '../types'
import TutorBriefingPanel from '../components/TutorBriefingPanel'
import SessionCallCard from '../components/SessionCallCard'
import LiveJoinBanner from '../components/LiveJoinBanner'
import TutorProfilePanel, { type TutorProfileData } from '../components/TutorProfilePanel'
import TutorWeeklyPaperCard from '../components/TutorWeeklyPaperCard'
import TutorLocationPin from '../components/TutorLocationPin'
import TutorEventsPanel from '../components/TutorEventsPanel'
import Dashboard from './Dashboard'
import type { LatLng } from '../lib/geo'
import { setTutorViewAsStudentId, TUTOR_EXIT_STUDENT_MSG } from '../lib/tutorViewAs'
import s from './TutorDashboard.module.css'
import { MARKETING_BASE } from '../lib/siteUrls'
import { WEBHOOK_BASE } from '../lib/mlApi'

type DashPanel = 'home' | 'student' | 'profile' | 'notes' | 'admin' | 'events'
const CALENDLY_GUIDE = '/guides/calendly-setup.html'
const GMEET_GUIDE = '/guides/gmeet-setup.html'

const FIFTEEN_MIN = 15 * 60 * 1000
const FIVE_MIN = 5 * 60 * 1000

interface ActivityItem {
  studentId: string
  conceptId: string
  outcome: number
  ts: number
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

// A durable, cross-session signal about a student, tagged by topic (broad,
// "math in general", or narrow, "this one trig problem"). Deliberately
// separate from the session-scoped `sessions/{id}.tutorNotes` textarea
// above: that one is a single field tied to one session and gets
// overwritten every time a different session is focused. This is a real
// per-note collection under the student's own doc, so it survives across
// sessions and reads as a running signal about the student, not a session
// summary.
interface KnowledgeNote {
  id: string
  tutorId: string
  tutorName: string
  topic: string
  note: string
  ts: number
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
  // studentId -> display name, reused for LiveJoinBanner (no new Firestore
  // read, same fallback chain focusStudent/heroStudent already use).
  const studentNames = useMemo(
    () => Object.fromEntries(students.map(st => [st.id, st.displayName || st.email?.split('@')[0] || 'Student'])),
    [students],
  )
  const [selectedStudent, setSelectedStudent]   = useState<string | null>(null)
  const [chatMessages, setChatMessages]   = useState<{ senderId: string; text: string; createdAt: any }[]>([])
  const [chatDraft, setChatDraft]         = useState('')
  const [sendingChat, setSendingChat]     = useState(false)
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
    subjects: [],
    photoUrl: null,
    resumeUrl: null,
    locationAddress: null,
  })
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionNotesId, setSessionNotesId] = useState<string | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [knowledgeTopic, setKnowledgeTopic] = useState('')
  const [knowledgeNote, setKnowledgeNote] = useState('')
  const [savingKnowledgeNote, setSavingKnowledgeNote] = useState(false)
  const [knowledgeNotes, setKnowledgeNotes] = useState<KnowledgeNote[]>([])
  const [connectChip, setConnectChip] = useState<null | 'calendly' | 'meet' | 'location'>(null)

  // Deep links from Desk OS (TUTORS_EVENTS build, 2026-08-31): the hub's
  // "Create event" button lands on /tutor?panel=events, and the hub's three
  // tutor tiles land on /tutor?chip=calendly|meet|location. Read once on
  // mount, then scrubbed from the URL so refresh and back do not keep
  // forcing the same panel.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wantPanel = params.get('panel')
    const wantChip = params.get('chip')
    if (wantPanel === 'events') {
      setPanel('events')
    } else if (wantChip === 'calendly' || wantChip === 'meet' || wantChip === 'location') {
      setPanel('home')
      setConnectChip(wantChip)
    }
    if (wantPanel || wantChip) window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // ── Assigned student (roster seed) ──────────────────────────────────────────
  const [assignedStudent, setAssignedStudent] = useState<AssignedStudent | null>(null)

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

  // Live activity, pause while student dash is open in-panel
  useEffect(() => {
    const sid = focusStudent?.id
    if (!sid || panel === 'admin') { setActivity([]); return }
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
          outcome: Number(data.outcome ?? 0),
          ts,
        }
      })),
      () => setActivity([]),
    )
    return () => unsub()
  }, [focusStudent?.id, panel])

  // Live chat for focused student (comment strip under briefing)
  useEffect(() => {
    const sid = focusStudent?.id
    if (!sid || panel === 'admin') { setChatMessages([]); setChatDraft(''); return }
    const chatId = [user.uid, sid].sort().join('_')
    const unsub = onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(20)),
      snap => setChatMessages(snap.docs.map(d => d.data() as { senderId: string; text: string; createdAt: unknown })),
      () => setChatMessages([]),
    )
    return () => unsub()
  }, [focusStudent?.id, user.uid, panel])

  async function sendLiveComment() {
    const sid = focusStudent?.id
    const text = chatDraft.trim()
    if (!sid || !text) return
    setSendingChat(true)
    const chatId = [user.uid, sid].sort().join('_')
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        text,
        fileUrl: null,
        fileName: null,
        fileType: null,
        createdAt: serverTimestamp(),
      })
      await setDoc(doc(db, 'chats', chatId), {
        participants: [user.uid, sid],
        lastMessage: text,
        lastAt: serverTimestamp(),
      }, { merge: true })
      setChatDraft('')
    } catch {
      showToast('Could not send message')
    } finally {
      setSendingChat(false)
    }
  }

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

  // Knowledge notes: a running, topic-tagged signal about the student that
  // outlives any one session, meant to be read back both by the tutor and,
  // later, by the student's own agent context. Lives at
  // users/{studentUid}/knowledgeNotes/{noteId}, only the student's own
  // linked tutor can create one (see firestore.rules), so it stays a
  // trusted signal, not open annotation.
  useEffect(() => {
    if (panel !== 'notes' || !focusStudent) { setKnowledgeNotes([]); return }
    const unsub = onSnapshot(
      query(collection(db, 'users', focusStudent.id, 'knowledgeNotes'), orderBy('createdAt', 'desc'), limit(20)),
      snap => {
        setKnowledgeNotes(snap.docs.map(d => {
          const data = d.data()
          return {
            id: d.id,
            tutorId: data.tutorId ?? '',
            tutorName: data.tutorName || 'Tutor',
            topic: data.topic ?? '',
            note: data.note ?? '',
            ts: data.createdAt?.toMillis?.() ?? 0,
          }
        }))
      },
      () => setKnowledgeNotes([]),
    )
    return () => unsub()
  }, [panel, focusStudent?.id])

  async function saveKnowledgeNote() {
    const topic = knowledgeTopic.trim()
    const note = knowledgeNote.trim()
    if (!focusStudent) { showToast('Pick a student first'); return }
    if (!topic || !note) { showToast('Add a topic and a note'); return }
    setSavingKnowledgeNote(true)
    try {
      await addDoc(collection(db, 'users', focusStudent.id, 'knowledgeNotes'), {
        tutorId: user.uid,
        tutorName: tutorProfile.displayName,
        topic,
        note,
        createdAt: serverTimestamp(),
      })
      setKnowledgeTopic('')
      setKnowledgeNote('')
      showToast('Knowledge note saved')
    } catch {
      showToast('Could not save note')
    } finally {
      setSavingKnowledgeNote(false)
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

  // One-time parent lookup + mailto - no extra state needed. Checks both the
  // legacy single-child scalar and the childIds array (a student can now
  // have more than one linked parent, see admin-link.ts), mailing all of
  // them at once via a comma-separated recipient list.
  async function emailParent(studentId: string, studentName: string) {
    try {
      const [byScalar, byArray] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('childId', '==', studentId), limit(10))),
        getDocs(query(collection(db, 'users'), where('childIds', 'array-contains', studentId), limit(10))),
      ])
      const emails = new Set<string>()
      for (const d of [...byScalar.docs, ...byArray.docs]) {
        const email = d.data().email
        if (email) emails.add(email)
      }
      if (emails.size === 0) { showToast('No parent linked'); return }
      window.open(`mailto:${[...emails].join(',')}?subject=${encodeURIComponent(`Update on ${studentName}`)}`)
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
        subjects: Array.isArray(data?.subjects)
          ? data.subjects.filter((x: unknown): x is string => typeof x === 'string' && !!x.trim())
          : [],
        photoUrl: typeof data?.photoUrl === 'string' ? data.photoUrl : null,
        resumeUrl: typeof data?.resumeUrl === 'string' ? data.resumeUrl : null,
        locationAddress: typeof data?.locationAddress === 'string' ? data.locationAddress : null,
      })
    })
  }, [user, navigate])

  // Roster: assignedTutorId (legacy single-tutor scalar, still the only
  // field an older student doc has) UNION assignedTutorIds array-contains
  // (a student can now be linked to multiple tutors, see admin-link.ts).
  // Both queries run and get deduped by id, so a tutor sees every student
  // linked either way, old or new.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const byId = new Map<string, Student>()
        const [assignedSnap, assignedArraySnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('assignedTutorId', '==', user.uid), limit(30))),
          getDocs(query(collection(db, 'users'), where('assignedTutorIds', 'array-contains', user.uid), limit(30))),
        ])
        for (const d of [...assignedSnap.docs, ...assignedArraySnap.docs]) {
          byId.set(d.id, { id: d.id, ...(d.data() as Omit<Student, 'id'>) })
        }
        if (!cancelled) setExtraStudents([...byId.values()])
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
      const res = await fetch(`${WEBHOOK_BASE}/api/register-calendly`, {
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
      const res = await fetch(`${WEBHOOK_BASE}/api/delete-session`, {
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

  const activityLiveNow = activity.length > 0 && now - activity[0].ts < FIVE_MIN
  const heroFirstName = focusStudent?.name.split(' ')[0] ?? 'Your student'

  function openStudentDash() {
    if (!focusStudent) { showToast('No student yet'); return }
    setPanel('admin')
    setConnectChip(null)
  }

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
    setTutorViewAsStudentId(null)
    setPanel('home')
    setSelectedStudent(null)
    setConnectChip(null)
  }

  // Admin iframe → "back" posts here so we stay on /tutor
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      if (e.data?.type !== TUTOR_EXIT_STUDENT_MSG) return
      setTutorViewAsStudentId(null)
      setPanel('student')
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

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
          className={`${s.sideItem} ${panel === 'events' ? s.sideActive : ''}`}
          onClick={() => { setPanel('events'); setConnectChip(null) }}
        >
          Events
        </button>

        <div className={s.sideDivider} />
        <button
          type="button"
          className={`${s.sideItem} ${panel === 'admin' ? s.sideActive : ''}`}
          onClick={() => {
            if (!selectedStudent && !students[0]) {
              showToast('No students linked yet')
              return
            }
            const sid = selectedStudent ?? students[0]?.id
            if (sid) setSelectedStudent(sid)
            setPanel('admin')
            setConnectChip(null)
          }}
        >
          Admin
        </button>
        {students.length === 0 ? (
          <p className={s.sideEmptyNested}>Linked students show up here</p>
        ) : students.map(st => (
          <button
            key={st.id}
            type="button"
            className={`${s.sideItem} ${s.sideItemNested} ${panel === 'student' && selectedStudent === st.id ? s.sideActive : ''}`}
            onClick={() => { setPanel('student'); setSelectedStudent(st.id); setConnectChip(null) }}
          >
            <div className={s.sideAvatar}>{(st.displayName || st.email)?.[0]?.toUpperCase()}</div>
            {st.displayName || st.email?.split('@')[0]}
          </button>
        ))}
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
        ) : panel === 'events' ? (
          <TutorEventsPanel
            user={user}
            tutorName={tutorProfile.displayName}
            initialLatLng={locationLatLng}
            onToast={showToast}
          />
        ) : panel === 'notes' ? (
          <>
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
          <div className={`${s.card} ${s.knowledgeCard}`}>
            <div className={s.cardHeader}>
              <span className={s.cardLabel}>Knowledge notes</span>
              <button
                type="button"
                className={s.btnPrimary}
                disabled={savingKnowledgeNote || !focusStudent}
                onClick={() => void saveKnowledgeNote()}
              >
                {savingKnowledgeNote ? 'Saving…' : 'Save note'}
              </button>
            </div>
            <p className={s.calendlyHint}>
              {focusStudent
                ? `Beyond this one session. A running signal about ${focusStudent.name}, broad ("math in general") or narrow ("this one trig problem").`
                : 'Pick a student to add a knowledge note.'}
            </p>
            <input
              className={s.topicInput}
              type="text"
              value={knowledgeTopic}
              onChange={e => setKnowledgeTopic(e.target.value)}
              placeholder="Topic, e.g. Trigonometry, or Math in general"
              maxLength={80}
            />
            <textarea
              className={s.notesArea}
              rows={5}
              value={knowledgeNote}
              onChange={e => setKnowledgeNote(e.target.value)}
              placeholder="What you noticed, why it matters going forward."
            />
            {knowledgeNotes.length > 0 && (
              <div className={s.sessionList}>
                {knowledgeNotes.map(kn => (
                  <div key={kn.id} className={s.sessionRow}>
                    <div className={s.sessionLeft}>
                      <div className={s.sessionName}>{kn.topic}</div>
                      <div className={s.sessionMeta}>{kn.note}</div>
                      <div className={s.sessionDate}>{kn.tutorName} · {timeAgo(kn.ts)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
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
        ) : focusStudent && (panel === 'student' || panel === 'admin') ? (
          <div className={s.studentStage}>
            <div className={s.switchBar}>
              <div className={s.switchWho}>
                <span className={s.switchLabel}>Viewing</span>
                <strong>{focusStudent.name}</strong>
              </div>
              <div className={s.switchToggle} role="group" aria-label="Student view switch">
                <button
                  type="button"
                  className={`${s.switchBtn} ${panel === 'student' ? s.switchBtnOn : ''}`}
                  onClick={() => {
                    setTutorViewAsStudentId(null)
                    setPanel('student')
                    setConnectChip(null)
                  }}
                >
                  Briefing
                </button>
                <button
                  type="button"
                  className={`${s.switchBtn} ${panel === 'admin' ? s.switchBtnOn : ''}`}
                  onClick={openStudentDash}
                >
                  Student dash
                </button>
              </div>
            </div>

            {panel === 'admin' ? (
              <div className={s.studentFrameWrap}>
                <Dashboard
                  key={focusStudent.id}
                  viewAsStudentId={focusStudent.id}
                  embedded
                  onExit={() => {
                    setTutorViewAsStudentId(null)
                    setPanel('student')
                  }}
                />
              </div>
            ) : (
          <div className={s.grid}>
            <div className={s.col}>
                  <TutorBriefingPanel
                    studentId={focusStudent.id}
                    studentName={focusStudent.name}
                    examTrack={focusStudent.examTrack}
                  />

                  <TutorWeeklyPaperCard
                    studentId={focusStudent.id}
                    studentName={focusStudent.name}
                  />

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
                  <form
                    className={s.chatCompose}
                    onSubmit={e => { e.preventDefault(); void sendLiveComment() }}
                  >
                    <input
                      className={s.chatInput}
                      type="text"
                      placeholder={`Message ${heroFirstName}…`}
                      value={chatDraft}
                      onChange={e => setChatDraft(e.target.value)}
                      disabled={sendingChat}
                    />
                    <button
                      type="submit"
                      className={s.chatSend}
                      disabled={sendingChat || !chatDraft.trim()}
                    >
                      Send
                    </button>
                  </form>
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
                  <button
                    type="button"
                    className={`${s.actionBtn} ${s.actionBtnPrimary}`}
                    onClick={openStudentDash}
                  >
                    Switch to student dash →
                  </button>
                  <button
                    type="button"
                    className={s.actionBtn}
                    onClick={() => {
                      if (!focusStudent) { showToast('No student yet'); return }
                      navigate(`/chat/${focusStudent.id}`, { state: { from: '/tutor' } })
                    }}
                  >
                    Message student
                  </button>
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
          </div>
        ) : (
          <div className={s.card}>
            <p className={s.heroEmpty}>Pick a linked student under Admin.</p>
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

      <LiveJoinBanner role="tutor" linkedId={user.uid} studentNames={studentNames} />

      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  )
}
