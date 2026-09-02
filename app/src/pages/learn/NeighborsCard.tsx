import { CARD, Eyebrow, TEXT_FAINT, TEXT_PRIMARY, type NeighborRow } from './shared'

export interface NeighborsCardProps {
  activeLabel: string
  resolvedLabel: string
  neighbors: NeighborRow[]
  isStudied: (id: string) => boolean
  onOpenNeighbor: (id: string) => void
}

/** "Related concepts": real graph edges from the active concept. Purely
 * presentational, the neighbor fetch lives in Learn.tsx's loadContent. */
export default function NeighborsCard({ activeLabel, resolvedLabel, neighbors, isStudied, onOpenNeighbor }: NeighborsCardProps) {
  return (
    <div style={{ ...CARD, padding: '20px 22px', flexShrink: 0 }}>
      <Eyebrow color="#5fa578">Related concepts</Eyebrow>
      <p style={{ margin: '6px 0 12px', fontSize: 13, color: TEXT_FAINT, lineHeight: 1.5 }}>
        Real graph edges from {activeLabel || resolvedLabel}: what comes before it, what it unlocks, and what connects across subjects.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {neighbors.length === 0 && <p style={{ margin: 0, fontSize: 13, color: TEXT_FAINT }}>No graph neighbours recorded for this concept.</p>}
        {neighbors.map((n) => (
          <button
            key={`${n.relation}-${n.id}`}
            className="lrn-neighbor"
            onClick={() => onOpenNeighbor(n.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '11px 13px', borderRadius: 11, border: '1px solid rgba(205,220,208,0.13)', background: 'rgba(205,220,208,0.04)', color: TEXT_PRIMARY, cursor: 'pointer', fontSize: 14 }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              {n.label}
              <span style={{ display: 'block', fontSize: 11.5, color: TEXT_FAINT, marginTop: 2 }}>{n.group}</span>
            </span>
            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: n.relation === 'prerequisite' ? '#8BE85C' : n.relation === 'next' ? '#5fa578' : '#c4f547', border: '1px solid currentColor', borderRadius: 6, padding: '2px 7px', opacity: 0.85 }}>
              {n.relation === 'prerequisite' ? 'BEFORE' : n.relation === 'next' ? 'NEXT' : 'CROSS'}
            </span>
            {isStudied(n.id) && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: '#f2b84b', border: '1px solid rgba(242,184,75,0.4)', borderRadius: 6, padding: '2px 7px' }}>✓</span>}
            {n.hasSim && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: '#F0C060', border: '1px solid rgba(240,192,96,0.4)', borderRadius: 6, padding: '2px 7px' }}>SIM</span>}
            {!n.hasChapter && <span style={{ flexShrink: 0, fontSize: 10.5, color: TEXT_FAINT }}>no chapter yet</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
