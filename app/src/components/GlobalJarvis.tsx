/**
 * GlobalJarvis.tsx
 *
 * Persistent bottom-right JARVIS rendered inside AuthGuard — survives navigation.
 * Fetches the student's displayName + tutorId from Firestore once on mount.
 * Enables wake word detection ("Jarvis" / "Hey Jarvis") globally.
 */

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import Jarvis from './Jarvis'

// Pages that have their own heroMode JARVIS — no global orb needed there
const HERO_PAGES = ['/dashboard']

export default function GlobalJarvis() {
  const user     = useUser()
  const location = useLocation()

  // Don't render on pages with their own heroMode JARVIS
  if (HERO_PAGES.includes(location.pathname)) return null
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [tutorId,     setTutorId]     = useState<string | null>(null)
  const [subject,     setSubject]     = useState<string>('')

  useEffect(() => {
    if (!user?.uid) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const d = snap.data()
      setDisplayName(d?.displayName || user.displayName || null)
      setTutorId(d?.tutorId || null)
      if (d?.lastSession) {
        setSubject(`Last session: ${d.lastSession.subject} on ${d.lastSession.date}.`)
      }
    }).catch(() => {})
  }, [user?.uid, user?.displayName])

  return (
    <Jarvis
      userName={displayName}
      tutorId={tutorId}
      userId={user?.uid}
      wakeWordEnabled={true}
      context={`${subject} Current page: ${window.location.pathname}.`}
    />
  )
}
