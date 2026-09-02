import { CARD, TEXT_FAINT, TEXT_PRIMARY, TEXT_SOFT } from './shared'

export interface RouteCardsProps {
  resolvedLabel: string
  hasFoundation: boolean
  foundationLabel: string | undefined
  rampLength: number
  personalizedLabel: string | null
  personalizedTrapLabel: string | null
  onPickFoundation: () => void
  onPickDirect: () => void
  onPickPersonalized: () => void
  onUploadInstead: () => void
}

const ZONE_STYLE = {
  comfort: { color: '#8BE85C', label: 'COMFORT ZONE' },
  proximal: { color: '#58CC02', label: 'PROXIMAL ZONE' },
  trap: { color: '#c4f547', label: 'WORTH FIXING' },
}

function RouteCard({
  zone, title, detail, onClick,
}: { zone: keyof typeof ZONE_STYLE; title: string; detail: string; onClick: () => void }) {
  const z = ZONE_STYLE[zone]
  return (
    <button
      onClick={onClick}
      style={{
        ...CARD, textAlign: 'left', cursor: 'pointer', padding: '18px 20px', flex: '1 1 220px', minWidth: 200,
        border: `1px solid ${z.color}55`, display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: z.color }}>{z.label}</span>
      <span style={{ fontSize: 15.5, fontWeight: 700, color: TEXT_PRIMARY }}>{title}</span>
      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: TEXT_FAINT }}>{detail}</span>
    </button>
  )
}

/** Three real routes into a resolved concept, drawn from real data (the
 * prerequisite ramp, the resolve match, and the same misconceptionGaps the
 * nudge banner uses), instead of jumping straight to content. Purely
 * presentational, Learn.tsx owns picking a route (loading content, moving
 * the path index, revealing the panels). */
export default function RouteCards({
  resolvedLabel, hasFoundation, foundationLabel, rampLength, personalizedLabel, personalizedTrapLabel,
  onPickFoundation, onPickDirect, onPickPersonalized, onUploadInstead,
}: RouteCardsProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ ...CARD, pointerEvents: 'auto', maxWidth: 760, width: '94%', padding: '24px 26px' }}>
        <div style={{ fontSize: 16.5, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>A few ways in</div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: TEXT_SOFT }}>
          "{resolvedLabel}" is where that resolved to. Pick where you actually want to start.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          {hasFoundation && foundationLabel && (
            <RouteCard
              zone="comfort"
              title={`Start at the foundation: ${foundationLabel}`}
              detail={`${rampLength - 1} prerequisite step${rampLength - 1 === 1 ? '' : 's'} away from "${resolvedLabel}". Build up from what you already have.`}
              onClick={onPickFoundation}
            />
          )}
          <RouteCard
            zone="proximal"
            title={`Go straight to ${resolvedLabel}`}
            detail="Skip the ramp and read this concept directly."
            onClick={onPickDirect}
          />
          {personalizedLabel ? (
            <RouteCard
              zone="trap"
              title={`Beat the trap on ${personalizedLabel}`}
              detail={`${personalizedTrapLabel || 'A familiar trap'} keeps catching you here. Worth a real pass.`}
              onClick={onPickPersonalized}
            />
          ) : (
            <RouteCard
              zone="trap"
              title="Working from a worksheet instead?"
              detail="Upload it and every question becomes its own path in, with hints and a sim if one exists."
              onClick={onUploadInstead}
            />
          )}
        </div>
      </div>
    </div>
  )
}
