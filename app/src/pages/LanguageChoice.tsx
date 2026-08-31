/**
 * LanguageChoice.tsx
 *
 * One-time language picker, shown right after login, ahead of the real
 * destination (2026-08-31 ask). Mirrors the iOS prototype's
 * LanguageChoiceView (ios-prototype/MindCraftNotes/MindCraftNotes/Views/
 * LanguageChoiceView.swift) for tone and structure, same "gate one layer
 * before the real destination" shape Login.tsx already uses ahead of the
 * app, same dark-green/lime brand palette Login.module.css already
 * defines.
 *
 * Writes users/{uid}.language + languageChosen, then re-resolves the
 * post-login path so the next gate (voice, only if the chosen language has
 * voice options) or the real destination picks up automatically --
 * resolvePostLoginPath is the single source of truth for gate ordering,
 * this page does not duplicate it.
 */
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import { completePostLoginNavigate, resolvePostLoginPath, safeReturnPath } from '../lib/postLogin'
import { STUDENT_LANGUAGE_OPTIONS, type StudentLanguageCode } from '../lib/studentPreferences'
import s from './LanguageChoice.module.css'

export default function LanguageChoice() {
  const user = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get('next'))
  const [choosing, setChoosing] = useState<StudentLanguageCode | null>(null)
  const [error, setError] = useState('')

  async function choose(code: StudentLanguageCode) {
    if (choosing) return
    setChoosing(code)
    setError('')
    try {
      await setDoc(doc(db, 'users', user.uid), { language: code, languageChosen: true }, { merge: true })
      const dest = await resolvePostLoginPath(user.uid, { returnTo, grantAdmin: false })
      await completePostLoginNavigate(dest, navigate)
    } catch {
      setError('Could not save your language. Please try again.')
      setChoosing(null)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <p className={s.kicker}>Welcome to the desk</p>
        <h1 className={s.title}>Choose your language</h1>
        <p className={s.copy}>MindCraft will listen and speak in this language during calls.</p>

        {error && <p className={s.error}>{error}</p>}

        <div className={s.options} role="group" aria-label="Language">
          {STUDENT_LANGUAGE_OPTIONS.map(opt => (
            <button
              key={opt.code}
              type="button"
              className={s.option}
              disabled={choosing !== null}
              onClick={() => choose(opt.code)}
              data-testid={`languageChoice_${opt.code}`}
            >
              <span>{choosing === opt.code ? 'Saving...' : opt.displayName}</span>
              <span className={s.chevron} aria-hidden="true">-&gt;</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
