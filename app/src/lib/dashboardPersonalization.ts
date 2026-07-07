import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

export interface DashboardSticker {
  stickerId: string
  x: number
  y: number
  rotation: number
}

export type PaperPreset = 'cream' | 'beige' | 'greyblue' | 'sage' | 'blush'
export type FontPreset = 'script' | 'print' | 'mono'

export interface DashboardTheme {
  paper: PaperPreset
  font: FontPreset
}

export interface DashboardPersonalization {
  stickers: DashboardSticker[]
  theme: DashboardTheme
  bookmarkedQuestions: string[]
}

export const STICKER_CAP = 10
export const BOOKMARK_CAP = 200

export const DEFAULT_THEME: DashboardTheme = { paper: 'cream', font: 'script' }

export const STICKER_IDS = [
  'star', 'paw', 'compass', 'flag', 'plant', 'moon',
  'heart', 'bolt', 'leaf', 'anchor', 'gem', 'feather',
] as const

export type StickerId = typeof STICKER_IDS[number]

export const PAPER_LABELS: Record<PaperPreset, string> = {
  cream: 'Classic cream',
  beige: 'Warm beige',
  greyblue: 'Cool grey-blue',
  sage: 'Sage',
  blush: 'Blush',
}

export const FONT_LABELS: Record<FontPreset, string> = {
  script: 'Handwritten',
  print: 'Neat print',
  mono: 'Journal mono',
}

const EMPTY: DashboardPersonalization = {
  stickers: [],
  theme: DEFAULT_THEME,
  bookmarkedQuestions: [],
}

function cleanStickers(raw: unknown): DashboardSticker[] {
  if (!Array.isArray(raw)) return []
  const out: DashboardSticker[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const s = item as Record<string, unknown>
    if (typeof s.stickerId !== 'string') continue
    if (!STICKER_IDS.includes(s.stickerId as StickerId)) continue
    const x = Number(s.x)
    const y = Number(s.y)
    const rotation = Number(s.rotation)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out.push({
      stickerId: s.stickerId,
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      rotation: Number.isFinite(rotation) ? rotation : 0,
    })
    if (out.length >= STICKER_CAP) break
  }
  return out
}

function cleanTheme(raw: unknown): DashboardTheme {
  if (!raw || typeof raw !== 'object') return DEFAULT_THEME
  const t = raw as Record<string, unknown>
  const paper = t.paper as PaperPreset
  const font = t.font as FontPreset
  return {
    paper: PAPER_LABELS[paper] ? paper : 'cream',
    font: FONT_LABELS[font] ? font : 'script',
  }
}

function cleanBookmarks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const id of raw) {
    if (typeof id !== 'string' || !id.trim()) continue
    if (out.includes(id)) continue
    out.push(id)
    if (out.length >= BOOKMARK_CAP) break
  }
  return out
}

export async function loadDashboardPersonalization(uid: string): Promise<DashboardPersonalization> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const data = snap.data()
    if (!data) return { ...EMPTY }
    return {
      stickers: cleanStickers(data.dashboardStickers),
      theme: cleanTheme(data.dashboardTheme),
      bookmarkedQuestions: cleanBookmarks(data.bookmarkedQuestions),
    }
  } catch {
    return { ...EMPTY }
  }
}

export async function saveDashboardStickers(uid: string, stickers: DashboardSticker[]): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {
      dashboardStickers: cleanStickers(stickers),
    }, { merge: true })
  } catch { /* fail-soft */ }
}

export async function saveDashboardTheme(uid: string, theme: DashboardTheme): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {
      dashboardTheme: cleanTheme(theme),
    }, { merge: true })
  } catch { /* fail-soft */ }
}

export async function saveBookmarkedQuestions(uid: string, ids: string[]): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {
      bookmarkedQuestions: cleanBookmarks(ids),
    }, { merge: true })
  } catch { /* fail-soft */ }
}

export async function toggleBookmark(uid: string, questionId: string, current: string[]): Promise<string[]> {
  const has = current.includes(questionId)
  const next = has
    ? current.filter(id => id !== questionId)
    : [questionId, ...current].slice(0, BOOKMARK_CAP)
  await saveBookmarkedQuestions(uid, next)
  return next
}
