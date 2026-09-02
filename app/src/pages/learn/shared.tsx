/**
 * pages/learn/shared.tsx
 *
 * Phase 0 of the Learn refactor (see the founder's scoped plan, 2026-09-02):
 * a purely mechanical split of the old single 1345-line Learn.tsx into
 * presentational sub-components. Zero behavior change on purpose, this pass
 * only moves JSX into its own files, props in, JSX out, no component here
 * owns any state or effect of its own. All state, all effects, and all
 * handlers stay in pages/Learn.tsx exactly as they were; these just render
 * what they are handed.
 *
 * This file is the shared visual language and shared types every one of
 * those sub-components (and Learn.tsx itself) imports, so a color or a type
 * shape is defined exactly once.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { ConceptSim, GeneratedSim } from '../../lib/conceptLibrary'
import type { HomeworkQuestion } from '../../types'

// Forest-green retheme (2026-09-02): PAGE_BG now matches
// full-graph-viewer.html's own --field (#080e14) exactly, so the iframe
// behind the panels no longer has a visible navy-vs-deep-field seam at its
// edge. Text/border tint shifted from blue-white to green-white to match.
export const PAGE_BG = '#080e14'
export const FONT_STACK = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif"
export const TEXT_PRIMARY = 'rgba(232,239,228,0.95)'
export const TEXT_SOFT = 'rgba(205,220,208,0.8)'
export const TEXT_FAINT = 'rgba(205,220,208,0.55)'
export const BORDER_SOFT = '1px solid rgba(140,178,150,0.16)'

export const CARD: CSSProperties = {
  background: '#141f18',
  border: BORDER_SOFT,
  borderRadius: 18,
  boxShadow: '0 6px 22px rgba(3,8,5,0.35)',
}

// Accent families, same retheme. Indigo (search/primary actions) becomes
// forest green; violet (tutor/Jesse/nudge) becomes brand lime, matching
// the raccoon mark's own color everywhere else in the product. Cyan
// (materials/homework) and the existing zone greens/amber/red are left
// alone on purpose: Fable 5's scoping pass flagged that collapsing every
// accent to one green would lose the semantic color coding between
// search, tutor chat, and materials, so materials keeps its own identity.
export const ACCENT_FOREST = '#3d6b4f'
export const ACCENT_FOREST_SOFT = '#5fa578'
export const ACCENT_FOREST_PALE = '#a8d4b5'
export const ACCENT_LIME = '#c4f547'
export const ACCENT_LIME_INK = '#0c1207'

export function Eyebrow({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase', color }}>
      {children}
    </div>
  )
}

/** Hint-card templates come from the ML service (Engine lane) and some carry
 * em/en dashes. The product-wide style rule bans those, so they are replaced
 * at this display boundary rather than silently shown. */
export function cleanDashes(text: string): string {
  return text.replace(new RegExp('\\s*[\\u2014\\u2013]\\s*', 'g'), ', ')
}

export interface NeighborRow {
  id: string
  label: string
  group: string
  hasChapter: boolean
  hasSim: boolean
  relation: 'prerequisite' | 'next' | 'related'
}

export interface MaterialsState {
  fileName: string
  pageCount: number
  questions: HomeworkQuestion[]
}

export interface LibraryCounts { nodes: number; withLesson: number; withSim: number; subjects: number }

export interface QuestionSimState {
  status: 'loading' | 'ready' | 'none' | 'error'
  conceptId?: string
  conceptLabel?: string
  sim?: ConceptSim
  generating?: boolean
  genStatus?: string
  genFailed?: string
  generatedSim?: GeneratedSim
}
