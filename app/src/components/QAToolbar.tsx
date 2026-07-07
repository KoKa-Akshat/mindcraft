/**
 * QAToolbar — floating test harness, visible only in QA mode.
 * Activate by navigating to /qa (sets sessionStorage mc-qa-mode=1).
 * "Restart Fresh" wipes diagnostic state so the onboarding flow can be re-tested.
 * Exit: click ✕ on the toolbar.
 */
import { useState } from 'react'
import { useUser } from '../App'
import { resetStudentProfile } from '../lib/testProfile'

type Status = 'idle' | 'working' | 'done' | 'error'

export default function QAToolbar() {
  const user = useUser()
  const [status, setStatus] = useState<Status>('idle')
  const [detail, setDetail] = useState('')

  async function handleRestart() {
    if (status === 'working') return
    setStatus('working')
    setDetail('resetting user…')
    try {
      await resetStudentProfile(user.uid)

      setStatus('done')
      setDetail('done!')
      setTimeout(() => { window.location.href = '/practice' }, 900)
    } catch (e: unknown) {
      console.error('[QA] restart failed', e)
      setStatus('error')
      setDetail(e instanceof Error ? e.message : 'failed')
    }
  }

  function exitQA() {
    sessionStorage.removeItem('mc-qa-mode')
    window.location.reload()
  }

  const btnLabel =
    status === 'working' ? detail :
    status === 'done'    ? '✓ restarted' :
    status === 'error'   ? '⚠ ' + detail :
    '↺ Restart Fresh'

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 99999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', borderRadius: 12,
      background: 'rgba(12,12,20,0.96)',
      border: '1px solid rgba(255,79,216,0.35)',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 4px 28px rgba(0,0,0,0.5)',
      fontFamily: 'system-ui,-apple-system,sans-serif',
      fontSize: 12, color: 'rgba(255,255,255,0.65)',
      userSelect: 'none',
    }}>
      <span style={{
        background: '#ff4fd8', color: '#000', fontWeight: 900,
        fontSize: 10, padding: '2px 6px', borderRadius: 4,
        letterSpacing: '0.05em', flexShrink: 0,
      }}>QA</span>

      <span style={{
        maxWidth: 160, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1,
      }}>{user.email}</span>

      <button onClick={handleRestart} disabled={status !== 'idle'} style={{
        background: status === 'idle' ? '#ff4fd8' : 'rgba(255,255,255,0.08)',
        color: status === 'idle' ? '#000' : status === 'error' ? '#ff6b6b' : 'rgba(255,255,255,0.4)',
        border: 'none', borderRadius: 8, padding: '5px 12px',
        fontWeight: 900, fontSize: 12,
        cursor: status === 'idle' ? 'pointer' : 'default',
        transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
      }}>{btnLabel}</button>

      <button onClick={exitQA} title="Exit QA mode" style={{
        background: 'transparent', border: 'none',
        color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
        fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0,
      }}>✕</button>
    </div>
  )
}
