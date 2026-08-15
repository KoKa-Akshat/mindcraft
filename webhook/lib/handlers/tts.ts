/**
 * api/tts.ts
 *
 * Kokoro TTS (onnx-community/Kokoro-82M-v1.0-ONNX, CPU/WASM - WebGPU isn't
 * available in a Node serverless function, that's a browser-only backend).
 * Chosen over the alternatives after a real comparison: Chatterbox needs a
 * GPU and is overkill for short call turns; Piper still sounds like a
 * device assistant; edge-tts scrapes an undocumented Microsoft endpoint
 * (bad ToS for a product); XTTS/Fish/F5 are non-commercial; ElevenLabs'
 * free tier is 10k chars/month and non-commercial. Kokoro is weaker on big
 * emotion and voice cloning, which is the right tradeoff for "walk a
 * student through a workflow" - clear and calm, not theatrical.
 *
 * Only three voices are offered, all real, graded choices - no D-grade
 * voices:
 * - af_heart (grade A, warm American woman) - the default, Jesse's voice.
 * - af_bella (grade A-, brighter/more energy) - chapter read-aloud.
 * - am_michael (grade C+, best male Kokoro ships) - a calm guide option.
 *
 * The model is ~96MB - too large to bundle into the deployment package
 * (and would bloat every other action routed through app-actions.ts if it
 * lived there), so it's fetched from the HF hub into /tmp on first cold
 * start and kept in memory for the life of the warm container. This is why
 * TTS gets its own top-level function file with a generous maxDuration
 * instead of joining the app-actions.ts fan-out.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const VALID_VOICES = ['af_heart', 'af_bella', 'am_michael'] as const
type Voice = (typeof VALID_VOICES)[number]
const DEFAULT_VOICE: Voice = 'af_heart'
const MAX_CHARS = 500

let ttsPromise: Promise<import('kokoro-js').KokoroTTS> | null = null

async function getTTS() {
  if (!ttsPromise) {
    // kokoro-js's from_pretrained only takes dtype/device/progress_callback
    // (no cache_dir passthrough) - the underlying @huggingface/transformers
    // cache location is a separate global (env.cacheDir, default `./.cache`
    // relative to cwd). A Vercel function's filesystem is read-only outside
    // /tmp, so without this the ~96MB model download would fail to cache on
    // first write.
    ttsPromise = Promise.all([import('kokoro-js'), import('@huggingface/transformers')]).then(
      ([{ KokoroTTS }, { env }]) => {
        env.cacheDir = '/tmp/kokoro-cache'
        return KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'cpu' })
      },
    )
  }
  return ttsPromise
}

function sanitizeText(raw: unknown): string {
  const s = String(raw || '').replace(/[—–]/g, '-')
  return s.split(/\s+/).filter(Boolean).join(' ').slice(0, MAX_CHARS)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body || {}) as { text?: string; voice?: string }
  const text = sanitizeText(body.text)
  if (!text) return res.status(400).json({ error: 'No text' })

  const requestedVoice = String(body.voice || DEFAULT_VOICE)
  const voice = (VALID_VOICES as readonly string[]).includes(requestedVoice)
    ? (requestedVoice as Voice)
    : DEFAULT_VOICE

  try {
    const tts = await getTTS()
    const audio = await tts.generate(text, { voice })
    const buffer = Buffer.from(audio.toWav())
    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(buffer)
  } catch (err) {
    console.error('[tts] error:', err)
    return res.status(500).json({ error: 'TTS generation failed' })
  }
}
