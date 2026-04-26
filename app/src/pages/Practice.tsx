/**
 * Practice.tsx
 *
 * Adaptive practice powered by the ML ingredient engine.
 * Student types or pastes a problem → ML breaks it into atomic
 * mental models → flip-card experience, one card at a time.
 *
 * Flow:
 *   1. Enter problem text (or pick from "recent topics" chips)
 *   2. ML returns prerequisite ingredient cards ordered by need
 *   3. Each card: read the body, flip to see the prompt, mark ✓ or ✗
 *   4. Answer is submitted to ML, mastery updates in Firestore
 *   5. After all cards: composition prompt shown as a mini essay challenge
 */

import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import { useState } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import {
  getIngredientCards,
  submitAnswer,
  conceptLabel,
  type PracticeCard,
  type IngredientRecommendResult,
} from '../lib/mlApi'
import { logEvent } from '../lib/logEvent'
import s from './Practice.module.css'

const QUICK_PROBLEMS = [
  'Solve x² − 5x + 6 = 0 by factoring',
  'Find the slope of the line through (2,3) and (5,9)',
  'Simplify √48',
  'Find sin(30°) using the unit circle',
  'Solve the system: 2x + y = 7 and x − y = 2',
]

export default function Practice() {
  const user = useUser()
  const navigate = useNavigate()
  const data = useStudentData(user)

  const [problem, setProblem]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [result,  setResult]    = useState<IngredientRecommendResult | null>(null)
  const [cardIdx, setCardIdx]   = useState(0)
  const [flipped, setFlipped]   = useState(false)
  const [done,    setDone]      = useState(false)
  const [error,   setError]     = useState('')

  async function loadCards(problemText: string) {
    if (!problemText.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setDone(false)
    setCardIdx(0)
    setFlipped(false)

    const res = await getIngredientCards(user.uid, problemText)
    setLoading(false)

    if (!res || res.cards.length === 0) {
      setError('No practice cards found for that problem. Try rephrasing it.')
      return
    }

    setResult(res)
    logEvent(user.uid, 'practice_started', {
      problemText,
      conceptId: res.problemFeatures.primary_concept,
      cardCount: res.cards.length,
    })
  }

  async function handleAnswer(card: PracticeCard, succeeded: boolean) {
    await submitAnswer(
      user.uid,
      card.cardTemplateId,
      card.targetType,
      card.targetId,
      card.representationKey,
      succeeded,
    )
    logEvent(user.uid, 'practice_answer', {
      cardId: card.cardTemplateId,
      succeeded,
      conceptId: result?.problemFeatures.primary_concept,
    })

    const next = cardIdx + 1
    if (result && next >= result.cards.length) {
      setDone(true)
    } else {
      setCardIdx(next)
      setFlipped(false)
    }
  }

  const card: PracticeCard | null = result?.cards[cardIdx] ?? null
  const progress = result ? Math.round((cardIdx / result.cards.length) * 100) : 0

  return (
    <div className={s.shell}>
      <Navbar user={user} onSignOut={() => signOut(auth).then(() => navigate('/login', { replace: true }))} />
      <Sidebar />

      <main className={s.page}>
        <div className={s.header}>
          <button className={s.back} onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <h1 className={s.title}>Practice</h1>
          <p className={s.sub}>Enter a problem and JARVIS will break it into the building blocks you need.</p>
        </div>

        {/* ── Problem input ── */}
        {!result && !loading && (
          <div className={s.inputSection}>
            <div className={s.inputWrap}>
              <textarea
                className={s.textarea}
                placeholder="Paste a problem, e.g. — Solve x² − 5x + 6 = 0 by factoring"
                value={problem}
                onChange={e => setProblem(e.target.value)}
                rows={3}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) loadCards(problem) }}
              />
              <button
                className={s.analyzeBtn}
                onClick={() => loadCards(problem)}
                disabled={!problem.trim()}
              >
                Analyse →
              </button>
            </div>

            <div className={s.quickRow}>
              <span className={s.quickLabel}>Try:</span>
              {QUICK_PROBLEMS.map(p => (
                <button key={p} className={s.quickChip} onClick={() => { setProblem(p); loadCards(p) }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className={s.loadingState}>
            <div className={s.spinner} />
            <p>Breaking down the problem…</p>
          </div>
        )}

        {error && (
          <div className={s.errorMsg}>
            {error}
            <button className={s.retry} onClick={() => setError('')}>Try again</button>
          </div>
        )}

        {/* ── Card session ── */}
        {result && !done && card && (
          <div className={s.session}>
            {/* Header row */}
            <div className={s.sessionHeader}>
              <div className={s.conceptBadge}>
                {conceptLabel(result.problemFeatures.primary_concept)}
              </div>
              <button className={s.newProblem} onClick={() => { setResult(null); setProblem('') }}>
                New problem
              </button>
            </div>

            {/* Progress bar */}
            <div className={s.progressBar}>
              <div className={s.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <div className={s.progressLabel}>
              Card {cardIdx + 1} of {result.cards.length}
            </div>

            {/* Flip card */}
            <div className={`${s.cardWrap} ${flipped ? s.flipped : ''}`} onClick={() => setFlipped(f => !f)}>
              <div className={s.cardInner}>
                {/* Front */}
                <div className={s.cardFront}>
                  <div className={s.cardTag}>{card.representationKey} explanation</div>
                  <h2 className={s.cardTitle}>{card.title}</h2>
                  <p className={s.cardBody}>{card.body}</p>
                  <span className={s.tapHint}>Tap to flip →</span>
                </div>
                {/* Back */}
                <div className={s.cardBack}>
                  <div className={s.cardTag}>Your turn</div>
                  <p className={s.cardPrompt}>{card.prompt}</p>
                  <p className={s.cardHint}>{card.reason}</p>
                </div>
              </div>
            </div>

            {/* Answer buttons — only show when flipped */}
            {flipped && (
              <div className={s.answerRow}>
                <button className={s.btnNo}  onClick={() => handleAnswer(card, false)}>✗ Still learning</button>
                <button className={s.btnYes} onClick={() => handleAnswer(card, true)}>✓ Got it</button>
              </div>
            )}
          </div>
        )}

        {/* ── Done state ── */}
        {done && result && (
          <div className={s.doneState}>
            <div className={s.doneIcon}>✓</div>
            <h2 className={s.doneTitle}>Building blocks covered!</h2>
            <p className={s.doneLabel}>Now put it together:</p>
            <div className={s.compositionCard}>
              <p className={s.compositionPrompt}>{result.compositionPrompt}</p>
            </div>
            <div className={s.doneActions}>
              <button className={s.btnOutline} onClick={() => { setResult(null); setProblem(''); setDone(false) }}>
                New problem
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
