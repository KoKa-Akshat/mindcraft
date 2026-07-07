import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * PageFlipTransition — a subtle page-turn between views on a book page,
 * so every section (today / notes / map / solver / route) reads as
 * flipping to another leaf of the same notebook. Key it by the view id.
 *
 * `direction` controls the turn: 'forward' (default) turns like moving
 * deeper into the book, 'back' like returning to an earlier page.
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
        initial={{ opacity: 0, x: 26 * sign, rotateY: -7 * sign, filter: 'blur(1.5px)' }}
        animate={{ opacity: 1, x: 0, rotateY: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: -20 * sign, rotateY: 6 * sign, filter: 'blur(1.5px)' }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          transformPerspective: 1400,
          transformOrigin: direction === 'forward' ? 'left center' : 'right center',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
