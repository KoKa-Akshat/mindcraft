/**
 * hooks/useToast.ts
 *
 * Lightweight toast notification hook.
 * Returns [toast, showToast] — render the toast string when truthy.
 *
 * Usage:
 *   const { toast, showToast } = useToast()
 *   showToast('Saved!')
 *   {toast && <div className={s.toast}>{toast}</div>}
 */

import { useState } from 'react'

export function useToast(durationMs = 3000) {
  const [toast, setToast] = useState('')

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(''), durationMs)
  }

  return { toast, showToast }
}
