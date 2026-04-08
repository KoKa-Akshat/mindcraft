import { useEffect, useState } from 'react'
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp, collection, query, where, writeBatch } from 'firebase/firestore'
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
  initial: string
  isTutor: boolean
  name: string
  time: string
  text: string
  unread: boolean
}

export interface StudentData {
  displayName: string
  streak: number
  nextSession: { subject: string; time: string; tutor: string; meetingUrl?: string | null; scheduledAt?: number } | null
  lastSession: SessionSummary | null
  practiceCount: number
  messages: Message[]
  loading: boolean
}

function firstName(user: User | null): string {
  if (!user) return 'there'
  if (user.displayName) return user.displayName.split(' ')[0]
  if (user.email) return user.email.split('@')[0].split('.')[0]
  return 'there'
}

export function useStudentData(user: User | null): StudentData {
  const [userData, setUserData] = useState<Omit<StudentData, 'nextSession' | 'loading'>>({
    displayName: firstName(user),
    streak: 0,
    lastSession: null,
    practiceCount: 0,
    messages: [],
  })
  const [nextSession, setNextSession] = useState<StudentData['nextSession']>(null)
  const [loading, setLoading] = useState(true)

  // Listen to user doc
  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    const unsub = onSnapshot(ref, async snap => {
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: user.uid, email: user.email,
          displayName: firstName(user), role: 'student',
          streak: 0, practiceCount: 0, messages: [],
          lastSession: null, nextSession: null,
          createdAt: serverTimestamp(), lastActive: serverTimestamp(),
        })
        // Link pre-existing sessions
        if (user.email) {
          const pendingSnap = await new Promise<any>(res =>
            onSnapshot(query(collection(db, 'sessions'), where('studentEmail', '==', user.email), where('studentId', '==', null)), res, () => res({ docs: [] }))
          )
          if (!pendingSnap.empty) {
            const batch = writeBatch(db)
            pendingSnap.docs.forEach((sd: any) => batch.update(sd.ref, { studentId: user.uid }))
            await batch.commit()
          }
        }
        return
      }
      const d = snap.data()
      setUserData({
        displayName: d.displayName || firstName(user),
        streak: d.streak ?? 0,
        lastSession: d.lastSession ?? null,
        practiceCount: d.practiceCount ?? 0,
        messages: d.messages ?? [],
      })
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [user])

  // Listen to sessions collection — updates nextSession in real-time
  useEffect(() => {
    if (!user?.email) return
    const unsub = onSnapshot(
      query(collection(db, 'sessions'), where('studentEmail', '==', user.email)),
      snap => {
        const now = Date.now()
        const upcoming = snap.docs
          .map(sd => ({ id: sd.id, ref: sd.ref, ...sd.data() as any }))
          .filter(sd => sd.status === 'scheduled' && (sd.endAt ?? sd.scheduledAt + 90 * 60 * 1000) > now)
          .sort((a, b) => a.scheduledAt - b.scheduledAt)[0]

        if (upcoming) {
          const ns = {
            subject: upcoming.subject,
            time: new Date(upcoming.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            tutor: upcoming.tutorName,
            meetingUrl: upcoming.meetingUrl ?? null,
            scheduledAt: upcoming.scheduledAt,
          }
          setNextSession(ns)
          // Link studentId if missing
          if (!upcoming.studentId) updateDoc(upcoming.ref, { studentId: user.uid }).catch(() => {})
        } else {
          setNextSession(null)
        }
      },
      () => {}
    )
    return () => unsub()
  }, [user])

  return { ...userData, nextSession, loading }
}
