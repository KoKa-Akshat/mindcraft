/**
 * SessionWork.tsx
 *
 * Student async reasoning capture — one tutor-flagged prompt at a time.
 * Scratch pad + optional "what were you thinking" when stuck.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  doc, getDoc, getDocs, addDoc, collection,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import ScratchPad from '../components/ScratchPad'
import s from './SessionWork.module.css'

export default function SessionWork() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const user = useUser()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [prompts, setPrompts] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const [wasStuck, setWasStuck] = useState<boolean | null>(null)
  const [reasoningText, setReasoningText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [subject, setSubject] = useState('')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!sessionId || !user?.email) return
    let cancelled = false

    async function load() {
      const snap = await getDoc(doc(db, 'sessions', sessionId!))
      if (!snap.exists()) {
        if (!cancelled) navigate('/sessions', { replace: true })
        return
      }
      const data = snap.data()
      const ownsSession =
        data.studentId === user.uid ||
        data.studentEmail === user.email
      if (!ownsSession) {
        if (!cancelled) navigate('/sessions', { replace: true })
        return
      }

      const workPrompts: string[] = (data.workPrompts ?? []).filter(Boolean)
      if (!workPrompts.length) {
        if (!cancelled) navigate('/sessions', { replace: true })
        return
      }

      const workSnap = await getDocs(collection(db, 'sessions', sessionId!, 'studentWork'))
      const submitted = new Set(workSnap.docs.map(d => d.data().prompt as string))
      const remaining = workPrompts.filter(p => !submitted.has(p))

      if (!cancelled) {
        setSubject(data.subject ?? 'Session')
        if (!remaining.length) {
          setPrompts([])
          setStep(-1)
        } else {
          setPrompts(remaining)
          setStep(0)
        }
        setLoading(false)
      }
    }

    load().catch(() => {
      if (!cancelled) navigate('/sessions', { replace: true })
    })

    return () => { cancelled = true }
  }, [sessionId, user, navigate])

  async function handleSubmit() {
    if (!sessionId || step < 0 || step >= prompts.length) return
    if (wasStuck === null) {
      setError('Let us know if you knew what to do or got stuck.')
      return
    }
    if (wasStuck && !reasoningText.trim()) {
      setError('Please explain what you were thinking — this helps your tutor help you.')
      return
    }

    setSubmitting(true)
    setError('')
    const prompt = prompts[step]

    try {
      await addDoc(collection(db, 'sessions', sessionId, 'studentWork'), {
        sessionId,
        studentId: user.uid,
        prompt,
        wasStuck,
        reasoningText: reasoningText.trim(),
        scratchImage: canvasRef.current?.toDataURL('image/png') ?? '',
        createdAt: Date.now(),
      })

      const next = step + 1
      if (next >= prompts.length) {
        setStep(-1)
      } else {
        setStep(next)
        setWasStuck(null)
        setReasoningText('')
        canvasRef.current = null
      }
    } catch {
      setError('Could not save your work. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className={s.loadWrap}><div className={s.spinner} /></div>
  }

  const prompt = prompts[step]
  const totalSteps = prompts.length

  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <Link to="/sessions" className={s.logo}>Mind<span>Craft</span></Link>
        <Link to="/sessions" className={s.back}>← Session Notes</Link>
      </nav>

      <main className={s.page}>
        {step === -1 ? (
          <div className={`${s.card} ${s.doneCard}`}>
            <div className={s.doneIcon}>✓</div>
            <h1 className={s.doneTitle}>All done!</h1>
            <p className={s.doneSub}>
              Your tutor will review your scratch work and reasoning.
            </p>
            <Link to="/sessions" className={s.submitBtn} style={{ display: 'inline-block', textDecoration: 'none' }}>
              Back to Session Notes
            </Link>
          </div>
        ) : (
          <>
            <div className={s.progress}>
              {subject} · Problem {step + 1} of {totalSteps}
            </div>
            <h1 className={s.title}>Work through what we covered</h1>
            <p className={s.sub}>
              Use the scratch pad to try the problem, then tell your tutor how it went.
            </p>

            <div className={s.card}>
              <div className={s.promptBox}>{prompt}</div>

              <ScratchPad
                key={`${step}-${prompt}`}
                height={300}
                onChange={canvas => { canvasRef.current = canvas }}
              />

              <div>
                <div className={s.label} style={{ marginBottom: 8 }}>How did it go?</div>
                <div className={s.toggleRow}>
                  <button
                    type="button"
                    className={`${s.toggleBtn} ${wasStuck === false ? s.toggleBtnActive : ''}`}
                    onClick={() => setWasStuck(false)}
                  >
                    I knew what to do
                  </button>
                  <button
                    type="button"
                    className={`${s.toggleBtn} ${wasStuck === true ? s.toggleBtnStuck : ''}`}
                    onClick={() => setWasStuck(true)}
                  >
                    I got stuck
                  </button>
                </div>
              </div>

              {wasStuck && (
                <div>
                  <label className={s.label} htmlFor="reasoning">
                    What were you thinking?
                  </label>
                  <textarea
                    id="reasoning"
                    className={s.reasoning}
                    placeholder="Walk through your thinking — where did you get confused?"
                    value={reasoningText}
                    onChange={e => setReasoningText(e.target.value)}
                  />
                </div>
              )}

              {error && <p className={s.error}>{error}</p>}

              <button
                type="button"
                className={s.submitBtn}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Saving…' : step + 1 >= totalSteps ? 'Submit & finish' : 'Submit & next →'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
