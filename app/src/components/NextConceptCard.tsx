import { useNavigate } from 'react-router-dom'
import { ConceptPathIcon } from './ConceptPathIcon'
import type { PathConcept } from '../lib/practicePathQueue'
import s from './NextConceptCard.module.css'

type Props = {
  concept: PathConcept | null
  loading?: boolean
  exam?: string
}

export default function NextConceptCard({ concept, loading, exam }: Props) {
  const navigate = useNavigate()

  if (loading) {
    return <p className={s.loading}>Finding your next topic…</p>
  }

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <h2 className={s.title}>Practice next</h2>
        {exam ? <span className={s.exam}>{exam}</span> : null}
      </div>

      {concept ? (
        <div className={s.card}>
          <span className={s.icon}>
            <ConceptPathIcon conceptId={concept.id} size={40} />
          </span>
          <div className={s.body}>
            <p className={s.kicker}>Up next on your path</p>
            <h3 className={s.name}>{concept.label}</h3>
          </div>
          <button
            type="button"
            className={s.primary}
            onClick={() => navigate('/practice', { state: { conceptId: concept.id, missionType: 'learn' } })}
          >
            Start practice →
          </button>
        </div>
      ) : (
        <p className={s.empty}>Complete the gap scan to unlock your learning path.</p>
      )}

      <button type="button" className={s.ghost} onClick={() => navigate('/practice')}>
        See full path →
      </button>
    </div>
  )
}
