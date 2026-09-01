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

export const PAGE_BG = '#0F1424'
export const FONT_STACK = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif"
export const TEXT_PRIMARY = 'rgba(238,242,252,0.95)'
export const TEXT_SOFT = 'rgba(205,215,238,0.8)'
export const TEXT_FAINT = 'rgba(205,215,238,0.55)'
export const BORDER_SOFT = '1px solid rgba(160,178,224,0.16)'

export const CARD: CSSProperties = {
  background: '#182036',
  border: BORDER_SOFT,
  borderRadius: 18,
  boxShadow: '0 6px 22px rgba(5,9,22,0.3)',
}

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
