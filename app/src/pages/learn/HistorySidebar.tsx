import { useEffect } from 'react'
import type { RefObject } from 'react'
import { BORDER_SOFT, CARD, FONT_STACK, TEXT_FAINT, TEXT_PRIMARY, TEXT_SOFT } from './shared'
import type { LearnSessionSummary } from '../../lib/learnSessions'

export interface HistorySidebarProps {
  sessions: LearnSessionSummary[]
  loading: boolean
  open: boolean
  onToggle: () => void
  onOpenSession: (conceptId: string, conceptLabel: string) => void
  activeConceptId: string | null
  // Search + upload (Phase G1: moved off the bottom bar and into this panel,
  // which now opens by default instead of the old flyout-on-demand menu).
  query: string
  onQueryChange: (v: string) => void
  onSearch: () => void
  searchLoading: boolean
  inputRef: RefObject<HTMLInputElement>
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
  searchErr: string
}

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

/** Phase 3 built this as a toggle + flyout for "what have I been talking to
 * Jesse about." Phase G1 (2026-09-02) folds the search/upload bar that used
 * to run across the bottom of the whole page into the same panel instead,
 * and flips the default to open: a fresh /learn opens with this panel
 * showing, search focused, so a student can start typing immediately
 * instead of hunting for a bottom bar. Learn.tsx auto-collapses it the
 * moment a concept actually reveals (see the panelsRevealed effect there),
 * so the reading/sim area gets full width once there is something to read;
 * the toggle button here is always visible to bring it back. The upload
 * file input stays mounted outside the open-only block below so
 * EntryStage's "I have homework" button can trigger it via ref even while
 * this panel is collapsed. */
export default function HistorySidebar({
  sessions, loading, open, onToggle, onOpenSession, activeConceptId,
  query, onQueryChange, onSearch, searchLoading, inputRef, topUploadFileRef, materialsAccept, onTopUpload,
  materialsBusy, showPanels, materialsError, embedPct, embedderReady, resolveMeta, studiedIds, searchErr,
}: HistorySidebarProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggle() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onToggle])

  return (
    <>
      <button
        onClick={onToggle}
        style={{
          position: 'absolute', top: 16, left: 16, zIndex: 6,
          padding: '9px 14px', borderRadius: 999,
          border: BORDER_SOFT, background: 'rgba(20,31,24,0.9)', backdropFilter: 'blur(6px)',
          color: TEXT_PRIMARY, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        {sessions.length > 0 ? `History (${sessions.length})` : 'Search'}
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

      {open && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex' }}>
          {/* Open by default now, alongside EntryStage/RouteCards, not just as
              an on-demand modal, so this stays a transparent click-outside
              target rather than a dark scrim that would dim whatever else is
              on screen behind it. */}
          <div onClick={onToggle} style={{ flex: 1, background: 'transparent' }} />
          <div style={{ ...CARD, width: 340, maxWidth: '88%', height: '100%', borderRadius: 0, borderLeft: BORDER_SOFT, display: 'flex', flexDirection: 'column', padding: '60px 0 16px' }}>
            <div style={{ padding: '0 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>Ask Jesse</div>
              <button onClick={onToggle} style={{ background: 'none', border: 'none', color: TEXT_FAINT, fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '0 18px 16px', borderBottom: BORDER_SOFT, marginBottom: 4 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={inputRef}
                  className="lrn-input"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                  placeholder="Ask anything, or paste a homework question..."
                  style={{ flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(205,220,208,0.2)', background: 'rgba(205,220,208,0.05)', color: TEXT_PRIMARY, fontSize: 14, fontFamily: FONT_STACK }}
                />
                <button onClick={onSearch} disabled={searchLoading} style={{ padding: '12px 18px', borderRadius: 12, border: 'none', background: '#3d6b4f', color: 'white', fontWeight: 600, fontSize: 13.5, cursor: searchLoading ? 'default' : 'pointer' }}>
                  {searchLoading ? '...' : 'Go'}
                </button>
              </div>
              <button
                onClick={() => topUploadFileRef.current?.click()}
                disabled={!!materialsBusy || searchLoading}
                title="Upload a worksheet and jump straight to it, no typing needed"
                style={{ marginTop: 8, width: '100%', padding: '11px 16px', borderRadius: 12, border: '1.5px dashed rgba(94,200,240,0.5)', background: 'rgba(94,200,240,0.07)', color: '#5EC8F0', fontWeight: 600, fontSize: 13, cursor: materialsBusy || searchLoading ? 'default' : 'pointer' }}
              >
                {materialsBusy || 'Upload homework'}
              </button>
              {/* The materials panel's own error line only exists once a concept
                  has resolved, so an upload started from here (before anything
                  has resolved) needs its own surface, or a failure reads as the
                  button just silently doing nothing. */}
              {!showPanels && materialsError && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#FF7B7B', lineHeight: 1.45 }}>{materialsError}</p>
              )}
              {embedPct !== null && embedPct < 100 && !embedderReady && (
                <p style={{ margin: '8px 0 0', fontSize: 11.5, color: '#5EC8F0', lineHeight: 1.45 }}>
                  Getting the search model ready ({embedPct}%). One-time download, cached in your browser, runs on your device.
                </p>
              )}
              {resolveMeta && !searchLoading && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: TEXT_FAINT }}>
                  {resolveMeta.indexed} concepts searched in {resolveMeta.totalMs}ms{resolveMeta.coldStart ? ' (cold start)' : ''}
                </p>
              )}
              {studiedIds.length > 0 && (
                <p title={studiedIds.join(', ')} style={{ margin: '8px 0 0', fontSize: 11.5, color: '#f2b84b' }}>
                  ✓ {studiedIds.length} studied
                </p>
              )}
              {searchErr && <p style={{ margin: '8px 0 0', color: '#FF7B7B', fontSize: 12.5 }}>{searchErr}</p>}
            </div>

            <div style={{ padding: '12px 18px 6px', fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: TEXT_FAINT }}>
              Your sessions
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
              {loading && sessions.length === 0 && (
                <p style={{ padding: '20px 8px', fontSize: 12.5, color: TEXT_FAINT }}>Loading...</p>
              )}
              {!loading && sessions.length === 0 && (
                <p style={{ padding: '20px 8px', fontSize: 12.5, lineHeight: 1.6, color: TEXT_FAINT }}>
                  Nothing yet. Once you talk to Jesse about a concept, it shows up here so you can pick up where you left off.
                </p>
              )}
              {sessions.map((s) => (
                <button
                  key={s.conceptId}
                  onClick={() => onOpenSession(s.conceptId, s.conceptLabel)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '11px 12px', marginBottom: 6,
                    borderRadius: 10, cursor: 'pointer',
                    border: s.conceptId === activeConceptId ? '1px solid rgba(196,245,71,0.5)' : '1px solid transparent',
                    background: s.conceptId === activeConceptId ? 'rgba(196,245,71,0.12)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 3 }}>{s.conceptLabel}</div>
                  <div style={{ fontSize: 11.5, color: TEXT_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.lastRole === 'user' ? 'You: ' : 'Jesse: '}{s.lastMessage}
                  </div>
                  <div style={{ fontSize: 10.5, color: TEXT_FAINT, marginTop: 3 }}>{timeAgo(s.updatedAt)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
