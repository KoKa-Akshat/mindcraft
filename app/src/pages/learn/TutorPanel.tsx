import { useEffect, useRef } from 'react'
import MathText from '../../components/MathText'
import { CARD, Eyebrow, TEXT_FAINT, TEXT_PRIMARY, TEXT_SOFT } from './shared'

export interface TutorMessage {
  role: 'user' | 'assistant'
  content: string
  fallback?: boolean
}

export interface TutorPanelProps {
  messages: TutorMessage[]
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  sending: boolean
  error: string
}

/** The Phase 2 guarded tutor chat. Purely presentational, the conversation
 * state, the /api/learn-tutor call, and the hint-reveal action it can
 * trigger all live in Learn.tsx (askTutor in lib/learnTutor.ts). Never
 * gives the final answer, see webhook/lib/handlers/learn-tutor.ts's own
 * guardrail prompt for why.
 *
 * Phase 4 polish: auto-scrolls to the newest message (a restored session
 * from HistorySidebar, or a growing live conversation, both used to leave
 * the student scrolled to wherever they happened to be) and shows a typing
 * indicator while waiting on a reply, so a slower BYOK model does not read
 * as frozen. */
export default function TutorPanel({ messages, input, onInputChange, onSend, sending, error }: TutorPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, sending])

  return (
    <div style={{ ...CARD, padding: '18px 20px', flexShrink: 0 }}>
      <Eyebrow color="#A78BFA">Talk it through with Jesse</Eyebrow>
      <p style={{ margin: '6px 0 12px', fontSize: 12.5, lineHeight: 1.5, color: TEXT_FAINT }}>
        Jesse will never just hand over the answer, tell it what you have tried and it will help you get unstuck.
      </p>
      {(messages.length > 0 || sending) && (
        <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, maxHeight: 360, overflowY: 'auto' }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                padding: '9px 13px',
                borderRadius: 12,
                fontSize: 13.5,
                lineHeight: 1.55,
                background: m.role === 'user' ? 'rgba(99,102,241,0.18)' : m.fallback ? 'rgba(240,192,96,0.1)' : 'rgba(167,139,250,0.1)',
                border: `1px solid ${m.role === 'user' ? 'rgba(99,102,241,0.3)' : m.fallback ? 'rgba(240,192,96,0.3)' : 'rgba(167,139,250,0.3)'}`,
                color: TEXT_PRIMARY,
              }}
            >
              <MathText text={m.content} />
            </div>
          ))}
          {sending && (
            <div
              style={{
                alignSelf: 'flex-start', padding: '9px 13px', borderRadius: 12, fontSize: 13,
                background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: TEXT_FAINT,
              }}
            >
              Jesse is thinking...
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !sending && onSend()}
          placeholder="What have you tried so far?"
          style={{ flex: 1, padding: '10px 13px', borderRadius: 10, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.05)', color: TEXT_PRIMARY, fontSize: 13.5 }}
        />
        <button
          onClick={onSend}
          disabled={sending || !input.trim()}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: sending || !input.trim() ? 'rgba(167,139,250,0.35)' : '#A78BFA', color: '#1E1533', fontWeight: 600, fontSize: 13, cursor: sending || !input.trim() ? 'default' : 'pointer' }}
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
      {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#FF7B7B' }}>{error}</p>}
      <p style={{ margin: '10px 0 0', fontSize: 11, color: TEXT_SOFT }}>
        Runs on the API key you set in Settings, or a shared fallback if you have not set one yet.
      </p>
    </div>
  )
}
