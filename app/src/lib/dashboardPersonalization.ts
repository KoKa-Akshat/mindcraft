import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { isAllowedCustomFont, isValidHexColor } from './themeUtils'

export interface DashboardSticker {
  stickerId: string
  x: number
  y: number
  rotation: number
  customUrl?: string
}

export interface CustomSticker {
  id: string
  url: string
  storagePath: string
  uploadedAt: number
}

export interface StickerSelection {
  stickerId: string
  customUrl?: string
}

export type PaperPreset = 'cream' | 'beige' | 'greyblue' | 'sage' | 'blush' | 'cyberpunk' | 'custom'
export type FontPreset = 'script' | 'print' | 'mono' | 'custom'

export interface DashboardTheme {
  paper: PaperPreset
  font: FontPreset
  customPaper?: string
  customInk?: string
  customFontFamily?: string
}

export interface DashboardPersonalization {
  stickers: DashboardSticker[]
  theme: DashboardTheme
  bookmarkedQuestions: string[]
  customStickers: CustomSticker[]
}

export const STICKER_CAP = 10
export const BOOKMARK_CAP = 200

export const DEFAULT_THEME: DashboardTheme = { paper: 'cream', font: 'script' }

export const STICKER_IDS = [
  'star', 'paw', 'compass', 'flag', 'plant', 'moon',
  'heart', 'bolt', 'leaf', 'anchor', 'gem', 'feather',
] as const

export type StickerId = typeof STICKER_IDS[number]

export const PAPER_LABELS: Record<Exclude<PaperPreset, 'custom'>, string> = {
  cream: 'Classic cream',
  beige: 'Warm beige',
  greyblue: 'Cool grey-blue',
  sage: 'Sage',
  blush: 'Blush',
  cyberpunk: 'Night circuit',
}

export const FONT_LABELS: Record<Exclude<FontPreset, 'custom'>, string> = {
  script: 'Handwritten',
  print: 'Neat print',
  mono: 'Journal mono',
}

const EMPTY: DashboardPersonalization = {
  stickers: [],
  theme: DEFAULT_THEME,
  bookmarkedQuestions: [],
  customStickers: [],
}

const STORAGE_HOST = 'firebasestorage.googleapis.com'
const PROJECT_BUCKET = 'mindcraft-93858'

export function isValidCustomStickerUrl(url: string, uid?: string): boolean {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes(STORAGE_HOST)) return false
    const path = decodeURIComponent(parsed.pathname)
    if (!path.includes(PROJECT_BUCKET)) return false
    if (!path.includes('/users/') || !path.includes('/stickers/')) return false
    if (uid && !path.includes(`/users/${uid}/stickers/`)) return false
    return true
  } catch {
    return false
  }
}

function isCuratedStickerId(id: string): id is StickerId {
  return STICKER_IDS.includes(id as StickerId)
}

const EMOJI_STICKER_PREFIX = 'emoji:'
// A generous but bounded cap — a handful of grapheme clusters (emoji can be
// multi-codepoint with skin-tone/ZWJ modifiers), never a smuggled string.
const MAX_EMOJI_STICKER_CHARS = 16

function isEmojiStickerIdValue(id: string): boolean {
  if (!id.startsWith(EMOJI_STICKER_PREFIX)) return false
  const chars = id.slice(EMOJI_STICKER_PREFIX.length)
  return chars.length > 0 && chars.length <= MAX_EMOJI_STICKER_CHARS
}

export function cleanStickers(raw: unknown, uid?: string): DashboardSticker[] {
  if (!Array.isArray(raw)) return []
  const out: DashboardSticker[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const s = item as Record<string, unknown>
    if (typeof s.stickerId !== 'string') continue
    const x = Number(s.x)
    const y = Number(s.y)
    const rotation = Number(s.rotation)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue

    const customUrl = typeof s.customUrl === 'string' ? s.customUrl : undefined
    if (customUrl) {
      if (!isValidCustomStickerUrl(customUrl, uid)) continue
    } else if (!isCuratedStickerId(s.stickerId) && !isEmojiStickerIdValue(s.stickerId)) {
      continue
    }

    out.push({
      stickerId: s.stickerId,
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      rotation: Number.isFinite(rotation) ? rotation : 0,
      customUrl,
    })
    if (out.length >= STICKER_CAP) break
  }
  return out
}

function cleanCustomStickers(raw: unknown, uid?: string): CustomSticker[] {
  if (!Array.isArray(raw)) return []
  const out: CustomSticker[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.url !== 'string') continue
    if (!isValidCustomStickerUrl(row.url, uid)) continue
    const storagePath = typeof row.storagePath === 'string'
      ? row.storagePath
      : `users/${uid ?? ''}/stickers/${row.id}`
    if (uid && !storagePath.startsWith(`users/${uid}/stickers/`)) continue
    out.push({
      id: row.id,
      url: row.url,
      storagePath,
      uploadedAt: typeof row.uploadedAt === 'number' ? row.uploadedAt : Date.now(),
    })
  }
  return out
}

function cleanTheme(raw: unknown): DashboardTheme {
  if (!raw || typeof raw !== 'object') return DEFAULT_THEME
  const t = raw as Record<string, unknown>
  const paper = t.paper as PaperPreset
  const font = t.font as FontPreset

  const theme: DashboardTheme = {
    paper: paper === 'custom' ? 'custom' : (PAPER_LABELS[paper as keyof typeof PAPER_LABELS] ? paper : 'cream'),
    font: font === 'custom' ? 'custom' : (FONT_LABELS[font as keyof typeof FONT_LABELS] ? font : 'script'),
  }

  if (typeof t.customPaper === 'string' && isValidHexColor(t.customPaper)) {
    theme.customPaper = t.customPaper
  }
  if (typeof t.customInk === 'string' && isValidHexColor(t.customInk)) {
    theme.customInk = t.customInk
  }
  if (typeof t.customFontFamily === 'string' && isAllowedCustomFont(t.customFontFamily)) {
    theme.customFontFamily = t.customFontFamily
  }

  if (theme.paper === 'custom' && !theme.customPaper) theme.paper = 'cream'
  if (theme.font === 'custom' && !theme.customFontFamily) theme.font = 'script'

  return theme
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
      stickers: cleanStickers(data.dashboardStickers, uid),
      theme: cleanTheme(data.dashboardTheme),
      bookmarkedQuestions: cleanBookmarks(data.bookmarkedQuestions),
      customStickers: cleanCustomStickers(data.customStickers, uid),
    }
  } catch {
    return { ...EMPTY }
  }
}

export async function saveDashboardStickers(uid: string, stickers: DashboardSticker[]): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {
      dashboardStickers: cleanStickers(stickers, uid),
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

export async function saveCustomStickers(uid: string, stickers: CustomSticker[]): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {
      customStickers: cleanCustomStickers(stickers, uid),
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

export function themeShellStyle(theme: DashboardTheme): Record<string, string> | undefined {
  const style: Record<string, string> = {}
  if (theme.paper === 'custom' && theme.customPaper) {
    style['--paper-base'] = theme.customPaper
    style['--paper-raised'] = theme.customPaper
    style['--paper-recessed'] = theme.customPaper
    style['--paper-edge'] = theme.customPaper
    style['--paper-crease'] = theme.customPaper
  }
  if (theme.customInk) {
    style['--ink-katha'] = theme.customInk
    style['--ink-system'] = theme.customInk
    style['--ink-pencil'] = theme.customInk
    style['--ink-depth'] = theme.customInk
  }
  if (theme.font === 'custom' && theme.customFontFamily) {
    const quoted = `"${theme.customFontFamily}"`
    style['--font-script'] = `${quoted}, cursive`
    style['--font-katha'] = `${quoted}, serif`
  }
  return Object.keys(style).length ? style : undefined
}

export function resolvedPaperPreset(theme: DashboardTheme): Exclude<PaperPreset, 'custom'> {
  if (theme.paper !== 'custom') return theme.paper
  return 'cream'
}

export function resolvedFontPreset(theme: DashboardTheme): Exclude<FontPreset, 'custom'> {
  if (theme.font !== 'custom') return theme.font
  return 'script'
}
