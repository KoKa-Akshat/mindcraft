/**
 * Ephemeral marketing demo: diagnostic results live in sessionStorage only.
 * Closing the tab resets everything — nothing is written to Firestore.
 */
import type { User } from 'firebase/auth'

export const DEMO_DIAGNOSTIC_KEY = 'mc-demo-diagnostic'
export const DEMO_MODE_KEY = 'mc-demo-mode'
export const DEMO_UID = 'mc-demo-local'

export type DemoDiagnostic = {
  exam?: string
  deadlineDays?: number | null
  confidence?: Record<string, string>
}

export function isDemoMode(): boolean {
  try {
    return sessionStorage.getItem(DEMO_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function enableDemoMode() {
  try {
    sessionStorage.setItem(DEMO_MODE_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function readDemoDiagnostic(): DemoDiagnostic | null {
  try {
    const raw = sessionStorage.getItem(DEMO_DIAGNOSTIC_KEY)
    return raw ? (JSON.parse(raw) as DemoDiagnostic) : null
  } catch {
    return null
  }
}

export function saveDemoDiagnostic(payload: DemoDiagnostic) {
  enableDemoMode()
  try {
    sessionStorage.setItem(DEMO_DIAGNOSTIC_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

/** Confidence → dashboard TOC / map status vocabulary. */
export function demoConceptProgress(
  confidence: Record<string, string> | undefined,
): Record<string, { mastery: number; status: string; eventCount: number }> {
  const next: Record<string, { mastery: number; status: string; eventCount: number }> = {}
  for (const [id, v] of Object.entries(confidence ?? {})) {
    if (v === 'easy') next[id] = { mastery: 0.72, status: 'stable', eventCount: 4 }
    else if (v === 'kinda') next[id] = { mastery: 0.38, status: 'in_progress', eventCount: 2 }
    else if (v === 'hard') next[id] = { mastery: 0.12, status: 'open_gap', eventCount: 1 }
  }
  return next
}

export function demoWeaknessConceptId(
  confidence: Record<string, string> | undefined,
): string | null {
  const entries = Object.entries(confidence ?? {})
  const hard = entries.find(([, v]) => v === 'hard')
  if (hard) return hard[0]
  const kinda = entries.find(([, v]) => v === 'kinda')
  return kinda?.[0] ?? null
}

/** Minimal Firebase User stand-in for UserContext. Never hits Auth. */
export function makeDemoUser(): User {
  return {
    uid: DEMO_UID,
    email: null,
    emailVerified: false,
    displayName: 'Guest',
    isAnonymous: true,
    metadata: {} as User['metadata'],
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({} as Awaited<ReturnType<User['getIdTokenResult']>>),
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: null,
    photoURL: null,
    providerId: 'demo',
  } as User
}
