/**
 * lib/learnScope.ts
 *
 * Client for POST /api/learn-scope-agent, the "Fun Lessons" pre-search
 * chooser (see webhook/lib/handlers/learn-scope-agent.ts for the full
 * contract). No auth required, same as resume-agent.ts's own client: this
 * fires from /learn's blank entry screen, which a student can reach before
 * signing in.
 */
import { WEBHOOK_BASE } from './mlApi'
import { readByokConfig } from './byokSettings'

export interface ScopeTurn {
  role: 'user' | 'jesse'
  text: string
}

export interface ScopeTurnResult {
  reply: string
  ready: boolean
  searchQuery?: string
  fallback: boolean
}

export async function askLearnScope(message: string, history: ScopeTurn[]): Promise<ScopeTurnResult> {
  const byok = readByokConfig()
  const res = await fetch(`${WEBHOOK_BASE}/api/learn-scope-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, byok: byok ?? undefined }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Could not reach Jesse (${res.status}).`)
  return {
    reply: typeof data.reply === 'string' ? data.reply : "Jesse didn't say anything back. Try again.",
    ready: data.ready === true,
    searchQuery: typeof data.searchQuery === 'string' ? data.searchQuery : undefined,
    fallback: data.fallback === true,
  }
}
