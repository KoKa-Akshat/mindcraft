import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { User } from 'firebase/auth'

export interface SessionSummary {
  subject: string
  date: string
  duration: string
  title: string
  bullets: string[]
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
  nextSession: { subject: string; time: string; tutor: string } | null
  lastSession: SessionSummary | null
  practiceCount: number
  messages: Message[]
  loading: boolean
}

const DEFAULTS: Omit<StudentData, 'displayName' | 'loading'> = {
  streak: 0,
  nextSession: null,
  lastSession: null,
  practiceCount: 0,
  messages: [],
}

export function useStudentData(user: User): StudentData {
  const [data, setData] = useState<StudentData>({
    displayName: user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'there',
    ...DEFAULTS,
    loading: true,
  })

  useEffect(() => {
    if (!user) return

    const ref = doc(db, 'users', user.uid)

    getDoc(ref).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setData({
          displayName: d.displayName || user.displayName?.split(' ')[0] || 'there',
          streak: d.streak ?? 0,
          nextSession: d.nextSession ?? null,
          lastSession: d.lastSession ?? null,
          practiceCount: d.practiceCount ?? 0,
          messages: d.messages ?? [],
          loading: false,
        })
      } else {
        // First time user — create their doc with defaults
        const newUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'there',
          role: 'student',
          streak: 0,
          nextSession: null,
          lastSession: null,
          practiceCount: 0,
          messages: [],
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
        }
        setDoc(ref, newUser)
        setData({
          displayName: newUser.displayName,
          ...DEFAULTS,
          loading: false,
        })
      }
    }).catch(() => {
      // Firestore not enabled yet — show empty state gracefully
      setData(prev => ({ ...prev, loading: false }))
    })
  }, [user])

  return data
}
