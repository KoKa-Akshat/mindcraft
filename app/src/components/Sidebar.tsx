import { Link, useLocation } from 'react-router-dom'
import s from './Sidebar.module.css'

export default function Sidebar() {
  const loc = useLocation()
  // Use startsWith so /knowledge-graph/Logarithms still highlights the Knowledge Graph link
  const active = (path: string) => loc.pathname === path || (path !== '/' && path !== '#' && loc.pathname.startsWith(path + '/')) ? s.active : ''

  return (
    <aside className={s.sidebar}>
      <p className={s.label}>Study</p>
      <Link to="/sessions" className={`${s.item} ${active('/sessions')}`}>
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Session Notes
      </Link>
      <Link to="/knowledge-graph" className={`${s.item} ${active('/knowledge-graph')}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
          <circle cx="12" cy="8" r="2"/><circle cx="12" cy="16" r="2"/>
          <line x1="7" y1="12" x2="10" y2="9"/><line x1="7" y1="12" x2="10" y2="15"/>
          <line x1="14" y1="8" x2="17" y2="6"/><line x1="14" y1="16" x2="17" y2="18"/>
          <line x1="13" y1="10" x2="13" y2="14"/>
        </svg>
        Knowledge Graph
      </Link>

      <div className={s.divider} />

      <p className={s.label}>Practice</p>
      <Link to="/dashboard" className={`${s.item} ${active('/dashboard')}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        Past Papers
      </Link>
      <Link to="/organize-notes" className={`${s.item} ${active('/organize-notes')}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        Organize Notes
      </Link>

      <div className={s.divider} />

      <a href="https://join.slack.com/t/mindcraftnetwork/shared_invite/zt-3vnl9tmvm-sTq8wFPky0LcOGWcK_COHg" target="_blank" rel="noopener" className={s.slack}>
        <svg className={s.slackIcon} viewBox="0 0 24 24" fill="none">
          <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" fill="#E01E5A"/>
          <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="#E01E5A"/>
          <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" fill="#2EB67D"/>
          <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" fill="#2EB67D"/>
          <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" fill="#ECB22E"/>
          <path d="M14 3.5C14 2.67 14.67 2 15.5 2S17 2.67 17 3.5V5h-1.5C14.67 5 14 4.33 14 3.5z" fill="#ECB22E"/>
          <path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z" fill="#36C5F0"/>
          <path d="M10 20.5c0 .83-.67 1.5-1.5 1.5S7 21.33 7 20.5V19h1.5c.83 0 1.5.67 1.5 1.5z" fill="#36C5F0"/>
        </svg>
        Slack
      </a>
    </aside>
  )
}
