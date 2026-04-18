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
      <Link to="#" className={s.item}>
        <svg viewBox="0 0 24 24"><rect x="2" y="3" width="9" height="7" rx="1.5"/><rect x="13" y="3" width="9" height="7" rx="1.5"/><rect x="2" y="14" width="9" height="7" rx="1.5"/><rect x="13" y="14" width="9" height="7" rx="1.5"/></svg>
        Flashcards
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
      <Link to="/study-timer" className={`${s.item} ${active('/study-timer')}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 3H3v4l4-2-2-2z"/>
          <path d="M19 3h2v4l-4-2 2-2z"/>
          <path d="M12 7C8.13 7 5 10.13 5 14s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7z"/>
          <path d="M12 10v4l2.5 2.5"/>
          <line x1="8" y1="1" x2="16" y2="1"/>
        </svg>
        Study Techniques
      </Link>

      <div className={s.divider} />

      <p className={s.label}>Practice</p>
      <Link to="/dashboard" className={`${s.item} ${active('/dashboard')}`}>
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Practice
      </Link>
      <Link to="#" className={s.item}>
        <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        Question Banks
      </Link>

      <div className={s.divider} />

      <a href="https://slack.com" target="_blank" rel="noopener" className={s.slack}>
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
        Join Class Slack
      </a>
    </aside>
  )
}
