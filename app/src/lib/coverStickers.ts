/**
 * Cover Stickers catalog. Sliced from the Codex transparent sheet in
 * agent_work/product/dashboard-cover-sticker-ideas/.
 *
 * Pricing: list prices for the $100 plan ($0.99–$4.99). The $240 plan
 * includes the shelf. Soft launch keeps equipping free for every plan;
 * Admin sets stickerPlan on student/parent docs.
 */
import starstruckGlove from '../assets/cover-stickers/starstruck-glove.png'
import orbitTome from '../assets/cover-stickers/orbit-tome.png'
import constellationCompass from '../assets/cover-stickers/constellation-compass.png'
import limePiePlot from '../assets/cover-stickers/lime-pie-plot.png'
import parabolaPilot from '../assets/cover-stickers/parabola-pilot.png'
import rocketPencil from '../assets/cover-stickers/rocket-pencil.png'
import questPack from '../assets/cover-stickers/quest-pack.png'
import nightwatchScope from '../assets/cover-stickers/nightwatch-scope.png'
import supernovaCup from '../assets/cover-stickers/supernova-cup.png'
import sparkCalc from '../assets/cover-stickers/spark-calc.png'
import ribbonDossier from '../assets/cover-stickers/ribbon-dossier.png'
import keyholeCodex from '../assets/cover-stickers/keyhole-codex.png'

/** Admin-set shelf entitlement on users/{uid}.stickerPlan */
export type StickerPlan = 'testing' | 'standard' | 'premium'

export const STICKER_PLANS: ReadonlyArray<StickerPlan> = ['testing', 'standard', 'premium']

export const STICKER_PLAN_LABELS: Record<StickerPlan, string> = {
  testing: 'Testing (free)',
  standard: '$100 plan (priced)',
  premium: '$240 plan (included)',
}

export type CoverSticker = {
  id: string
  name: string
  blurb: string
  src: string
  /** List price in USD for the $100 plan. */
  priceUsd: number
}

export const COVER_STICKERS: ReadonlyArray<CoverSticker> = [
  { id: 'starstruck-glove', name: 'Palm of Sparks', blurb: 'Catch a green idea mid-air.', src: starstruckGlove, priceUsd: 2.99 },
  { id: 'orbit-tome', name: 'Cosmic Syllabus', blurb: 'Homework that hums like a galaxy.', src: orbitTome, priceUsd: 3.49 },
  { id: 'constellation-compass', name: 'True-North Notes', blurb: 'Never lose the map of what matters.', src: constellationCompass, priceUsd: 2.49 },
  { id: 'lime-pie-plot', name: 'Pie in the Sky', blurb: 'Stats that look good enough to eat.', src: limePiePlot, priceUsd: 1.99 },
  { id: 'parabola-pilot', name: 'Parabola Pilot', blurb: 'Ride the curve all the way up.', src: parabolaPilot, priceUsd: 3.99 },
  { id: 'rocket-pencil', name: 'No. 2 Liftoff', blurb: 'Write hard. Burn bright.', src: rocketPencil, priceUsd: 1.49 },
  { id: 'quest-pack', name: 'Patchwork Quest', blurb: 'Pins for every world you have tried.', src: questPack, priceUsd: 4.49 },
  { id: 'nightwatch-scope', name: 'Nightwatch Scope', blurb: 'Spot the next topic before dawn.', src: nightwatchScope, priceUsd: 3.49 },
  { id: 'supernova-cup', name: 'Supernova Cup', blurb: 'First place is a little radioactive.', src: supernovaCup, priceUsd: 4.99 },
  { id: 'spark-calc', name: 'Clickety Spark', blurb: 'Chunky buttons. Loud answers.', src: sparkCalc, priceUsd: 0.99 },
  { id: 'ribbon-dossier', name: 'Scarlet Dossier', blurb: 'Tied tight. Secrets optional.', src: ribbonDossier, priceUsd: 2.99 },
  { id: 'keyhole-codex', name: 'Keyhole Codex', blurb: 'Turn the key. Open the chapter.', src: keyholeCodex, priceUsd: 4.49 },
]

export const COVER_STICKER_EQUIP_CAP = 4
const EQUIPPED_KEY = 'mc-cover-equipped-stickers'

export function parseStickerPlan(raw: unknown): StickerPlan {
  if (raw === 'standard' || raw === 'premium' || raw === 'testing') return raw
  return 'testing'
}

/** Soft launch: every plan can equip. Checkout comes later. */
export function canEquipCoverSticker(_plan: StickerPlan): boolean {
  return true
}

/** Show the Free badge (testing, premium, or soft-launch complimentary). */
export function showStickerFreeBadge(plan: StickerPlan): boolean {
  return plan === 'testing' || plan === 'premium' || plan === 'standard'
}

export function stickerShelfNote(plan: StickerPlan): string {
  if (plan === 'premium') return 'Included with your plan.'
  if (plan === 'standard') return 'Listed for the $100 plan. Complimentary while we test.'
  return 'Complimentary while we test. Yours free for now.'
}

export function formatStickerPrice(priceUsd: number): string {
  return `$${priceUsd.toFixed(2)}`
}

export function loadEquippedCoverStickers(): string[] {
  try {
    const raw = localStorage.getItem(EQUIPPED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const known = new Set(COVER_STICKERS.map(s => s.id))
    return parsed.filter((id): id is string => typeof id === 'string' && known.has(id)).slice(0, COVER_STICKER_EQUIP_CAP)
  } catch {
    return []
  }
}

export function saveEquippedCoverStickers(ids: string[]) {
  try {
    localStorage.setItem(EQUIPPED_KEY, JSON.stringify(ids.slice(0, COVER_STICKER_EQUIP_CAP)))
  } catch { /* ignore */ }
}

export function coverStickerById(id: string): CoverSticker | undefined {
  return COVER_STICKERS.find(s => s.id === id)
}
