/**
 * lib/generatedBooks.ts
 *
 * Client for POST /api/generate-book — the real, gated, on-demand multi-
 * chapter book pipeline (webhook/lib/handlers/generate-book.ts), the SAME
 * one the overnight cron uses for curated subjects, run ad-hoc on a topic
 * the concept library has no coverage for. Genuinely async and genuinely
 * expensive (real run: 3 gate-passed chapters, 2 embedded sims, ~4 minutes,
 * $3.60), so this starts a job and polls it, same start/poll shape
 * lib/conceptLibrary.ts's own generateSim() already uses — see that file
 * for the fuller design rationale. Every non-passing terminal state comes
 * back as an honest reason string, never silently retried into an
 * infinite spinner.
 *
 * Response shape (book_assembler.py's AssembledBook.to_dict(), passed
 * through generate-book.ts untouched apart from stripping training-capture
 * fields): chapters are grouped by taxonomy, not numbered 1/2/3 — the real
 * reading unit is a SECTION, one per concept, each with its own body and at
 * most one embedded sim (sim_html, not a nested sim object).
 */
import { auth } from '../firebase'
import { readByokConfig } from './byokSettings'
import { WEBHOOK_BASE } from './mlApi'

/** The student's own key from Settings, shaped for generate-book.ts's two
 * distinct fields (studentGeminiKey powers generation, studentAnthropicKey
 * powers the quality judge — see that handler's own doc comment). A BYOK
 * config is one provider at a time, so only ever one of these is set from
 * here; both fields existing is what lets the webhook/content-engine
 * recognize either. */
function bookByokFields(): { studentGeminiKey?: string; studentAnthropicKey?: string } {
  const byok = readByokConfig()
  if (!byok?.apiKey) return {}
  if (byok.provider === 'gemini') return { studentGeminiKey: byok.apiKey }
  if (byok.provider === 'anthropic') return { studentAnthropicKey: byok.apiKey }
  return {}
}

export interface GeneratedBookSection {
  concept_id: string
  title: string
  body: string
  summary?: string
  sim_title?: string
  sim_html?: string
}

export interface GeneratedBookChapter {
  taxonomy_id: string
  sections: GeneratedBookSection[]
}

export interface GeneratedBook {
  subject_id: string
  title: string
  total_concepts?: number
  covered_concepts?: number
  chapters: GeneratedBookChapter[]
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) return null
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export async function generateBook(
  topic: string,
  opts: {
    pollMs?: number
    maxWaitMs?: number
    onStatus?: (s: string) => void
    onProgress?: (p: { chaptersReady: number; totalChapters: number }) => void
  } = {},
): Promise<{ book: GeneratedBook | null; reason?: string; cached?: boolean }> {
  const headers = await authHeaders()
  if (!headers) return { book: null, reason: 'not signed in' }
  const pollMs = opts.pollMs ?? 5000
  const maxWaitMs = opts.maxWaitMs ?? 6 * 60_000

  let jobId = ''
  try {
    const res = await fetch(`${WEBHOOK_BASE}/api/generate-book`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic, ...bookByokFields() }),
    })
    const data = await res.json().catch(() => ({}))
    if (data?.status === 'passed' && data?.book) {
      return { book: data.book as GeneratedBook, cached: data.cached === true }
    }
    if (data?.status === 'running' && data?.jobId) {
      jobId = String(data.jobId)
    } else {
      return { book: null, reason: data?.reason || data?.error || `Book generation could not start (${res.status}).` }
    }
  } catch (e) {
    return { book: null, reason: `Generation service unreachable: ${String(e).slice(0, 140)}` }
  }

  const started = Date.now()
  while (Date.now() - started < maxWaitMs) {
    await new Promise((r) => setTimeout(r, pollMs))
    const elapsed = Math.round((Date.now() - started) / 1000)
    try {
      const res = await fetch(`${WEBHOOK_BASE}/api/generate-book`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.status === 'running') {
        const chaptersReady = Number(data.chaptersReady) || 0
        const totalChapters = Number(data.totalChapters) || 0
        if (totalChapters > 0) opts.onProgress?.({ chaptersReady, totalChapters })
        opts.onStatus?.(
          totalChapters > 0
            ? `${chaptersReady} of ${totalChapters} chapters ready (${elapsed}s)...`
            : `${data.phase || 'Writing'}... (${elapsed}s)`,
        )
        continue
      }
      if (data?.status === 'passed' && data?.book) {
        return { book: data.book as GeneratedBook, cached: data.cached === true }
      }
      if (data?.status === 'no_good_result') {
        return { book: null, reason: data?.reason || 'Nothing passed the quality gate for this topic.' }
      }
      if (data?.status === 'rate_limited') {
        return { book: null, reason: data?.reason || "This closed test's generation budget is used up." }
      }
      return { book: null, reason: data?.detail || data?.reason || 'Generation ended without a usable result.' }
    } catch (e) {
      return { book: null, reason: `Lost contact with the generation service: ${String(e).slice(0, 140)}` }
    }
  }
  return { book: null, reason: 'Generation is taking longer than expected, so it was not shown. Nothing was lost, it can be retried.' }
}
