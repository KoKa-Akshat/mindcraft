/**
 * api/gemini.ts
 *
 * AI proxy via Groq (Llama 3.3 70B) — key lives server-side only.
 *
 * POST { prompt: string, model?: string }
 * → { text: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

const ALLOWED_ORIGIN = 'https://mindcraft-93858.web.app'
const GROQ_KEY       = process.env.GROQ_API_KEY ?? ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  if (!GROQ_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not configured on server' })

  const { prompt, model = 'llama-3.3-70b-versatile' } = req.body as { prompt?: string; model?: string }
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' })

  try {
    const apiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages:   [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens:  2048,
      }),
    })

    if (!apiRes.ok) {
      const err = await apiRes.json()
      return res.status(apiRes.status).json({ error: err?.error?.message ?? 'Groq API error' })
    }

    const data = await apiRes.json() as {
      choices?: { message?: { content?: string } }[]
    }
    const text = data.choices?.[0]?.message?.content ?? ''
    return res.json({ text })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}
