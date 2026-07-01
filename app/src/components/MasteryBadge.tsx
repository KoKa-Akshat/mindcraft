import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchKnowledgeGraph } from '../lib/graphCache'
import { fetchExamConceptIds } from '../lib/mlApi'
import { mlIdToLabel } from '../lib/conceptMap'
import s from './MasteryBadge.module.css'

type KGNode = { id: string; mastery: number; level: string; status: string }

type Props = { userId: string }

export default function MasteryBadge({ userId }: Props) {
  const [kg, setKg] = useState<{ nodes: KGNode[] } | null>(null)
  const [actIds, setActIds] = useState<Set<string> | null>(null)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userId) return
    void fetchKnowledgeGraph(userId).then(d => {
      if (d?.nodes) setKg({ nodes: d.nodes as KGNode[] })
    })
    void fetchExamConceptIds('ACT').then(ids => setActIds(new Set(ids)))
  }, [userId])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const actNodes = useMemo(() => {
    const nodes = kg?.nodes ?? []
    if (!actIds?.size) return nodes
    return nodes.filter(n => actIds.has(n.id))
  }, [kg, actIds])

  const overallPct = useMemo(() => {
    if (!actNodes.length) return 0
    return Math.round((actNodes.reduce((sum, n) => sum + n.mastery, 0) / actNodes.length) * 100)
  }, [actNodes])

  const breakdown = useMemo(() => {
    return [...actNodes]
      .sort((a, b) => a.mastery - b.mastery)
      .map(n => ({
        id: n.id,
        label: mlIdToLabel(n.id),
        level: n.level?.replace(/_/g, ' ') ?? '',
        pct: Math.round(n.mastery * 100),
      }))
  }, [actNodes])

  if (!userId) return null

  return (
    <div className={s.wrap} ref={wrapRef}>
      <button
        type="button"
        className={s.badge}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className={s.pct}>{overallPct}%</span>
        <span className={s.label}>mastery</span>
      </button>

      {open && (
        <div className={s.panel} role="dialog" aria-label="Mastery breakdown">
          <div className={s.panelHead}>
            <strong>ACT mastery</strong>
            <span>{overallPct}% overall</span>
          </div>
          <ul className={s.list}>
            {breakdown.map(row => (
              <li key={row.id} className={s.row}>
                <span className={s.rowLabel}>{row.label}</span>
                <span className={s.rowMeta}>{row.level}</span>
                <span className={s.rowPct}>{row.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
