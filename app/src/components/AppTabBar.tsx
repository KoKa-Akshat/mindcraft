import { useNavigate } from 'react-router-dom'
import s from './AppTabBar.module.css'

export type AppTabId = 'dashboard' | 'practice' | 'solver' | 'map' | 'admin'

const BASE_TABS: { id: AppTabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'practice',  label: 'Practice' },
  { id: 'solver',    label: 'Problem Solver' },
  { id: 'map',       label: 'Knowledge Map' },
]

type Props = {
  active: AppTabId
  className?: string
  isAdmin?: boolean
}

export default function AppTabBar({ active, className, isAdmin }: Props) {
  const navigate = useNavigate()
  const tabs = isAdmin ? [...BASE_TABS, { id: 'admin' as AppTabId, label: 'Admin' }] : BASE_TABS

  function go(tab: AppTabId) {
    if (tab === active) return
    switch (tab) {
      case 'dashboard': navigate('/dashboard'); break
      case 'practice':  navigate('/practice'); break
      case 'solver':    navigate('/practice', { state: { homeworkHelp: true } }); break
      case 'map':       navigate('/knowledge-graph'); break
      case 'admin':     navigate('/admin'); break
    }
  }

  return (
    <nav className={`${s.bar}${className ? ` ${className}` : ''}`} aria-label="App sections">
      <div className={s.toggle}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === active ? s.tabActive : s.tab}
            onClick={() => go(tab.id)}
            aria-current={tab.id === active ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
