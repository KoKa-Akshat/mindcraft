import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * PageFlipTransition — crossfades between views on a book page so
 * every section (today / notes / map / solver / route) blends into
 * the paper instead of appearing abruptly. Key it by the view id.
 */
export default function PageFlipTransition({
  viewKey,
  children,
}: {
  viewKey: string
  children: ReactNode
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, y: 10, filter: 'blur(1.5px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -8, filter: 'blur(1.5px)' }}
        transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
