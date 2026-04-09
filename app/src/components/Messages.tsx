import { Link } from 'react-router-dom'
import { Message } from '../hooks/useStudentData'
import s from './Card.module.css'

interface Props {
  messages: Message[]
  tutorId:  string | null
}

function MailboxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="17" />
      <line x1="9.5" y1="14.5" x2="14.5" y2="14.5" />
    </svg>
  )
}

export default function Messages({ messages, tutorId }: Props) {
  return (
    <div className={s.card}>
      <p className={s.label}>
        <MailboxIcon />
        Messages
      </p>
      {messages.length === 0 ? (
        <div className={s.empty}>
          <span>No messages yet</span>
          <p>Messages from your tutor will appear here.</p>
        </div>
      ) : (
        messages.map((m, i) => (
          <div key={i} className={`${s.msgRow} ${m.unread ? s.msgUnread : ''}`}>
            <div className={`${s.msgAv} ${m.isTutor ? s.msgAvTutor : ''}`}>{m.initial}</div>
            <div className={s.msgBody}>
              <div className={s.msgMeta}>
                <span className={s.msgName}>{m.name}</span>
                <span className={s.msgTime}>{m.time}</span>
              </div>
              <div className={s.msgText}>{m.text}</div>
            </div>
            {m.unread && <div className={s.msgDot} />}
          </div>
        ))
      )}
      <div className={s.divider} />
      {tutorId ? (
        <Link to={`/chat/${tutorId}`} className={s.btnOutline} style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block' }}>
          Message your tutor →
        </Link>
      ) : (
        <span className={s.btnOutline} style={{ fontSize: 12, opacity: 0.5, cursor: 'default' }}>
          Book a session to message your tutor
        </span>
      )}
    </div>
  )
}
