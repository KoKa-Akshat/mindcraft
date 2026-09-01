import type { RefObject } from 'react'
import { BORDER_SOFT, FONT_STACK, PAGE_BG, TEXT_FAINT, TEXT_PRIMARY } from './shared'

export interface SearchBarProps {
  query: string
  onQueryChange: (v: string) => void
  onSearch: () => void
  loading: boolean
  topUploadFileRef: RefObject<HTMLInputElement>
  materialsAccept: string
  onTopUpload: (file: File) => void
  materialsBusy: string
  showPanels: boolean
  materialsError: string
  embedPct: number | null
  embedderReady: boolean
  resolveMeta: { indexed: number; totalMs: number; coldStart: boolean } | null
  studiedIds: string[]
  err: string
}

/** The persistent bottom search/upload bar. Purely presentational, the
 * search/upload logic and every piece of state here lives in Learn.tsx. */
export default function SearchBar({
  query, onQueryChange, onSearch, loading, topUploadFileRef, materialsAccept, onTopUpload,
  materialsBusy, showPanels, materialsError, embedPct, embedderReady, resolveMeta, studiedIds, err,
}: SearchBarProps) {
  return (
    <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: BORDER_SOFT, display: 'flex', gap: 10, alignItems: 'center', background: PAGE_BG, flexWrap: 'wrap' }}>
      <input
        className="lrn-input"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        placeholder="Ask anything, or paste a homework question..."
        style={{ flex: 1, minWidth: 220, padding: '13px 17px', borderRadius: 13, border: '1px solid rgba(205,215,238,0.2)', background: 'rgba(205,215,238,0.05)', color: TEXT_PRIMARY, fontSize: 15, fontFamily: FONT_STACK }}
      />
      <button onClick={onSearch} disabled={loading} style={{ padding: '13px 28px', borderRadius: 13, border: 'none', background: '#6366F1', color: 'white', fontWeight: 600, fontSize: 14.5, cursor: loading ? 'default' : 'pointer' }}>
        {loading ? '...' : 'Search'}
      </button>
      <input
        ref={topUploadFileRef}
        type="file"
        accept={materialsAccept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onTopUpload(f)
          e.target.value = ''
        }}
      />
      <button
        onClick={() => topUploadFileRef.current?.click()}
        disabled={!!materialsBusy || loading}
        title="Upload a worksheet and jump straight to it, no typing needed"
        style={{ padding: '13px 20px', borderRadius: 13, border: '1.5px dashed rgba(94,200,240,0.5)', background: 'rgba(94,200,240,0.07)', color: '#5EC8F0', fontWeight: 600, fontSize: 13.5, cursor: materialsBusy || loading ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
      >
        {materialsBusy || 'Upload homework'}
      </button>
      {/* The materials panel's own error line only exists once a concept has
          resolved, so an upload started from here (before anything has
          resolved) needs its own surface, or a failure reads as the button
          just silently doing nothing. */}
      {!showPanels && materialsError && (
        <span style={{ fontSize: 12.5, color: '#FF7B7B', maxWidth: 320, lineHeight: 1.45 }}>{materialsError}</span>
      )}
      {embedPct !== null && embedPct < 100 && !embedderReady && (
        <span style={{ fontSize: 12, color: '#5EC8F0', maxWidth: 360, lineHeight: 1.45 }}>
          Getting the search model ready ({embedPct}%). This is a one-time download that stays cached in your browser, and it runs on your device, so searching costs nothing.
        </span>
      )}
      {resolveMeta && !loading && (
        <span style={{ fontSize: 11.5, color: TEXT_FAINT, whiteSpace: 'nowrap' }}>
          {resolveMeta.indexed} concepts searched in {resolveMeta.totalMs}ms{resolveMeta.coldStart ? ' (cold start)' : ''}
        </span>
      )}
      {studiedIds.length > 0 && (
        <span title={studiedIds.join(', ')} style={{ fontSize: 12, color: '#f2b84b', whiteSpace: 'nowrap' }}>
          ✓ {studiedIds.length} studied
        </span>
      )}
      {err && <p style={{ color: '#FF7B7B', fontSize: 13.5, margin: 0 }}>{err}</p>}
    </div>
  )
}
