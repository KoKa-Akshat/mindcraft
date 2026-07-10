/**
 * shopCatalog.ts — the journal "store" shelf: cover art skins and sticker
 * packs a student can browse and equip.
 *
 * IMPORTANT — no payment wiring here or anywhere downstream of this file.
 * `locked` items render as "coming soon" and cannot be equipped. This is
 * intentionally a shopfront shell for a future pricing decision, not a real
 * store: every unlocked item is free today. Do not wire Stripe/billing
 * against this catalog without explicit owner sign-off.
 */
import type { PaperPreset } from './dashboardPersonalization'

export interface CoverArtItem {
  kind: 'cover'
  id: PaperPreset
  name: string
  blurb: string
  swatch: [string, string, string]
  locked: boolean
}

export interface StickerPackItem {
  kind: 'stickerpack'
  id: string
  name: string
  blurb: string
  emoji: string[]
  locked: boolean
}

export type ShopItem = CoverArtItem | StickerPackItem

export const SHOP_CATALOG: ShopItem[] = [
  {
    kind: 'cover', id: 'cream', name: 'Classic cream', blurb: 'The original field journal paper.',
    swatch: ['#f7f3ee', '#efe9e0', '#1d3a8a'], locked: false,
  },
  {
    kind: 'cover', id: 'sage', name: 'Sage', blurb: 'A quieter, cooler green-grey page.',
    swatch: ['#eef2ea', '#e2e8dc', '#1d3a8a'], locked: false,
  },
  {
    kind: 'cover', id: 'cyberpunk', name: 'Night circuit', blurb: 'Cyan rules, magenta margin, still a notebook.',
    swatch: ['#e2ebf1', '#d2dee6', '#d6009f'], locked: false,
  },
  {
    kind: 'stickerpack', id: 'pack-explorer', name: 'Field kit', blurb: 'Compass, flag, anchor, feather.',
    emoji: ['star', 'compass', 'flag', 'anchor'], locked: false,
  },
  {
    kind: 'cover', id: 'beige' as PaperPreset, name: 'Aurora foil', blurb: 'A holographic edge on every page.',
    swatch: ['#f2e9d8', '#e8d9b8', '#7d6fa8'], locked: true,
  },
  {
    kind: 'stickerpack', id: 'pack-holo', name: 'Holographic pack', blurb: 'Shifting foil stickers.',
    emoji: ['gem', 'moon', 'bolt'], locked: true,
  },
  {
    kind: 'cover', id: 'blush' as PaperPreset, name: 'Gilded leather', blurb: 'A warm leather-bound cover treatment.',
    swatch: ['#f6eeea', '#ebe0da', '#c9963f'], locked: true,
  },
] as const
