import { Bookmark } from 'lucide-react'
import s from './BookmarkButton.module.css'

export default function BookmarkButton({
  active,
  onToggle,
  label = 'Bookmark question',
}: {
  active: boolean
  onToggle: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      className={`${s.btn} ${active ? s.active : ''}`}
      onClick={onToggle}
      aria-label={active ? `Remove ${label.toLowerCase()}` : label}
      title={active ? 'Saved' : label}
    >
      <Bookmark size={16} strokeWidth={1.75} fill={active ? 'currentColor' : 'none'} />
    </button>
  )
}
