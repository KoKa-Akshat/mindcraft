/**
 * Unified Work canvas: drop a PDF → homework flow; otherwise paste a problem
 * (solver). Wizard tip sits beside the pad.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../App'
import {
  pagesFromFile, parseHomeworkPages, createHomeworkSession, listHomeworkSessions,
} from '../../lib/homework'
import type { HomeworkSessionDoc } from '../../types'
import WizardMascot from './WizardMascot'
import s from './WorkStudio.module.css'

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
const SOLVER_MAX = 1200

type Stage = 'idle' | 'reading' | 'error'

export default function WorkStudio({
  solverText,
  onSolverText,
  onSolve,
}: {
  solverText: string
  onSolverText: (v: string) => void
  onSolve: () => void
}) {
  const navigate = useNavigate()
  const user = useUser()
  const fileRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [past, setPast] = useState<HomeworkSessionDoc[]>([])

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    void listHomeworkSessions(user.uid).then(sessions => {
      if (!cancelled) setPast(sessions.slice(0, 4))
    })
    return () => { cancelled = true }
  }, [user?.uid])

  async function handleFile(file: File) {
    if (!user?.uid) return
    setError('')
    setStage('reading')
    setStatusText('Opening on your canvas…')
    try {
      const pages = await pagesFromFile(file)
      if (pages.length === 0) {
        setError('Couldn’t read that file. Try a clearer photo.')
        setStage('error')
        return
      }
      const { questions, unavailable } = await parseHomeworkPages(pages)
      if (unavailable || questions.length === 0) {
        setError('Couldn’t find questions. Try another page.')
        setStage('error')
        return
      }
      const homeworkId = await createHomeworkSession(user.uid, file.name, pages.length, questions)
      navigate(`/homework/${homeworkId}`)
    } catch {
      setError('Something went wrong reading that upload.')
      setStage('error')
    }
  }

  const hasText = solverText.trim().length > 0
  const tip = stage === 'reading'
    ? 'Hang tight, I’m laying your pages on the canvas…'
    : hasText
      ? 'Nice. Hit Get hints and I’ll walk you through it.'
      : 'Drop a worksheet PDF, or paste a stuck problem below.'

  return (
    <div className={s.root}>
      <div className={s.heroRow}>
        <div>
          <h2 className={s.title}>Work</h2>
          <p className={s.sub}>Homework + solver in one place</p>
        </div>
        <WizardMascot line={tip} cheering={stage !== 'reading'} />
      </div>

      <div
        className={`${s.drop} ${dragging ? s.dropHot : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files[0]
          if (f) void handleFile(f)
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
          }}
        />
        <button type="button" className={s.dropBtn} onClick={() => fileRef.current?.click()} disabled={stage === 'reading'}>
          {stage === 'reading' ? statusText : 'Drop PDF / photo here'}
        </button>
        <span className={s.or}>or paste a problem</span>
        <textarea
          className={s.input}
          placeholder="e.g. Solve 2x + 5 = 13…"
          value={solverText}
          maxLength={SOLVER_MAX}
          rows={5}
          onChange={e => onSolverText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && hasText) onSolve()
          }}
        />
        <button
          type="button"
          className={s.go}
          disabled={!hasText || stage === 'reading'}
          onClick={onSolve}
        >
          Get hints →
        </button>
        {error && <p className={s.err}>{error}</p>}
      </div>

      {past.length > 0 && (
        <div className={s.past}>
          <span className={s.pastLabel}>Recent</span>
          {past.map(p => (
            <button
              key={p.id}
              type="button"
              className={s.pastItem}
              onClick={() => navigate(`/homework/${p.id}`)}
            >
              {p.title || 'Worksheet'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
