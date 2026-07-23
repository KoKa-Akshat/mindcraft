/**
 * Small icon-scale concept badges  -  replaces the old hardcoded-emoji-per-
 * concept system (`actTopicEmojis.ts`) in the TOC list and the Map.
 *
 * Why: Akshat, verbatim  -  "why does fractions and decimals have a pizza
 * slice lmao". `ACT_TOPIC_EMOJI` picked one generic platform emoji per
 * concept (often a pun, e.g. 🍕 for fractions_decimals) with no connection to
 * that concept's actual locked protagonist/scene  -  jarring next to the real
 * hand-authored SVG concept art used everywhere else (chapter pages,
 * practice sessions).
 *
 * Source: `app/scripts/generateConceptIconsSvg.mjs`  -  a re-simplified (NOT a
 * scaled-down copy) 64x64 badge built from that SAME concept's one bespoke
 * math metaphor prop in `generateConceptArtSvg.mjs` (the balance scale for
 * basic_equations, the rope-stretched cord for right_triangle_geometry,
 * etc.), same ink/parchment/navy/gold palette. Drops files at
 * `assets/canvas/generated/icon-{conceptId}.svg`, auto-discovered here via
 * import.meta.glob  -  same rerunnable-pipeline pattern as `storyArt.ts`'s
 * `story-*` glob, no code edit needed to register a new icon.
 */
const iconModules = import.meta.glob<{ default: string }>(
  '../assets/canvas/generated/icon-*.svg',
  { eager: true },
)

const ICONS: Record<string, string> = {}
for (const [path, mod] of Object.entries(iconModules)) {
  const match = path.match(/icon-([a-z0-9_]+)\.svg$/)
  if (match) ICONS[match[1]] = mod.default
}

/** conceptId -> small badge icon URL. Falls back to a generic compass-rose
 * badge (still hand-authored, in-palette) rather than an emoji  -  every
 * concept currently shown in the TOC/Map has a real bespoke entry, so this
 * fallback is a disclosed safety net, not the common path. */
export function conceptIconUrl(conceptId: string): string {
  return ICONS[conceptId] ?? ICONS.fallback ?? ''
}
