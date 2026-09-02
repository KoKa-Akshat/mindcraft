import type { RefObject } from 'react'
import { ACCENT_FOREST, CARD, FONT_STACK, TEXT_FAINT, TEXT_PRIMARY, TEXT_SOFT } from './shared'

export interface EntryStageProps {
  onFocusSearch: () => void
  onUploadHomework: () => void
  nudgeLabel: string | null
  onPracticeNudge: () => void
  // A real, always-visible bottom search bar (2026-09-02 ask: restores what
  // SearchBar.tsx did before Phase G1 folded search into the History panel
  // — that panel is still real and still useful for browsing past sessions,
  // but "Type your own question below" needs an actual input below to be
  // true, not just copy). Same query/runSearch state Learn.tsx already
  // threads to HistorySidebar, not a second search mechanism.
  query: string
  onQueryChange: (v: string) => void
  onSearch: () => void
  searchLoading: boolean
  searchInputRef: RefObject<HTMLInputElement>
}

/** The very first thing a student sees on a blank /learn: a greeting from
 * Jesse and a few real starting points, instead of a bare search box or the
 * raw graph. Purely presentational, every action here just drives the same
 * search/upload/nudge machinery Learn.tsx already had. Sits as an overlay
 * on top of the still-alive graph, same spot RouteCards takes over once a
 * search resolves. */
export default function EntryStage({
  onFocusSearch, onUploadHomework, nudgeLabel, onPracticeNudge,
  query, onQueryChange, onSearch, searchLoading, searchInputRef,
}: EntryStageProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ ...CARD, pointerEvents: 'auto', maxWidth: 480, width: '92%', padding: '26px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 8 }}>Hi, I'm Jesse. What would you like to work on?</div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: TEXT_SOFT }}>
          Ask anything below, or start from one of these.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          <button
            onClick={onFocusSearch}
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(61,107,79,0.35)', background: 'rgba(61,107,79,0.1)', color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Help me learn something new
          </button>
          <button
            onClick={onUploadHomework}
            style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(94,200,240,0.35)', background: 'rgba(94,200,240,0.08)', color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            I have homework to work through
          </button>
          {nudgeLabel && (
            <button
              onClick={onPracticeNudge}
              style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(196,245,71,0.35)', background: 'rgba(196,245,71,0.08)', color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Show me what I'm weak on ({nudgeLabel})
            </button>
          )}
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 11.5, color: TEXT_FAINT }}>The graph behind this is real and live. Type your own question below any time.</p>
      </div>

      {/* full-graph-viewer.html's own coverage-key legend (its own document,
          bottom-left, roughly 110-125px tall — outside React's control) sits
          in the same corner. A centered bar at this width would dip into
          that zone below ~1088px wide (iPad portrait and phone both do), so
          it needs a real breakpoint, not just a fluid width; scoped inline
          <style> since this file has no CSS module of its own. */}
      <style>{`
        .lrn-entry-searchbar { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); }
        @media (max-width: 1088px) {
          .lrn-entry-searchbar { bottom: 150px; }
        }
      `}</style>
      <div
        className="lrn-entry-searchbar"
        style={{
          width: 'min(560px, 92%)', pointerEvents: 'auto',
          display: 'flex', gap: 8, padding: 8, borderRadius: 16,
          background: 'rgba(20,31,24,0.82)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(140,178,150,0.2)', boxShadow: '0 14px 34px rgba(3,8,5,0.4)',
        }}
      >
        <input
          ref={searchInputRef}
          className="lrn-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="What do you want to understand?"
          style={{ flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: 12, border: 'none', background: 'transparent', color: TEXT_PRIMARY, fontSize: 14.5, fontFamily: FONT_STACK, outline: 'none' }}
        />
        <button
          onClick={onSearch}
          disabled={searchLoading}
          style={{ flex: 'none', padding: '12px 22px', borderRadius: 12, border: 'none', background: ACCENT_FOREST, color: 'white', fontWeight: 600, fontSize: 13.5, cursor: searchLoading ? 'default' : 'pointer' }}
        >
          {searchLoading ? '...' : 'Search'}
        </button>
      </div>
    </div>
  )
}
