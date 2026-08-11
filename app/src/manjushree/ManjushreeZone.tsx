/**
 * ManjushreeZone.tsx
 *
 * The Sword of Wisdom: The First Cut. Hidden action-math zone.
 *
 * Rebuilt 2026-07-21 as a 2D layered illustration scene (the project owner's
 * pivot away from the earlier Three.js build after playing it -- see
 * agent_work/manjushree-zone/LESSONS.md for the full reasoning). Follows the
 * same house pattern as `spark/spark.js` and `components/book/`: absolutely
 * positioned DOM layers over real generated illustration images, CSS
 * transitions for motion, no canvas game engine. The one exception is
 * ParabolaOverlay.tsx, a real SVG drawing surface for the one thing that
 * deserves genuine math-driven drawing: the parabola itself.
 *
 * Simplified beat sequence (owner's own description, verbatim intent
 * preserved): arrival -> villager interaction -> travel -> Wisdom Sight ->
 * roots ("sword power") -> axis + vertex ("cleave power") -> cut -> result.
 * This drops axis-of-symmetry as its own separately-gated phase (see
 * state.ts) while keeping the exact same validated math and misconception
 * checks underneath.
 *
 * Route: /manjushree (AuthGuard), /try/manjushree (public landing preview),
 * and /manjushree-dev (DEV alias of the public preview).
 */

import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserContext } from '../App'
import { ZoneSession, type Phase, type SubmitResult } from './state'
import {
  NARRATIVE, VILLAGER_DIALOGUE,
} from './math/content'
import {
  equationText, fmt, axisCandidates, vertexHeightCandidates, rootPairCandidates,
  axisOf, type RootPair,
} from './math/quadratics'
import { logAttempt, logZoneEvent, submitZoneOutcomes } from './telemetry'
import ParabolaOverlay from './ParabolaOverlay'
import valleyUrl from './assets2d/valley_blocks.jpg'
import villagerUrl from './assets2d/villager.png'
import swordUrl from './assets2d/sword.png'
import s from './ManjushreeZone.module.css'

const CUT_SEEN_KEY = 'mc-manjushree-cut-seen'
const COMPLETED_KEY = 'mc-manjushree-completed'
const STRIKE_HOLD_MS = 1300
/** Cut plays, then we jump straight into the story slideshow. */
const CINEMATIC_MS = 3000

const MARKETING_DEMO = 'https://joinmindcraft.com/#demo'

function storyLoopPath(preview: boolean): string {
  return preview
    ? '/try/story/fractions_decimals?auto=1'
    : '/story-loop/fractions_decimals?auto=1'
}

type ToastKind = 'neutral' | 'success' | 'unstable'
interface Toast { text: string; kind: ToastKind }
type VertexStep = 'axis' | 'height'
type ArrivalStep = 'establishing' | 'dialogue' | 'traveling'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Fisher-Yates. Randomizes rune-stone display order per encounter. */
function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function ManjushreeZone({
  preview = false,
  /** @deprecated use preview — kept so older call sites keep working */
  devMode = false,
}: { preview?: boolean; devMode?: boolean }) {
  const isPreview = preview || devMode
  const user = useContext(UserContext)
  const uid = user?.uid ?? null
  const navigate = useNavigate()

  const [sessionKey, setSessionKey] = useState(0)
  const [level, setLevel] = useState<1 | 2 | 3>(1)
  const [phase, setPhase] = useState<Phase>('intro')
  const [introOpen, setIntroOpen] = useState(true)
  const [reduced] = useState(prefersReducedMotion)

  // Arrival / villager / travel (all local UI state, not session Phase)
  const [arrivalStep, setArrivalStep] = useState<ArrivalStep>('establishing')
  const [dialogueIndex, setDialogueIndex] = useState(0)

  // Wisdom Sight
  const [sightOn, setSightOn] = useState(false)

  // Roots ("sword power") — two clickable pairs
  const [rootOptions, setRootOptions] = useState<RootPair[] | null>(null)
  const [rejectedRootPair, setRejectedRootPair] = useState<string | null>(null)
  const [confirmedRoots, setConfirmedRoots] = useState<number[]>([])

  // Vertex ("cleave power"): axis sub-step, then height sub-step
  const [vertexStep, setVertexStep] = useState<VertexStep>('axis')
  const [axisOptions, setAxisOptions] = useState<number[] | null>(null)
  const [rejectedAxisStone, setRejectedAxisStone] = useState<number | null>(null)
  const [axisConfirmed, setAxisConfirmed] = useState(false)
  const [heightOptions, setHeightOptions] = useState<number[] | null>(null)
  const [rejectedHeightStone, setRejectedHeightStone] = useState<number | null>(null)
  const [vertexConfirmed, setVertexConfirmed] = useState(false)
  const [flooding, setFlooding] = useState(false)

  // Strike ("the cut")
  const [strikeHold, setStrikeHold] = useState(0)
  const strikeRaf = useRef(0)
  const strikeStart = useRef(0)

  // Cinematic
  const [crackDrawn, setCrackDrawn] = useState(false)
  const [splitActive, setSplitActive] = useState(false)
  const [impactFlash, setImpactFlash] = useState(false)

  // Shared feedback chrome — one line at a time (toast OR hint), never stacked cards
  const [objective, setObjective] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [hint, setHint] = useState<{ level: number; text: string } | null>(null)
  const toastTimer = useRef(0)
  const advanceTimer = useRef(0)
  const hintTimer = useRef(0)
  const floodTimer = useRef(0)

  const [searchParams] = useSearchParams()
  const sessionRef = useRef<ZoneSession | null>(null)
  if (!sessionRef.current) {
    const forced = isPreview ? searchParams.get('q') ?? undefined : undefined
    sessionRef.current = new ZoneSession({ level, questionId: forced, includeDiscriminant: false })
  }
  const session = sessionRef.current
  const q = session.quadratic
  const axis = axisOf(q)

  function revealHint(h: { level: number; text: string }) {
    setHint(h)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(null), 4000)
  }

  function triggerFlood() {
    setFlooding(true)
    window.clearTimeout(floodTimer.current)
    floodTimer.current = window.setTimeout(() => setFlooding(false), reduced ? 900 : 2800)
  }

  useEffect(() => {
    logZoneEvent(uid, 'manjushree_enter', { questionId: q.id, level: q.level })
    return () => {
      window.clearTimeout(toastTimer.current)
      window.clearTimeout(advanceTimer.current)
      window.cancelAnimationFrame(strikeRaf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey])

  // ── Helpers ──────────────────────────────────────────────────────────────

  function showToast(text: string, kind: ToastKind = 'neutral', ms = 4200) {
    setToast({ text, kind })
    window.clearTimeout(toastTimer.current)
    if (ms > 0) toastTimer.current = window.setTimeout(() => setToast(null), ms)
  }

  function goPhase(next: Phase) {
    session.setPhase(next)
    setPhase(next)
    setHint(null)
    window.clearTimeout(hintTimer.current)
    switch (next) {
      case 'explore':
        setArrivalStep('establishing')
        // Clean start: only the Talk button — no ask card / toast covering it.
        setObjective('')
        setToast(null)
        break
      case 'sight':
        setObjective(NARRATIVE.sightPrompt)
        showToast(NARRATIVE.sightIntro, 'neutral', 2800)
        break
      case 'roots':
        // Objective lives in the dock — clear leftover sight toast so it does not duplicate.
        window.clearTimeout(toastTimer.current)
        setToast(null)
        setObjective(NARRATIVE.rootsObjective)
        setRootOptions(shuffleArray([...rootPairCandidates(q)]))
        setRejectedRootPair(null)
        break
      case 'vertex':
        session.markEncounterStart('axis')
        setVertexStep('axis')
        setObjective(NARRATIVE.vertexAxisObjective)
        setAxisConfirmed(false)
        setVertexConfirmed(false)
        setRejectedAxisStone(null)
        setAxisOptions(shuffleArray(axisCandidates(q, 2)))
        break
      case 'strike':
        setObjective(NARRATIVE.strikeObjective)
        showToast(NARRATIVE.strikeReady, 'success', 3200)
        setStrikeHold(0)
        break
      case 'cinematic':
        window.clearTimeout(toastTimer.current)
        setToast(null)
        setHint(null)
        setCrackDrawn(false)
        setSplitActive(false)
        runCinematic()
        break
      case 'summary':
        finishAndOpenSlideshow()
        break
    }
  }

  function finishAndOpenSlideshow() {
    const sum = session.buildSummary()
    localStorage.setItem(CUT_SEEN_KEY, '1')
    const prev = Number(localStorage.getItem(COMPLETED_KEY) ?? '0')
    localStorage.setItem(COMPLETED_KEY, String(Math.max(prev, q.level)))
    void submitZoneOutcomes(uid, sum)
    navigate(storyLoopPath(isPreview))
  }

  function runCinematic() {
    const t1 = window.setTimeout(() => setCrackDrawn(true), 40)
    const t2 = window.setTimeout(() => {
      setSplitActive(true)
      setImpactFlash(true)
      logZoneEvent(uid, 'manjushree_strike', { questionId: q.id })
      window.setTimeout(() => setImpactFlash(false), 260)
    }, reduced ? 200 : 900)
    // ~3s of cut, then hard-cut into the animated story slideshow — no summary gate.
    const t3 = window.setTimeout(() => {
      finishAndOpenSlideshow()
    }, reduced ? 700 : CINEMATIC_MS)
    advanceTimer.current = t3
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3) }
  }

  function afterSolve(next: Phase, line: string) {
    showToast(line, 'success', 4200)
    setHint(null)
    window.clearTimeout(hintTimer.current)
    window.clearTimeout(advanceTimer.current)
    advanceTimer.current = window.setTimeout(() => goPhase(next), 1900)
  }

  function handleMiss(res: SubmitResult, _unstableLine: string) {
    // One calm line — flood is the drama; UI stays a single dock.
    triggerFlood()
    setHint(null)
    window.clearTimeout(hintTimer.current)
    showToast(
      res.check.unparsed ? 'That did not read. Try again.' : 'Not those. The valley floods.',
      'unstable',
      2800,
    )
  }

  function logRes(inputPath: 'placed' | 'typed' = 'placed') {
    const attempt = session.attemptLog[session.attemptLog.length - 1]
    if (attempt) {
      logAttempt(uid, attempt, {
        level: q.level, phase: session.phase, sightOn, inputPath,
      })
    }
  }

  // ── Villager dialogue ────────────────────────────────────────────────────

  function openDialogue() {
    setArrivalStep('dialogue')
    setDialogueIndex(0)
    logZoneEvent(uid, 'manjushree_npc_met', { phase })
  }

  function advanceDialogue() {
    if (dialogueIndex < VILLAGER_DIALOGUE.length - 1) {
      setDialogueIndex(i => i + 1)
    } else {
      // Go straight to sight — the old travel "loading" card could hang forever
      // if its timer got cleared by an HMR remount / effect cleanup.
      window.clearTimeout(advanceTimer.current)
      goPhase('sight')
    }
  }

  function startTravel() {
    // Kept for any leftover callers; never block on a timed travel screen.
    window.clearTimeout(advanceTimer.current)
    goPhase('sight')
  }

  // ── Wisdom Sight ─────────────────────────────────────────────────────────

  function toggleSight() {
    const next = !sightOn
    setSightOn(next)
    logZoneEvent(uid, 'manjushree_sight', { on: next, phase })
    if (next && phase === 'sight') {
      showToast(NARRATIVE.sightRevealed, 'success', 4600)
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = window.setTimeout(() => goPhase('roots'), reduced ? 800 : 3200)
    }
  }

  // ── Roots ────────────────────────────────────────────────────────────────

  function submitRootPair(pair: RootPair) {
    const res = session.submitRootsPlacement([...pair])
    logRes('placed')
    if (res.check.correct) {
      setConfirmedRoots([q.r1, q.r2])
      setRejectedRootPair(null)
      afterSolve('vertex', NARRATIVE.rootsCorrect)
    } else {
      setRejectedRootPair(`${pair[0]},${pair[1]}`)
      window.setTimeout(() => setRejectedRootPair(null), 700)
      handleMiss(res, NARRATIVE.rootsUnstable)
    }
  }

  // ── Vertex: axis sub-step, then height sub-step ─────────────────────────

  function submitAxisCandidate(value: number) {
    const res = session.submitAxisTyped(String(value))
    logRes('placed')
    if (res.check.correct) {
      setAxisConfirmed(true)
      showToast(NARRATIVE.vertexAxisCorrect, 'success', 2600)
      setHint(null)
      window.clearTimeout(hintTimer.current)
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = window.setTimeout(() => {
        session.markEncounterStart('vertex')
        setVertexStep('height')
        setObjective(NARRATIVE.vertexHeightObjective)
        setRejectedHeightStone(null)
        setHeightOptions(shuffleArray(vertexHeightCandidates(q, 2)))
      }, reduced ? 300 : 1300)
    } else {
      setRejectedAxisStone(value)
      window.setTimeout(() => setRejectedAxisStone(null), 700)
      handleMiss(res, NARRATIVE.vertexAxisUnstable)
    }
  }

  function submitHeightCandidate(value: number) {
    const res = session.submitVertexTyped(`(${fmt(axis)}, ${fmt(value)})`)
    logRes('placed')
    if (res.check.correct) {
      setVertexConfirmed(true)
      afterSolve('strike', NARRATIVE.vertexHeightCorrect)
    } else {
      setRejectedHeightStone(value)
      window.setTimeout(() => setRejectedHeightStone(null), 700)
      handleMiss(res, NARRATIVE.vertexUnstable)
    }
  }

  // ── Strike (hold to charge, release to cut) ─────────────────────────────

  function beginStrikeHold() {
    if (phase !== 'strike') return
    strikeStart.current = performance.now()
    const loop = () => {
      const p = Math.min(1, (performance.now() - strikeStart.current) / STRIKE_HOLD_MS)
      setStrikeHold(p)
      if (p < 1) strikeRaf.current = requestAnimationFrame(loop)
    }
    strikeRaf.current = requestAnimationFrame(loop)
  }

  function endStrikeHold() {
    window.cancelAnimationFrame(strikeRaf.current)
    if (strikeHold >= 0.98) {
      goPhase('cinematic')
    } else if (strikeHold > 0.1) {
      showToast('The charge slipped. Hold until the ring closes, then release.', 'unstable', 4000)
    }
    setStrikeHold(0)
  }

  // ── Keyboard shortcuts (accessibility parity with the pointer path) ─────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (introOpen || phase === 'summary') return
      if (e.key === 'h' || e.key === 'H') {
        const enc = phase === 'roots' ? 'roots'
          : phase === 'vertex' ? (vertexStep === 'axis' ? 'axis' : 'vertex')
          : phase === 'strike' ? 'strike' : null
        if (enc) {
          const h = session.currentHint(enc)
          if (h) {
            session.markHintShown(enc === 'strike' ? 'roots' : enc as 'roots' | 'axis' | 'vertex', h.level)
            revealHint(h)
          }
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (phase === 'roots') {
          setRootOptions(shuffleArray([...rootPairCandidates(q)]))
          setRejectedRootPair(null)
        }
        if (phase === 'vertex' && vertexStep === 'axis') {
          setAxisOptions(shuffleArray(axisCandidates(q, 2)))
          setRejectedAxisStone(null)
        }
        if (phase === 'vertex' && vertexStep === 'height') {
          setHeightOptions(shuffleArray(vertexHeightCandidates(q, 2)))
          setRejectedHeightStone(null)
        }
        showToast('Trial reset. The rock keeps no grudges.', 'neutral', 3000)
      } else if (e.key === ' ' && phase === 'strike') {
        e.preventDefault()
        beginStrikeHold()
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === ' ' && phase === 'strike') endStrikeHold()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, vertexStep, introOpen, strikeHold])

  // ── Replay / exit ────────────────────────────────────────────────────────

  function replay(nextLevel: 1 | 2 | 3) {
    sessionRef.current = new ZoneSession({ level: nextLevel, excludeId: q.id, includeDiscriminant: false })
    setLevel(nextLevel)
    setSightOn(false)
    setConfirmedRoots([])
    setRootOptions(null)
    setFlooding(false)
    setAxisConfirmed(false)
    setVertexConfirmed(false)
    setAxisOptions(null)
    setHeightOptions(null)
    setPhase('intro')
    setIntroOpen(true)
    setSessionKey(k => k + 1)
  }

  function begin() {
    setIntroOpen(false)
    goPhase('explore')
  }

  function exitToDashboard() {
    logZoneEvent(uid, 'manjushree_exit', { phase })
    if (isPreview) {
      try {
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'mc-try-close' }, '*')
          return
        }
      } catch { /* cross-origin parent — fall through */ }
      window.location.href = MARKETING_DEMO
      return
    }
    navigate('/dashboard')
  }

  // ── Derived render helpers ──────────────────────────────────────────────

  const showEquation = sightOn && !introOpen && phase !== 'summary' && phase !== 'cinematic'
  const encounterForHint = phase === 'roots' || phase === 'vertex' || phase === 'strike'
  // Wide "arrival" framing for explore, closer "hill" framing from sight onward.
  // Keep full-valley framing once Sight is on so the silhouette overlay
  // stays locked to the painted mountain (zooming the backdrop alone drifts it).
  const closeFraming = phase !== 'intro' && phase !== 'explore' && !sightOn
  const cutFinished = phase === 'cinematic' && splitActive || phase === 'summary'

  // Crack line: a hand-authored jagged path through the ridge's saddle notch,
  // shared by the SVG stroke reveal AND the two clip-path halves so the crack
  // visual and the image split can never disagree with each other.
  const CRACK_POINTS: Array<[number, number]> = [
    [47, 0], [50, 13], [45, 27], [49, 41], [44, 55], [48, 69], [46, 84], [49, 100],
  ]
  const crackPathD = CRACK_POINTS.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const leftClip = `polygon(0% 0%, ${CRACK_POINTS.map(([x, y]) => `${x}% ${y}%`).join(', ')}, 0% 100%)`
  const rightClip = `polygon(100% 0%, ${CRACK_POINTS.map(([x, y]) => `${x}% ${y}%`).join(', ')}, 100% 100%)`

  return (
    <div className={s.root} key={sessionKey}>
      <div
        className={`${s.backdrop} ${closeFraming ? s.backdropClose : ''} ${cutFinished ? s.backdropCut : ''}`}
        style={{ backgroundImage: `url(${valleyUrl})` }}
      />

      {/* Screen-reader narration */}
      <div aria-live="polite" className={s.srOnly}>
        {hint?.text ?? toast?.text}
      </div>

      {/* Wisdom Sight overlay (the one real math-drawing surface) */}
      {(phase === 'sight' || phase === 'roots' || phase === 'vertex' || phase === 'strike') && (
        <ParabolaOverlay
          quadratic={q}
          revealed={sightOn}
          axisConfirmed={axisConfirmed}
          showCenterCut={phase === 'strike' || (phase === 'vertex' && axisConfirmed)}
          reducedMotion={reduced}
        />
      )}

      {/* Flood on wrong answer */}
      <div className={`${s.floodOverlay} ${flooding ? s.floodOverlayOn : ''}`} aria-hidden="true" />

      {/* Villager sprite, peeking in during the arrival beat only (the
          dialogue panel below renders its own avatar once talk begins,
          so this must not stay mounted underneath it). */}
      {phase === 'explore' && arrivalStep === 'establishing' && (
        <button
          type="button"
          className={s.villagerBtn}
          onClick={openDialogue}
          aria-label="Talk to the villager"
        >
          <img src={villagerUrl} alt="" className={s.villagerImg} />
          <span className={s.villagerHint}>Talk</span>
        </button>
      )}

      {/* Villager dialogue panel */}
      {phase === 'explore' && arrivalStep === 'dialogue' && (
        <div className={s.dialoguePanel} role="dialog" aria-label="Villager">
          <img src={villagerUrl} alt="" className={s.dialogueAvatar} />
          <div className={s.dialogueBox}>
            <p className={s.dialogueLine}>{VILLAGER_DIALOGUE[dialogueIndex]}</p>
            <button className={s.primaryBtn} onClick={advanceDialogue}>
              {dialogueIndex < VILLAGER_DIALOGUE.length - 1 ? 'Continue' : 'Head to the ridge'}
            </button>
          </div>
        </div>
      )}

      {/* Sight: one floating toast + the reveal button (no play dock yet) */}
      {phase === 'sight' && toast && (
        <p className={`${s.toast} ${s[`toast_${toast.kind}`]}`} role="status">{toast.text}</p>
      )}
      {phase === 'sight' && (
        <div className={s.sightPrompt}>
          <button className={`${s.actionBtn} ${sightOn ? s.actionBtnActive : ''}`} onClick={toggleSight}>
            {NARRATIVE.sightPrompt}
          </button>
        </div>
      )}

      {/* One play dock: equation + one feedback line + choices — never stacked cards */}
      {!introOpen && (phase === 'roots' || phase === 'vertex' || phase === 'strike') && (
        <div className={s.playDock}>
          {(showEquation || objective) && (
            <div className={s.askBlock}>
              {phase === 'roots' ? (
                <>
                  <p className={s.askText}>{NARRATIVE.rootsObjective}</p>
                  <p className={s.askEq}>{equationText(q)}?</p>
                </>
              ) : (
                <>
                  {showEquation && <p className={s.askEq}>{equationText(q)}</p>}
                  {objective && <p className={s.askText}>{objective}</p>}
                </>
              )}
            </div>
          )}

          <div className={s.feedbackSlot} aria-live="polite">
            {hint ? (
              <p className={s.feedbackHint}>{hint.text}</p>
            ) : toast ? (
              <p className={`${s.feedbackLine} ${toast.kind === 'unstable' ? s.feedbackBad : toast.kind === 'success' ? s.feedbackGood : ''}`}>
                {toast.text}
              </p>
            ) : null}
          </div>

          {phase === 'roots' && sightOn && rootOptions && (
            <div className={s.choiceRow} role="group" aria-label="Choose the roots">
              {rootOptions.map(pair => {
                const key = `${pair[0]},${pair[1]}`
                return (
                  <button
                    key={key}
                    type="button"
                    className={`${s.choiceBtn} ${rejectedRootPair === key ? s.choiceBtnBad : ''}`}
                    onClick={() => submitRootPair(pair)}
                    aria-label={`Roots x equals ${fmt(pair[0])} and ${fmt(pair[1])}`}
                  >
                    x = {fmt(pair[0])} and {fmt(pair[1])}
                  </button>
                )
              })}
            </div>
          )}

          {phase === 'vertex' && vertexStep === 'axis' && axisOptions && !axisConfirmed && (
            <div className={s.choiceRow} role="group" aria-label="Choose the axis">
              {axisOptions.map(v => (
                <button
                  key={v}
                  type="button"
                  className={`${s.choiceBtn} ${rejectedAxisStone === v ? s.choiceBtnBad : ''}`}
                  onClick={() => submitAxisCandidate(v)}
                >
                  x = {fmt(v)}
                </button>
              ))}
            </div>
          )}

          {phase === 'vertex' && vertexStep === 'height' && heightOptions && !vertexConfirmed && (
            <div className={s.choiceRow} role="group" aria-label="Choose the peak height">
              {heightOptions.map(v => (
                <button
                  key={v}
                  type="button"
                  className={`${s.choiceBtn} ${rejectedHeightStone === v ? s.choiceBtnBad : ''}`}
                  onClick={() => submitHeightCandidate(v)}
                >
                  y = {fmt(v)}
                </button>
              ))}
            </div>
          )}

          {phase === 'strike' && (
            <div className={s.strikeWrap}>
              <button
                className={`${s.strikeBtn} ${strikeHold > 0 ? s.strikeBtnActive : ''}`}
                onPointerDown={beginStrikeHold}
                onPointerUp={endStrikeHold}
                onPointerLeave={endStrikeHold}
              >
                <img src={swordUrl} alt="" className={s.strikeSword} />
                <span>Hold to strike</span>
              </button>
              <svg className={s.holdRing} viewBox="0 0 60 60" aria-hidden="true">
                <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(23,48,31,0.18)" strokeWidth="4" />
                <circle
                  cx="30" cy="30" r="26" fill="none" stroke="#17301f" strokeWidth="4"
                  strokeDasharray={`${Math.PI * 52}`}
                  strokeDashoffset={`${Math.PI * 52 * (1 - strikeHold)}`}
                  transform="rotate(-90 30 30)"
                />
              </svg>
            </div>
          )}

          {encounterForHint && (
            <button
              type="button"
              className={s.hintLink}
              onClick={() => {
                const enc = phase === 'roots' ? 'roots' : phase === 'vertex' ? (vertexStep === 'axis' ? 'axis' : 'vertex') : 'strike'
                const h = session.currentHint(enc)
                if (h) {
                  session.markHintShown(enc === 'strike' ? 'roots' : enc as 'roots' | 'axis' | 'vertex', h.level)
                  revealHint(h)
                }
              }}
            >
              Hint
            </button>
          )}
        </div>
      )}

      {/* Cinematic: the cut */}
      {phase === 'cinematic' && (
        <div className={s.cinematicStage}>
          {/*
            Water sits UNDERNEATH the two image halves, full-bleed and never
            clipped or moved. Before the halves separate, together they cover
            the entire stage so the water is fully hidden -- exactly like the
            real ridge, no water visible until the cut. Once split, each half
            translates away from the crack, and whatever gap that opens
            between them naturally reveals the water beneath it. (A first
            attempt clipped the water to the SAME shapes as the halves, which
            meant it only ever showed where a half already covered it -- never
            in the newly-opened gap. Caught on a screenshot: the "water
            flowing through" beat was invisible. Un-clipped and moved behind
            the halves fixes it structurally instead of chasing gap geometry.)
          */}
          <div className={`${s.cinematicWater} ${splitActive ? s.cinematicWaterIn : ''}`} />
          <div
            className={s.cinematicHalf}
            style={{ backgroundImage: `url(${valleyUrl})`, clipPath: leftClip, transform: splitActive ? 'translateX(-4%) rotate(-0.5deg)' : 'none' }}
          />
          <div
            className={s.cinematicHalf}
            style={{ backgroundImage: `url(${valleyUrl})`, clipPath: rightClip, transform: splitActive ? 'translateX(4%) rotate(0.5deg)' : 'none' }}
          />
          <svg className={s.crackSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={crackPathD} className={`${s.crackLine} ${crackDrawn ? s.crackLineIn : ''}`} />
          </svg>
          <div className={s.letterboxTop} />
          <div className={s.letterboxBottom} />
          <div className={s.cinematicLine}>{NARRATIVE.cinematicLine}</div>
          <button
            className={s.skipBtn}
            onClick={() => {
              window.clearTimeout(advanceTimer.current)
              finishAndOpenSlideshow()
            }}
          >
            Skip
          </button>
        </div>
      )}
      {impactFlash && <div className={s.impactFlash} aria-hidden="true" />}

      {/* Intro title card — test build: title only over voxel valley */}
      {introOpen && (
        <div className={s.introOverlay}>
          <div className={s.introVignette} aria-hidden="true" />
          <div className={s.introInner}>
            <h1 className={s.introTitle}>Sword of Wisdom</h1>
            <button className={s.playBtn} onClick={begin}>
              <span className={s.playBtnGlow} aria-hidden="true" />
              Begin
            </button>
          </div>
        </div>
      )}

      {isPreview && import.meta.env.DEV && <div className={s.devBadge}>try preview</div>}
    </div>
  )
}
