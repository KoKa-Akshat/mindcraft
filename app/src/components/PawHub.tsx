import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { motion } from 'framer-motion'
import { db } from '../firebase'
import {
  pawHubDisplayText,
  pawHubLearnSub,
  type CurriculumTrack,
} from '../lib/curriculumTrack'
import { fetchPracticeHubRecommendations, type NextConcept } from '../lib/recommendNextConcept'
import s from './PawHub.module.css'

function KathaFlame({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 24"
      fill="none"
      aria-hidden="true"
      className={s.kathaFlame}
    >
      <defs>
        <linearGradient id="kf_outer" x1="0.3" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stopColor="#c1121f" />
          <stop offset="55%" stopColor="#e85d04" />
          <stop offset="100%" stopColor="#ffb703" />
        </linearGradient>
        <linearGradient id="kf_inner" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#1d3a8a" />
          <stop offset="100%" stopColor="#4895ef" />
        </linearGradient>
      </defs>
      <path
        d="M10 1C10 1 13.5 5.5 13 9C15 7 16 4.5 14.5 1.5C17 4 18.5 8.5 17 12.5C17.8 11 18.5 11 18 13C18 17.9 14.4 22 10 22C5.6 22 2 17.9 2 13C2 9 5.5 6 5.5 6C5.5 8.5 7 10.5 8.5 10.5C8.5 7 9 3.5 10 1Z"
        fill="url(#kf_outer)"
      />
      <path
        d="M10 11.5C10 11.5 11.5 13.5 10.5 16C9.5 14.5 8.5 13 9.5 11C8.5 12 7.5 14 8 16C8 18 8.9 19.5 10 19.5C11.1 19.5 12 18 12 16C12 13.5 10 11.5 10 11.5Z"
        fill="url(#kf_inner)"
        opacity="0.82"
      />
    </svg>
  )
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={s.exploreIcon}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12.5 7.5L11 11 7.5 12.5 9 9 12.5 7.5Z" fill="currentColor" opacity="0.75" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={s.qkIcon}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 2.5V5M10 15V17.5M2.5 10H5M15 10H17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={s.qkIcon}>
      <path d="M5 15L13.5 6.5L15 8L6.5 16.5L4 16L5 15Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12.5 5L15.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={s.qkIcon}>
      <rect x="5" y="4" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 8h5M7.5 11h5M7.5 14h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export default function PawHub({
  userId,
  layout = 'default',
  compact = false,
  onGpsClick,
  onNotesClick,
  onHomeworkClick,
}: {
  userId: string
  layout?: 'default' | 'side'
  compact?: boolean
  onGpsClick?: () => void
  onNotesClick?: () => void
  onHomeworkClick?: () => void
}) {
  const navigate = useNavigate()
  const [weakness, setWeakness] = useState<NextConcept | null>(null)
  const [learn, setLearn] = useState<NextConcept | null>(null)
  const [curriculumTrack, setCurriculumTrack] = useState<CurriculumTrack | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const snap = await getDoc(doc(db, 'users', userId))
      if (cancelled) return
      const track = snap.data()?.curriculumTrack as CurriculumTrack | undefined
      if (track) setCurriculumTrack(track)
      const rec = await fetchPracticeHubRecommendations(userId, track ?? null)
      if (!cancelled) {
        setWeakness(rec.weakness)
        setLearn(rec.learn)
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  function goChallenge() {
    if (weakness) {
      navigate('/practice', { state: { conceptId: weakness.conceptId, missionType: 'weakness' } })
    } else {
      navigate('/practice')
    }
  }

  function goExplore() {
    if (learn) {
      navigate('/practice', { state: { conceptId: learn.conceptId, missionType: 'learn' } })
    } else {
      navigate('/practice')
    }
  }

  const weaknessLabel = weakness ? pawHubDisplayText(weakness.label, curriculumTrack) : null
  const learnLabel    = learn    ? pawHubDisplayText(learn.label, curriculumTrack)    : null
  const learnSub      = pawHubLearnSub(curriculumTrack)

  return (
    <div className={`${s.deck} ${layout === 'side' ? s.deckSide : ''} ${compact ? s.compact : ''}`}>

      {/* Challenge — main action, red */}
      <motion.button
        type="button"
        className={s.practiceCard}
        onClick={goChallenge}
        whileHover={{ scale: 1.018, y: -2 }}
        whileTap={{ scale: 0.982 }}
      >
        <div className={s.cardGlow} aria-hidden="true" />
        <div className={s.cardTop}>
          <span className={s.practiceChip}>
            <KathaFlame size={13} />
            Challenge
          </span>
          <span className={s.cardArrow} aria-hidden="true">→</span>
        </div>
        <div className={s.cardTopic}>
          {weaknessLabel ?? 'Your next challenge'}
        </div>
        <div className={s.cardSub}>Your biggest gap</div>
      </motion.button>

      {/* Explore — blue */}
      <motion.button
        type="button"
        className={s.learnCard}
        onClick={goExplore}
        whileHover={{ scale: 1.018, y: -2 }}
        whileTap={{ scale: 0.982 }}
      >
        <div className={s.cardTop}>
          <span className={s.learnChip}>
            <CompassIcon />
            Explore
          </span>
          <span className={s.cardArrow} aria-hidden="true">→</span>
        </div>
        <div className={s.cardTopic}>
          {learnLabel ?? learnSub}
        </div>
        <div className={s.cardSub}>Fresh territory</div>
      </motion.button>

      {/* Quick actions */}
      <div className={s.quickRow}>
        <button
          type="button"
          className={s.quickBtn}
          onClick={onHomeworkClick ?? (() => navigate('/dashboard?view=homework'))}
        >
          <PencilIcon />
          <span>Solver</span>
        </button>
        <button
          type="button"
          className={s.quickBtn}
          onClick={onGpsClick ?? (() => navigate('/learning-gps'))}
        >
          <MapIcon />
          <span>Map</span>
        </button>
        <button
          type="button"
          className={s.quickBtn}
          onClick={onNotesClick ?? (() => navigate('/dashboard?view=notes'))}
        >
          <NotesIcon />
          <span>Notes</span>
        </button>
      </div>

    </div>
  )
}
