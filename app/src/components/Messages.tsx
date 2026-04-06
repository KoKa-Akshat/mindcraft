import { Message } from '../hooks/useStudentData'
import s from './Card.module.css'

interface Props { messages: Message[] }

export default function Messages({ messages }: Props) {
  return (
    <div className={s.card}>
      <p className={s.label}>Messages</p>
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
      <button className={s.btnOutline} style={{ fontSize: 12 }}>Open full inbox →</button>
    </div>
  )
}
