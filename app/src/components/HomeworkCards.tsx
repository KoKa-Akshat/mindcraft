/**
 * HomeworkCards.tsx
 *
 * The student-facing card experience for the MindCraft Homework Help system.
 *
 * One card per narrative step. Students advance through:
 *   hint → question → reframe → encouragement → ...
 *
 * Each card may carry an animated visual (Manim gif as base64) or an SVG diagram.
 * "Need a Clue?" reveals one nudge per click, max 2 per card.
 * Outcome buttons update the student's knowledge graph via /outcome.
 *
 * Design: dark indigo theme — #0A0A0F bg, #12121A card, #6366F1 accent.
 */

import { useState, useEffect, useCallback } from 'react'
import s from './HomeworkCards.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HomeworkCard {
  step_number:    number
  total_steps:    number
  type:           'question' | 'hint' | 'reframe' | 'encouragement'
  concept_chip:   string
  content:        string
  visual_type:    'gif' | 'svg' | 'none'
  visual_data:    string
  is_visual_step: boolean
}

export interface HomeworkSession {
  session_id:      string
  problem_summary: string
  target_concept:  string
  path_framing:    string
  cards:           HomeworkCard[]
  paths_explored:  number
}

interface Props {
  session:       HomeworkSession
  studentId:     string
  apiBase:       string
  onComplete:    (results: OutcomeRecord[]) => void
  onNewProblem:  () => void
}

export interface OutcomeRecord {
  concept_chip: string
  outcome:      number
  clues_used:   number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  question:      'Think about this',
  hint:          'Here\'s a hint',
  reframe:       'Another angle',
  encouragement: 'You\'ve got this',
}

const TYPE_ACCENT: Record<string, string> = {
  question:      '#6366F1',
  hint:          '#6366F1',
  reframe:       '#8B5CF6',
  encouragement: '#F0C060',
}

function dot(filled: boolean) {
  return filled
    ? { background: '#6366F1', opacity: 1 }
    : { background: 'rgba(255,255,255,0.15)', opacity: 1 }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function HomeworkCards({ session, studentId, apiBase, onComplete, onNewProblem }: Props) {
  const [cardIdx,     setCardIdx]     = useState(0)
  const [animDir,     setAnimDir]     = useState<'enter' | 'exit-left' | 'exit-right' | null>(null)
  const [clues,       setClues]       = useState<string[]>([])
  const [clueLoading, setClueLoading] = useState(false)
  const [outcomes,    setOutcomes]    = useState<OutcomeRecord[]>([])
  const [done,        setDone]        = useState(false)

  const card      = session.cards[cardIdx]
  const isLast    = cardIdx === session.cards.length - 1

  // Slide-in on card change
  useEffect(() => {
    setAnimDir('enter')
    setClues([])
    const t = setTimeout(() => setAnimDir(null), 320)
    return () => clearTimeout(t)
  }, [cardIdx])

  // ── Visual rendering ──
  function renderVisual(card: HomeworkCard) {
    if (card.visual_type === 'none' || !card.visual_data) return null
    if (card.visual_type === 'gif') {
      return (
        <div className={s.visualBox}>
          <img
            src={`data:image/gif;base64,${card.visual_data}`}
            alt={`Visual for ${card.concept_chip}`}
            className={s.visualGif}
          />
        </div>
      )
    }
    if (card.visual_type === 'svg') {
      return (
        <div
          className={s.visualBox}
          dangerouslySetInnerHTML={{ __html: card.visual_data }}
        />
      )
    }
    return null
  }

  // ── Clue fetch ──
  const fetchClue = useCallback(async () => {
    if (clues.length >= 2 || clueLoading) return
    setClueLoading(true)
    try {
      const res = await fetch(`${apiBase}/clue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id:         studentId,
          step_content:       card.content,
          concept_addressed:  card.concept_chip,
          preferred_style:    'algebraic',
          clue_number:        clues.length + 1,
        }),
      })
      const data = await res.json()
      setClues(prev => [...prev, data.clue])
    } catch {
      setClues(prev => [...prev, "Think about what you already know — what's one fact you're confident about here?"])
    } finally {
      setClueLoading(false)
    }
  }, [clues.length, clueLoading, card, apiBase, studentId])

  // ── Outcome recording ──
  async function recordOutcome(outcome: number) {
    const record: OutcomeRecord = {
      concept_chip: card.concept_chip,
      outcome,
      clues_used: clues.length,
    }
    setOutcomes(prev => [...prev, record])

    // Fire-and-forget to /outcome
    fetch(`${apiBase}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id:   studentId,
        session_id:   session.session_id,
        concept_id:   card.concept_chip.toLowerCase().replace(/\s+/g, '_'),
        outcome,
        clues_used:   clues.length,
      }),
    }).catch(() => {})

    if (isLast) {
      setDone(true)
      onComplete([...outcomes, record])
    } else {
      setAnimDir('exit-left')
      setTimeout(() => {
        setCardIdx(i => i + 1)
      }, 280)
    }
  }

  // ── Done state ──
  if (done) {
    const correct  = outcomes.filter(o => o.outcome === 1).length
    const partial  = outcomes.filter(o => o.outcome === 0.5).length
    const total    = outcomes.length

    return (
      <div className={s.doneWrap}>
        <div className={s.doneOrb}>✦</div>
        <h2 className={s.doneTitle}>You worked through it.</h2>
        <p className={s.doneSub}>
          {correct} of {total} steps clicked — {partial > 0 ? `${partial} partial.` : 'solid run.'}
        </p>
        <div className={s.doneStats}>
          {outcomes.map((o, i) => (
            <div key={i} className={s.doneStat}>
              <span className={s.doneStatLabel}>{o.concept_chip}</span>
              <span
                className={s.doneStatBadge}
                style={{ color: o.outcome === 1 ? '#58CC02' : o.outcome === 0.5 ? '#F0C060' : '#FF6B6B' }}
              >
                {o.outcome === 1 ? '✓ Got it' : o.outcome === 0.5 ? '~ Partial' : '✗ Still learning'}
              </span>
            </div>
          ))}
        </div>
        <button className={s.newProblemBtn} onClick={onNewProblem}>
          Try another problem →
        </button>
      </div>
    )
  }

  // ── Card ──
  const accentColor = TYPE_ACCENT[card.type] ?? '#6366F1'
  const cardClass = [
    s.card,
    animDir === 'enter'     ? s.slideIn  : '',
    animDir === 'exit-left' ? s.slideOut : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={s.wrap}>

      {/* Session header */}
      <div className={s.sessionHeader}>
        <span className={s.problemSummary}>{session.problem_summary}</span>
        <div className={s.metaRow}>
          <span className={s.framingBadge}>{session.path_framing}</span>
          <span className={s.pathsNote}>{session.paths_explored} paths explored</span>
        </div>
      </div>

      {/* Card */}
      <div className={cardClass} style={{ borderLeftColor: accentColor }}>

        {/* Card top bar */}
        <div className={s.cardTop}>
          <span className={s.conceptChip} style={{ color: accentColor }}>
            {card.concept_chip}
          </span>
          <div className={s.progressDots}>
            {session.cards.map((_, i) => (
              <span key={i} className={s.dot} style={dot(i <= cardIdx)} />
            ))}
          </div>
          <span className={s.stepCounter}>{card.step_number} / {card.total_steps}</span>
        </div>

        {/* Visual */}
        {card.is_visual_step && renderVisual(card)}

        {/* Type label */}
        <div className={s.typeLabel} style={{ color: accentColor }}>
          {card.type === 'encouragement'
            ? <span className={s.encouragementStar}>✦</span>
            : null}
          {TYPE_LABEL[card.type]}
        </div>

        {/* Content */}
        <p className={`${s.content} ${card.type === 'encouragement' ? s.encouragementContent : ''}`}>
          {card.content}
        </p>

        {/* Clues */}
        {clues.length > 0 && (
          <div className={s.clueSection}>
            {clues.map((clue, i) => (
              <div key={i} className={s.clue}>
                <span className={s.clueNum}>Clue {i + 1}</span>
                <p className={s.clueText}>{clue}</p>
              </div>
            ))}
          </div>
        )}

        {clues.length >= 2 && (
          <p className={s.clueMax}>
            You're closer than you think. Try writing out what you DO know first.
          </p>
        )}

        {/* Action row */}
        <div className={s.actionRow}>
          <div className={s.outcomeBtns}>
            <button
              className={s.btnGotIt}
              onClick={() => recordOutcome(1)}
            >
              I get it →
            </button>
            <button
              className={s.btnPartial}
              onClick={() => recordOutcome(0.5)}
            >
              Kind of
            </button>
            <button
              className={s.btnStuck}
              onClick={() => recordOutcome(0)}
            >
              Not yet
            </button>
          </div>
          {clues.length < 2 && (
            <button
              className={s.clueBtn}
              onClick={fetchClue}
              disabled={clueLoading}
            >
              {clueLoading ? '…' : 'Need a clue?'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
