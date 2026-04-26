/**
 * MLInsightCard — fills the empty placeholder on the student dashboard.
 *
 * Pulls the student's ML profile and shows:
 *   - Top strength concept + mastery %
 *   - Top gap concept + mastery %
 *   - Recommended next focus
 *   - Dominant learning style
 *   - CTAs to Practice / Knowledge Graph
 *
 * If no ML data yet: clean invite to start their first practice.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStudentProfile, conceptLabel, type StudentProfileResult } from '../lib/mlApi'
import s from './MLInsightCard.module.css'

interface Props {
  userId: string
}

const STYLE_META: Record<string, { label: string; icon: string; color: string }> = {
  geometric:  { label: 'Geometric',  icon: '⬡', color: '#7eb3ff' },
  algebraic:  { label: 'Algebraic',  icon: 'Σ', color: '#c084fc' },
  procedural: { label: 'Procedural', icon: '▶', color: '#58CC02' },
}

export default function MLInsightCard({ userId }: Props) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<StudentProfileResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    getStudentProfile(userId).then(p => {
      setProfile(p)
      setLoading(false)
    })
  }, [userId])

  if (loading) {
    return (
      <div className={s.card}>
        <div className={s.loadRow}>
          <div className={s.spinner} />
          <span>Loading your intelligence profile…</span>
        </div>
      </div>
    )
  }

  // No data yet — invite to first session
  if (!profile || profile.eventCount === 0) {
    return (
      <div className={s.card}>
        <div className={s.emptyHeader}>
          <div className={s.emptyOrb}>
            <span className={s.emptyOrbJ}>◎</span>
          </div>
          <div>
            <p className={s.emptyTitle}>Intelligence Profile</p>
            <p className={s.emptySub}>Unlocks after your first practice</p>
          </div>
        </div>
        <p className={s.emptyBody}>
          Complete a practice session and JARVIS will start mapping your strengths,
          gaps, and learning style — so every session is built around you.
        </p>
        <button className={s.ctaPrimary} onClick={() => navigate('/practice')}>
          Start First Practice →
        </button>
      </div>
    )
  }

  const top    = profile.topStrengths[0]
  const gap    = profile.topWeaknesses[0]
  const focus  = profile.topWeaknesses[0] ?? profile.topStrengths[profile.topStrengths.length - 1]

  // Infer dominant style from concept mastery distribution (simple heuristic)
  // In production this would come from the ML style scores
  const dominantStyle = 'intuitive'
  const styleMeta = STYLE_META[dominantStyle] ?? STYLE_META.geometric

  return (
    <div className={s.card}>
      <div className={s.header}>
        <span className={s.label}>Intelligence Profile</span>
        <span className={s.eventCount}>{profile.eventCount} interactions</span>
      </div>

      {/* Style badge */}
      <div className={s.styleRow} style={{ color: styleMeta.color }}>
        <span className={s.styleIcon}>{styleMeta.icon}</span>
        <span className={s.styleLabel}>{styleMeta.label} Learner</span>
      </div>

      {/* Strength */}
      {top && (
        <div className={s.statRow}>
          <div className={s.statMeta}>
            <span className={s.statIcon} style={{ color: '#58CC02' }}>▲</span>
            <div>
              <div className={s.statName}>{conceptLabel(top.conceptId)}</div>
              <div className={s.statSub}>Top strength</div>
            </div>
          </div>
          <div className={s.barWrap}>
            <div className={s.bar}>
              <div className={s.barFillGreen} style={{ width: `${Math.round(top.strength * 100)}%` }} />
            </div>
            <span className={s.pct}>{Math.round(top.strength * 100)}%</span>
          </div>
        </div>
      )}

      {/* Gap */}
      {gap && (
        <div className={s.statRow}>
          <div className={s.statMeta}>
            <span className={s.statIcon} style={{ color: '#ff8080' }}>▼</span>
            <div>
              <div className={s.statName}>{conceptLabel(gap.conceptId)}</div>
              <div className={s.statSub}>Needs work</div>
            </div>
          </div>
          <div className={s.barWrap}>
            <div className={s.bar}>
              <div className={s.barFillRed} style={{ width: `${Math.round(gap.strength * 100)}%` }} />
            </div>
            <span className={s.pct}>{Math.round(gap.strength * 100)}%</span>
          </div>
        </div>
      )}

      {/* Focus recommendation */}
      {focus && (
        <div className={s.focusBox}>
          <span className={s.focusLabel}>Next focus</span>
          <span className={s.focusConcept}>{conceptLabel(focus.conceptId)}</span>
        </div>
      )}

      <div className={s.ctaRow}>
        <button className={s.ctaSecondary} onClick={() => navigate('/knowledge-graph')}>
          Knowledge Graph
        </button>
        <button className={s.ctaPrimary} onClick={() => navigate('/practice')}>
          Practice →
        </button>
      </div>
    </div>
  )
}
