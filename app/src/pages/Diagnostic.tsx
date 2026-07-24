/**
 * Diagnostic.tsx: goals + concept confidence (kickstarts the engine).
 *
 * Reached from the kitchen world ("Let Nox Cook"), not immediately after login.
 * Flow: login → kitchen world → Let Nox Cook → this page → dashboard.
 *   - goals       → stored on users/{uid}.goals
 *   - confidence  → POST /seed-assessment (hard|kinda|easy per concept → L1/L2/L3)
 *   - complete    → markDiagnosticComplete (diagnosticCompleted: true) + goals
 *
 * Probe step anchors confidence with one ACT question per cluster.
 *
 * 2026-07-23 pass (Akshat's onboarding review): the intro's illustration is
 * now the interaction (click/tap it, it zooms, then the first real question
 * appears, no separate flat "Start" tap), the horizon step is recolored onto
 * the same parchment/navy/gold palette its own icons already use, the
 * confidence step is three non-scrolling boxes (no Skip button anywhere),
 * and completion drops the old "You're mapped." screen for a direct wizard
 * loading transition into the dashboard. Full reasoning in
 * Diagnostic.module.css's header comment and ACTIVE_TASK.md.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import { applyDiagnosticConfidence } from '../lib/diagnosticSeed'
import type { Confidence } from '../lib/bridgePractice'
import { ACT_TOC_SECTIONS, actTocSectionForConcept } from '../lib/actToc'
import spec from '../data/actDiagnostic.json'
import actBankData from '../data/actMasterQuestionBank.generated.json'
import MathText from '../components/MathText'
import { DeskArt, HorizonIcon } from '../components/DiagnosticArt'
import WizardMascot from '../components/canvas/WizardMascot'
import s from './Diagnostic.module.css'

interface ConfConcept { concept_id: string; name: string; act_high_priority: boolean }
interface ScalePoint { value: Confidence; label: string }
interface ProbeQuestionSpec { question_id: string; concept_id: string; cluster: string }
interface ActQuestion { id: string; conceptId: string; level: 1 | 2 | 3; question: string; choices: string[]; correctIndex: number }
interface ConfGroup { id: string; title: string; concepts: ConfConcept[] }

const PROBE_ANSWERS: { value: Confidence; label: string }[] = [
  { value: 'easy', label: 'Yes, I know it' },
  { value: 'kinda', label: 'Seen it before' },
  { value: 'hard', label: 'New to me' },
]

const EXAM = 'ACT'

type Step = 'intro' | 'goals' | 'horizon' | 'probe' | 'confidence' | 'loading'

type HorizonOption = { value: number; label: string; sublabel: string; kind: 'today' | 'days' | 'week' | 'weeks' }

/** Same day-value buckets as PanicInput's time-to-exam pills (components/PanicInput.tsx)
 *  so `deadline_days` means one consistent thing everywhere it's collected. */
const HORIZON_OPTIONS: HorizonOption[] = [
  { value: 1,  label: 'Today',    sublabel: 'exam is today or tomorrow', kind: 'today' },
  { value: 3,  label: '3 days',   sublabel: 'this week',                 kind: 'days' },
  { value: 7,  label: '1 week',   sublabel: 'next week',                 kind: 'week' },
  { value: 30, label: '2+ weeks', sublabel: 'building from scratch',     kind: 'weeks' },
]

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** Groups the confidence step's concepts into at most 3 non-scrolling boxes,
 * using the SAME lane membership the Map/Contents already render
 * (actTocSectionForConcept → ACT_TOC_SECTIONS), not a second hand-rolled
 * category system. actDiagnostic.json's current concept list happens to
 * split cleanly into exactly 3 non-empty lanes (Algebra/Geometry/Data), so
 * this is normally a straight group-by; the merge fallback only kicks in if
 * a future spec ever also includes foundational ("Warm-ups") concepts,
 * which would make 4 lanes, more than Akshat's "three boxes" ask. */
function groupConceptsForConfidence(concepts: ConfConcept[]): ConfGroup[] {
  const bySection = new Map<string, ConfConcept[]>()
  for (const c of concepts) {
    const sectionId = actTocSectionForConcept(c.concept_id) ?? 'warmups'
    const list = bySection.get(sectionId) ?? []
    list.push(c)
    bySection.set(sectionId, list)
  }
  const ordered = ACT_TOC_SECTIONS
    .filter(sec => (bySection.get(sec.id)?.length ?? 0) > 0)
    .map(sec => ({ id: sec.id, title: sec.title, concepts: bySection.get(sec.id)! }))

  if (ordered.length <= 3) return ordered

  // Condense a 4-lane split down to 3: keep Warm-ups and Algebra separate,
  // merge Geometry + Data into one box.
  const byId = new Map(ordered.map(g => [g.id, g]))
  const merged: ConfGroup[] = []
  const warmups = byId.get('warmups')
  const algebra = byId.get('algebra')
  const geometry = byId.get('geometry')
  const data = byId.get('data')
  if (warmups) merged.push(warmups)
  if (algebra) merged.push(algebra)
  const combined = [...(geometry?.concepts ?? []), ...(data?.concepts ?? [])]
  if (combined.length) merged.push({ id: 'geometry_data', title: 'Geometry & Data', concepts: combined })
  return merged
}

export default function Diagnostic() {
  const user = useUser()
  const navigate = useNavigate()
  const concepts = (spec as { confidence_step: { concepts: ConfConcept[] } }).confidence_step.concepts
  const scale = (spec as { confidence_step: { scale: ScalePoint[] } }).confidence_step.scale
  const presets = (spec as { goals_step: { presets: string[] } }).goals_step.presets
  const probeStep = (spec as { probe_step?: { prompt?: string; note?: string; questions?: ProbeQuestionSpec[] } }).probe_step
  const probeSpecs = probeStep?.questions ?? []

  const [step, setStep] = useState<Step>('intro')
  const [zooming, setZooming] = useState(false)
  const [goalTags, setGoalTags] = useState<string[]>([])
  const [goalText, setGoalText] = useState('')
  const [deadlineDays, setDeadlineDays] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<Record<string, Confidence>>({})
  const [probeAnswers, setProbeAnswers] = useState<Record<string, Confidence>>({})

  const progress = useMemo(() => {
    const order: Step[] = ['intro', 'goals', 'horizon', 'probe', 'confidence', 'loading']
    return (order.indexOf(step) / (order.length - 1)) * 100
  }, [step])

  const confGroups = useMemo(() => groupConceptsForConfidence(concepts), [concepts])

  const allRated = useMemo(
    () => concepts.every(c => !!confidence[c.concept_id]),
    [concepts, confidence],
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

  /** Intro's illustration IS the interaction: tap the notebook, it zooms in,
   * then the first real question replaces it once the transition settles.
   * Respects prefers-reduced-motion by skipping straight to the next step. */
  function beginZoom() {
    if (zooming) return
    setZooming(true)
    window.setTimeout(() => setStep('goals'), prefersReducedMotion() ? 60 : 650)
  }

  async function finishConfidence() {
    setStep('loading')
    try {
      const minDwell = new Promise(resolve => window.setTimeout(resolve, 900))
      await Promise.all([
        applyDiagnosticConfidence(
          user.uid,
          EXAM,
          confidence,
          { tags: goalTags, text: goalText.trim() },
          {
            diagnosticVersion: (spec as { version?: string }).version,
            deadlineDays,
          },
        ),
        minDwell,
      ])
    } finally {
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <div className={s.page}>
      <div className={s.bar}><div className={s.barFill} style={{ width: `${progress}%` }} /></div>
      <div className={s.shell}>

        {step === 'intro' && (
          <section className={s.card}>
            <div className={`${s.cardInner} ${s.introCentered}`}>
              <p className={s.kicker}>Jesse's kitchen</p>
              <h1 className={s.title}>{(spec as { intro: { title: string } }).intro.title}</h1>
              <p className={s.body}>{(spec as { intro: { body: string } }).intro.body}</p>
              <button
                type="button"
                className={`${s.introHotspot} ${zooming ? s.introZooming : ''}`}
                onClick={beginZoom}
                aria-label="Step into Jesse's kitchen and begin"
              >
                <DeskArt className={s.introArt} />
              </button>
              <span className={s.introCue}>Tap the notebook to begin →</span>
            </div>
          </section>
        )}

        {step === 'goals' && (
          <section className={s.card}>
            <div className={s.cardInner}>
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
            </div>
          </section>
        )}

        {step === 'horizon' && (
          <section className={s.card}>
            <div className={s.cardInner}>
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
            </div>
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
            <div className={s.confHead}>
              <h2 className={s.h2}>{(spec as { confidence_step: { prompt: string } }).confidence_step.prompt}</h2>
              <p className={s.note}>{(spec as { confidence_step: { note: string } }).confidence_step.note}</p>
            </div>
            <div className={s.confGrid}>
              {confGroups.map(group => (
                <div key={group.id} className={s.confBox}>
                  <h3 className={s.confBoxTitle}>{group.title}</h3>
                  <div className={s.confBoxList}>
                    {group.concepts.map(c => (
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

        {step === 'loading' && (
          <section className={s.card}>
            <div className={s.loadingStage}>
              <h1 className={s.loadingTitle}>Loading…</h1>
              <WizardMascot line="Personalizing your world ★" cheering />
              <div className={s.loadingBar}><div className={s.loadingBarFill} /></div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
