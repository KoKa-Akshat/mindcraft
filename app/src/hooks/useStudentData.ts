/**
 * hooks/useStudentData.ts
 *
 * Real-time data hook for the student dashboard.
 * Subscribes to three Firestore sources simultaneously:
 *   1. users/{uid}         — profile, streak, lastSession, practiceCount
 *   2. sessions/           — finds next upcoming session, backfills studentId if missing
 *   3. chats/{chatId}/messages — last 2 messages from tutor (shown in Messages card)
 *
 * Optional viewAsUid: tutors/admins viewing a linked student's live dash.
 * Never creates/mutates the student doc in that mode.
 */

import { useEffect, useState } from 'react'
import {
  doc, setDoc, updateDoc, onSnapshot, serverTimestamp,
  collection, query, where, orderBy, limit, writeBatch, getDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { User } from 'firebase/auth'
import { DEMO_UID, isDemoMode } from '../lib/demoMode'

export interface HomeworkProblem {
  id: string
  text: string
  done: boolean
  subject?: string
}

export interface HomeworkAssignment {
  prompt?: string
  subject?: string
  problems: HomeworkProblem[]
  assignedAt?: number
  tutorName?: string
}

export interface SessionSummary {
  id: string
  subject: string
  date: string
  duration: string
  title: string
  bullets: string[]
  tutorName: string
  scheduledAt: number
}

export interface Message {
  initial:  string
  isTutor:  boolean
  name:     string
  time:     string
  text:     string
  unread:   boolean
}

export interface StudentData {
  displayName:  string
  streak:       number
  nextSession:  { id?: string; subject: string; time: string; tutor: string; meetingUrl?: string | null; scheduledAt?: number; endAt?: number } | null
  lastSession:  SessionSummary | null
  homework:     HomeworkAssignment | null
  practiceCount: number
  messages:     Message[]
  tutorId:      string | null
  loading:      boolean
  /** weekKey() (weeklyPracticePaper.ts) of the last completed "This week's
   * paper" mission — null if never completed. Drives the paper lock state. */
  weeklyPaperCompletedWeek: string | null
}

export type UseStudentDataOpts = {
  /** When set, load this student's dash data (tutor/admin live view). */
  viewAsUid?: string | null
}

function firstName(user: User | null): string {
  if (!user) return 'there'
  if (user.displayName) return user.displayName.split(' ')[0]
  if (user.email) return user.email.split('@')[0].split('.')[0]
  return 'there'
}

function fmtMessageTime(ts: any): string {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1)  return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sessionToSummary(ps: any): SessionSummary {
  const d = new Date(ps.scheduledAt)
  return {
    id:        ps.id,
    subject:   ps.subject   ?? 'Math',
    date:      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    duration:  ps.duration  ?? '60 min',
    title:     ps.summary?.title ?? ps.title ?? `${ps.subject ?? 'Math'} Session`,
    bullets:   Array.isArray(ps.summary?.bullets) ? ps.summary.bullets
             : Array.isArray(ps.bullets)          ? ps.bullets : [],
    tutorName: ps.tutorName ?? '',
    scheduledAt: ps.scheduledAt,
  }
}

export function useStudentData(user: User | null, opts?: UseStudentDataOpts): StudentData {
  const viewAsUid = opts?.viewAsUid ?? null
  const isViewAs = !!(user && viewAsUid && viewAsUid !== user.uid)
  const dataUid = isViewAs ? viewAsUid! : (user?.uid ?? '')
  const demo = !!user && !isViewAs && (user.uid === DEMO_UID || isDemoMode())

  const [userData, setUserData] = useState<Omit<StudentData, 'nextSession' | 'tutorId' | 'loading' | 'messages'>>({
    displayName:   firstName(user),
    streak:        0,
    lastSession:   null,
    homework:      null,
    practiceCount: 0,
    weeklyPaperCompletedWeek: null,
  })
  const [nextSession, setNextSession]           = useState<StudentData['nextSession']>(null)
  const [derivedLastSession, setDerivedLast]    = useState<SessionSummary | null>(null)
  const [tutorId, setTutorId]                   = useState<string | null>(null)
  const [tutorName, setTutorName]               = useState<string>('Tutor')
  const [studentEmail, setStudentEmail]         = useState<string | null>(null)
  const [messages, setMessages]                 = useState<Message[]>([])
  const [loading, setLoading]                   = useState(!demo)

  // Marketing ACT Demo: no Firestore — tab close resets everything.
  useEffect(() => {
    if (!demo || !user) return
    setUserData({
      displayName: firstName(user) || 'Guest',
      streak: 0,
      lastSession: null,
      homework: null,
      practiceCount: 0,
      weeklyPaperCompletedWeek: null,
    })
    setNextSession(null)
    setDerivedLast(null)
    setTutorId(null)
    setMessages([])
    setLoading(false)
  }, [demo, user])

  // ── 1. User doc ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || demo || !dataUid) return

    if (isViewAs) {
      let cancelled = false
      void getDoc(doc(db, 'users', dataUid)).then(snap => {
        if (cancelled || !snap.exists()) {
          if (!cancelled) setLoading(false)
          return
        }
        const d = snap.data()
        setUserData({
          displayName:   d.displayName || d.email?.split('@')[0] || 'Student',
          streak:        d.streak ?? 0,
          lastSession:   d.lastSession ?? null,
          homework:      d.homework   ?? null,
          practiceCount: d.practiceCount ?? 0,
          weeklyPaperCompletedWeek: d.weeklyPaperCompletedWeek ?? null,
        })
        setStudentEmail(typeof d.email === 'string' ? d.email : null)
        if (typeof d.assignedTutorId === 'string' && d.assignedTutorId) {
          setTutorId(d.assignedTutorId)
        } else if (typeof d.tutorId === 'string' && d.tutorId) {
          setTutorId(d.tutorId)
        } else {
          setTutorId(user.uid)
        }
        setLoading(false)
      }).catch(() => { if (!cancelled) setLoading(false) })
      return () => { cancelled = true }
    }

    const ref = doc(db, 'users', user.uid)
    const unsub = onSnapshot(ref, async snap => {
      if (!snap.exists()) {
        await setDoc(ref, {
          uid:          user.uid,
          email:        user.email,
          displayName:  firstName(user),
          role:         'student',
          streak:       0,
          practiceCount: 0,
          lastSession:  null,
          nextSession:  null,
          createdAt:    serverTimestamp(),
          lastActive:   serverTimestamp(),
        })
        if (user.email) {
          const pending = await new Promise<any>(res =>
            onSnapshot(
              query(collection(db, 'sessions'), where('studentEmail', '==', user.email), where('studentId', '==', null)),
              res, () => res({ docs: [] })
            )
          )
          if (!pending.empty) {
            const batch = writeBatch(db)
            pending.docs.forEach((sd: any) => batch.update(sd.ref, { studentId: user.uid }))
            await batch.commit()
          }
        }
        return
      }

      const d = snap.data()
      setUserData({
        displayName:   d.displayName || firstName(user),
        streak:        d.streak ?? 0,
        lastSession:   d.lastSession ?? null,
        homework:      d.homework   ?? null,
        practiceCount: d.practiceCount ?? 0,
        weeklyPaperCompletedWeek: d.weeklyPaperCompletedWeek ?? null,
      })
      setStudentEmail(typeof d.email === 'string' ? d.email : user.email)
      setLoading(false)
    }, () => setLoading(false))

    return () => unsub()
  }, [user, demo, dataUid, isViewAs])

  // ── 2. Upcoming sessions ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || demo) return

    if (isViewAs) {
      const unsub = onSnapshot(
        query(collection(db, 'sessions'), where('tutorId', '==', user.uid)),
        snap => {
          const now = Date.now()
          const allSessions = snap.docs
            .map(sd => ({ id: sd.id, ref: sd.ref, ...(sd.data() as any) }))
            .filter(sd =>
              sd.studentId === dataUid
              || (studentEmail && sd.studentEmail === studentEmail),
            )

          const upcoming = allSessions
            .filter(sd => sd.status === 'scheduled' && (sd.endAt ?? sd.scheduledAt + 90 * 60_000) > now)
            .sort((a, b) => a.scheduledAt - b.scheduledAt)[0]

          const past = allSessions
            .filter(sd => (sd.endAt ?? sd.scheduledAt + 90 * 60_000) < now)
            .sort((a, b) => b.scheduledAt - a.scheduledAt)
          if (past.length > 0) setDerivedLast(sessionToSummary(past[0]))

          if (upcoming) {
            setNextSession({
              id:          upcoming.id,
              subject:     upcoming.subject,
              time:        new Date(upcoming.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              tutor:       upcoming.tutorName,
              meetingUrl:  upcoming.meetingUrl ?? null,
              scheduledAt: upcoming.scheduledAt,
              endAt:       upcoming.endAt ?? (upcoming.scheduledAt ? upcoming.scheduledAt + 90 * 60_000 : undefined),
            })
            setTutorId(upcoming.tutorId ?? user.uid)
            setTutorName(upcoming.tutorName ?? 'Tutor')
          } else {
            setNextSession(null)
          }
        },
        () => {},
      )
      return () => unsub()
    }

    if (!user.email) return
    const unsub = onSnapshot(
      query(collection(db, 'sessions'), where('studentEmail', '==', user.email)),
      snap => {
        const now = Date.now()
        const allSessions = snap.docs.map(sd => ({ id: sd.id, ref: sd.ref, ...(sd.data() as any) }))

        const upcoming = allSessions
          .filter(sd => sd.status === 'scheduled' && (sd.endAt ?? sd.scheduledAt + 90 * 60_000) > now)
          .sort((a, b) => a.scheduledAt - b.scheduledAt)[0]

        const past = allSessions
          .filter(sd => (sd.endAt ?? sd.scheduledAt + 90 * 60_000) < now)
          .sort((a, b) => b.scheduledAt - a.scheduledAt)
        if (past.length > 0) setDerivedLast(sessionToSummary(past[0]))

        if (upcoming) {
          setNextSession({
            id:          upcoming.id,
            subject:     upcoming.subject,
            time:        new Date(upcoming.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            tutor:       upcoming.tutorName,
            meetingUrl:  upcoming.meetingUrl ?? null,
            scheduledAt: upcoming.scheduledAt,
            endAt:       upcoming.endAt ?? (upcoming.scheduledAt ? upcoming.scheduledAt + 90 * 60_000 : undefined),
          })
          setTutorId(upcoming.tutorId ?? null)
          setTutorName(upcoming.tutorName ?? 'Tutor')
          if (!upcoming.studentId) {
            updateDoc(upcoming.ref, { studentId: user.uid }).catch(() => {})
          }
        } else {
          setNextSession(null)
        }
      },
      () => {}
    )
    return () => unsub()
  }, [user, demo, isViewAs, dataUid, studentEmail])

  // ── 3. Live chat messages ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || demo || !dataUid) { setMessages([]); return }

    const peerId = isViewAs ? user.uid : tutorId
    if (!peerId) { setMessages([]); return }

    const chatId = [dataUid, peerId].sort().join('_')
    const unsub = onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(20)),
      snap => {
        const recent = snap.docs.slice(-2).map(d => {
          const data = d.data()
          const fromPeer = data.senderId !== dataUid
          const peerLabel = isViewAs ? 'You' : tutorName
          const studentLabel = userData.displayName || 'Student'
          return {
            initial:  fromPeer
              ? (isViewAs ? (user.displayName?.[0] ?? 'T') : tutorName[0]?.toUpperCase() ?? 'T')
              : (studentLabel[0] ?? 'S').toUpperCase(),
            isTutor:  fromPeer,
            name:     fromPeer ? peerLabel : (isViewAs ? studentLabel : 'You'),
            time:     fmtMessageTime(data.createdAt),
            text:     data.text || (data.fileName ? `📎 ${data.fileName}` : ''),
            unread:   fromPeer && !isViewAs,
          } as Message
        })
        setMessages(recent)
      },
      () => setMessages([]),
    )
    return () => unsub()
  }, [user, demo, dataUid, isViewAs, tutorId, tutorName, userData.displayName])

  return {
    ...userData,
    lastSession: userData.lastSession ?? derivedLastSession,
    nextSession, tutorId, messages, loading,
    homework: userData.homework,
  }
}
