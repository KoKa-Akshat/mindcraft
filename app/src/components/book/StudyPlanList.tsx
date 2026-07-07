import { CheckCircle2, Circle, ChevronRight, Milestone } from 'lucide-react'
import s from './Book.module.css'

export type StudyPlanItem = {
  id: string
  label: string
  state: 'done' | 'active' | 'upcoming'
}

/**
 * StudyPlanList — the curated learning route on the right page.
 * A dotted route spine with done / active / upcoming nodes,
 * a progress inkline, and a "now" badge on the active concept.
 */
export default function StudyPlanList({
  title = 'Your route',
  examLabel,
  items,
  progressPct,
  completedCount,
  disabled = false,
  onSelect,
  moreCount = 0,
  onMore,
}: {
  title?: string
  examLabel?: string
  items: StudyPlanItem[]
  progressPct: number
  completedCount: number
  disabled?: boolean
  onSelect: (item: StudyPlanItem) => void
  moreCount?: number
  onMore?: () => void
}) {
  return (
    <div className={s.plan}>
      <div className={s.planHeading}>
        <span className={s.planTitle}>{title}</span>
        {examLabel && <span className={s.planExam}>{examLabel}</span>}
      </div>

      <div className={s.planProgress}>
        <div className={s.planProgressTrack}>
          <div className={s.planProgressFill} style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
        </div>
        <span className={s.planProgressLabel}>
          {completedCount > 0 ? `${completedCount} mastered · ${progressPct}%` : 'just getting started'}
        </span>
      </div>

      <div className={s.planList}>
        {items.map(item => {
          const nodeClass = item.state === 'done'
            ? s.planNodeDone
            : item.state === 'active' ? s.planNodeActive : s.planNodeUpcoming
          const nameClass = item.state === 'done'
            ? s.planRowNameDone
            : item.state === 'active' ? s.planRowNameActive : ''
          return (
            <button
              key={item.id}
              type="button"
              className={s.planRow}
              onClick={() => onSelect(item)}
              disabled={disabled}
              title={`Open ${item.label}`}
            >
              <span className={`${s.planNode} ${nodeClass}`}>
                {item.state === 'done'
                  ? <CheckCircle2 size={19} strokeWidth={1.75} />
                  : item.state === 'active'
                    ? <Milestone size={18} strokeWidth={2} />
                    : <Circle size={16} strokeWidth={1.5} />}
              </span>
              <span className={s.planRowText}>
                <span className={`${s.planRowName} ${nameClass}`} style={{ display: 'block' }}>{item.label}</span>
                <span className={s.planRowMeta} style={{ display: 'block' }}>
                  {item.state === 'done' ? 'mastered' : item.state === 'active' ? 'in progress' : 'up ahead'}
                </span>
              </span>
              {item.state === 'active' && <span className={s.planRowBadge}>now</span>}
              <ChevronRight size={15} strokeWidth={1.75} className={s.planRowChevron} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      {moreCount > 0 && onMore && (
        <button type="button" className={s.planMore} onClick={onMore}>
          +{moreCount} more on the map →
        </button>
      )}
    </div>
  )
}
