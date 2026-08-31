/**
 * studentPreferences.ts
 *
 * Shared shape for the student language + voice one-time gate (2026-08-31
 * ask). The web app had zero language/voice preference infrastructure
 * before this -- this mirrors the already-shipped iOS prototype pattern
 * (ios-prototype/MindCraftNotes/MindCraftNotes/Networking/
 * StudentLanguagePreference.swift + StudentVoicePreference.swift), but
 * persisted on the student's users/{uid} Firestore doc instead of
 * UserDefaults, since a web session has no per-device local store worth
 * trusting across logins.
 *
 * Consumed by lib/postLogin.ts (gate ordering) and pages/LanguageChoice.tsx
 * + pages/VoiceChoice.tsx (the actual pickers).
 */

export type StudentLanguageCode = 'en' | 'es'

export interface StudentLanguageOption {
  code: StudentLanguageCode
  displayName: string
}

export const STUDENT_LANGUAGE_OPTIONS: StudentLanguageOption[] = [
  { code: 'en', displayName: 'English' },
  { code: 'es', displayName: 'Español' },
]

/**
 * Only English has real graded voice options today (three Kokoro voices --
 * see webhook/lib/handlers/tts.ts's own doc comment on why Spanish has no
 * Kokoro voice among them). Same gap as iOS's StudentLanguage.usesKokoro:
 * a Spanish-choosing student skips the voice picker entirely rather than
 * being shown options that do not apply to them.
 */
export function languageHasVoiceOptions(language: string | undefined | null): boolean {
  return language === 'en'
}

export type StudentVoiceId = 'af_heart' | 'af_bella' | 'am_michael'

export interface StudentVoiceOption {
  id: StudentVoiceId
  displayName: string
  blurb: string
}

// Same three voices, same names/blurbs, as iOS's KokoroVoice enum
// (ios-prototype/.../Networking/KokoroTTSClient.swift) -- kept identical so
// a student who used the iOS prototype and now lands on web sees the same
// choices under the same names.
export const STUDENT_VOICE_OPTIONS: StudentVoiceOption[] = [
  { id: 'af_heart', displayName: 'Warm', blurb: 'Steady and warm. The default.' },
  { id: 'af_bella', displayName: 'Bright', blurb: 'A bit brighter, more energy.' },
  { id: 'am_michael', displayName: 'Calm', blurb: 'A calm, even-paced male guide.' },
]

export const DEFAULT_STUDENT_VOICE: StudentVoiceId = 'af_heart'
