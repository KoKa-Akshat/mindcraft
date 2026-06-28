import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchPracticeHubRecommendations,
  type NextConcept,
} from '../lib/recommendNextConcept'
import {
  formatDraftStatus,
  hydrateWeaknessAndLearnDrafts,
  MISSION_LABELS,
  type StoredPracticeDraft,
} from '../lib/practiceDrafts'
import s from './PracticeHubPanel.module.css'

const STATUS_LABEL: Record<string, string> = {
  mastered: 'Mastered',
  in_progress: 'In progress',
  struggling: 'Needs work',
  untouched: 'Not started',
}

type ResumeDrafts = Partial<Record<'weakness' | 'learn', StoredPracticeDraft>>

export default function PracticeHubPanel({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [weakness, setWeakness] = useState<NextConcept | null>(null)
  const [learn, setLearn] = useState<NextConcept | null>(null)
  const [drafts, setDrafts] = useState<ResumeDrafts>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [recs, saved] = await Promise.all([
        fetchPracticeHubRecommendations(userId),
        hydrateWeaknessAndLearnDrafts(userId),
      ])
      if (cancelled) return
      setWeakness(recs.weakness)
      setLearn(recs.learn)
      setDrafts(saved)
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [userId])

  function goPractice(conceptId: string, missionType: 'weakness' | 'learn') {
    navigate('/practice', { state: { conceptId, missionType } })
  }

  function resumeMission(missionType: 'weakness' | 'learn') {
    navigate('/practice', { state: { resumeMission: missionType } })
  }

  if (loading) {
    return (
      <div className={s.stack}>
        <div className={s.loadRow}>
          <div className={s.spinner} />
          <span>Loading your practice hub…</span>
        </div>
      </div>
    )
  }

  return (
    <div className={s.stack}>
      {(['weakness', 'learn'] as const).map(type => {
        const draft = drafts[type]
        if (!draft) return null
        return (
          <button
            key={type}
            type="button"
            className={s.resumeBtn}
            onClick={() => resumeMission(type)}
          >
            <span className={s.resumeTop}>
              <span>Resume {MISSION_LABELS[type]}</span>
              <span>→</span>
            </span>
            <span className={s.resumeMeta}>{formatDraftStatus(draft)}</span>
          </button>
        )
      })}

      {weakness ? (
        <div
          className={s.card}
          role="button"
          tabIndex={0}
          onClick={() => goPractice(weakness.conceptId, 'weakness')}
          onKeyDown={e => e.key === 'Enter' && goPractice(weakness.conceptId, 'weakness')}
        >
          <span className={s.badge}>WEAK SPOT</span>
          <h3 className={s.title}>{weakness.label}</h3>
          <p className={s.sub}>
            {STATUS_LABEL[weakness.status] ?? 'Recommended'} · {Math.round(weakness.mastery * 100)}% mastery
            {' '}— drill your highest-priority weakness.
          </p>
          <button
            type="button"
            className={s.btn}
            onClick={e => { e.stopPropagation(); goPractice(weakness.conceptId, 'weakness') }}
          >
            Practice {weakness.label} →
          </button>
        </div>
      ) : null}

      {learn ? (
        <div
          className={`${s.card} ${s.cardLearn}`}
          role="button"
          tabIndex={0}
          onClick={() => goPractice(learn.conceptId, 'learn')}
          onKeyDown={e => e.key === 'Enter' && goPractice(learn.conceptId, 'learn')}
        >
          <span className={`${s.badge} ${s.badgeLearn}`}>LEARN NEXT</span>
          <h3 className={s.title}>{learn.label}</h3>
          <p className={s.sub}>
            {STATUS_LABEL[learn.status] ?? 'On your path'} · {Math.round(learn.mastery * 100)}% mastery
            {' '}— the next new concept on your Learning GPS route.
          </p>
          <button
            type="button"
            className={`${s.btn} ${s.btnLearn}`}
            onClick={e => { e.stopPropagation(); goPractice(learn.conceptId, 'learn') }}
          >
            Learn {learn.label} →
          </button>
        </div>
      ) : null}

      {!weakness && !learn && (
        <div
          className={s.card}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/practice')}
          onKeyDown={e => e.key === 'Enter' && navigate('/practice')}
        >
          <span className={s.badge}>PRACTICE</span>
          <h3 className={s.title}>Start practicing</h3>
          <p className={s.sub}>Complete a session to unlock personalized recommendations.</p>
          <button type="button" className={s.btn} onClick={e => { e.stopPropagation(); navigate('/practice') }}>
            Open practice →
          </button>
        </div>
      )}
    </div>
  )
}
