import { useEffect } from 'react'
import type { RefObject } from 'react'
import { BORDER_SOFT, CARD, TEXT_FAINT, TEXT_PRIMARY, TEXT_SOFT } from './shared'
import type { LearnSessionSummary } from '../../lib/learnSessions'

export interface HistorySidebarProps {
  sessions: LearnSessionSummary[]
  loading: boolean
  open: boolean
  onToggle: () => void
  onOpenSession: (conceptId: string, conceptLabel: string) => void
  activeConceptId: string | null
  topUploadFileRef: RefObject<HTMLInputElement>
  materialsAccept: string
  onTopUpload: (file: File) => void
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
 * Jesse about." Phase G1 (2026-09-02) folded the search/upload bar into this
 * same panel; this pass (same day, later) pulls search back out into
 * EntryStage's own real bottom bar (which also fixed backToGraph() to
 * reliably land back on that screen, so a second search entry point here is
 * no longer needed anywhere) and strips this panel down to what the founder
 * actually asked for: just the past prompts you've sent, nothing else. The
 * upload file input stays mounted here (hidden, no visual footprint) since
 * EntryStage's "I have homework" button still triggers it via this same
 * ref, open or collapsed. */
export default function HistorySidebar({
  sessions, loading, open, onToggle, onOpenSession, activeConceptId,
  topUploadFileRef, materialsAccept, onTopUpload,
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
        {sessions.length > 0 ? `History (${sessions.length})` : 'History'}
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
          <div onClick={onToggle} style={{ flex: 1, background: 'transparent' }} />
          <div style={{ ...CARD, width: 340, maxWidth: '88%', height: '100%', borderRadius: 0, borderLeft: BORDER_SOFT, display: 'flex', flexDirection: 'column', padding: '60px 0 16px' }}>
            <div style={{ padding: '0 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>History</div>
              <button onClick={onToggle} style={{ background: 'none', border: 'none', color: TEXT_FAINT, fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>×</button>
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
