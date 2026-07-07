import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../lib/cors'
import { auth } from '../lib/firebase'

const MAX_IMAGE_BASE64_BYTES = 1.5 * 1024 * 1024
const MODEL_TIMEOUT_MS = 4000
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

interface TranscriptionResult {
  text: string
  latex: string
  unavailable?: boolean
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

function fallback(unavailable = false): TranscriptionResult {
  return unavailable ? { text: '', latex: '', unavailable: true } : { text: '', latex: '' }
}

function stripDataUrl(raw: string): { base64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' } {
  const match = raw.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/)
  if (match) {
    return { mediaType: match[1] as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', base64: match[2] }
  }
  return { mediaType: 'image/png', base64: raw }
}

function safeJson(raw: string): TranscriptionResult {
  const trimmed = raw.trim()
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const first = unfenced.indexOf('{')
  const last = unfenced.lastIndexOf('}')
  if (first < 0 || last < first) return fallback()

  try {
    const parsed = JSON.parse(unfenced.slice(first, last + 1))
    return {
      text: typeof parsed.text === 'string' ? parsed.text.slice(0, 4000) : '',
      latex: typeof parsed.latex === 'string' ? parsed.latex.slice(0, 4000) : '',
    }
  } catch {
    return fallback()
  }
}

function systemPrompt() {
  return [
    'You transcribe handwritten math scratch work from an image.',
    'Return valid JSON only, with no markdown and no prose before or after it.',
    'Schema: {"text":"string","latex":"string"}',
    'text = a plain-language reading of the written work, one line per written line.',
    'latex = the same work as LaTeX using $...$ inline delimiters, one line per written line.',
    'Do not solve, correct, complete, or explain the work. Only transcribe what is visible.',
    'If the image is blank or illegible, return {"text":"","latex":""}.',
  ].join('\n')
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('transcribe timeout')), ms)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      err => { clearTimeout(timer); reject(err) },
    )
  })
}

async function transcribeWithAnthropic(base64: string, mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif') {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')
  const result = await withTimeout(anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 700,
    system: systemPrompt(),
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: 'Transcribe this scratch work.' },
      ],
    }],
  }), MODEL_TIMEOUT_MS)
  const raw = result.content[0]?.type === 'text' ? result.content[0].text : ''
  return safeJson(raw)
}

async function transcribeWithGroq(base64: string, mediaType: string) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY missing')
  const res = await withTimeout(fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      max_tokens: 700,
      messages: [
        { role: 'system', content: systemPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe this scratch work.' },
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
          ],
        },
      ],
    }),
  }), MODEL_TIMEOUT_MS)
  if (!res.ok) throw new Error(`Groq transcription failed: ${res.status}`)
  const data = await res.json()
  return safeJson(data.choices?.[0]?.message?.content ?? '')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await auth.verifyIdToken(header.slice(7))
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const imageBase64 = typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64 : ''
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' })

  const { base64, mediaType } = stripDataUrl(imageBase64)
  if (Buffer.byteLength(base64, 'base64') > MAX_IMAGE_BASE64_BYTES) {
    return res.status(413).json({ error: 'Image too large' })
  }

  try {
    const result = await transcribeWithAnthropic(base64, mediaType)
    return res.status(200).json(result)
  } catch (anthropicErr: any) {
    console.warn('transcribe-scratch anthropic fallback:', anthropicErr?.message ?? anthropicErr)
  }

  try {
    const result = await transcribeWithGroq(base64, mediaType)
    return res.status(200).json(result)
  } catch (groqErr: any) {
    console.warn('transcribe-scratch unavailable:', groqErr?.message ?? groqErr)
    return res.status(200).json(fallback(true))
  }
}
