/**
 * Diagnostic.tsx — goals + concept confidence (kickstarts the engine).
 *
 * Reached from the kitchen world ("Let Nox Cook"), not immediately after login.
 * Flow: login → kitchen world → Let Nox Cook → this page → dashboard.
 *   - goals       → stored on users/{uid}.goals
 *   - confidence  → POST /seed-assessment (hard|kinda|easy per concept → L1/L2/L3)
 *   - complete    → markDiagnosticComplete (diagnosticCompleted: true) + goals
 *
 * Probe step anchors confidence with one ACT question per cluster.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import type { Confidence } from '../lib/bridgePractice'
import spec from '../data/actDiagnostic.json'
import actBankData from '../data/actMasterQuestionBank.generated.json'
import MathText from '../components/MathText'
import { DeskArt, HorizonIcon } from '../components/DiagnosticArt'
import s from './Diagnostic.module.css'

interface ConfConcept { concept_id: string; name: string; act_high_priority: boolean }
interface ScalePoint { value: Confidence; label: string }
interface ProbeQuestionSpec { question_id: string; concept_id: string; cluster: string }
interface ActQuestion { id: string; conceptId: string; level: 1 | 2 | 3; question: string; choices: string[]; correctIndex: number }

const PROBE_ANSWERS: { value: Confidence; label: string }[] = [
  { value: 'easy', label: 'Yes, I know it' },
  { value: 'kinda', label: 'Seen it before' },
  { value: 'hard', label: 'New to me' },
]

const EXAM = 'ACT'

type Step = 'intro' | 'goals' | 'horizon' | 'probe' | 'confidence' | 'done'

type HorizonOption = { value: number; label: string; sublabel: string; kind: 'today' | 'days' | 'week' | 'weeks' }

/** Same day-value buckets as PanicInput's time-to-exam pills (components/PanicInput.tsx)
 *  so `deadline_days` means one consistent thing everywhere it's collected. */
const HORIZON_OPTIONS: HorizonOption[] = [
  { value: 1,  label: 'Today',    sublabel: 'exam is today or tomorrow', kind: 'today' },
  { value: 3,  label: '3 days',   sublabel: 'this week',                 kind: 'days' },
  { value: 7,  label: '1 week',   sublabel: 'next week',                 kind: 'week' },
  { value: 30, label: '2+ weeks', sublabel: 'building from scratch',     kind: 'weeks' },
]

export default function Diagnostic() {
  const user = useUser()
  const navigate = useNavigate()
  const concepts = (spec as { confidence_step: { concepts: ConfConcept[] } }).confidence_step.concepts
  const scale = (spec as { confidence_step: { scale: ScalePoint[] } }).confidence_step.scale
  const presets = (spec as { goals_step: { presets: string[] } }).goals_step.presets
  const probeStep = (spec as { probe_step?: { prompt?: string; note?: string; questions?: ProbeQuestionSpec[] } }).probe_step
  const probeSpecs = probeStep?.questions ?? []

  const [step, setStep] = useState<Step>('intro')
  const [goalTags, setGoalTags] = useState<string[]>([])
  const [goalText, setGoalText] = useState('')
  const [deadlineDays, setDeadlineDays] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<Record<string, Confidence>>({})
  const [probeAnswers, setProbeAnswers] = useState<Record<string, Confidence>>({})
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set())
  const [saving, setSaving] = useState(false)

  const progress = useMemo(() => {
    const order: Step[] = ['intro', 'goals', 'horizon', 'probe', 'confidence', 'done']
    return (order.indexOf(step) / (order.length - 1)) * 100
  }, [step])

  const allRated = useMemo(
    () => concepts.every(c => confidence[c.concept_id] || excludedIds.has(c.concept_id)),
    [concepts, confidence, excludedIds],
  )

  const probeQuestions = useMemo(() => {
    const bank = actBankData as ActQuestion[]
    return probeSpecs.flatMap(item => {
      const question = bank.find(q => q.id === item.question_id && q.conceptId === item.concept_id)
      return question ? [{ ...item, question }] : []
    })
  }, [probeSpecs])

  const allProbesAnswered = useMemo(
    () => probeQuestions.length > 0 && probeQuestions.every(item => probeAnswers[item.concept_id]),
    [probeQuestions, probeAnswers],
  )

  function toggleGoal(tag: string) {
    setGoalTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  function setConf(conceptId: string, value: Confidence) {
    setExcludedIds(prev => {
      const next = new Set(prev)
      next.delete(conceptId)
      return next
    })
    setConfidence(prev => ({ ...prev, [conceptId]: value }))
  }

  function setProbeAnswer(conceptId: string, value: Confidence) {
    setProbeAnswers(prev => ({ ...prev, [conceptId]: value }))
  }

  function applyProbeAnswers() {
    setConfidence(prev => {
      const next = { ...prev }
      for (const item of probeQuestions) {
        const answer = probeAnswers[item.concept_id]
        if (answer) next[item.concept_id] = answer
      }
      return next
    })
    setStep('confidence')
  }

  function toggleSkip(conceptId: string) {
    setExcludedIds(prev => {
      const next = new Set(prev)
      if (next.has(conceptId)) next.delete(conceptId)
      else next.add(conceptId)
      return next
    })
    setConfidence(prev => {
      const next = { ...prev }
      delete next[conceptId]
      return next
    })
  }

  async function finishConfidence() {
    setSaving(true)
    try {
      await applyDiagnosticConfidence(
        user.uid,
        EXAM,
        confidence,
        { tags: goalTags, text: goalText.trim() },
        {
          diagnosticVersion: (spec as { version?: string }).version,
          excludedConcepts: [...excludedIds],
          deadlineDays,
        },
      )
      setStep('done')
    } finally {
      setSaving(false)
    }
  }

  function goToDashboard() {
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className={s.page}>
      <div className={s.bar}><div className={s.barFill} style={{ width: `${progress}%` }} /></div>
      <div className={s.shell}>

        {step === 'intro' && (
          <section className={s.card}>
            <DeskArt className={s.introArt} />
            <p className={s.kicker}>Jesse's kitchen</p>
            <h1 className={s.title}>{(spec as { intro: { title: string } }).intro.title}</h1>
            <p className={s.body}>{(spec as { intro: { body: string } }).intro.body}</p>
            <button className={s.primary} onClick={() => setStep('goals')}>Start</button>
          </section>
        )}

        {step === 'goals' && (
          <section className={s.card}>
            <h2 className={s.h2}>{(spec as { goals_step: { prompt: string } }).goals_step.prompt}</h2>
            <div className={s.tags}>
              {presets.map(p => (
                <button
                  key={p}
                  className={`${s.tag} ${goalTags.includes(p) ? s.tagOn : ''}`}
                  onClick={() => toggleGoal(p)}
                >{p}</button>
              ))}
            </div>
            <textarea
              className={s.textarea}
              placeholder={(spec as { goals_step: { placeholder?: string } }).goals_step.placeholder ?? 'What are you aiming for?'}
              value={goalText}
              onChange={e => setGoalText(e.target.value)}
              rows={4}
            />
            <button
              className={s.primary}
              disabled={!goalText.trim() && goalTags.length === 0}
              onClick={() => setStep('horizon')}
            >Next</button>
          </section>
        )}

        {step === 'horizon' && (
          <section className={s.card}>
            <h2 className={s.h2}>When is your exam?</h2>
            <p className={s.note}>One tap. This paces how fast your route moves.</p>
            <div className={s.horizonGrid}>
              {HORIZON_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${s.horizonBtn} ${deadlineDays === opt.value ? s.horizonBtnOn : ''}`}
                  onClick={() => setDeadlineDays(opt.value)}
                >
                  <HorizonIcon kind={opt.kind} className={s.horizonIcon} />
                  <span className={s.horizonLabel}>{opt.label}</span>
                  <span className={s.horizonSublabel}>{opt.sublabel}</span>
                </button>
              ))}
            </div>
            <button
              className={s.primary}
              disabled={deadlineDays === null}
              onClick={() => setStep(probeQuestions.length > 0 ? 'probe' : 'confidence')}
            >Next</button>
          </section>
        )}

        {step === 'probe' && (
          <section className={`${s.card} ${s.probeStage}`}>
            <p className={s.kicker}>ACT anchors</p>
            <h2 className={s.h2}>{probeStep?.prompt ?? 'Look at four ACT math moments.'}</h2>
            <p className={s.probeIntro}>{probeStep?.note ?? 'Use these as anchors. You can still adjust every rating on the next page.'}</p>
            <div className={s.probeGrid}>
              {probeQuestions.map(item => (
                <article key={item.question_id} className={s.probeCard}>
                  <div className={s.probeCluster}>{item.cluster}</div>
                  <p className={s.probeStem}><MathText text={item.question.question} /></p>
                  <p className={s.probeAsk}>Do you recognize this kind of problem?</p>
                  <div className={s.probeButtons}>
                    {PROBE_ANSWERS.map(answer => (
                      <button
                        key={answer.value}
                        type="button"
                        className={`${s.probeBtn} ${answer.value === 'easy' ? s.probeBtnKnown : ''} ${probeAnswers[item.concept_id] === answer.value ? s.probeBtnOn : ''}`}
                        onClick={() => setProbeAnswer(item.concept_id, answer.value)}
                      >{answer.label}</button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <button
              className={s.primary}
              disabled={!allProbesAnswered}
              onClick={applyProbeAnswers}
            >Use these anchors</button>
          </section>
        )}

        {step === 'confidence' && (
          <section className={s.card}>
            <h2 className={s.h2}>{(spec as { confidence_step: { prompt: string } }).confidence_step.prompt}</h2>
            <p className={s.note}>{(spec as { confidence_step: { note: string } }).confidence_step.note}</p>
            <div className={s.confList}>
              {concepts.map(c => (
                <div key={c.concept_id} className={s.confRow}>
                  <div className={s.confName}>
                    {c.name}
                    {c.act_high_priority && <span className={s.pill}>ACT core</span>}
                  </div>
                  <div className={s.scale}>
                    {scale.map(sp => (
                      <button
                        key={sp.value}
                        className={`${s.scaleBtn} ${confidence[c.concept_id] === sp.value ? s.scaleOn : ''}`}
                        onClick={() => setConf(c.concept_id, sp.value)}
                      >{sp.label}</button>
                    ))}
                    <button
                      type="button"
                      className={`${s.skipBtn} ${excludedIds.has(c.concept_id) ? s.skipOn : ''}`}
                      onClick={() => toggleSkip(c.concept_id)}
                    >Skip</button>
                  </div>
                </div>
              ))}
            </div>
            <button
              className={s.primary}
              disabled={!allRated}
              onClick={() => void finishConfidence()}
            >Finish</button>
          </section>
        )}

        {step === 'done' && (
          <section className={s.card}>
            <h1 className={s.title}>You're mapped.</h1>
            <p className={s.body}>
              Jesse really cooked. Your journal knows your strengths and gaps now.
              The more you practice, the sharper your route gets.
            </p>
            <button className={s.primary} onClick={goToDashboard} disabled={saving}>
              {saving ? 'Saving…' : 'Go to my dashboard'}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
