/**
 * WorldPreview.tsx
 *
 * Unauthenticated preview route for MindCraftWorldScene (src/world), so the
 * scene can be reviewed live before any decision is made about replacing
 * the current post-login landing with it. Not wired into real login,
 * real feature panels, or postLogin.ts routing, on purpose: this is a
 * direction-setting preview, same spirit as the earlier standalone Desk OS
 * room prototype, just inside the real app this time since this component
 * already lives in src/world.
 */

import { useEffect, useState } from 'react'
import MindCraftWorldScene, { WorldMode, WorldObjectId } from '../world/MindCraftWorldScene'

const PANEL_COPY: Record<Exclude<WorldObjectId, 'door'>, { kicker: string; title: string; body: string }> = {
  desk: {
    kicker: 'Careers office',
    title: 'Resume Helper',
    body: 'Draft a resume and cover letter with Jesse, tailored to a real role you paste in.',
  },
  library: {
    kicker: 'Research library',
    title: 'Learn',
    body: 'Your live knowledge map. Ask Jesse anything and watch the graph grow around it.',
  },
  plant: {
    kicker: 'Living systems lab',
    title: 'Sim Studio',
    body: 'Wire small experiments together, sun to shade to plant, and watch each value travel live.',
  },
  hearth: {
    kicker: 'Learning hearth',
    title: 'Pick up where you left off',
    body: 'A warm spot for your last conversation with Jesse and anything still open.',
  },
  book: {
    kicker: 'Book atelier',
    title: 'Your book',
    body: 'The book Jesse is building with you, chapter by chapter, from what you have studied.',
  },
  missions: {
    kicker: 'Today board',
    title: "Today's missions",
    body: 'What is worth doing today, picked from what you have been learning this week.',
  },
  'data-center': {
    kicker: 'Outside, simulation building',
    title: 'Data center simulation',
    body: 'A bigger, systems-level sim: many small parts, one live simulation.',
  },
  observatory: {
    kicker: 'Outside, simulation building',
    title: 'Pattern observatory',
    body: 'Spot the pattern across many examples at once, built for the concepts that need it.',
  },
  workshop: {
    kicker: 'Outside, simulation building',
    title: 'Build workshop',
    body: 'The real Sim Studio workbench: parts bin, wiring board, and Invent a sim.',
  },
}

export default function WorldPreview() {
  const [mode, setMode] = useState<WorldMode>('room')
  const [night, setNight] = useState(false)
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null)
  const [panel, setPanel] = useState<WorldObjectId | null>(null)

  // The only other way to close the panel is clicking the small X or the
  // dimmed area beside it, neither of which is obvious on its own (real
  // feedback: "how do I leave the building and walk around").
  useEffect(() => {
    if (!panel) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel])

  const handleHover = (label: string | null, x?: number, y?: number) => {
    if (!label || x === undefined || y === undefined) {
      setHover(null)
      return
    }
    setHover({ label, x, y })
  }

  const activeCopy = panel && panel !== 'door' ? PANEL_COPY[panel] : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#c6e9ef', overflow: 'hidden' }}>
      <MindCraftWorldScene
        mode={mode}
        night={night}
        onModeChange={setMode}
        onInteract={(id) => setPanel(id)}
        onHover={handleHover}
      />

      <div
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 5,
          padding: '8px 12px',
          border: '2px solid #143a2e',
          borderRadius: 8,
          background: 'rgba(255, 253, 248, 0.9)',
          backdropFilter: 'blur(6px)',
          boxShadow: '3px 3px 0 rgba(20, 58, 46, 0.25)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <strong style={{ display: 'block', fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 15, color: '#143a2e' }}>
          The Desk, a room
        </strong>
        <span style={{ display: 'block', marginTop: 2, fontSize: 11, fontWeight: 600, color: '#52675f' }}>
          Preview, drag to look around, WASD to walk, click the door to go outside
        </span>
      </div>

      <button
        type="button"
        onClick={() => setNight((n) => !n)}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 5,
          padding: '8px 14px',
          border: '2px solid #143a2e',
          borderRadius: 8,
          background: 'rgba(255, 253, 248, 0.9)',
          backdropFilter: 'blur(6px)',
          boxShadow: '3px 3px 0 rgba(20, 58, 46, 0.25)',
          font: '700 11px/1 -apple-system, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          color: '#143a2e',
          cursor: 'pointer',
        }}
      >
        {night ? 'Day' : 'Night'}
      </button>

      {hover && !panel && (
        <div
          style={{
            position: 'fixed',
            left: hover.x,
            top: hover.y,
            transform: 'translate(-50%, -140%)',
            zIndex: 4,
            padding: '4px 9px',
            border: '2px solid #143a2e',
            borderRadius: 6,
            background: '#fffdf8',
            color: '#143a2e',
            font: '750 11px/1 -apple-system, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            boxShadow: '3px 3px 0 rgba(20, 58, 46, 0.3)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {hover.label}
        </div>
      )}

      {activeCopy && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(20, 58, 46, 0.28)',
          }}
          onClick={() => setPanel(null)}
        >
          <div
            style={{
              width: 'min(420px, 92vw)',
              height: '100%',
              background: '#fffdf8',
              borderLeft: '2px solid #143a2e',
              boxShadow: '-10px 0 0 rgba(20, 58, 46, 0.12)',
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ margin: '0 0 6px', font: '800 10px/1 sans-serif', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#247a4d' }}>
                  {activeCopy.kicker}
                </p>
                <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 30, lineHeight: 1.05, color: '#143a2e' }}>
                  {activeCopy.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label="Close"
                style={{
                  flex: 'none',
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid #143a2e',
                  borderRadius: 6,
                  background: '#fffdf8',
                  color: '#143a2e',
                  cursor: 'pointer',
                }}
              >
                &#10005;
              </button>
            </div>
            <p style={{ color: '#52675f', font: '550 14.5px/1.55 sans-serif' }}>{activeCopy.body}</p>
            <button
              type="button"
              onClick={() => setPanel(null)}
              style={{
                alignSelf: 'flex-start',
                padding: '9px 14px',
                border: '1px solid #143a2e',
                borderRadius: 8,
                background: '#fffdf8',
                color: '#143a2e',
                font: '700 12px/1 sans-serif',
                cursor: 'pointer',
              }}
            >
              &larr; Back to the world
            </button>
            <p
              style={{
                marginTop: 'auto',
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(229, 187, 67, 0.18)',
                border: '1px solid rgba(20, 58, 46, 0.15)',
                font: '600 12px/1.4 sans-serif',
                color: '#143a2e',
              }}
            >
              Preview note: this panel is a placeholder. The real version would open the actual Resume Helper, Learn, or Sim
              Studio panel here.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
