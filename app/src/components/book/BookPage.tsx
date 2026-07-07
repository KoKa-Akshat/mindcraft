import type { ReactNode } from 'react'
import s from './Book.module.css'

/**
 * BookPage — one page of the open book.
 * side="left"  → recessed cover/contents page
 * side="right" → raised working page (red margin rule + bookmark ribbon)
 * flipping     → plays the page-flip animation (used before navigating)
 */
export default function BookPage({
  side,
  children,
  flipping = false,
  ribbon = false,
  runningHead,
  folio,
  overlay,
}: {
  side: 'left' | 'right'
  children: ReactNode
  flipping?: boolean
  ribbon?: boolean
  runningHead?: string
  folio?: ReactNode
  /** Rendered inside the page but outside the padded inner area (e.g. fore-edge tabs). */
  overlay?: ReactNode
}) {
  const sideClass = side === 'left' ? s.pageLeft : s.pageRight
  return (
    <div className={`${s.page} ${sideClass} ${flipping && side === 'right' ? s.flipping : ''}`}>
      {side === 'left' && <div className={s.edgeLeft} aria-hidden="true" />}
      {side === 'right' && <div className={s.edgeRight} aria-hidden="true" />}
      {side === 'left' && (
        <div className={`${s.flipShadow} ${flipping ? s.flipShadowActive : ''}`} aria-hidden="true" />
      )}
      {ribbon && <div className={s.ribbon} aria-hidden="true" />}
      {overlay}
      <div className={s.pageInner}>
        {runningHead && <div className={s.runningHead}>{runningHead}</div>}
        {children}
        {folio && <div className={s.folio}>{folio}</div>}
      </div>
    </div>
  )
}
