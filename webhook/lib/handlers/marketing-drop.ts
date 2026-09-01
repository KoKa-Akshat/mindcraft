/**
 * Public marketing "Drop it. It finds its place." demo.
 * POST https://mindcraft-webhook.vercel.app/api/marketing-drop
 * Body: { filename: string, text?: string, imageBase64?: string }
 *
 * Returns a filed note card: { title, course, meta, bullets[], whisper }
 * Uses Gemini when available; falls back to filename heuristics.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'
import { setCors } from '../cors'

// 'gemini-2.5-flash' is retired (404 for new callers); '-latest' is a
// rolling alias so this should not go stale the same way again.
const MODEL = process.env.PARSE_HOMEWORK_MODEL ?? 'gemini-flash-lite-latest'
const MAX_IMAGE_BASE64_BYTES = 900 * 1024
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })

type FiledNote = {
  title: string
  course: string
  meta: string
  bullets: string[]
  whisper: string
}

function stripDataUrl(raw: string): { base64: string; mediaType: string } {
  const match = raw.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/)
  if (match) return { mediaType: match[1], base64: match[2] }
  return { mediaType: 'image/jpeg', base64: raw }
}

function heuristic(filename: string, text = ''): FiledNote {
  const blob = `${filename} ${text}`.toLowerCase()
  if (/gatsby|english|annotation|essay/.test(blob)) {
    return {
      title: 'Gatsby Annotations',
      course: 'English 11',
      meta: 'English 11 · Ch. 4-6 · filed for Friday',
      bullets: ['Quotes you can reopen fast', 'No more hunting the PDF', 'Filed with the chapter'],
      whisper: 'the desk kept the quotes that matter',
    }
  }
  if (/chem|stoich|mole|reaction/.test(blob)) {
    return {
      title: 'Stoichiometry Set',
      course: 'AP Chem',
      meta: 'AP Chem · Unit 3 · quiz Monday',
      bullets: ['Four problems, one unit', 'Queued before the quiz', 'Unit 3, not IMG_whatever'],
      whisper: 'unit 3, not "IMG_whatever"',
    }
  }
  if (/circle|geometry|theorem/.test(blob)) {
    return {
      title: 'Circle Theorems',
      course: 'Geometry',
      meta: 'Geometry · Unit 6 · practice',
      bullets: ['Theorems titled for search', 'Practice when you need it', 'Geometry finally has a home'],
      whisper: 'geometry finally has a home',
    }
  }
  if (/system|algebra|equation|linear/.test(blob)) {
    return {
      title: 'Systems of Equations',
      course: 'Algebra II',
      meta: 'Algebra II · Unit 5 · due Thursday',
      bullets: ['Named and dated for you', 'Graph + word problem on one page', "Ready for tonight's study"],
      whisper: 'named, dated, waiting in your binder',
    }
  }
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'School drop'
  const titled = base.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80)
  return {
    title: titled,
    course: 'Binder',
    meta: 'Binder · filed just now',
    bullets: ['Named from what you dropped', 'Ready on your Field Desk', 'Ask can find it later'],
    whisper: 'dropped, named, waiting in your binder',
  }
}

function safeParse(raw: string, fallback: FiledNote): FiledNote {
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    const first = trimmed.indexOf('{')
    const last = trimmed.lastIndexOf('}')
    if (first < 0 || last < first) return fallback
    const parsed = JSON.parse(trimmed.slice(first, last + 1))
    const title = String(parsed.title || '').trim().slice(0, 80)
    const course = String(parsed.course || '').trim().slice(0, 40)
    const meta = String(parsed.meta || '').trim().slice(0, 120)
    const whisper = String(parsed.whisper || '').trim().slice(0, 120)
    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets.filter((b: unknown) => typeof b === 'string').map((b: string) => b.slice(0, 80)).slice(0, 3)
      : []
    if (!title || !course || bullets.length === 0) return fallback
    return {
      title,
      course,
      meta: meta || `${course} · filed just now`,
      bullets,
      whisper: whisper || 'named, dated, waiting in your binder',
    }
  } catch {
    return fallback
  }
}

async function classifyWithGemini(filename: string, text: string, imageBase64?: string): Promise<FiledNote | null> {
  if (!process.env.GEMINI_API_KEY) return null
  const fallback = heuristic(filename, text)
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
  if (imageBase64) {
    const { base64, mediaType } = stripDataUrl(imageBase64)
    if (Buffer.byteLength(base64, 'base64') > MAX_IMAGE_BASE64_BYTES) return fallback
    parts.push({ inlineData: { mimeType: mediaType, data: base64 } })
  }
  parts.push({
    text: [
      'You file a school worksheet drop onto a student desk.',
      'Return JSON only:',
      '{"title":string,"course":string,"meta":string,"bullets":[string,string,string],"whisper":string}',
      'title = clean short note title. course = class name. meta = course · unit/due · filed.',
      'bullets = 3 short wins about filing (not solving). whisper = one soft line.',
      'Do not solve the work. Filename: ' + JSON.stringify(filename),
      text ? 'Text hint: ' + text.slice(0, 500) : '',
    ].filter(Boolean).join('\n'),
  })

  try {
    const result = await genai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      config: { temperature: 0.2, maxOutputTokens: 400 },
    })
    return safeParse(result.text ?? '', fallback)
  } catch (err) {
    console.warn('[marketing-drop] gemini failed', err)
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {}
    const honey = String(body._honey || body.honey || '').trim()
    if (honey) return res.status(200).json({ ok: true, ignored: true })

    const filename = String(body.filename || body.name || 'drop.jpg').trim().slice(0, 180)
    const text = String(body.text || '').trim().slice(0, 800)
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : undefined
    const fallback = heuristic(filename, text)
    const live = await classifyWithGemini(filename, text, imageBase64)
    return res.status(200).json({ ...(live || fallback), source: live ? 'live' : 'heuristic' })
  } catch (err) {
    console.error('[marketing-drop]', err)
    return res.status(200).json({ ...heuristic('drop.jpg'), source: 'heuristic' })
  }
}
