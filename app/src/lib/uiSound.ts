/**
 * uiSound.ts — tiny, tasteful click-feedback synth.
 *
 * No audio files, no third-party generation service (Higgsfield audio is at
 * 0 credits) — every tone is synthesized on the fly with the Web Audio API:
 * a short envelope-shaped oscillator, nothing arcade-y. Two tones only:
 *
 *  - playTap()   — a single soft "tap", for a normal meaningful click
 *                  (opening a chapter, advancing a diagnostic step, the
 *                  exam-horizon pill, the Jesse's Kitchen intro tap).
 *  - playChime() — a brighter ascending two-note chime, for a correct
 *                  answer or completing a step.
 *
 * Deliberately NOT wired to every click sitewide — see call sites. Muted
 * state persists in localStorage and is respected everywhere; nothing ever
 * plays before a real user gesture (browser autoplay policy) because the
 * AudioContext is only ever constructed lazily, inside a play*() call that
 * callers only ever invoke from within a click handler.
 */

const MUTE_KEY = 'mc_sound_muted'
const MUTE_EVENT = 'mc_sound_muted_change'

let ctx: AudioContext | null = null

function getMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

export function isSoundMuted(): boolean {
  return getMuted()
}

export function setSoundMuted(muted: boolean): void {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent(MUTE_EVENT, { detail: muted }))
}

export function toggleSoundMuted(): boolean {
  const next = !getMuted()
  setSoundMuted(next)
  return next
}

/** Subscribe to mute-state changes (for a toggle UI in multiple places). */
export function onSoundMutedChange(cb: (muted: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail)
  window.addEventListener(MUTE_EVENT, handler)
  return () => window.removeEventListener(MUTE_EVENT, handler)
}

/** Lazily create (or resume) the shared AudioContext. Only ever called from
 *  inside a play*() call, which callers only invoke from click handlers —
 *  so this always runs inside a real user-gesture stack, satisfying every
 *  browser's autoplay policy. Never throws: Web Audio isn't universal. */
function getContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

interface ToneSpec {
  freq: number
  /** Seconds from now this note starts. */
  start: number
  /** Note duration in seconds. */
  duration: number
  /** Peak gain (quiet — this is a study app, not a game). */
  gain: number
  type?: OscillatorType
}

function playTones(tones: ToneSpec[]) {
  if (getMuted()) return
  const audio = getContext()
  if (!audio) return
  const now = audio.currentTime
  for (const t of tones) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = t.type ?? 'sine'
    osc.frequency.value = t.freq
    const startAt = now + t.start
    const endAt = startAt + t.duration
    // Quick soft attack, gentle exponential release — an envelope, not a
    // hard on/off, so it reads as a "tone" rather than a beep/blip.
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(t.gain, startAt + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(startAt)
    osc.stop(endAt + 0.02)
  }
}

/** Soft, quiet tap for a normal meaningful click — one short triangle-wave
 *  note. Chosen over sine for a touch more warmth without being buzzy. */
export function playTap(): void {
  playTones([{ freq: 480, start: 0, duration: 0.09, gain: 0.05, type: 'triangle' }])
}

/** Brighter ascending two-note chime — correct answer / completing a step.
 *  A perfect fourth up (523Hz → 698Hz, C5 → F5) reads as "resolved" and
 *  pleasant without being a cartoonish jingle; second note overlaps the
 *  tail of the first for a small sparkle rather than two flat beeps. */
export function playChime(): void {
  playTones([
    { freq: 523.25, start: 0,    duration: 0.12, gain: 0.065, type: 'sine' },
    { freq: 698.46, start: 0.09, duration: 0.16, gain: 0.075, type: 'sine' },
  ])
}
