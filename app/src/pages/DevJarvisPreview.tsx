// THROWAWAY dev preview route — proves the semantic bridge end to end with
// REAL matched content (real chapter text, real self-contained sim HTML),
// not mocked data. Bundle built tonight from the live 42-concept act-math
// ontology matched against the 13-subject chapter/sim library via
// embedding similarity (see semantic_bridge.py). Delete this file and its
// route in App.tsx when done.
import { useState } from 'react'
import bundle from '../data/jarvisDemoBundle.json'

interface DemoEntry {
  actMathConceptId: string
  actMathLabel: string
  chapterScore: number
  chapterTitle: string
  chapterSummary: string
  chapterBody: string
  simScore: number | null
  simTitle: string | null
  simHtml: string | null
}

const entries = bundle as DemoEntry[]

export default function DevJarvisPreview() {
  const [idx, setIdx] = useState(0)
  const entry = entries[idx]

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', color: 'white', fontFamily: 'system-ui', padding: 20 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>JARVIS pane — dev preview (real matched content)</h2>
        {entries.map((e, i) => (
          <button
            key={e.actMathConceptId}
            onClick={() => setIdx(i)}
            style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              border: i === idx ? '1.5px solid #6366F1' : '1px solid rgba(255,255,255,0.2)',
              background: i === idx ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: 'white', fontSize: 13,
            }}
          >
            {e.actMathLabel}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
        Resolved concept: <b>{entry.actMathLabel}</b> (act-math ontology, the same id the live ingredient pipeline classifies an uploaded problem into)
        {' · '}chapter match {(entry.chapterScore * 100).toFixed(0)}%
        {entry.simScore != null && <> · sim match {(entry.simScore * 100).toFixed(0)}%</>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: entry.simHtml ? '1fr 1fr' : '1fr', gap: 16, height: 600 }}>
        {entry.simHtml && (
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.04)', color: '#F0C060' }}>
              LEFT · {entry.simTitle}
            </div>
            <iframe
              title="matched-sim"
              srcDoc={entry.simHtml}
              style={{ flex: 1, border: 'none', background: 'white' }}
              sandbox="allow-scripts"
            />
          </div>
        )}

        <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.04)', color: '#58CC02' }}>
            RIGHT · {entry.chapterTitle}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', fontSize: 14, lineHeight: 1.6 }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>{entry.chapterSummary}</p>
            {entry.chapterBody.split('\n\n').map((para, i) => (
              <p key={i} style={{ marginBottom: 12 }}>{para}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
