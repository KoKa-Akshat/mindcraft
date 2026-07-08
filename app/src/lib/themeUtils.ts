/** WCAG contrast + curated custom-font allowlist for dashboard theme. */

export const ALLOWED_CUSTOM_FONTS = [
  'Caveat',
  'Patrick Hand',
  'Kalam',
  'Shadows Into Light',
  'Architects Daughter',
  'Homemade Apple',
  'Libre Baskerville',
  'Lora',
  'Merriweather',
  'Source Serif 4',
  'DM Serif Display',
  'Fraunces',
  'IBM Plex Mono',
  'JetBrains Mono',
  'Courier Prime',
] as const

export type AllowedCustomFont = typeof ALLOWED_CUSTOM_FONTS[number]

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value)
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(channel => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(foreground: string, background: string): number {
  if (!isValidHexColor(foreground) || !isValidHexColor(background)) return 0
  const l1 = relativeLuminance(foreground)
  const l2 = relativeLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function meetsContrast(foreground: string, background: string, min = 4.5): boolean {
  return contrastRatio(foreground, background) >= min
}

export function isAllowedCustomFont(name: string): name is AllowedCustomFont {
  return (ALLOWED_CUSTOM_FONTS as readonly string[]).includes(name)
}

export function ensureGoogleFont(family: string): void {
  if (!isAllowedCustomFont(family)) return
  const id = `gf-${family.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;600;700&display=swap`
  document.head.appendChild(link)
}
