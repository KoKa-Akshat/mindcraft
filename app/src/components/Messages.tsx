import s from './Card.module.css'

const messages = [
  { initial: 'A', isTutor: true,  name: 'Mr. Alex',  time: '2h ago',   text: "Can you upload your worksheet before today's session?", unread: true  },
  { initial: 'Y', isTutor: false, name: 'You',        time: '3h ago',   text: "Sure, I'll send it over before 2pm!",                  unread: false },
  { initial: 'P', isTutor: true,  name: 'Ms. Priya',  time: 'Yesterday', text: 'Great work on Thursday — much stronger on quadratics.', unread: false },
  { initial: 'Y', isTutor: false, name: 'You',        time: 'Yesterday', text: 'Thank you! The practice set really helped.',            unread: false },
]

export default function Messages() {
  return (
    <div className={s.card}>
      <p className={s.label}>Messages</p>
      {messages.map((m, i) => (
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
      ))}
      <div className={s.divider} />
      <button className={s.btnOutline} style={{ fontSize: 12 }}>Open full inbox →</button>
    </div>
  )
}
