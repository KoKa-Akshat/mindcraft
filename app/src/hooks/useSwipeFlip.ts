import { useEffect, type RefObject } from 'react'

/**
 * iPad-style horizontal swipe → page turn callbacks.
 * Swipe left (finger moves left) = forward (next leaf).
 * Swipe right = back (previous leaf).
 */
export function useSwipeFlip(
  ref: RefObject<HTMLElement | null>,
  onForward: () => void,
  onBack: () => void,
  enabled = true,
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let startX = 0
    let startY = 0
    const THRESH = 48

    function onStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }
    function onEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) < THRESH || Math.abs(dx) < Math.abs(dy) * 1.2) return
      if (dx < 0) onForward()
      else onBack()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [ref, onForward, onBack, enabled])
}
