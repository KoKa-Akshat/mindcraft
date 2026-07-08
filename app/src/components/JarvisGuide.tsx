/**
 * JarvisGuide — on-screen Jarvis companion for the field journal.
 * Margin notes per DASHBOARD_NOTEBOOK_SPEC §5.2: pencil italic, ≤12 words,
 * staggered wipe-in, max three visible.
 */
import type { GuideInsight } from '../lib/journalGuide'
import s from './JarvisGuide.module.css'

interface Props {
  insights: GuideInsight[]
  thinking?: boolean
  /** question = left spread; work = right spread margin */
  side?: 'question' | 'work'
  className?: string
}

const KIND_CLASS: Record<GuideInsight['kind'], string> = {
  focus: s.noteFocus,
  nudge: s.noteNudge,
  encourage: s.noteEncourage,
  watch: s.noteWatch,
  read: s.noteRead,
}

export default function JarvisGuide({ insights, thinking = false, side = 'work', className }: Props) {
  if (!insights.length && !thinking) return null

  return (
    <aside
      className={`${s.margin} ${side === 'question' ? s.marginQuestion : s.marginWork} ${className ?? ''}`}
      aria-label="Jarvis margin notes"
    >
      <div className={s.badgeRow}>
        <span className={`${s.badge}${thinking ? ` ${s.badgeThinking}` : ''}`}>jarvis</span>
        {thinking && <span className={s.thinkingDot} aria-hidden />}
      </div>

      <ul className={s.noteList}>
        {insights.map((note, i) => (
          <li
            key={note.id}
            className={`${s.note} ${KIND_CLASS[note.kind]}`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className={s.hook} aria-hidden />
            {note.text}
          </li>
        ))}
      </ul>
    </aside>
  )
}
