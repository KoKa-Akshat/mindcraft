/**
 * Cover Sticker Store catalog — sliced from the Codex transparent sheet
 * in agent_work/product/dashboard-cover-sticker-ideas/.
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

export type CoverSticker = {
  id: string
  name: string
  blurb: string
  src: string
}

export const COVER_STICKERS: ReadonlyArray<CoverSticker> = [
  { id: 'starstruck-glove', name: 'Palm of Sparks', blurb: 'Catch a green idea mid-air.', src: starstruckGlove },
  { id: 'orbit-tome', name: 'Cosmic Syllabus', blurb: 'Homework that hums like a galaxy.', src: orbitTome },
  { id: 'constellation-compass', name: 'True-North Notes', blurb: 'Never lose the map of what matters.', src: constellationCompass },
  { id: 'lime-pie-plot', name: 'Pie in the Sky', blurb: 'Stats that look good enough to eat.', src: limePiePlot },
  { id: 'parabola-pilot', name: 'Parabola Pilot', blurb: 'Ride the curve all the way up.', src: parabolaPilot },
  { id: 'rocket-pencil', name: 'No. 2 Liftoff', blurb: 'Write hard. Burn bright.', src: rocketPencil },
  { id: 'quest-pack', name: 'Patchwork Quest', blurb: 'Pins for every world you’ve tried.', src: questPack },
  { id: 'nightwatch-scope', name: 'Nightwatch Scope', blurb: 'Spot the next topic before dawn.', src: nightwatchScope },
  { id: 'supernova-cup', name: 'Supernova Cup', blurb: 'First place is a little radioactive.', src: supernovaCup },
  { id: 'spark-calc', name: 'Clickety Spark', blurb: 'Chunky buttons. Loud answers.', src: sparkCalc },
  { id: 'ribbon-dossier', name: 'Scarlet Dossier', blurb: 'Tied tight. Secrets optional.', src: ribbonDossier },
  { id: 'keyhole-codex', name: 'Keyhole Codex', blurb: 'Turn the key. Open the chapter.', src: keyholeCodex },
]

export const COVER_STICKER_EQUIP_CAP = 4
const EQUIPPED_KEY = 'mc-cover-equipped-stickers'

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
