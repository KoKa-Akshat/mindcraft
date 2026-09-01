/**
 * lib/byokSettings.ts
 *
 * Reads the same student-set API key the Desk OS hub's Settings panel
 * writes (agent_work/product/desk_os/js/settings.js, localStorage key
 * 'deskOs.byok'). Desk OS and this React app share one origin
 * (mindcraft-93858.web.app), so localStorage is already shared — no new
 * storage, no Firestore round trip, just reading what the student already
 * set once from wherever in the product needs it.
 */

export interface ByokConfig {
  provider: 'openai' | 'groq' | 'gemini' | 'openrouter' | 'anthropic' | 'custom'
  apiKey: string
  model?: string
  baseUrl?: string
}

const STORAGE_KEY = 'deskOs.byok'

export function readByokConfig(): ByokConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.apiKey || !parsed?.provider) return null
    return parsed as ByokConfig
  } catch {
    return null
  }
}
