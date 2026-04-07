import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'
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
  const [data, setData] = useState<StudentData>({
    displayName: firstName(user),
    streak: 0,
    nextSession: null,
    lastSession: null,
    practiceCount: 0,
    messages: [],
    loading: true,
  })

  useEffect(() => {
    if (!user) return

    async function load() {
      const ref = doc(db, 'users', user!.uid)
      try {
        const snap = await getDoc(ref)

        if (snap.exists()) {
          const d = snap.data()
          let nextSession = d.nextSession ?? null

          if (user!.email) {
            const sessSnap = await getDocs(
              query(collection(db, 'sessions'),
                where('studentEmail', '==', user!.email),
                where('status', '==', 'scheduled')
              )
            )
            if (!sessSnap.empty) {
              const upcoming = sessSnap.docs
                .map(sd => ({ id: sd.id, ref: sd.ref, ...sd.data() }))
                .filter((sd: any) => sd.scheduledAt > Date.now() - 2 * 60 * 60 * 1000)
                .sort((a: any, b: any) => a.scheduledAt - b.scheduledAt)[0] as any
              if (upcoming) {
                const timeStr = new Date(upcoming.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                nextSession = {
                  subject: upcoming.subject,
                  time: timeStr,
                  tutor: upcoming.tutorName,
                  meetingUrl: upcoming.meetingUrl ?? null,
                  scheduledAt: upcoming.scheduledAt,
                }
                const updates: Promise<void>[] = [updateDoc(ref, { nextSession })]
                if (!upcoming.studentId) {
                  updates.push(updateDoc(upcoming.ref, { studentId: user!.uid }))
                }
                await Promise.all(updates)
              }
            }
          }

          setData({
            displayName: d.displayName || firstName(user),
            streak: d.streak ?? 0,
            nextSession,
            lastSession: d.lastSession ?? null,
            practiceCount: d.practiceCount ?? 0,
            messages: d.messages ?? [],
            loading: false,
          })
        } else {
          await setDoc(ref, {
            uid: user!.uid,
            email: user!.email,
            displayName: firstName(user),
            role: 'student',
            streak: 0,
            practiceCount: 0,
            messages: [],
            lastSession: null,
            nextSession: null,
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
          })

          let linkedNextSession: StudentData['nextSession'] = null
          if (user!.email) {
            const pendingSnap = await getDocs(
              query(collection(db, 'sessions'),
                where('studentEmail', '==', user!.email),
                where('studentId', '==', null)
              )
            )
            if (!pendingSnap.empty) {
              const batch = writeBatch(db)
              pendingSnap.docs.forEach(sessionDoc => {
                batch.update(sessionDoc.ref, { studentId: user!.uid })
                const d = sessionDoc.data()
                if (d.status === 'scheduled' && !linkedNextSession) {
                  const timeStr = new Date(d.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  linkedNextSession = { subject: d.subject, time: timeStr, tutor: d.tutorName, meetingUrl: d.meetingUrl ?? null, scheduledAt: d.scheduledAt }
                }
              })
              if (linkedNextSession) batch.update(ref, { nextSession: linkedNextSession })
              await batch.commit()
            }
          }

          setData({
            displayName: firstName(user),
            streak: 0,
            nextSession: linkedNextSession,
            lastSession: null,
            practiceCount: 0,
            messages: [],
            loading: false,
          })
        }
      } catch (err) {
        console.warn('Firestore load error:', err)
        setData(prev => ({ ...prev, displayName: firstName(user), loading: false }))
      }
    }

    load()
  }, [user])

  return data
}
