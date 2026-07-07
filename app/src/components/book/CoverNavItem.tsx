import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import s from './Book.module.css'

/**
 * CoverNavItem — a premium chapter entry on the book's cover page.
 * Icon plate + script label + serif subtitle + hover/active ink bar.
 */
export default function CoverNavItem({
  icon,
  label,
  sub,
  active = false,
  onClick,
}: {
  icon: ReactNode
  label: string
  sub: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`${s.navItem} ${active ? s.navItemActive : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <span className={s.navIcon}>{icon}</span>
      <span className={s.navText}>
        <span className={s.navLabel}>{label}</span>
        <span className={s.navSub} style={{ display: 'block' }}>{sub}</span>
      </span>
      <ArrowRight size={16} strokeWidth={1.75} className={s.navArrow} aria-hidden="true" />
    </button>
  )
}

export function CoverNavSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className={s.navSection}>
      <div className={s.navHeading}>
        <span className={s.navHeadingLabel}>{heading}</span>
        <span className={s.navHeadingRule} aria-hidden="true" />
      </div>
      <div className={s.navList}>{children}</div>
    </div>
  )
}
