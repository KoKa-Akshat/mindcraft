/**
 * fly-tts/server.js — the same Kokoro TTS logic as webhook/lib/handlers/tts.ts,
 * rehosted on an always-on process instead of Vercel serverless.
 *
 * Why this file exists: tts.ts's model load (~96MB, kokoro-js, ONNX/CPU) has
 * to happen on every Vercel cold start because Vercel scales serverless
 * functions to zero — that's the entire root cause of Jesse's "takes forever
 * to load" complaint (see ../../JESSE_VOICE_TTS_SPEC.md, root-caused by
 * reading tts.ts directly, not assumed). Kokoro was never the problem; the
 * scale-to-zero host was. This file is the SAME logic — same model id, same
 * three voices, same request/response contract — on a host that never scales
 * to zero (Fly.io, `min_machines_running >= 1` in fly.toml), so the model
 * loads ONCE at process boot and stays warm forever instead of per-request.
 *
 * Contract, unchanged from tts.ts (KokoroTTSClient.swift needs zero changes
 * beyond its endpoint URL): POST / (or /api/tts) with JSON {text, voice},
 * 200 with audio/wav bytes on success, 4xx/5xx JSON {error} on failure.
 *
 * Plain Node http, no framework — Vercel's request/response types don't
 * apply outside Vercel, and a single-route server doesn't need Express.
 */
const http = require('node:http')

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const VALID_VOICES = ['af_heart', 'af_bella', 'am_michael']
const DEFAULT_VOICE = 'af_heart'
const MAX_CHARS = 500
const PORT = process.env.PORT || 8080

let ttsPromise = null

function getTTS() {
  if (!ttsPromise) {
    // No /tmp cache-dir override needed here (unlike tts.ts) — this
    // process owns a normal writable filesystem, not a Vercel function's
    // read-only-outside-/tmp sandbox. Default cache location is fine.
    ttsPromise = Promise.all([import('kokoro-js')]).then(([{ KokoroTTS }]) =>
      KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'cpu' }),
    )
  }
  return ttsPromise
}

function sanitizeText(raw) {
  const s = String(raw || '').replace(/[—–]/g, '-')
  return s.split(/\s+/).filter(Boolean).join(' ').slice(0, MAX_CHARS)
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = ''
    req.on('data', (c) => {
      chunks += c
      if (chunks.length > 1_000_000) req.destroy() // guard against a runaway body
    })
    req.on('end', () => {
      try {
        resolve(chunks ? JSON.parse(chunks) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  setCors(res)

  // Fly's health check hits this — kept trivially cheap (no model touch)
  // so it answers instantly even mid-generation of someone else's request.
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, modelLoaded: ttsPromise !== null }))
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    return res.end()
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Method not allowed' }))
  }

  // Shared-secret gate (2026-08-25, was fully open) — this process has no
  // Firebase Admin SDK (see kokoro-js-only package.json), so it can't verify
  // a Firebase ID token like the Vercel handlers do. A dedicated secret,
  // same comparison style as webhook/lib/handlers/reset-student-data.ts,
  // is the pragmatic gate here; KokoroTTSClient.swift sends it as a header.
  // Deliberately fail-OPEN (not closed) while TTS_SHARED_SECRET is unset -
  // unlike reset-student-data.ts, this ships before the Fly secret is
  // provisioned (a separate `fly secrets set` step, not a silent side
  // effect of this deploy); once that secret is set, this becomes the same
  // fail-closed shape as reset-student-data.ts. Until then this is a no-op,
  // identical to the pre-diff fully-open state - not a regression, but not
  // protection either.
  const expectedSecret = process.env.TTS_SHARED_SECRET
  if (expectedSecret && req.headers['x-tts-secret'] !== expectedSecret) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'invalid secret' }))
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Invalid JSON body' }))
  }

  const text = sanitizeText(body.text)
  if (!text) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'No text' }))
  }

  const requestedVoice = String(body.voice || DEFAULT_VOICE)
  const voice = VALID_VOICES.includes(requestedVoice) ? requestedVoice : DEFAULT_VOICE

  try {
    const tts = await getTTS()
    const audio = await tts.generate(text, { voice })
    const buffer = Buffer.from(audio.toWav())
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' })
    return res.end(buffer)
  } catch (err) {
    console.error('[tts] error:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'TTS generation failed' }))
  }
})

// Load the model at boot, not on the first request — this is the entire
// point of moving off Vercel: nobody's request should ever pay the load
// cost. Errors here are fatal (fail loud at boot, not silently per-request).
getTTS()
  .then(() => console.log('[tts] Kokoro model loaded, warm and ready'))
  .catch((e) => {
    console.error('[tts] FATAL: model failed to load at boot:', e)
    process.exit(1)
  })

server.listen(PORT, () => console.log(`[tts] listening on :${PORT}`))
