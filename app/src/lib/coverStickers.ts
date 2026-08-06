/**
 * Cover Stickers catalog. Art from
 * app/src/assets/canvas/generated/dashboard-stickers-3d/ (Codex 3D set).
 *
 * Pricing: list prices for the $100 plan ($0.99–$4.99). The $240 plan
 * includes the shelf. Soft launch keeps equipping free for every plan;
 * Admin sets stickerPlan on student/parent docs.
 */
import wizardSpark from '../assets/canvas/generated/dashboard-stickers-3d/wizard-spark-3d.png'
import portalJournal from '../assets/canvas/generated/dashboard-stickers-3d/portal-journal-3d.png'
import constellationCompass from '../assets/canvas/generated/dashboard-stickers-3d/constellation-compass-3d.png'
import fractionPuzzle from '../assets/canvas/generated/dashboard-stickers-3d/fraction-puzzle-3d.png'
import launchCurve from '../assets/canvas/generated/dashboard-stickers-3d/launch-curve-3d.png'
import pencilRocket from '../assets/canvas/generated/dashboard-stickers-3d/pencil-rocket-3d.png'
import explorerPack from '../assets/canvas/generated/dashboard-stickers-3d/explorer-pack-3d.png'
import constellationTelescope from '../assets/canvas/generated/dashboard-stickers-3d/constellation-telescope-3d.png'
import starTrophy from '../assets/canvas/generated/dashboard-stickers-3d/star-trophy-3d.png'
import studyCalculator from '../assets/canvas/generated/dashboard-stickers-3d/study-calculator-3d.png'
import fieldNotesBundle from '../assets/canvas/generated/dashboard-stickers-3d/field-notes-bundle-3d.png'
import keybook from '../assets/canvas/generated/dashboard-stickers-3d/keybook-3d.png'

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
  { id: 'wizard-spark', name: 'Palm of Sparks', blurb: 'Catch a green idea mid-air.', src: wizardSpark, priceUsd: 2.99 },
  { id: 'portal-journal', name: 'Portal Journal', blurb: 'Open a page. Fall into a galaxy.', src: portalJournal, priceUsd: 3.49 },
  { id: 'constellation-compass', name: 'True-North Notes', blurb: 'Never lose the map of what matters.', src: constellationCompass, priceUsd: 2.49 },
  { id: 'fraction-puzzle', name: 'Fraction Puzzle', blurb: 'Snap the pieces. Own the whole.', src: fractionPuzzle, priceUsd: 1.99 },
  { id: 'launch-curve', name: 'Launch Curve', blurb: 'Ride the arc all the way up.', src: launchCurve, priceUsd: 3.99 },
  { id: 'pencil-rocket', name: 'No. 2 Liftoff', blurb: 'Write hard. Burn bright.', src: pencilRocket, priceUsd: 1.49 },
  { id: 'explorer-pack', name: 'Explorer Pack', blurb: 'Pins for every world you have tried.', src: explorerPack, priceUsd: 4.49 },
  { id: 'constellation-telescope', name: 'Nightwatch Scope', blurb: 'Spot the next topic before dawn.', src: constellationTelescope, priceUsd: 3.49 },
  { id: 'star-trophy', name: 'Supernova Cup', blurb: 'First place is a little radioactive.', src: starTrophy, priceUsd: 4.99 },
  { id: 'study-calculator', name: 'Clickety Spark', blurb: 'Chunky buttons. Loud answers.', src: studyCalculator, priceUsd: 0.99 },
  { id: 'field-notes-bundle', name: 'Field Notes Bundle', blurb: 'Tied tight. Secrets optional.', src: fieldNotesBundle, priceUsd: 2.99 },
  { id: 'keybook', name: 'Keyhole Codex', blurb: 'Turn the key. Open the chapter.', src: keybook, priceUsd: 4.49 },
]

export const COVER_STICKER_EQUIP_CAP = 4
const EQUIPPED_KEY = 'mc-cover-equipped-stickers-v2'
const MASCOT_KEY = 'mc-cover-mascot-sticker'
export const DEFAULT_MASCOT_STICKER_ID = 'wizard-spark'

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

export function loadMascotStickerId(): string {
  try {
    const id = localStorage.getItem(MASCOT_KEY)
    if (id && COVER_STICKERS.some(s => s.id === id)) return id
  } catch { /* ignore */ }
  return DEFAULT_MASCOT_STICKER_ID
}

export function saveMascotStickerId(id: string) {
  try {
    if (COVER_STICKERS.some(s => s.id === id)) localStorage.setItem(MASCOT_KEY, id)
  } catch { /* ignore */ }
}
