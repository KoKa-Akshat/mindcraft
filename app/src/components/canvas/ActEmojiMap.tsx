/**
 * Full-canvas ACT topic map  -  spread constellation, icons only (name in dock).
 */
import { useMemo, useState } from 'react'
import { ACT_TOC_SECTIONS, actConceptLabel } from '../../lib/actToc'
import { conceptIconUrl } from '../../lib/conceptIcon'
import s from './ActEmojiMap.module.css'

type Props = {
  sparkId?: string | null
  onOpenLesson: (conceptId: string) => void
}

type Placed = {
  id: string
  section: string
  x: number
  y: number
}

/** Spread nodes by TOC section so edges read clearly  -  no pile-up in the middle. */
function layoutNodes(): Placed[] {
  const out: Placed[] = []
  const sections = ACT_TOC_SECTIONS.filter(sec => sec.conceptIds.length > 0)
  const nSec = sections.length

  sections.forEach((sec, si) => {
    const ids = sec.conceptIds
    const colX = nSec <= 1 ? 50 : 10 + (si / (nSec - 1)) * 80
    const count = ids.length
    ids.forEach((id, ti) => {
      // Zigzag within the section column so neighbors stay far apart
      const row = Math.floor(ti / 2)
      const side = ti % 2 === 0 ? -1 : 1
      const rowSpan = Math.max(1, Math.ceil(count / 2) - 1)
      const y = 14 + (rowSpan === 0 ? 0 : (row / rowSpan) * 72)
      const x = colX + side * (6 + (ti % 3) * 2.2)
      out.push({
        id,
        section: sec.title,
        x: Math.min(94, Math.max(6, x)),
        y: Math.min(88, Math.max(10, y)),
      })
    })
  })
  return out
}

function edgesFor(nodes: Placed[]): Array<[Placed, Placed]> {
  const bySection = new Map<string, Placed[]>()
  for (const n of nodes) {
    const list = bySection.get(n.section) ?? []
    list.push(n)
    bySection.set(n.section, list)
  }
  const edges: Array<[Placed, Placed]> = []
  for (const list of bySection.values()) {
    for (let i = 0; i < list.length - 1; i++) {
      edges.push([list[i], list[i + 1]])
    }
  }
  // Soft bridges between section hubs (first node of each)
  const hubs = [...bySection.values()].map(list => list[0]).filter(Boolean)
  for (let i = 0; i < hubs.length - 1; i++) {
    edges.push([hubs[i], hubs[i + 1]])
  }
  return edges
}

export default function ActEmojiMap({ sparkId, onOpenLesson }: Props) {
  const [focus, setFocus] = useState(sparkId ?? '')
  const [q, setQ] = useState('')

  const all = useMemo(() => layoutNodes(), [])

  const nodes = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return all
    return all.filter(n => {
      const label = actConceptLabel(n.id).toLowerCase()
      return label.includes(needle) || n.id.includes(needle) || n.section.toLowerCase().includes(needle)
    })
  }, [all, q])

  const links = useMemo(() => edgesFor(nodes), [nodes])

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
        <p className={s.hint}>tap an icon · double-tap to open</p>
      </div>

      <div className={s.sky} aria-label="ACT topic map">
        <svg className={s.links} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {links.map(([a, b]) => (
            <line
              key={`${a.id}-${b.id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={s.link}
            />
          ))}
        </svg>

        {nodes.map(n => {
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
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
              onClick={() => setFocus(n.id)}
              onDoubleClick={() => onOpenLesson(n.id)}
              title={actConceptLabel(n.id)}
              aria-label={actConceptLabel(n.id)}
            >
              <img className={s.emoji} src={conceptIconUrl(n.id)} alt="" draggable={false} />
            </button>
          )
        })}
      </div>

      {focus && (
        <div className={s.dock}>
          <img className={s.dockEmoji} src={conceptIconUrl(focus)} alt="" draggable={false} />
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
