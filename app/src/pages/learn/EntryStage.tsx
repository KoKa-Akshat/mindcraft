import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCENT_FOREST, CARD, FONT_STACK, TEXT_FAINT, TEXT_PRIMARY, TEXT_SOFT } from './shared'
import { askLearnScope, type ScopeTurn } from '../../lib/learnScope'

export interface EntryStageProps {
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
  // Takes an explicit override so Vocal Practice can search the transcript
  // it just heard without racing onQueryChange's own state update (calling
  // onQueryChange then a no-arg onSearch in the same tick would still read
  // the PREVIOUS query from a stale closure; runSearch already accepts an
  // explicit text argument in Learn.tsx, this just threads it through).
  onSearch: (text?: string) => void
  searchLoading: boolean
  searchInputRef: RefObject<HTMLInputElement>
}

type Mode = 'default' | 'scope'

const OPTION_BTN_BASE = { textAlign: 'left' as const, padding: '14px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' as const }

const SCOPE_OPENING = 'What are you preparing for, or what do you want to learn?'

/** The very first thing a student sees on a blank /learn: a greeting from
 * Jesse and a few real starting points, instead of a bare search box or the
 * raw graph. Sits as an overlay on top of the still-alive graph, same spot
 * RouteCards takes over once a search resolves.
 *
 * "Help me learn something new" (2026-09-03 ask) goes straight into the
 * scope conversation below, no chooser step first: Jesse asks what the
 * student is preparing for, then real follow-ups, until the moment it
 * resolves, when it opens that concept as a living book (see
 * pages/learn/BookReader.tsx) instead of returning to the graph. */
export default function EntryStage({
  onUploadHomework, nudgeLabel, onPracticeNudge,
  query, onQueryChange, onSearch, searchLoading, searchInputRef,
}: EntryStageProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('default')

  // Fun Lessons (2026-09-02 ask): Jesse asks what the student is preparing
  // for, then real follow-ups, until it knows enough to search — not a
  // single-shot "type your topic" box. scopeHistory is the full exchange so
  // far (both sides), sent back each turn the same stateless way every
  // other conversational handler here already works; the actual "what to
  // teach" decision always stays with the real search once ready fires,
  // this conversation only ever refines the query string.
  const [scopeHistory, setScopeHistory] = useState<ScopeTurn[]>([])
  const [scopeInput, setScopeInput] = useState('')
  const [scopeLoading, setScopeLoading] = useState(false)
  const [scopeError, setScopeError] = useState('')
  const scopeInputRef = useRef<HTMLInputElement>(null)

  function startScope() {
    setScopeHistory([{ role: 'jesse', text: SCOPE_OPENING }])
    setScopeInput('')
    setScopeError('')
    setMode('scope')
    window.setTimeout(() => scopeInputRef.current?.focus(), 60)
  }

  async function submitScope() {
    const text = scopeInput.trim()
    if (!text || scopeLoading) return
    const nextHistory: ScopeTurn[] = [...scopeHistory, { role: 'user', text }]
    setScopeHistory(nextHistory)
    setScopeInput('')
    setScopeLoading(true)
    setScopeError('')
    try {
      const result = await askLearnScope(text, scopeHistory)
      if (result.ready) {
        navigate(`/learn/book?topic=${encodeURIComponent(result.searchQuery || text)}`)
        return
      }
      setScopeHistory([...nextHistory, { role: 'jesse', text: result.reply }])
      window.setTimeout(() => scopeInputRef.current?.focus(), 60)
    } catch {
      setScopeError("Could not reach Jesse. Try again, or type your question in the bar below.")
    } finally {
      setScopeLoading(false)
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ ...CARD, pointerEvents: 'auto', maxWidth: 480, width: '92%', padding: '26px 28px', textAlign: 'center' }}>
        {mode === 'default' && (
          <>
            <div style={{ fontSize: 19, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 8 }}>Hi, I'm Jesse. What would you like to work on?</div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: TEXT_SOFT }}>
              Ask anything below, or start from one of these.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
              <button
                onClick={startScope}
                style={{ ...OPTION_BTN_BASE, border: '1px solid rgba(61,107,79,0.35)', background: 'rgba(61,107,79,0.1)', color: TEXT_PRIMARY }}
              >
                Help me learn something new
              </button>
              <button
                onClick={() => navigate('/learn/book?mode=homework')}
                style={{ ...OPTION_BTN_BASE, border: '1px solid rgba(94,200,240,0.35)', background: 'rgba(94,200,240,0.08)', color: TEXT_PRIMARY }}
              >
                I have homework to work through
              </button>
              {nudgeLabel && (
                <button
                  onClick={onPracticeNudge}
                  style={{ ...OPTION_BTN_BASE, border: '1px solid rgba(196,245,71,0.35)', background: 'rgba(196,245,71,0.08)', color: TEXT_PRIMARY }}
                >
                  Show me what I'm weak on ({nudgeLabel})
                </button>
              )}
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 11.5, color: TEXT_FAINT }}>The graph behind this is real and live. Type your own question below any time.</p>
          </>
        )}

        {mode === 'scope' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 180, overflowY: 'auto', textAlign: 'left' }}>
              {scopeHistory.map((turn, i) => (
                <p key={i} style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: turn.role === 'jesse' ? TEXT_PRIMARY : TEXT_SOFT }}>
                  <strong style={{ color: turn.role === 'jesse' ? ACCENT_FOREST : TEXT_FAINT, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {turn.role === 'jesse' ? 'Jesse' : 'You'}
                  </strong>
                  <br />
                  {turn.text}
                </p>
              ))}
              {scopeLoading && <p style={{ margin: 0, fontSize: 12.5, color: TEXT_FAINT }}>Jesse is thinking...</p>}
            </div>
            {scopeError && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#FF7B7B' }}>{scopeError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={scopeInputRef}
                className="lrn-input"
                value={scopeInput}
                onChange={(e) => setScopeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitScope()}
                placeholder="Type your answer..."
                disabled={scopeLoading}
                style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(140,178,150,0.25)', background: 'rgba(205,220,208,0.05)', color: TEXT_PRIMARY, fontSize: 14, fontFamily: FONT_STACK, outline: 'none' }}
              />
              <button onClick={submitScope} disabled={scopeLoading || !scopeInput.trim()} style={{ flex: 'none', padding: '11px 18px', borderRadius: 12, border: 'none', background: ACCENT_FOREST, color: 'white', fontWeight: 600, fontSize: 13, cursor: scopeLoading ? 'default' : 'pointer' }}>
                {scopeLoading ? '...' : 'Send'}
              </button>
            </div>
            <button
              onClick={() => setMode('default')}
              style={{ marginTop: 14, background: 'none', border: 'none', color: TEXT_FAINT, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Back
            </button>
          </>
        )}
      </div>

      {mode === 'default' && (
        <div
          style={{
            position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)',
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
            onClick={() => onSearch()}
            disabled={searchLoading}
            style={{ flex: 'none', padding: '12px 22px', borderRadius: 12, border: 'none', background: ACCENT_FOREST, color: 'white', fontWeight: 600, fontSize: 13.5, cursor: searchLoading ? 'default' : 'pointer' }}
          >
            {searchLoading ? '...' : 'Search'}
          </button>
        </div>
      )}
    </div>
  )
}
