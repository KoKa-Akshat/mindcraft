import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchPracticeHubRecommendations, type NextConcept } from '../lib/recommendNextConcept'
import s from './PawHub.module.css'

type Toe = {
  id: string
  label: string
  sub: string
  onClick: () => void
  accent?: 'lime' | 'violet' | 'sky' | 'amber'
  icon: ReactNode
}

function WheelIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={s.iconSvg}>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <line
          key={deg}
          x1="16"
          y1="16"
          x2={16 + 11 * Math.cos((deg * Math.PI) / 180)}
          y2={16 + 11 * Math.sin((deg * Math.PI) / 180)}
          stroke="currentColor"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={s.iconSvg}>
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={s.iconSvg}>
      <path d="M8 24 L22 10 L24 12 L10 26 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M20 8 L24 12" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function GpsIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={s.iconSvg}>
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 6 V10 M16 22 V26 M6 16 H10 M22 16 H26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
    </svg>
  )
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={s.iconSvg}>
      <rect x="9" y="7" width="14" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 13 H20 M12 17 H20 M12 21 H16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export default function PawHub({
  userId,
  layout = 'default',
  compact = false,
  onPracticeClick,
  onGpsClick,
  onNotesClick,
  onHomeworkClick,
}: {
  userId: string
  layout?: 'default' | 'side'
  compact?: boolean
  onPracticeClick?: () => void
  onGpsClick?: () => void
  onNotesClick?: () => void
  onHomeworkClick?: () => void
}) {
  const navigate = useNavigate()
  const [weakness, setWeakness] = useState<NextConcept | null>(null)
  const [learn, setLearn] = useState<NextConcept | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchPracticeHubRecommendations(userId).then(rec => {
      if (!cancelled) {
        setWeakness(rec.weakness)
        setLearn(rec.learn)
      }
    })
    return () => { cancelled = true }
  }, [userId])

  function goPractice() {
    if (onPracticeClick) {
      onPracticeClick()
      return
    }
    navigate('/dashboard')
  }

  function goLearnNext() {
    if (learn) {
      navigate(`/dashboard?view=gps&concept=${encodeURIComponent(learn.conceptId)}`)
    } else {
      navigate('/dashboard?view=gps&learnNext=1')
    }
  }

  const toes: Toe[] = [
    {
      id: 'learn',
      label: 'Learn Next',
      sub: learn ? learn.label : 'Plot your route',
      accent: 'violet',
      onClick: goLearnNext,
      icon: <TargetIcon />,
    },
    {
      id: 'homework',
      label: 'Homework Help',
      sub: 'Socratic hints',
      accent: 'sky',
      onClick: onHomeworkClick ?? (() => navigate('/dashboard?view=homework')),
      icon: <PencilIcon />,
    },
    {
      id: 'gps',
      label: 'GPS',
      sub: 'Knowledge map',
      accent: 'lime',
      onClick: onGpsClick ?? (() => navigate('/learning-gps')),
      icon: <GpsIcon />,
    },
    {
      id: 'notes',
      label: 'Notes',
      sub: 'Session summary',
      accent: 'amber',
      onClick: onNotesClick ?? (() => navigate('/dashboard?view=notes')),
      icon: <NotesIcon />,
    },
  ]

  return (
    <div className={`${s.stage} ${layout === 'side' ? s.stageSide : ''} ${compact ? s.compact : ''}`}>
      <div className={s.backdrop} aria-hidden="true" />
      <div className={`${s.paw} ${layout === 'side' ? s.pawSide : ''}`}>
        <div className={`${s.toes} ${layout === 'side' ? s.toesSide : ''}`}>
          {toes.map(toe => (
            <motion.button
              key={toe.id}
              type="button"
              className={`${s.toe} ${s[`toe_${toe.id}`]} ${s[`toe_${toe.accent ?? 'lime'}`]}`}
              onClick={toe.onClick}
              whileHover={{ y: -4, scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className={s.toeIcon}>{toe.icon}</span>
              {toe.id === 'learn' ? (
                <span className={s.toeTopicOnly}>{learn?.label ?? '···'}</span>
              ) : (
                <span className={s.toeLabel}>{toe.label}</span>
              )}
            </motion.button>
          ))}
        </div>

        <motion.button
          type="button"
          className={s.mainPad}
          onClick={goPractice}
          whileHover={{ y: -3, scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
        >
          <span className={s.mainGlow} aria-hidden="true" />
          <span className={s.mainIcon}><WheelIcon /></span>
          <span className={s.mainLabel}>Practice</span>
          <span className={s.mainSub}>{weakness ? weakness.label : 'Your learning path'}</span>
        </motion.button>
      </div>
    </div>
  )
}
