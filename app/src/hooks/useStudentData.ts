/**
 * hooks/useStudentData.ts
 *
 * Real-time data hook for the student dashboard.
 * Subscribes to three Firestore sources simultaneously:
 *   1. users/{uid}         — profile, streak, lastSession, practiceCount
 *   2. sessions/           — finds next upcoming session, backfills studentId if missing
 *   3. chats/{chatId}/messages — last 2 messages from tutor (shown in Messages card)
 *
 * Also handles first-time signup: creates the user doc and links any
 * pre-existing sessions booked by email before the account existed.
 */

import { useEffect, useState } from 'react'
import {
  doc, setDoc, updateDoc, onSnapshot, serverTimestamp,
  collection, query, where, orderBy, limit, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { User } from 'firebase/auth'

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
  nextSession:  { subject: string; time: string; tutor: string; meetingUrl?: string | null; scheduledAt?: number } | null
  lastSession:  SessionSummary | null
  practiceCount: number
  messages:     Message[]
  tutorId:      string | null
  loading:      boolean
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

export function useStudentData(user: User | null): StudentData {
  const [userData, setUserData] = useState<Omit<StudentData, 'nextSession' | 'tutorId' | 'loading' | 'messages'>>({
    displayName:  firstName(user),
    streak:       0,
    lastSession:  null,
    practiceCount: 0,
  })
  const [nextSession, setNextSession]   = useState<StudentData['nextSession']>(null)
  const [tutorId, setTutorId]           = useState<string | null>(null)
  const [tutorName, setTutorName]       = useState<string>('Tutor')
  const [messages, setMessages]         = useState<Message[]>([])
  const [loading, setLoading]           = useState(true)

  // ── 1. User doc ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid)

    const unsub = onSnapshot(ref, async snap => {
      if (!snap.exists()) {
        // First sign-in — create the user doc
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
        // Link any sessions booked by email before the account existed
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
        practiceCount: d.practiceCount ?? 0,
      })
      setLoading(false)
    }, () => setLoading(false))

    return () => unsub()
  }, [user])

  // ── 2. Upcoming sessions ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.email) return
    const unsub = onSnapshot(
      query(collection(db, 'sessions'), where('studentEmail', '==', user.email)),
      snap => {
        const now = Date.now()
        const upcoming = snap.docs
          .map(sd => ({ id: sd.id, ref: sd.ref, ...(sd.data() as any) }))
          .filter(sd => sd.status === 'scheduled' && (sd.endAt ?? sd.scheduledAt + 90 * 60_000) > now)
          .sort((a, b) => a.scheduledAt - b.scheduledAt)[0]

        if (upcoming) {
          setNextSession({
            subject:     upcoming.subject,
            time:        new Date(upcoming.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            tutor:       upcoming.tutorName,
            meetingUrl:  upcoming.meetingUrl ?? null,
            scheduledAt: upcoming.scheduledAt,
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
  }, [user])

  // ── 3. Live chat messages from tutor ─────────────────────────────────────────
  useEffect(() => {
    if (!user || !tutorId) { setMessages([]); return }

    const chatId = [user.uid, tutorId].sort().join('_')
    const unsub = onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(20)),
      snap => {
        // Take the last 2 messages for the dashboard preview
        const recent = snap.docs.slice(-2).map(d => {
          const data = d.data()
          const isFromTutor = data.senderId !== user.uid
          return {
            initial:  isFromTutor ? tutorName[0]?.toUpperCase() ?? 'T' : (user.displayName?.[0] ?? user.email?.[0] ?? 'Y').toUpperCase(),
            isTutor:  isFromTutor,
            name:     isFromTutor ? tutorName : 'You',
            time:     fmtMessageTime(data.createdAt),
            text:     data.text || (data.fileName ? `📎 ${data.fileName}` : ''),
            unread:   isFromTutor, // treat all tutor messages as unread for now
          } as Message
        })
        setMessages(recent)
      },
      () => setMessages([])
    )
    return () => unsub()
  }, [user, tutorId, tutorName])

  return { ...userData, nextSession, tutorId, messages, loading }
}
