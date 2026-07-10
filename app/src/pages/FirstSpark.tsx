/**
 * FirstSpark — cinematic interest → story → question concept page.
 * Public route: /spark
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BubbleField, { type BubblePulse } from '../components/spark/BubbleField'
import InterestCapture from '../components/spark/InterestCapture'
import SparkQuestionCard from '../components/spark/SparkQuestionCard'
import type { SparkMatchResult } from '../lib/sparkMatch'
import s from './FirstSpark.module.css'

type Phase =
  | 'arrival'
  | 'promise'
  | 'invitation'
  | 'matching'
  | 'spark'
  | 'reveal'

const SPARK_KEY = 'mc_spark_session'

export default function FirstSpark() {
  const [phase, setPhase] = useState<Phase>('arrival')
  const [promiseLine, setPromiseLine] = useState(0)
  const [interests, setInterests] = useState<string[]>([])
  const [pulses, setPulses] = useState<BubblePulse[]>([])
  const [match, setMatch] = useState<SparkMatchResult | null>(null)
  const [matchingLabel, setMatchingLabel] = useState('Finding your scene…')
  const [bubbleCount, setBubbleCount] = useState(48)

  useEffect(() => {
    setBubbleCount(window.innerWidth < 640 ? 28 : 48)
  }, [])

  useEffect(() => {
    if (phase !== 'arrival') return
    const t = window.setTimeout(() => setPhase('promise'), 4200)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'promise') return
    const t1 = window.setTimeout(() => setPromiseLine(1), 2200)
    const t2 = window.setTimeout(() => setPhase('invitation'), 5200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [phase])

  const addInterest = useCallback((value: string) => {
    setInterests(prev => {
      if (prev.length >= 4) return prev
      const next = [...prev, value]
      setPulses(p => [...p, { interest: value, at: performance.now() }])
      return next
    })
  }, [])

  const removeInterest = useCallback((index: number) => {
    setInterests(prev => prev.filter((_, i) => i !== index))
  }, [])

  const startMatching = useCallback(() => {
    if (interests.length < 2) return
    setPhase('matching')
    setMatchingLabel('Finding your scene…')

    window.setTimeout(() => {
      void (async () => {
        try {
          const { matchSparkExperience } = await import('../lib/sparkMatch')
          const result = await matchSparkExperience(interests)
          setMatch(result)
          sessionStorage.setItem(SPARK_KEY, JSON.stringify({
            interests,
            matchedTaleId: result.tale.id,
            matchedConceptId: result.conceptId,
            questionId: result.question.id,
          }))
          setMatchingLabel(`Matched: ${result.tale.title}`)
          window.setTimeout(() => setPhase('spark'), 900)
        } catch (err) {
          console.error('[FirstSpark] match failed', err)
          setMatchingLabel('Could not match a scene — try different interests.')
          window.setTimeout(() => setPhase('invitation'), 1200)
        }
      })()
    }, 1400)
  }, [interests])

  const goReveal = useCallback(() => {
    setPhase('reveal')
  }, [])

  const showBubbles = phase === 'invitation' || phase === 'matching' || phase === 'spark' || phase === 'reveal'
  const gatherBubbles = phase === 'matching' || phase === 'spark'
  const explodeBubbles = phase === 'reveal'

  return (
    <div
      className={`${s.page} ${explodeBubbles ? s.pageReveal : ''}`}
      style={{ background: '#060c09', minHeight: '100vh' }}
    >
      <div className={s.glow} aria-hidden />

      <BubbleField
        active={showBubbles}
        gather={gatherBubbles}
        pulses={pulses}
        count={bubbleCount}
      />

      {phase === 'arrival' && (
        <div className={`${s.titleCard} ${s.fadeIn}`}>
          <h1 className={s.brandTitle}>MindCraft</h1>
        </div>
      )}

      {phase === 'promise' && (
        <div className={s.manifesto}>
          {promiseLine === 0 ? (
            <p className={`${s.manifestoLine} ${s.fadeIn}`}>Be good at your craft.</p>
          ) : (
            <p className={`${s.manifestoLine} ${s.manifestoLine2} ${s.fadeIn}`}>
              We&apos;ll find the math hiding inside it.
            </p>
          )}
        </div>
      )}

      <InterestCapture
        visible={phase === 'invitation'}
        interests={interests}
        onAdd={addInterest}
        onRemove={removeInterest}
        onContinue={startMatching}
      />

      {phase === 'matching' && (
        <div className={s.matching}>
          <p className={s.matchingText}>{matchingLabel}</p>
        </div>
      )}

      {match && (
        <SparkQuestionCard
          visible={phase === 'spark'}
          scene={match.scene}
          question={match.question}
          worldFeedback={match.worldFeedback}
          taleTitle={match.tale.title}
          onAnswered={goReveal}
        />
      )}

      {phase === 'reveal' && (
        <div className={s.reveal}>
          <div className={s.revealCard}>
            <p className={s.revealEyebrow}>You just solved something real.</p>
            <h2 className={s.revealTitle}>This is MindCraft.</h2>
            <p className={s.revealSub}>Your map starts here — built around what you actually care about.</p>
            <div className={s.revealActions}>
              <Link className={s.primaryBtn} to="/login?next=/onboard">
                Enter your map
              </Link>
              <Link className={s.ghostBtn} to="/login">
                See the app
              </Link>
            </div>
            {interests.length > 0 && (
              <p className={s.revealMem}>
                Remembered: {interests.join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className={s.skip}
        onClick={() => setPhase('invitation')}
        hidden={phase !== 'arrival' && phase !== 'promise'}
      >
        Skip intro
      </button>
    </div>
  )
}
