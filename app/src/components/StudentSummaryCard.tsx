/**
 * StudentSummaryCard.tsx
 *
 * The "5-second read" card for tutor and parent views - Akshat's own phrase:
 * "a nice summary card ... neat and clean." One card per student, showing
 * exactly three things and nothing else:
 *
 *   1. The student's current focus/weakness concept, illustrated with the
 *      SAME art the student sees on their own dashboard (`storyArtFor()` +
 *      `conceptIconUrl()` from `lib/storyArt.ts` / `lib/conceptIcon.ts`) -
 *      so a tutor or parent recognizes the same world their student is in.
 *   2. One human-readable signal sentence - mastery percent alone is a data
 *      dump, so this composes concept label + mastery + recency the same
 *      way `TutorBriefingPanel` turns engine data into a sentence, just
 *      trimmed to a single line for a glanceable card (the full breakdown
 *      still lives in the Intelligence Report / briefing panel below).
 *   3. One clear next action button - never a menu of options.
 *
 * Visual language: reuses the exact `--desk-*` token values from
 * `Dashboard.module.css`'s `.canvasDesk` block (paper/parchment gradient,
 * Caveat display font, IBM Plex Mono labels, the same radius/shadow scale)
 * so this reads as the same product as the student notebook, not a new
 * design system. Declared locally on `.card` since TutorDashboard/
 * ParentDashboard don't share that CSS scope - same values, new home.
 */

import { useEffect, useState } from 'react'
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { getStudentProfile } from '../lib/mlApi'
import { mlIdToLabel } from '../lib/conceptMap'
import { conceptIconUrl } from '../lib/conceptIcon'
import { storyArtFor } from '../lib/storyArt'
import s from './StudentSummaryCard.module.css'

interface Action {
  label: string
  onClick: () => void
}

interface Props {
  studentId: string
  studentName: string
  examTrack?: string
  primaryAction: Action
  secondaryAction?: Action
}

function timeAgo(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 3_600_000)  return 'today'
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  const days = Math.floor(diff / 86_400_000)
  if (days === 1) return 'yesterday'
  if (days < 14)  return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StudentSummaryCard({
  studentId, studentName, examTrack, primaryAction, secondaryAction,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [focusConceptId, setFocusConceptId] = useState<string | null>(null)
  const [masteryPct, setMasteryPct] = useState<number | null>(null)
  const [eventCount, setEventCount] = useState(0)
  const [lastActiveTs, setLastActiveTs] = useState<number | null>(null)
  const [goalText, setGoalText] = useState('')

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    setLoading(true)

    void (async () => {
      const [profile, userSnap, lastSnap] = await Promise.all([
        getStudentProfile(studentId).catch(() => null),
        getDoc(doc(db, 'users', studentId)).catch(() => null),
        getDocs(query(
          collection(db, 'interactions'),
          where('studentId', '==', studentId),
          orderBy('timestamp', 'desc'),
          limit(1),
        )).catch(() => null),
      ])
      if (cancelled) return

      const worst = profile?.topWeaknesses?.[0]?.conceptId ?? null
      setFocusConceptId(worst)
      setEventCount(profile?.eventCount ?? 0)
      if (worst && profile?.masteryByConcept?.[worst] != null) {
        setMasteryPct(Math.round(profile.masteryByConcept[worst] * 100))
      } else {
        setMasteryPct(null)
      }

      const rawGoal = (userSnap?.data()?.goals as { text?: string } | undefined)?.text?.trim() ?? ''
      setGoalText(rawGoal === '[voice recorded]' ? '' : rawGoal)

      if (lastSnap && !lastSnap.empty) {
        const raw = lastSnap.docs[0].data().timestamp
        const ts = raw?.toMillis?.() ?? (typeof raw === 'number' ? raw : 0)
        if (ts) setLastActiveTs(ts)
      }

      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [studentId])

  const firstName = studentName.split(' ')[0] || 'This student'
  const hasFocus = !!focusConceptId && eventCount > 0
  const conceptLabel = hasFocus ? mlIdToLabel(focusConceptId!) : null

  let signal: string
  if (loading) {
    signal = 'Reading the map…'
  } else if (!hasFocus) {
    signal = `${firstName} hasn't practiced yet, so there's nothing to report.`
  } else if (masteryPct !== null) {
    const recency = lastActiveTs ? `, last active ${timeAgo(lastActiveTs)}` : ''
    signal = `Weakest at ${conceptLabel}, around ${masteryPct}% mastery${recency}.`
  } else {
    signal = `Weakest at ${conceptLabel}.`
  }

  return (
    <div className={s.card}>
      <div className={s.plate}>
        <img
          className={s.plateImg}
          src={hasFocus ? storyArtFor(focusConceptId!) : storyArtFor('fallback')}
          alt=""
          draggable={false}
        />
        {hasFocus && (
          <img className={s.plateBadge} src={conceptIconUrl(focusConceptId!)} alt="" draggable={false} />
        )}
      </div>

      <div className={s.body}>
        <div className={s.topRow}>
          <div className={s.idBlock}>
            <span className={s.name}>{studentName}</span>
            {examTrack && <span className={s.examTag}>{examTrack}</span>}
          </div>
          {lastActiveTs && <span className={s.lastActive}>Active {timeAgo(lastActiveTs)}</span>}
        </div>

        <p className={s.signal}>{signal}</p>

        {goalText && (
          <p className={s.goal}>&ldquo;{goalText}&rdquo;</p>
        )}

        <div className={s.actions}>
          <button type="button" className={s.primaryBtn} onClick={primaryAction.onClick}>
            {primaryAction.label} →
          </button>
          {secondaryAction && (
            <button type="button" className={s.secondaryBtn} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
