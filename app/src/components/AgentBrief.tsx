import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import s from './AgentBrief.module.css'

interface BriefData {
  conceptName: string
  examType:    string
  mode:        'triage' | 'foundation'
  confidence:  'high' | 'medium' | 'low'
  urgency:     'critical' | 'moderate' | 'stable'
  examWeight:  number
  sessionId:   string
}

const EXAM_LABEL: Record<string, string> = {
  SAT_MATH: 'SAT Math', ACT_MATH: 'ACT Math',
  IB_MATH_AA: 'IB Math AA', IB_MATH_AI: 'IB Math AI', AP_CALC_AB: 'AP Calc AB',
}

const SKILL_LABEL: Record<string, string> = {
  triage_critical:    'Trap identification · highest-impact pattern',
  triage_moderate:    'High-frequency pattern drilling',
  triage_stable:      'Speed-accuracy calibration',
  foundation_critical:'Prerequisite repair sequence',
  foundation_moderate:'Concept bridging with worked examples',
  foundation_stable:  'Reinforcement and variation practice',
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#A8E063', medium: '#C4F547', low: 'rgba(255,255,255,0.38)',
}

export default function AgentBrief({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [brief,   setBrief]   = useState<BriefData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let cancelled = false

    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, 'users', userId, 'prepSessions'), orderBy('createdAt', 'desc'), limit(1))
        )
        if (snap.empty || cancelled) { setLoading(false); return }

        const ref  = snap.docs[0].data()
        const full = await getDoc(doc(db, 'sessions', ref.sessionId))
        if (!full.exists() || cancelled) { setLoading(false); return }

        const data   = full.data()
        const topGap = data.gaps?.[0]
        if (!topGap) { setLoading(false); return }

        setBrief({
          conceptName: topGap.conceptName,
          examType:    ref.examType ?? data.examType ?? '',
          mode:        data.mode ?? 'foundation',
          confidence:  data.diagnosisConfidence ?? 'medium',
          urgency:     topGap.urgency ?? 'moderate',
          examWeight:  topGap.examWeight ?? 0,
          sessionId:   ref.sessionId,
        })
      } catch { /* network error or missing doc — show empty state */ }
      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  if (loading) return (
    <div className={s.card}>
      <div className={s.loadRow}><div className={s.spin} /><span>Agent loading…</span></div>
    </div>
  )

  if (!brief) return (
    <div className={s.card}>
      <div className={s.emptyState}>
        <span className={s.emptyIcon}>◈</span>
        <p className={s.emptyTitle}>Your agent is ready.</p>
        <p className={s.emptySub}>
          Start a prep session and MindCraft maps your gaps, builds a personalised skill plan,
          and recommends your next practice move.
        </p>
        <button className={s.startBtn} onClick={() => navigate('/prep')}>
          Run first diagnosis →
        </button>
      </div>
    </div>
  )

  const skillKey  = `${brief.mode}_${brief.urgency}`
  const skillText = SKILL_LABEL[skillKey] ?? 'Personalised practice sequence'

  return (
    <div className={s.card}>
      <div className={s.topRow}>
        <div className={s.agentLabel}>
          <span className={s.agentStar}>✦</span>
          <span>agent recommendation</span>
        </div>
        <div className={s.badges}>
          <span className={s.modeBadge} data-mode={brief.mode}>
            {brief.mode === 'triage' ? '⚡ Triage' : '◉ Foundation'}
          </span>
          {brief.examType && (
            <span className={s.examBadge}>{EXAM_LABEL[brief.examType] ?? brief.examType}</span>
          )}
        </div>
      </div>

      <h2 className={s.concept}>{brief.conceptName}</h2>

      <div className={s.skillRow}>
        <span className={s.skillIcon}>⬡</span>
        <span className={s.skillText}>{skillText}</span>
      </div>

      <div className={s.chips}>
        {brief.examWeight > 0 && (
          <span className={s.chip}>
            {Math.round(brief.examWeight * 100)}% exam weight
          </span>
        )}
        <span className={s.chip} data-urgency={brief.urgency}>
          {brief.urgency === 'critical' ? '⚡ Critical gap'
            : brief.urgency === 'moderate' ? 'Moderate gap'
            : '✓ Stable'}
        </span>
        <span className={s.chip} style={{ color: CONFIDENCE_COLOR[brief.confidence] }}>
          {brief.confidence} confidence
        </span>
      </div>

      <button
        className={s.practiceBtn}
        onClick={() => navigate('/prep', { state: { resumeSessionId: brief.sessionId } })}
      >
        Practice {brief.conceptName} →
      </button>
    </div>
  )
}
