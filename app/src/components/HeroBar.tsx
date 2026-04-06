import s from './HeroBar.module.css'

interface Props {
  greeting: string
  name: string
  streak: number
  nextSession: { subject: string; time: string; tutor: string } | null
}

export default function HeroBar({ greeting, name, streak, nextSession }: Props) {
  return (
    <div className={s.hero}>
      <div className={s.top}>
        <div className={s.left}>
          <h1>{greeting}, <em>{name}</em> 👋</h1>
          {nextSession ? (
            <div className={s.pill}>
              <div className={s.pillDot} />
              <div className={s.pillText}>
                {nextSession.subject} · {nextSession.time} <span>· with {nextSession.tutor}</span>
              </div>
            </div>
          ) : (
            <div className={s.pill}>
              <div className={s.pillDot} style={{ background: '#E8EAED', animation: 'none' }} />
              <div className={s.pillText} style={{ color: '#8A8F98' }}>No session scheduled yet</div>
            </div>
          )}
          <div className={s.btns}>
            <button className={s.btnPrimary}>Join Session →</button>
            <button className={s.btnSecondary}>View Schedule</button>
          </div>
        </div>
        <div className={s.streak}>
          <div className={s.streakNum}>{streak > 0 ? `🔥 ${streak}` : '—'}</div>
          <div className={s.streakLbl}>Day Streak</div>
        </div>
      </div>
    </div>
  )
}
