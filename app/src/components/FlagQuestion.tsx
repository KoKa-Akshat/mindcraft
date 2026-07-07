/**
 * FlagQuestion — small in-page "tag this question for my tutor" control.
 * Writes to flagged_questions; the tutor dashboard surfaces unresolved flags
 * for its own students in real time. Hidden when the student has no linked
 * tutor (same users/{uid}.tutorId link PingTutor uses).
 */
import { useEffect, useState } from 'react'
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import s from './FlagQuestion.module.css'

type Props = {
  questionId: string
  questionText: string
  conceptId?: string
  conceptName?: string
  questionLabel?: string
  className?: string
}

export default function FlagQuestion({
  questionId, questionText, conceptId, conceptName, questionLabel, className,
}: Props) {
  const user = useUser()
  const [tutorId, setTutorId] = useState<string | null>(null)
  const [tutorLoaded, setTutorLoaded] = useState(false)
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => new Set())
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    getDoc(doc(db, 'users', user.uid))
      .then(snap => {
        if (cancelled) return
        const id = snap.data()?.tutorId
        setTutorId(typeof id === 'string' && id ? id : null)
        setTutorLoaded(true)
      })
      .catch(() => { if (!cancelled) setTutorLoaded(true) })
    return () => { cancelled = true }
  }, [user?.uid])

  if (!tutorLoaded || !tutorId) return null

  const flagged = flaggedIds.has(questionId)

  async function flag() {
    if (!user?.uid || !tutorId || flagged || sending) return
    setSending(true)
    try {
      await addDoc(collection(db, 'flagged_questions'), {
        studentId: user.uid,
        studentName: user.displayName || user.email?.split('@')[0] || 'Student',
        tutorId,
        conceptId: conceptId ?? null,
        conceptName: conceptName ?? null,
        questionId,
        questionLabel: questionLabel ?? null,
        questionText: questionText.replace(/\s+/g, ' ').trim().slice(0, 500),
        resolved: false,
        createdAt: serverTimestamp(),
      })
      setFlaggedIds(prev => new Set(prev).add(questionId))
    } catch {
      // fail soft — flagging is best-effort
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      type="button"
      className={`${s.flagBtn}${flagged ? ` ${s.flagged}` : ''}${className ? ` ${className}` : ''}`}
      onClick={() => void flag()}
      disabled={flagged || sending}
      aria-pressed={flagged}
      title={flagged ? 'Tagged for your tutor' : 'Tag this question for your tutor'}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill={flagged ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" x2="4" y1="22" y2="15" />
      </svg>
      {flagged ? 'tagged' : 'tag for tutor'}
    </button>
  )
}
