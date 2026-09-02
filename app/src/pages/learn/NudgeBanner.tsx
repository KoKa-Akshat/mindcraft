import { TEXT_FAINT } from './shared'

export interface NudgeBannerProps {
  nudge: { conceptId: string; label: string; trapLabel: string }
  onPractice: () => void
  onDismiss: () => void
}

/** Proactive misconception nudge: purely presentational, the fetch that
 * produces `nudge` and the dismiss/practice handlers live in Learn.tsx. */
export default function NudgeBanner({ nudge, onPractice, onDismiss }: NudgeBannerProps) {
  return (
    <div style={{ padding: '12px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: '1px solid rgba(140,178,150,0.16)', background: 'rgba(196,245,71,0.08)' }}>
      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.5 }}>
        <b style={{ color: '#c4f547' }}>Worth a look:</b> {nudge.trapLabel} keeps catching you on <b>{nudge.label}</b>. A quick pass now beats it showing up again later.
      </span>
      <button
        onClick={onPractice}
        style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 9, border: 'none', background: '#c4f547', color: '#0c1207', cursor: 'pointer' }}
      >
        Practice this
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{ flexShrink: 0, fontSize: 12.5, padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(196,245,71,0.35)', background: 'transparent', color: TEXT_FAINT, cursor: 'pointer' }}
      >
        not now
      </button>
    </div>
  )
}
