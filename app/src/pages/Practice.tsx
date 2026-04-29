/**
 * Practice.tsx
 *
 * MindCraft Homework Help — multi-agent tutoring experience.
 *
 * Flow:
 *   1. Student types / pastes a problem
 *   2. POST /submit → orchestrator + 3 parallel agents → best path → Manim visual → cards
 *   3. HomeworkCards renders the card sequence with "Need a clue?" and outcome buttons
 *   4. Done screen shows per-concept breakdown and offers another problem
 */

import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { useState } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import HomeworkCards, { type HomeworkSession, type OutcomeRecord } from '../components/HomeworkCards'
import s from './Practice.module.css'

const HOMEWORK_API = import.meta.env.VITE_HOMEWORK_API_URL ?? 'http://localhost:8001'

const QUICK_PROBLEMS = [
  'Solve x² − 5x + 6 = 0 by factoring',
  'Find the slope of the line through (2,3) and (5,9)',
  'Simplify √48',
  'Find sin(30°) using the unit circle',
  'Solve the system: 2x + y = 7 and x − y = 2',
  'Expand (a + b)² and explain each term',
]

type Phase = 'input' | 'loading' | 'cards' | 'done'

export default function Practice() {
  const user     = useUser()
  const navigate = useNavigate()

  const [problem,  setProblem]  = useState('')
  const [phase,    setPhase]    = useState<Phase>('input')
  const [session,  setSession]  = useState<HomeworkSession | null>(null)
  const [results,  setResults]  = useState<OutcomeRecord[]>([])
  const [error,    setError]    = useState('')
  const [slowLoad, setSlowLoad] = useState(false)

  async function submitProblem(problemText: string) {
    if (!problemText.trim()) return
    setPhase('loading')
    setError('')
    setSession(null)
    setSlowLoad(false)

    const slowTimer = setTimeout(() => setSlowLoad(true), 7000)

    try {
      const res = await fetch(`${HOMEWORK_API}/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id:   user.uid,
          problem_text: problemText,
          subject:      'algebra',
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Server error ${res.status}`)
      }

      const data: HomeworkSession = await res.json()
      clearTimeout(slowTimer)
      setSlowLoad(false)
      setSession(data)
      setPhase('cards')
    } catch (err: unknown) {
      clearTimeout(slowTimer)
      setSlowLoad(false)
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setPhase('input')
    }
  }

  function handleComplete(outcomeRecords: OutcomeRecord[]) {
    setResults(outcomeRecords)
    setPhase('done')
  }

  function resetToInput() {
    setProblem('')
    setSession(null)
    setResults([])
    setError('')
    setPhase('input')
  }

  return (
    <div className={s.shell}>
      <Navbar user={user} onSignOut={() => signOut(auth).then(() => navigate('/login', { replace: true }))} />
      <Sidebar />

      <main className={s.page}>
        <div className={s.header}>
          <button className={s.back} onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <h1 className={s.title}>Homework Help</h1>
          <p className={s.sub}>Paste any problem — MindCraft breaks it down step by step, built around how you learn.</p>
        </div>

        {/* ── Input phase ── */}
        {phase === 'input' && (
          <div className={s.inputSection}>
            <div className={s.inputWrap}>
              <textarea
                className={s.textarea}
                placeholder="Paste your problem here, e.g. — Solve x² − 5x + 6 = 0 by factoring"
                value={problem}
                onChange={e => setProblem(e.target.value)}
                rows={3}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitProblem(problem)
                }}
              />
              <button
                className={s.analyzeBtn}
                onClick={() => submitProblem(problem)}
                disabled={!problem.trim()}
              >
                Break it down →
              </button>
            </div>

            <div className={s.quickRow}>
              <span className={s.quickLabel}>Try:</span>
              {QUICK_PROBLEMS.map(p => (
                <button
                  key={p}
                  className={s.quickChip}
                  onClick={() => { setProblem(p); submitProblem(p) }}
                >
                  {p}
                </button>
              ))}
            </div>

            {error && (
              <div className={s.errorMsg}>
                <span>{error}</span>
                <button className={s.retry} onClick={() => setError('')}>Dismiss</button>
              </div>
            )}
          </div>
        )}

        {/* ── Loading phase ── */}
        {phase === 'loading' && (
          <div className={s.loadingState}>
            <div className={s.spinner} />
            <p className={s.loadingMain}>Building your learning path…</p>
            {slowLoad && (
              <p className={s.loadingSlow}>
                The AI tutor is spinning up — first load takes 30–60 s. Hang tight.
              </p>
            )}
          </div>
        )}

        {/* ── Cards phase ── */}
        {phase === 'cards' && session && (
          <HomeworkCards
            session={session}
            studentId={user.uid}
            apiBase={HOMEWORK_API}
            onComplete={handleComplete}
            onNewProblem={resetToInput}
          />
        )}

        {/* ── Done phase ── */}
        {phase === 'done' && (
          <div className={s.doneState}>
            <div className={s.doneIcon}>✦</div>
            <h2 className={s.doneTitle}>Session complete.</h2>
            <p className={s.doneLabel}>
              {results.filter(r => r.outcome === 1).length} of {results.length} concepts solid
              {results.filter(r => r.outcome === 0.5).length > 0
                ? ` · ${results.filter(r => r.outcome === 0.5).length} partial`
                : ''}
            </p>
            <div className={s.doneActions}>
              <button className={s.btnOutline} onClick={resetToInput}>
                Try another problem
              </button>
              <button className={s.btnPrimary} onClick={() => navigate('/knowledge-graph')}>
                View Knowledge Graph →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
