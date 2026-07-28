/**
 * state.ts
 *
 * The encounter state machine for the Manjushree zone. Framework-free and
 * side-effect-free: React renders from it, the 2D illustrated scene animates
 * from it, telemetry serializes from it. No rendering imports at all (no
 * Three.js, no DOM, no Firebase) so this module stayed untouched across the
 * 2026-07-21 pivot from a 3D engine to a 2D layered-illustration scene.
 *
 * Sequence (simplified 2026-07-21, dropping axis-of-symmetry as its own
 * gated phase per the project owner's request for fewer distinct gates):
 *   intro -> explore -> sight (E1) -> roots (E2, "sword power")
 *   -> vertex (E3, "cleave power" -- internally runs the axis-of-symmetry
 *      check FIRST as an implicit sub-step, then the vertex height check;
 *      both still use the exact same validated math and misconception
 *      classification as before, they just no longer block progress as two
 *      separate top-level phases) -> discriminant (optional, off by default
 *      in the simplified loop) -> strike (E5) -> cinematic -> summary
 *
 * Mistake policy (fixed by the design brief): no health, no restarts.
 * Mistake 1 unlocks a conceptual hint, mistake 2 a partial scaffold,
 * mistake 3 step-by-step assistance. The final interaction always remains
 * the student's.
 */

import {
  checkAxis, checkDiscriminant, checkRoots, checkVertex,
  hintsFor, parseLine, parsePoint, parseRoots,
  MIS_LABELS,
  type AnswerCheck, type EncounterId, type ZoneQuadratic,
} from './math/quadratics'
import { pickQuadratic, quadraticById, TRAJECTORY_BANK, ENCOUNTER_SKILLS } from './math/content'

// 'axis' is deliberately NOT a top-level Phase (simplified 2026-07-21): the
// axis-of-symmetry check now runs as a sub-step inside the 'vertex' phase.
// It remains a full CoreEncounter/EncounterId for math validation, hint
// ladders, and summary reporting -- see markEncounterStart() below.
export type Phase =
  | 'intro' | 'explore' | 'sight' | 'roots' | 'vertex'
  | 'discriminant' | 'strike' | 'cinematic' | 'summary'

export type CoreEncounter = 'roots' | 'axis' | 'vertex'

export interface EncounterState {
  attempts: number
  /** 0 = none shown. Escalates with mistakes: 1 concept, 2 scaffold, 3 full assist. */
  hintLevel: 0 | 1 | 2 | 3
  /** Highest hint level actually shown to the student. */
  hintsShown: number
  solved: boolean
  firstTryCorrect: boolean | null
  misconceptions: string[]
  enteredAt: number | null
  lastSubmitAt: number | null
}

export interface AttemptRecord {
  encounter: EncounterId
  questionId: string
  submitted: string
  correct: boolean
  misconceptionId?: string
  attemptNumber: number
  hintLevelAtSubmit: number
  responseTimeMs: number
  at: number
}

export interface SubmitResult {
  check: AnswerCheck
  /** Amber "Common trap" label when the miss matched a known misconception. */
  trapLabel?: string
  /** Hint newly unlocked by this mistake (already at the escalated level). */
  hint?: { level: number; text: string }
  solvedEncounter: boolean
}

export interface SummaryEncounterRow {
  encounter: CoreEncounter | 'discriminant'
  skill: string
  solved: boolean
  attempts: number
  hintsUsed: number
  misconceptions: string[]
}

export interface SessionSummary {
  questionId: string
  level: 1 | 2 | 3
  rows: SummaryEncounterRow[]
  totalHints: number
  misconceptions: Array<{ id: string; label: string }>
  strength: string
  nextAction: string
  /** Data for the learning pipeline: one outcome per math encounter. */
  outcomes: Array<{
    encounter: string
    questionId: string
    score: number
    misconceptionId?: string
  }>
}

const CORE: CoreEncounter[] = ['roots', 'axis', 'vertex']

function freshEncounter(): EncounterState {
  return {
    attempts: 0, hintLevel: 0, hintsShown: 0, solved: false,
    firstTryCorrect: null, misconceptions: [], enteredAt: null, lastSubmitAt: null,
  }
}

export class ZoneSession {
  readonly quadratic: ZoneQuadratic
  phase: Phase = 'intro'
  charges = 0
  readonly includeDiscriminant: boolean
  encounters: Record<CoreEncounter, EncounterState> = {
    roots: freshEncounter(), axis: freshEncounter(), vertex: freshEncounter(),
  }
  discriminant = {
    answered: [] as Array<{ trajectoryId: string; correct: boolean; misconceptionId?: string; attempts: number }>,
    index: 0,
    attemptsOnCurrent: 0,
    enteredAt: null as number | null,
  }
  attemptLog: AttemptRecord[] = []
  private listeners = new Set<() => void>()

  constructor(opts: { level?: 1 | 2 | 3; questionId?: string; excludeId?: string; includeDiscriminant?: boolean } = {}) {
    this.quadratic = (opts.questionId ? quadraticById(opts.questionId) : undefined)
      ?? pickQuadratic(opts.level ?? 1, opts.excludeId)
    this.includeDiscriminant = opts.includeDiscriminant ?? true
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  setPhase(phase: Phase) {
    this.phase = phase
    if (phase === 'roots' || phase === 'vertex') {
      const enc = this.encounters[phase]
      if (enc.enteredAt === null) enc.enteredAt = Date.now()
    }
    if (phase === 'discriminant' && this.discriminant.enteredAt === null) {
      this.discriminant.enteredAt = Date.now()
    }
    this.emit()
  }

  /**
   * Start timing for the axis-of-symmetry sub-step. Called by the component
   * when it shows the axis rune-stone picker at the start of the 'vertex'
   * phase (before the vertex-height sub-step). Kept as an explicit method
   * rather than folding into setPhase() because 'axis' is not a Phase.
   */
  markEncounterStart(encounter: CoreEncounter) {
    const enc = this.encounters[encounter]
    if (enc.enteredAt === null) enc.enteredAt = Date.now()
  }

  /** The phase that follows a solved encounter. */
  nextPhaseAfter(phase: Phase): Phase {
    switch (phase) {
      case 'intro': return 'explore'
      case 'explore': return 'sight'
      case 'sight': return 'roots'
      case 'roots': return 'vertex'
      case 'vertex': return this.includeDiscriminant ? 'discriminant' : 'strike'
      case 'discriminant': return 'strike'
      case 'strike': return 'cinematic'
      case 'cinematic': return 'summary'
      default: return 'summary'
    }
  }

  advance() {
    this.setPhase(this.nextPhaseAfter(this.phase))
  }

  currentHint(encounter: EncounterId): { level: number; text: string } | null {
    if (encounter === 'discriminant') {
      const level = Math.min(3, this.discriminant.attemptsOnCurrent + 1)
      const text = hintsFor(this.quadratic, 'discriminant')[Math.max(0, level - 1)]
      return { level, text }
    }
    if (encounter === 'strike') {
      return { level: 1, text: hintsFor(this.quadratic, 'strike')[0] }
    }
    const enc = this.encounters[encounter as CoreEncounter]
    // H key always offers at least the conceptual hint; mistakes escalate it.
    const level = Math.max(1, enc.hintLevel) as 1 | 2 | 3
    const text = hintsFor(this.quadratic, encounter)[level - 1]
    return { level, text }
  }

  /** Mark a hint as actually shown (H key or auto-escalation). */
  markHintShown(encounter: CoreEncounter, level: number) {
    const enc = this.encounters[encounter]
    if (level > enc.hintsShown) enc.hintsShown = level
    this.emit()
  }

  private recordAttempt(
    encounter: EncounterId,
    submitted: string,
    check: AnswerCheck,
  ): SubmitResult {
    const now = Date.now()
    const isCore = encounter === 'roots' || encounter === 'axis' || encounter === 'vertex'
    let attemptNumber = 1
    let hintLevelAtSubmit = 0
    let responseTimeMs = 0

    if (isCore) {
      const enc = this.encounters[encounter as CoreEncounter]
      enc.attempts += 1
      attemptNumber = enc.attempts
      hintLevelAtSubmit = enc.hintsShown
      responseTimeMs = now - (enc.lastSubmitAt ?? enc.enteredAt ?? now)
      enc.lastSubmitAt = now
      if (enc.firstTryCorrect === null) enc.firstTryCorrect = check.correct
      if (check.correct) {
        enc.solved = true
        this.charges += 1
      } else {
        if (check.misconceptionId && !enc.misconceptions.includes(check.misconceptionId)) {
          enc.misconceptions.push(check.misconceptionId)
        }
        enc.hintLevel = Math.min(3, enc.attempts) as 1 | 2 | 3
      }
    } else if (encounter === 'discriminant') {
      this.discriminant.attemptsOnCurrent += 1
      attemptNumber = this.discriminant.attemptsOnCurrent
      responseTimeMs = now - (this.discriminant.enteredAt ?? now)
    }

    const record: AttemptRecord = {
      encounter,
      questionId: this.quadratic.id,
      submitted,
      correct: check.correct,
      misconceptionId: check.misconceptionId,
      attemptNumber,
      hintLevelAtSubmit,
      responseTimeMs,
      at: now,
    }
    this.attemptLog.push(record)

    const result: SubmitResult = {
      check,
      solvedEncounter: check.correct,
      trapLabel: check.misconceptionId ? MIS_LABELS[check.misconceptionId] : undefined,
    }
    if (!check.correct && isCore) {
      const hint = this.currentHint(encounter)
      if (hint) {
        result.hint = hint
        this.markHintShown(encounter as CoreEncounter, hint.level)
      }
    }
    this.emit()
    return result
  }

  submitRootsPlacement(values: number[]): SubmitResult {
    return this.recordAttempt('roots', `placed:${values.join(',')}`, checkRoots(this.quadratic, values))
  }

  submitRootsTyped(text: string): SubmitResult {
    const parsed = parseRoots(text)
    const check = parsed.valid
      ? checkRoots(this.quadratic, parsed.values, { usedYEquals: parsed.usedYEquals })
      : { correct: false, unparsed: true }
    return this.recordAttempt('roots', `typed:${text}`, check)
  }

  submitAxisPlacement(beamGraphX: number): SubmitResult {
    return this.recordAttempt('axis', `placed:${beamGraphX}`, checkAxis(this.quadratic, { kind: 'x', value: beamGraphX }))
  }

  submitAxisTyped(text: string): SubmitResult {
    return this.recordAttempt('axis', `typed:${text}`, checkAxis(this.quadratic, parseLine(text)))
  }

  submitVertexTyped(text: string): SubmitResult {
    return this.recordAttempt('vertex', `typed:${text}`, checkVertex(this.quadratic, parsePoint(text)))
  }

  currentTrajectory() {
    return TRAJECTORY_BANK[this.discriminant.index] ?? null
  }

  submitDiscriminant(answer: 'two' | 'one' | 'none'): SubmitResult & { finished: boolean } {
    const traj = this.currentTrajectory()
    if (!traj) return { check: { correct: false }, solvedEncounter: false, finished: true }
    const check = checkDiscriminant(traj, answer)
    const result = this.recordAttempt('discriminant', `${traj.id}:${answer}`, check)
    if (check.correct) {
      this.discriminant.answered.push({
        trajectoryId: traj.id,
        correct: this.discriminant.attemptsOnCurrent === 1,
        misconceptionId: undefined,
        attempts: this.discriminant.attemptsOnCurrent,
      })
      this.discriminant.index += 1
      this.discriminant.attemptsOnCurrent = 0
    }
    const finished = this.discriminant.index >= TRAJECTORY_BANK.length
    this.emit()
    return { ...result, finished }
  }

  get strikeReady(): boolean {
    return CORE.every(e => this.encounters[e].solved)
  }

  buildSummary(): SessionSummary {
    const rows: SummaryEncounterRow[] = CORE.map(e => ({
      encounter: e,
      skill: ENCOUNTER_SKILLS[e],
      solved: this.encounters[e].solved,
      attempts: this.encounters[e].attempts,
      hintsUsed: this.encounters[e].hintsShown,
      misconceptions: this.encounters[e].misconceptions,
    }))
    const discAttempted = this.attemptLog.some(a => a.encounter === 'discriminant')
    if (discAttempted) {
      const discAttempts = this.attemptLog.filter(a => a.encounter === 'discriminant')
      rows.push({
        encounter: 'discriminant',
        skill: ENCOUNTER_SKILLS.discriminant,
        solved: this.discriminant.answered.length >= TRAJECTORY_BANK.length,
        attempts: discAttempts.length,
        hintsUsed: 0,
        misconceptions: [...new Set(discAttempts.map(a => a.misconceptionId).filter((m): m is string => !!m))],
      })
    }

    const misconceptions = [...new Set(rows.flatMap(r => r.misconceptions))]
      .map(id => ({ id, label: MIS_LABELS[id] ?? id }))

    // Strength: the smoothest core encounter. Recommendation: the roughest.
    const scored = CORE.map(e => ({
      e,
      cost: this.encounters[e].attempts + this.encounters[e].hintsShown * 0.5,
    }))
    scored.sort((a, b) => a.cost - b.cost)
    const best = scored[0].e
    const worst = scored[scored.length - 1].e

    const strengthText: Record<CoreEncounter, string> = {
      roots: 'You read the roots straight off the structure. That is the hard part of factoring, done.',
      axis: 'You found the centerline cleanly. Symmetry is working for you.',
      vertex: 'You substituted into the function without a slip. The vertex held.',
    }
    const nextText: Record<CoreEncounter, string> = {
      roots: 'Your next mission will strengthen finding roots by factoring.',
      axis: 'Your next mission will strengthen the axis of symmetry.',
      vertex: 'Your next mission will strengthen vertex calculations.',
    }

    const outcomes: SessionSummary['outcomes'] = CORE.map(e => ({
      encounter: e as string,
      questionId: `${this.quadratic.id}__${e}`,
      score: this.encounters[e].firstTryCorrect ? 1 : 0,
      misconceptionId: this.encounters[e].misconceptions[0],
    }))
    if (discAttempted) {
      const firstTryAll = this.discriminant.answered.length > 0 && this.discriminant.answered.every(a => a.correct)
      outcomes.push({
        encounter: 'discriminant',
        questionId: `${this.quadratic.id}__discriminant`,
        score: firstTryAll ? 1 : 0,
        misconceptionId: this.attemptLog.find(a => a.encounter === 'discriminant' && a.misconceptionId)?.misconceptionId,
      })
    }

    const perfect = scored.every(s => s.cost <= 1)
    return {
      questionId: this.quadratic.id,
      level: this.quadratic.level,
      rows,
      totalHints: CORE.reduce((n, e) => n + this.encounters[e].hintsShown, 0),
      misconceptions,
      strength: strengthText[best],
      nextAction: perfect
        ? 'Clean run. Replay at a harder difficulty, or carry this into practice.'
        : nextText[worst],
      outcomes,
    }
  }
}
