import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * PageFlipTransition  -  3-D page-turn between views on a book page.
 * The entering page sweeps from -90 → 0 deg rotateY (like unfolding toward viewer);
 * the exiting page sweeps from 0 → 90 deg (folding away). Combined they produce
 * a convincing book-page flip without needing two separate face elements.
 *
 * `direction` controls the turn: 'forward' turns deeper into the book,
 * 'back' returns to an earlier page.
 *
 * Requires no `overflow: hidden` ancestor  -  the parent's overflow is left alone;
 * rotateY at ≤90 deg keeps the element within its bounding box.
 */
export default function PageFlipTransition({
  viewKey,
  children,
  direction = 'forward',
}: {
  viewKey: string
  children: ReactNode
  direction?: 'forward' | 'back'
}) {
  const sign = direction === 'forward' ? 1 : -1

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        initial={{
          opacity: 0,
          rotateY: -90 * sign,
          x: 18 * sign,
          filter: 'blur(2px)',
        }}
        animate={{
          opacity: 1,
          rotateY: 0,
          x: 0,
          filter: 'blur(0px)',
        }}
        exit={{
          opacity: 0,
          rotateY: 90 * sign,
          x: -14 * sign,
          filter: 'blur(2px)',
        }}
        transition={{
          duration: 0.38,
          ease: [0.2, 0, 0, 1],
          opacity: { duration: 0.18 },
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          transformPerspective: 1800,
          transformOrigin: direction === 'forward' ? 'left center' : 'right center',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'transform, opacity',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
