/**
 * Full-canvas ACT topic map — constellation-style layout with cute emoji nodes.
 */
import { useMemo, useState } from 'react'
import { ACT_TOC_SECTIONS, actConceptLabel, actFrequency } from '../../lib/actToc'
import { topicEmoji } from '../../lib/actTopicEmojis'
import s from './ActEmojiMap.module.css'

type Props = {
  sparkId?: string | null
  onOpenLesson: (conceptId: string) => void
}

/** Deterministic pseudo-positions so the map feels like a sky, not a list. */
function place(id: string, index: number, total: number) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const ring = 0.22 + (index / Math.max(1, total - 1)) * 0.55
  const angle = ((h % 360) * Math.PI) / 180 + index * 0.55
  const x = 50 + Math.cos(angle) * ring * 42
  const y = 48 + Math.sin(angle) * ring * 38
  return {
    left: `${Math.min(92, Math.max(8, x))}%`,
    top: `${Math.min(88, Math.max(10, y))}%`,
  }
}

export default function ActEmojiMap({ sparkId, onOpenLesson }: Props) {
  const [focus, setFocus] = useState(sparkId ?? '')
  const [q, setQ] = useState('')

  const nodes = useMemo(() => {
    const all = ACT_TOC_SECTIONS.flatMap(sec =>
      sec.conceptIds.map(id => ({ id, section: sec.title })),
    ).sort((a, b) => actFrequency(b.id) - actFrequency(a.id))
    const needle = q.trim().toLowerCase()
    return all.filter(n => {
      if (!needle) return true
      return actConceptLabel(n.id).toLowerCase().includes(needle) || n.id.includes(needle)
    })
  }, [q])

  return (
    <div className={s.root}>
      <div className={s.top}>
        <input
          className={s.search}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Find a topic…"
          aria-label="Find topic"
        />
      </div>

      <div className={s.sky} aria-label="ACT topic map">
        {nodes.map((n, i) => {
          const pos = place(n.id, i, nodes.length)
          const isSpark = n.id === sparkId
          const isFocus = n.id === focus
          return (
            <button
              key={n.id}
              type="button"
              className={[
                s.node,
                isSpark ? s.nodeSpark : '',
                isFocus ? s.nodeFocus : '',
              ].filter(Boolean).join(' ')}
              style={pos}
              onClick={() => setFocus(n.id)}
              onDoubleClick={() => onOpenLesson(n.id)}
              title={actConceptLabel(n.id)}
            >
              <span className={s.emoji} aria-hidden>{topicEmoji(n.id)}</span>
              <span className={s.label}>{actConceptLabel(n.id)}</span>
            </button>
          )
        })}
        <svg className={s.links} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {nodes.slice(0, 12).map((n, i) => {
            const a = place(n.id, i, nodes.length)
            const b = place(nodes[(i + 3) % nodes.length].id, (i + 3) % nodes.length, nodes.length)
            return (
              <line
                key={n.id}
                x1={parseFloat(a.left)}
                y1={parseFloat(a.top)}
                x2={parseFloat(b.left)}
                y2={parseFloat(b.top)}
                className={s.link}
              />
            )
          })}
        </svg>
      </div>

      {focus && (
        <div className={s.dock}>
          <span className={s.dockEmoji}>{topicEmoji(focus)}</span>
          <span className={s.dockName}>{actConceptLabel(focus)}</span>
          {focus === sparkId && <span className={s.dockHint}>study this next</span>}
          <button type="button" className={s.dockGo} onClick={() => onOpenLesson(focus)}>
            Open lesson →
          </button>
        </div>
      )}
    </div>
  )
}
