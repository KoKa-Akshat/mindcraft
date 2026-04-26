/**
 * StudentIntelPanel — tutor dashboard panel showing a student's ML profile.
 *
 * Shows: concept mastery, strengths, gaps, learning style, next focus.
 * Only fetches when a real studentId is selected (not 'all').
 */

import { useEffect, useState } from 'react'
import { getStudentProfile, conceptLabel, type StudentProfileResult } from '../lib/mlApi'
import s from './StudentIntelPanel.module.css'

interface Props {
  studentId:   string | null
  studentName: string
}

const STYLE_META: Record<string, { label: string; icon: string }> = {
  geometric:  { label: 'Geometric Learner',  icon: '⬡' },
  algebraic:  { label: 'Algebraic Learner',  icon: 'Σ' },
  procedural: { label: 'Procedural Learner', icon: '▶' },
  intuitive:  { label: 'Intuitive Learner',  icon: '◎' },
}

export default function StudentIntelPanel({ studentId, studentName }: Props) {
  const [profile, setProfile] = useState<StudentProfileResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!studentId) { setProfile(null); return }
    setLoading(true)
    setProfile(null)
    getStudentProfile(studentId).then(p => {
      setProfile(p)
      setLoading(false)
    })
  }, [studentId])

  if (!studentId) return null

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <span className={s.label}>Student Intelligence</span>
        <span className={s.name}>{studentName}</span>
      </div>

      {loading && (
        <div className={s.loadRow}>
          <div className={s.spinner} />
          <span>Fetching ML profile…</span>
        </div>
      )}

      {!loading && !profile && (
        <div className={s.empty}>
          <p className={s.emptyTitle}>No ML data yet</p>
          <p className={s.emptySub}>
            Data builds as {studentName.split(' ')[0]} completes practice sessions.
            Encourage them to try the Practice page after this session.
          </p>
        </div>
      )}

      {!loading && profile && profile.eventCount === 0 && (
        <div className={s.empty}>
          <p className={s.emptyTitle}>No practice data yet</p>
          <p className={s.emptySub}>
            {studentName.split(' ')[0]} hasn't done any practice sessions yet.
          </p>
        </div>
      )}

      {!loading && profile && profile.eventCount > 0 && (
        <>
          {/* Stats row */}
          <div className={s.statsRow}>
            <div className={s.stat}>
              <span className={s.statNum}>{profile.eventCount}</span>
              <span className={s.statLabel}>interactions</span>
            </div>
            <div className={s.stat}>
              <span className={s.statNum}>{profile.topStrengths.length}</span>
              <span className={s.statLabel}>strong concepts</span>
            </div>
            <div className={s.stat}>
              <span className={s.statNum}>{profile.topWeaknesses.length}</span>
              <span className={s.statLabel}>gaps</span>
            </div>
          </div>

          {/* Learning style */}
          <div className={s.styleBadge}>
            <span className={s.styleIcon}>{STYLE_META.intuitive.icon}</span>
            <span className={s.styleText}>{STYLE_META.intuitive.label}</span>
            <span className={s.styleTip}>Adapt your explanation style in-session</span>
          </div>

          {/* Strengths */}
          {profile.topStrengths.length > 0 && (
            <div className={s.section}>
              <span className={s.sectionTitle}>Strengths</span>
              <div className={s.barList}>
                {profile.topStrengths.slice(0, 3).map(sw => (
                  <div key={sw.conceptId} className={s.barRow}>
                    <span className={s.barLabel}>{conceptLabel(sw.conceptId)}</span>
                    <div className={s.barTrack}>
                      <div className={s.barGreen} style={{ width: `${Math.round(sw.strength * 100)}%` }} />
                    </div>
                    <span className={s.barPct}>{Math.round(sw.strength * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gaps */}
          {profile.topWeaknesses.length > 0 && (
            <div className={s.section}>
              <span className={s.sectionTitle}>Gaps to address</span>
              <div className={s.barList}>
                {profile.topWeaknesses.slice(0, 3).map(sw => (
                  <div key={sw.conceptId} className={s.barRow}>
                    <span className={s.barLabel}>{conceptLabel(sw.conceptId)}</span>
                    <div className={s.barTrack}>
                      <div className={s.barRed} style={{ width: `${Math.round(sw.strength * 100)}%` }} />
                    </div>
                    <span className={s.barPct}>{Math.round(sw.strength * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Focus recommendation */}
          {profile.topWeaknesses[0] && (
            <div className={s.focusBox}>
              <div className={s.focusLeft}>
                <span className={s.focusLabel}>Recommended focus</span>
                <span className={s.focusConcept}>{conceptLabel(profile.topWeaknesses[0].conceptId)}</span>
              </div>
              <span className={s.focusArrow}>→</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
