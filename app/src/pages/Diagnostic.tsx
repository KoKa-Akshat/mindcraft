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
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import { seedAssessment } from '../lib/mlApi'
import { markDiagnosticComplete } from '../lib/practiceState'
import { invalidateKnowledgeGraph } from '../lib/graphCache'
import { toOntologyId } from '../lib/conceptMap'
import { seedFoundationalConfidence } from '../lib/examCurricula'
import type { Confidence } from '../lib/bridgePractice'
import spec from '../data/actDiagnostic.json'
import s from './Diagnostic.module.css'

interface ConfConcept { concept_id: string; name: string; act_high_priority: boolean }
interface ScalePoint { value: Confidence; label: string }

const EXAM = 'ACT'

function buildConfidenceMap(raw: Record<string, Confidence>): Record<string, Confidence> {
  const out: Record<string, Confidence> = {}
  for (const [conceptId, value] of Object.entries(raw)) {
    out[toOntologyId(conceptId)] = value
  }
  return out
}

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
  const [saving, setSaving] = useState(false)

  const progress = useMemo(() => {
    const order: Step[] = ['intro', 'goals', 'confidence', 'done']
    return (order.indexOf(step) / (order.length - 1)) * 100
  }, [step])

  function toggleGoal(tag: string) {
    setGoalTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  function setConf(conceptId: string, value: Confidence) {
    setConfidence(prev => ({ ...prev, [conceptId]: value }))
  }

  async function finishConfidence() {
    const assessment = buildConfidenceMap(confidence)
    const seeded = seedFoundationalConfidence(assessment)
    await seedAssessment(user.uid, seeded)
    invalidateKnowledgeGraph(user.uid)
    await complete(seeded)
  }

  async function complete(confidenceMapOverride?: Record<string, Confidence>) {
    setSaving(true)
    setStep('done')
    const goals = { tags: goalTags, text: goalText.trim() }
    const confidenceMap = confidenceMapOverride ?? buildConfidenceMap(confidence)
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          goals,
          diagnosticCompletedAt: new Date().toISOString(),
          diagnosticVersion: (spec as { version?: string }).version,
        },
        { merge: true },
      )
    } catch {
      /* non-blocking */
    }
    await markDiagnosticComplete(user.uid, { exam: EXAM, confidenceMap })
    invalidateKnowledgeGraph(user.uid)
    setSaving(false)
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
            <p className={s.kicker}>MindCraft diagnostic</p>
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
              placeholder="Anything specific? (optional)"
              value={goalText}
              onChange={e => setGoalText(e.target.value)}
              rows={3}
            />
            <button
              className={s.primary}
              disabled={goalTags.length === 0 && !goalText.trim()}
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
                  </div>
                </div>
              ))}
            </div>
            <button
              className={s.primary}
              disabled={Object.keys(confidence).length < concepts.length}
              onClick={() => void finishConfidence()}
            >Finish</button>
          </section>
        )}

        {step === 'done' && (
          <section className={s.card}>
            <h1 className={s.title}>You're mapped.</h1>
            <p className={s.body}>
              Nox now has a starting picture of your strengths and gaps. The more you
              practice, the sharper your learning world gets.
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
