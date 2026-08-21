import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'
import { setCors } from '../lib/cors'
import { verifyToken } from '../lib/verifyToken'

const MAX_IMAGE_BASE64_BYTES = 1.5 * 1024 * 1024
const MAX_LINES = 20
const MODEL_TIMEOUT_MS = 4000
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL ?? DEFAULT_GEMINI_MODEL

interface TranscriptionResult {
  text: string
  latex: string
  unavailable?: boolean
  perLine?: Array<{ text: string; latex: string }>
}

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })

function fallback(unavailable = false, perLine?: Array<{ text: string; latex: string }>): TranscriptionResult {
  const result: TranscriptionResult = unavailable ? { text: '', latex: '', unavailable: true } : { text: '', latex: '' }
  if (perLine) result.perLine = perLine
  return result
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

async function transcribeWithGemini(base64: string, mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif') {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')
  const result = await withTimeout(genai.models.generateContent({
    model: TRANSCRIBE_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mediaType, data: base64 } },
        { text: 'Transcribe this scratch work.' },
      ],
    }],
    config: {
      systemInstruction: systemPrompt(),
      temperature: 0,
      maxOutputTokens: 700,
    },
  }), MODEL_TIMEOUT_MS)
  const raw = result.text ?? ''
  return safeJson(raw)
}

async function transcribeImage(rawImage: string): Promise<TranscriptionResult> {
  const { base64, mediaType } = stripDataUrl(rawImage)
  if (Buffer.byteLength(base64, 'base64') > MAX_IMAGE_BASE64_BYTES) {
    throw Object.assign(new Error('Image too large'), { statusCode: 413 })
  }

  try {
    return await transcribeWithGemini(base64, mediaType)
  } catch (geminiErr: any) {
    console.warn('transcribe-scratch unavailable:', geminiErr?.message ?? geminiErr)
    return fallback(true)
  }
}

async function transcribeLines(lines: Array<{ imageBase64: string }>): Promise<TranscriptionResult> {
  const perLine: Array<{ text: string; latex: string }> = []
  let unavailable = false

  for (const line of lines) {
    const result = await transcribeImage(line.imageBase64)
    if (result.unavailable) unavailable = true
    perLine.push({ text: result.text, latex: result.latex })
  }

  return {
    text: perLine.map(line => line.text).filter(Boolean).join('\n'),
    latex: perLine.map(line => line.latex).filter(Boolean).join('\n'),
    perLine,
    ...(unavailable ? { unavailable: true } : {}),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).send('')
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const uid = await verifyToken(req)
  if (!uid) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const rawLines: unknown[] = Array.isArray(req.body?.lines) ? req.body.lines : []
    const lines = rawLines
      .filter((line): line is { imageBase64: string } => (
        !!line
        && typeof line === 'object'
        && 'imageBase64' in line
        && typeof line.imageBase64 === 'string'
      ))
      .slice(0, MAX_LINES)

    if (lines.length > 0) {
      const result = await transcribeLines(lines)
      return res.status(200).json(result)
    }

    const imageBase64 = typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64 : ''
    if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' })

    const result = await transcribeImage(imageBase64)
    return res.status(200).json(result)
  } catch (err: any) {
    if (err?.statusCode === 413) return res.status(413).json({ error: 'Image too large' })
    console.warn('transcribe-scratch request failed:', err?.message ?? err)
    return res.status(200).json(fallback(true))
  }
}
