import s from './HeroBar.module.css'

interface Props {
  greeting: string
  name: string
}

export default function HeroBar({ greeting, name }: Props) {
  return (
    <div className={s.hero}>
      <div className={s.top}>
        <div className={s.left}>
          <h1>{greeting}, <em>{name}</em> 👋</h1>
          <div className={s.pill}>
            <div className={s.pillDot} />
            <div className={s.pillText}>
              Calculus · Today at 3:00 PM <span>· with Mr. Alex</span>
            </div>
          </div>
          <div className={s.btns}>
            <button className={s.btnPrimary}>Join Session →</button>
            <button className={s.btnSecondary}>View Schedule</button>
          </div>
        </div>
        <div className={s.streak}>
          <div className={s.streakNum}>🔥 6</div>
          <div className={s.streakLbl}>Day Streak</div>
        </div>
      </div>
    </div>
  )
}
