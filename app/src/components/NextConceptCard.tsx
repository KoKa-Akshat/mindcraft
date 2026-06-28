import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchNextConcept, type NextConcept } from '../lib/recommendNextConcept'
import s from './NextConceptCard.module.css'

const STATUS_LABEL: Record<string, string> = {
  mastered: 'Mastered',
  in_progress: 'In progress',
  struggling: 'Needs work',
  untouched: 'Not started',
}

export default function NextConceptCard({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [next, setNext] = useState<NextConcept | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchNextConcept(userId)
      .then(result => { if (!cancelled) setNext(result) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  function goPractice(conceptId?: string) {
    if (conceptId) {
      navigate('/practice', { state: { conceptId } })
    } else {
      navigate('/practice')
    }
  }

  if (loading) {
    return (
      <div className={s.card}>
        <div className={s.loadRow}>
          <div className={s.spinner} />
          <span>Finding your next focus…</span>
        </div>
      </div>
    )
  }

  if (!next) {
    return (
      <div className={s.card} role="button" tabIndex={0} onClick={() => goPractice()}
        onKeyDown={e => e.key === 'Enter' && goPractice()}>
        <span className={s.badge}>NEXT UP</span>
        <h3 className={s.title}>Start practicing</h3>
        <p className={s.sub}>Complete a session to unlock personalized recommendations.</p>
        <button type="button" className={s.btn} onClick={e => { e.stopPropagation(); goPractice() }}>
          Open practice →
        </button>
      </div>
    )
  }

  const statusLabel = STATUS_LABEL[next.status] ?? 'Recommended'
  const masteryPct = Math.round(next.mastery * 100)

  return (
    <div
      className={s.card}
      role="button"
      tabIndex={0}
      onClick={() => goPractice(next.conceptId)}
      onKeyDown={e => e.key === 'Enter' && goPractice(next.conceptId)}
    >
      <span className={s.badge}>NEXT UP</span>
      <h3 className={s.title}>{next.label}</h3>
      <p className={s.sub}>
        {statusLabel} · {masteryPct}% mastery — your highest-priority weakness to practice next.
      </p>
      <button
        type="button"
        className={s.btn}
        onClick={e => { e.stopPropagation(); goPractice(next.conceptId) }}
      >
        Practice {next.label} →
      </button>
    </div>
  )
}
