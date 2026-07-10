/**
 * lib/homework.ts — PDF/photo homework upload → parsed work pages → journal.
 *
 * Client owns rasterization (PDF pages → JPEG data URLs) and chunked calls to
 * /api/parse-homework (routed through the shared app-actions.ts Vercel
 * function — see AGENT_RULEBOOK.md §1.6a for the endpoint contract). Also
 * owns the Firestore CRUD for the lightweight `homework_sessions` collection
 * — a self-directed session isn't tied to a booked tutor session, so it gets
 * its own doc shape rather than overloading the tutor-booking `Session` type.
 */
import * as pdfjsLib from 'pdfjs-dist'
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  doc, getDoc, setDoc, addDoc, collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import { WEBHOOK_BASE } from './mlApi'
import type { HomeworkQuestion, HomeworkSessionDoc } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export const MAX_HOMEWORK_PAGES = 12
const PAGE_RASTER_SCALE = 1.6
const MAX_PAGE_WIDTH = 1400
const PAGES_PER_PARSE_CALL = 3

// ── Rasterization ────────────────────────────────────────────────────────────

/** Render every page of a PDF File to JPEG data URLs, capped at MAX_HOMEWORK_PAGES. */
export async function rasterizePdf(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const pageCount = Math.min(pdf.numPages, MAX_HOMEWORK_PAGES)
  const pages: string[] = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const baseViewport = page.getViewport({ scale: PAGE_RASTER_SCALE })
    const scale = baseViewport.width > MAX_PAGE_WIDTH ? (MAX_PAGE_WIDTH / baseViewport.width) * PAGE_RASTER_SCALE : PAGE_RASTER_SCALE
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    pages.push(canvas.toDataURL('image/jpeg', 0.8))
  }

  return pages
}

/** Downscale a photographed homework page to a reasonable upload size. */
export async function prepareImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = dataUrl
  })

  const scale = img.width > MAX_PAGE_WIDTH ? MAX_PAGE_WIDTH / img.width : 1
  if (scale === 1) return dataUrl

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}

/** Rasterize/prepare any accepted upload (PDF or image) into page data URLs. */
export async function pagesFromFile(file: File): Promise<string[]> {
  if (file.type === 'application/pdf') return rasterizePdf(file)
  return [await prepareImage(file)]
}

// ── Parsing ───────────────────────────────────────────────────────────────────

interface ParsedPageQuestion {
  number: string | null
  text: string
  choices: string[] | null
  figureNote: string | null
  continuesFromPrevious: boolean
  ambiguous: boolean
}

interface ParseHomeworkResponse {
  questions: ParsedPageQuestion[]
  pageCount: number
  unavailable?: boolean
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Send rasterized page images to /api/parse-homework in chunks, merge
 * cross-chunk continuations, and assign stable per-question ids.
 * Throws only on auth/network failure; a provider-side miss comes back as
 * an empty (but valid) questions array with `unavailable` folded into the
 * return value's length being zero — callers check `.length === 0`.
 */
export async function parseHomeworkPages(pages: string[]): Promise<{ questions: HomeworkQuestion[]; unavailable: boolean }> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Not signed in')

  const chunks = chunk(pages, PAGES_PER_PARSE_CALL)
  const merged: ParsedPageQuestion[] = []
  let anyUnavailable = false

  for (const pageChunk of chunks) {
    const res = await fetch(`${WEBHOOK_BASE}/api/parse-homework`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pages: pageChunk.map(imageBase64 => ({ imageBase64 })) }),
    })
    if (!res.ok) { anyUnavailable = true; continue }
    const data = await res.json() as ParseHomeworkResponse
    if (data.unavailable) anyUnavailable = true

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i]
      if (i === 0 && q.continuesFromPrevious && merged.length > 0) {
        const prev = merged[merged.length - 1]
        prev.text = `${prev.text}\n${q.text}`.slice(0, 2000)
        if (q.choices?.length) prev.choices = [...(prev.choices ?? []), ...q.choices]
        if (q.figureNote && !prev.figureNote) prev.figureNote = q.figureNote
        prev.ambiguous = prev.ambiguous || q.ambiguous
        continue
      }
      merged.push(q)
    }
  }

  const questions: HomeworkQuestion[] = merged.map((q, i) => ({
    id: `q${i}`,
    number: q.number,
    text: q.text,
    choices: q.choices,
    figureNote: q.figureNote,
    ambiguous: q.ambiguous,
  }))

  return { questions, unavailable: anyUnavailable && questions.length === 0 }
}

// ── Firestore CRUD ────────────────────────────────────────────────────────────

const COLLECTION = 'homework_sessions'

export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return base ? `Homework · ${base}` : 'Homework'
}

export async function createHomeworkSession(
  studentId: string,
  sourceFileName: string,
  pageCount: number,
  questions: HomeworkQuestion[],
): Promise<string> {
  const now = Date.now()
  const payload: Omit<HomeworkSessionDoc, 'id'> = {
    studentId,
    title: titleFromFileName(sourceFileName),
    sourceFileName,
    pageCount,
    questions,
    currentIndex: 0,
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
  }
  const ref = await addDoc(collection(db, COLLECTION), payload)
  return ref.id
}

export async function loadHomeworkSession(homeworkId: string): Promise<HomeworkSessionDoc | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, homeworkId))
    if (!snap.exists()) return null
    return { id: snap.id, ...(snap.data() as Omit<HomeworkSessionDoc, 'id'>) }
  } catch {
    return null
  }
}

export async function updateHomeworkProgress(homeworkId: string, currentIndex: number): Promise<void> {
  try {
    await setDoc(doc(db, COLLECTION, homeworkId), { currentIndex, updatedAt: Date.now() }, { merge: true })
  } catch { /* fail-soft */ }
}

function bulletForQuestion(q: HomeworkQuestion, hasWork: boolean): string {
  const label = q.number ? `Question ${q.number}` : 'A question'
  return hasWork ? `${label}: worked through, scratch work saved.` : `${label}: read but not worked yet.`
}

export async function completeHomeworkSession(
  homeworkId: string,
  questions: HomeworkQuestion[],
  workedQuestionIds: Set<string>,
): Promise<void> {
  const now = Date.now()
  const bullets = questions.map(q => bulletForQuestion(q, workedQuestionIds.has(q.id)))
  try {
    await setDoc(doc(db, COLLECTION, homeworkId), {
      status: 'completed',
      completedAt: now,
      updatedAt: now,
      summary: {
        date: new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        bullets,
      },
    }, { merge: true })
  } catch { /* fail-soft */ }
}

export async function listHomeworkSessions(studentId: string, max = 20): Promise<HomeworkSessionDoc[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('studentId', '==', studentId),
      orderBy('updatedAt', 'desc'),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<HomeworkSessionDoc, 'id'>) }))
  } catch {
    return []
  }
}
