/**
 * VoiceChoice.tsx
 *
 * One-time voice picker, shown right after language choice, ahead of the
 * real destination (2026-08-31 ask). Mirrors the iOS prototype's
 * VoiceChoiceView (ios-prototype/MindCraftNotes/MindCraftNotes/Views/
 * VoiceChoiceView.swift) for tone and structure: same once-per-account
 * gate, same three graded voices (Warm / Bright / Calm), minus the audio
 * preview -- the web app has no Kokoro TTS wiring yet (the build brief for
 * this feature is explicit that web starts from zero language/voice
 * infrastructure), so this is the selection UI only. A real preview sample
 * would mean wiring a new webhook call, a separate, heavier task from this
 * one.
 *
 * Only reached when the chosen language actually has voice options --
 * resolvePostLoginPath checks languageHasVoiceOptions before ever routing
 * here, same usesKokoro conditional the iOS gate cascade already applies.
 */
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import { completePostLoginNavigate, resolvePostLoginPath, safeReturnPath } from '../lib/postLogin'
import { STUDENT_VOICE_OPTIONS, DEFAULT_STUDENT_VOICE, type StudentVoiceId } from '../lib/studentPreferences'
import s from './VoiceChoice.module.css'

export default function VoiceChoice() {
  const user = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get('next'))
  const [selected, setSelected] = useState<StudentVoiceId>(DEFAULT_STUDENT_VOICE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleContinue() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await setDoc(doc(db, 'users', user.uid), { voice: selected, voiceChosen: true }, { merge: true })
      const dest = await resolvePostLoginPath(user.uid, { returnTo, grantAdmin: false })
      await completePostLoginNavigate(dest, navigate)
    } catch {
      setError('Could not save your voice. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <p className={s.kicker}>One more thing</p>
        <h1 className={s.title}>Pick your voice</h1>
        <p className={s.copy}>You can change this anytime later.</p>

        {error && <p className={s.error}>{error}</p>}

        <div className={s.options} role="group" aria-label="Voice">
          {STUDENT_VOICE_OPTIONS.map(opt => {
            const isSelected = opt.id === selected
            return (
              <button
                key={opt.id}
                type="button"
                className={isSelected ? `${s.option} ${s.optionSelected}` : s.option}
                onClick={() => setSelected(opt.id)}
                data-testid={`voiceChoice_${opt.id}`}
                aria-pressed={isSelected}
              >
                <span className={s.optionMain}>
                  <span className={s.optionName}>{opt.displayName}</span>
                  <span className={s.optionBlurb}>{opt.blurb}</span>
                </span>
                {isSelected && <span className={s.check} aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className={s.continueBtn}
          disabled={saving}
          onClick={handleContinue}
          data-testid="voiceChoiceContinue"
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
