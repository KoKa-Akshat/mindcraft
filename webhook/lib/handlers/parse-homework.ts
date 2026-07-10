/**
 * lib/handlers/parse-homework.ts
 *
 * POST /api/parse-homework (routed through app-actions.ts — see vercel.json
 * rewrite; Vercel Hobby plan is already at its serverless function cap, so
 * this rides the shared app-actions router instead of its own function).
 *
 * Turns 1-4 photographed/scanned homework page images into a structured
 * array of extracted questions. One vision call per page (parallel),
 * merged into a single question list. PDFs are rasterized to page images
 * client-side before this endpoint ever sees them (Groq vision cannot read
 * PDFs directly, and rasterizing client-side keeps each request small).
 *
 * Contract lives in AGENT_RULEBOOK.md §1.8 — keep both in sync.
 *
 * Provider: Anthropic claude-haiku-4-5 vision primary, Groq llama-4-scout
 * vision fallback (same cascade as transcribe-scratch.ts). Transcribe/split
 * only — never solves, answers, or annotates the homework.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { setCors } from '../cors'
import { auth } from '../firebase'

const MAX_IMAGE_BASE64_BYTES = 1.5 * 1024 * 1024
const MAX_PAGES_PER_CALL = 4
const PER_PAGE_TIMEOUT_MS = 20_000
const MODEL = process.env.PARSE_HOMEWORK_MODEL ?? 'claude-haiku-4-5-20251001'
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

export interface ParsedHomeworkQuestion {
  number: string | null
  text: string
  choices: string[] | null
  figureNote: string | null
  continuesFromPrevious: boolean
  ambiguous: boolean
}

interface PageResult {
  questions: ParsedHomeworkQuestion[]
  unavailable: boolean
}

function fallbackPage(): PageResult {
  return { questions: [], unavailable: true }
}

function stripDataUrl(raw: string): { base64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' } {
  const match = raw.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/)
  if (match) return { mediaType: match[1] as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', base64: match[2] }
  return { mediaType: 'image/jpeg', base64: raw }
}

function systemPrompt(): string {
  return [
    'You extract individual homework questions from a photographed or scanned page image.',
    'Return valid JSON only, with no markdown and no prose before or after it.',
    'Schema: {"questions":[{"number":string|null,"text":string,"choices":string[]|null,"figureNote":string|null,"continuesFromPrevious":boolean,"ambiguous":boolean}]}',
    'number = the question label as printed on the page ("3", "4a"), or null if unlabeled.',
    'text = the full question text, math rendered as LaTeX using $...$ inline delimiters. If a question has sub-parts (a, b, c under one number), keep them together in one text field, do not split them into separate questions.',
    'choices = the answer choices as an array of strings if this is multiple choice, else null.',
    'figureNote = a short plain-language description of any diagram or figure the question depends on (e.g. "a right triangle with legs 6 and 8"), else null.',
    'continuesFromPrevious = true only when the FIRST question on this page is clearly a continuation of the last question from the previous page (e.g. it starts mid-sentence or has no visible number and picks up where a prior question left off).',
    'ambiguous = true when you are not confident you split the questions correctly, so the student can be warned rather than silently given a wrong split.',
    'Shared instructions that apply to a block of questions (e.g. "use the graph below for questions 5-7") must be copied into the text of each question they apply to.',
    'Do not solve, answer, or annotate any question. Transcribe and split only.',
    'Ignore headers, footers, page numbers, and decorative content. Do not invent questions for them.',
    'If the page has no questions on it, return {"questions":[]}.',
  ].join('\n')
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('parse-homework timeout')), ms)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      err => { clearTimeout(timer); reject(err) },
    )
  })
}

function safeJsonQuestions(raw: string): ParsedHomeworkQuestion[] {
  const trimmed = raw.trim()
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const first = unfenced.indexOf('{')
  const last = unfenced.lastIndexOf('}')
  if (first < 0 || last < first) return []
  try {
    const parsed = JSON.parse(unfenced.slice(first, last + 1))
    const arr: unknown[] = Array.isArray(parsed.questions) ? parsed.questions : []
    return arr
      .filter((q): q is Record<string, unknown> => !!q && typeof q === 'object')
      .map(q => ({
        number: typeof q.number === 'string' ? q.number.slice(0, 20) : null,
        text: typeof q.text === 'string' ? q.text.slice(0, 2000) : '',
        choices: Array.isArray(q.choices)
          ? q.choices.filter((c): c is string => typeof c === 'string').slice(0, 12).map(c => c.slice(0, 300))
          : null,
        figureNote: typeof q.figureNote === 'string' ? q.figureNote.slice(0, 300) : null,
        continuesFromPrevious: q.continuesFromPrevious === true,
        ambiguous: q.ambiguous === true,
      }))
      .filter(q => q.text.length > 0)
  } catch {
    return []
  }
}

async function parsePageWithAnthropic(base64: string, mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'): Promise<PageResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')
  const result = await withTimeout(anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    temperature: 0,
    system: systemPrompt(),
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: 'Extract the questions on this homework page.' },
      ],
    }],
  }), PER_PAGE_TIMEOUT_MS)
  const raw = result.content[0]?.type === 'text' ? result.content[0].text : ''
  return { questions: safeJsonQuestions(raw), unavailable: false }
}

async function parsePageWithGroq(base64: string, mediaType: string): Promise<PageResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY missing')
  const res = await withTimeout(fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the questions on this homework page.' },
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
          ],
        },
      ],
    }),
  }), PER_PAGE_TIMEOUT_MS)
  if (!res.ok) throw new Error(`Groq parse-homework failed: ${res.status}`)
  const data = await res.json()
  return { questions: safeJsonQuestions(data.choices?.[0]?.message?.content ?? ''), unavailable: false }
}

async function parsePage(rawImage: string): Promise<PageResult> {
  const { base64, mediaType } = stripDataUrl(rawImage)
  if (Buffer.byteLength(base64, 'base64') > MAX_IMAGE_BASE64_BYTES) {
    throw Object.assign(new Error('Image too large'), { statusCode: 413 })
  }

  try {
    return await parsePageWithAnthropic(base64, mediaType)
  } catch (anthropicErr: any) {
    console.warn('parse-homework anthropic fallback:', anthropicErr?.message ?? anthropicErr)
  }

  try {
    return await parsePageWithGroq(base64, mediaType)
  } catch (groqErr: any) {
    console.warn('parse-homework unavailable:', groqErr?.message ?? groqErr)
    return fallbackPage()
  }
}

/** Merge a page's leading continuation question into the previous page's last question. */
function mergeContinuations(pages: ParsedHomeworkQuestion[][]): ParsedHomeworkQuestion[] {
  const merged: ParsedHomeworkQuestion[] = []
  for (const page of pages) {
    for (let i = 0; i < page.length; i++) {
      const q = page[i]
      if (i === 0 && q.continuesFromPrevious && merged.length > 0) {
        const prev = merged[merged.length - 1]
        prev.text = `${prev.text}\n${q.text}`.slice(0, 2000)
        if (q.choices?.length) prev.choices = [...(prev.choices ?? []), ...q.choices].slice(0, 12)
        if (q.figureNote && !prev.figureNote) prev.figureNote = q.figureNote
        prev.ambiguous = prev.ambiguous || q.ambiguous
        continue
      }
      merged.push({ ...q, continuesFromPrevious: i === 0 ? q.continuesFromPrevious : false })
    }
  }
  return merged
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    await auth.verifyIdToken(header.slice(7))
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const rawPages: unknown[] = Array.isArray(req.body?.pages) ? req.body.pages : []
    const pages = rawPages
      .filter((p): p is { imageBase64: string } => (
        !!p && typeof p === 'object' && 'imageBase64' in p && typeof (p as any).imageBase64 === 'string'
      ))
      .slice(0, MAX_PAGES_PER_CALL)

    if (pages.length === 0) return res.status(400).json({ error: 'Missing pages[]' })

    const results = await Promise.all(pages.map(p => parsePage(p.imageBase64)))
    const unavailable = results.some(r => r.unavailable)
    const questions = mergeContinuations(results.map(r => r.questions))

    return res.status(200).json({
      questions,
      pageCount: pages.length,
      ...(unavailable ? { unavailable: true } : {}),
    })
  } catch (err: any) {
    if (err?.statusCode === 413) return res.status(413).json({ error: 'Image too large' })
    console.warn('parse-homework request failed:', err?.message ?? err)
    return res.status(200).json({ questions: [], pageCount: 0, unavailable: true })
  }
}
