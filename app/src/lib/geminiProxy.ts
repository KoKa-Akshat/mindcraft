/**
 * geminiProxy.ts
 *
 * All Gemini calls go through the Vercel webhook proxy.
 * The API key lives in Vercel env vars — never in the browser bundle.
 */

const PROXY = 'https://mindcraft-webhook.vercel.app/api/gemini'

export async function gemini(prompt: string, model = 'llama-3.3-70b-versatile'): Promise<string> {
  const res = await fetch(PROXY, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt, model }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Proxy error ${res.status}`)
  }

  const data = await res.json() as { text: string }
  return data.text
}
