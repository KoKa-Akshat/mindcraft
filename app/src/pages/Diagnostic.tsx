/**
 * Diagnostic.tsx — goals + concept confidence (kickstarts the engine).
 *
 * Reached from the kitchen world ("Let Nox Cook"), not immediately after login.
 * Flow: login → kitchen world → Let Nox Cook → this page → dashboard.
 *   - goals       → stored on users/{uid}.goals
 *   - confidence  → POST /seed-assessment (hard|kinda|easy per concept → L1/L2/L3)
 *   - complete    → markDiagnosticComplete (diagnosticCompleted: true) + goals
 *
 * Probe step unwired — spec from data/actDiagnostic.json (probe_step.questions []).
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import type { Confidence } from '../lib/bridgePractice'
import spec from '../data/actDiagnostic.json'
import s from './Diagnostic.module.css'

interface ConfConcept { concept_id: string; name: string; act_high_priority: boolean }
interface ScalePoint { value: Confidence; label: string }

const EXAM = 'ACT'

type Step = 'intro' | 'goals' | 'confidence' | 'done'

export default function Diagnostic() {
  const user = useUser()
  const navigate = useNavigate()
  const concepts = (spec as { confidence_step: { concepts: ConfConcept[] } }).confidence_step.concepts
  const scale = (spec as { confidence_step: { scale: ScalePoint[] } }).confidence_step.scale
  const presets = (spec as { goals_step: { presets: string[] } }).goals_step.presets

  const [step, setStep] = useState<Step>('intro')
  const [goalTags, setGoalTags] = useState<string[]>([])
  const [goalText, setGoalText] = useState('')
  const [confidence, setConfidence] = useState<Record<string, Confidence>>({})
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set())
  const [saving, setSaving] = useState(false)

  const progress = useMemo(() => {
    const order: Step[] = ['intro', 'goals', 'confidence', 'done']
    return (order.indexOf(step) / (order.length - 1)) * 100
  }, [step])

  const allRated = useMemo(
    () => concepts.every(c => confidence[c.concept_id] || excludedIds.has(c.concept_id)),
    [concepts, confidence, excludedIds],
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
              onClick={() => setStep('confidence')}
            >Next</button>
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
