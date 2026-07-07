import type { ReactNode } from 'react'
import s from './Book.module.css'

/**
 * BookShell — the desk + open-book spread.
 * Renders chrome (wordmark / user / actions) above a two-page book
 * with a stitched binding gutter. Pages are provided as children
 * via <BookPage side="left|right">.
 */
export default function BookShell({
  chromeLeft,
  chromeRight,
  left,
  right,
  className,
  paper = 'cream',
  font = 'script',
  wordmark = 'MindCraft',
}: {
  chromeLeft?: ReactNode
  chromeRight?: ReactNode
  left: ReactNode
  right: ReactNode
  className?: string
  paper?: 'cream' | 'beige' | 'greyblue' | 'sage' | 'blush'
  font?: 'script' | 'print' | 'mono'
  wordmark?: ReactNode
}) {
  return (
    <div
      className={`${s.shell} ${className ?? ''}`}
      data-paper={paper}
      data-font={font}
    >
      <div className={s.chrome}>
        <div className={s.chromeLeft}>
          {chromeLeft}
          {typeof wordmark === 'string'
            ? <span className={s.wordmark}>{wordmark}</span>
            : wordmark}
        </div>
        <div className={s.chromeRight}>{chromeRight}</div>
      </div>

      <div className={s.book}>
        {left}

        <div className={s.gutter} aria-hidden="true">
          <div className={s.stitch} />
          <div className={s.stitchSmall} />
          <div className={s.stitch} />
          <div className={s.stitchSmall} />
          <div className={s.stitch} />
          <div className={s.stitchSmall} />
          <div className={s.stitch} />
          <div className={s.stitchSmall} />
          <div className={s.stitch} />
        </div>

        {right}
      </div>
    </div>
  )
}

export { s as bookStyles }
