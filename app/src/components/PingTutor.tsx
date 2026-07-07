/**
 * PingTutor — floating "message your tutor" pill + popup.
 * Writes to the same chats/{chatId}/messages path as Chat.tsx.
 */
import { useEffect, useState } from 'react'
import {
  addDoc, collection, doc, getDoc, serverTimestamp, setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import s from './PingTutor.module.css'

export type PingTutorContext = {
  conceptName?: string
  questionLabel?: string
  questionText?: string
}

function buildPingText(ctx: PingTutorContext, studentMsg: string): string {
  const msg = studentMsg.trim()
  if (!ctx.conceptName) return msg

  let header = `📍 ${ctx.conceptName}`
  if (ctx.questionLabel) header += `, ${ctx.questionLabel}`
  if (ctx.questionText) {
    const plain = ctx.questionText.replace(/\s+/g, ' ').trim()
    const snippet = plain.slice(0, 120)
    header += `: ${snippet}${plain.length > 120 ? '…' : ''}`
  }
  return `${header} — ${msg}`
}

type Props = {
  context?: PingTutorContext
  className?: string
  /** When true, render inside a parent float bar (no fixed positioning). */
  embedded?: boolean
}

export default function PingTutor({ context = {}, className, embedded = false }: Props) {
  const user = useUser()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [tutorId, setTutorId] = useState<string | null>(null)
  const [tutorLoaded, setTutorLoaded] = useState(false)
  const [error, setError] = useState('')

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

  async function sendPing() {
    if (!user?.uid || !msg.trim() || !tutorId) return
    setSending(true)
    setError('')
    const chatId = [user.uid, tutorId].sort().join('_')
    const text = buildPingText(context, msg)
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
        participants: [user.uid, tutorId],
        lastMessage: text,
        lastAt: serverTimestamp(),
      }, { merge: true })
      setSent(true)
      window.setTimeout(() => {
        setOpen(false)
        setSent(false)
        setMsg('')
      }, 2200)
    } catch {
      setError('Could not send — try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  const panel = open ? (
    <div className={s.pingPanel}>
      <p className={s.pingTitle}>Message your tutor</p>
      {!tutorLoaded ? (
        <p className={s.pingHint}>Checking your classroom link…</p>
      ) : !tutorId ? (
        <p className={s.pingExplainer}>
          You&apos;re not linked to a tutor yet — join your tutor&apos;s classroom first.
          Once you&apos;re in, you can ping them right from here.
        </p>
      ) : sent ? (
        <p className={s.pingSent}>Sent! Your tutor will see this in your chat thread.</p>
      ) : (
        <>
          {error && <p className={s.pingError}>{error}</p>}
          <textarea
            className={s.pingInput}
            placeholder="e.g. Stuck on this step — can we go over it next session?"
            value={msg}
            onChange={e => setMsg(e.target.value)}
          />
          <button
            type="button"
            className={s.pingSubmit}
            disabled={!msg.trim() || sending}
            onClick={() => void sendPing()}
          >
            {sending ? 'Sending…' : 'Send to tutor →'}
          </button>
        </>
      )}
    </div>
  ) : null

  const button = (
    <button
      type="button"
      className={s.fabPing}
      onClick={() => setOpen(o => !o)}
      aria-label="Message tutor"
      aria-expanded={open}
    >
      ✉ Ping tutor
    </button>
  )

  if (embedded) {
    return (
      <div className={className}>
        {panel}
        {button}
      </div>
    )
  }

  return (
    <div className={`${s.floatBar}${className ? ` ${className}` : ''}`}>
      {panel}
      {button}
    </div>
  )
}
