import s from './Card.module.css'

export default function LastSession() {
  return (
    <div className={s.card}>
      <p className={s.label}>Last Session</p>
      <div className={s.summaryHeader}>
        <span className={s.tag}>Calculus</span>
        <span className={s.date}>Yesterday · 45 min</span>
      </div>
      <div className={s.title}>Derivatives &amp; Chain Rule</div>
      <ul className={s.list}>
        <li>Introduced the chain rule with composite functions</li>
        <li>Worked through 4 problems with increasing difficulty</li>
        <li>Strong on basics — needs more work on implicit differentiation</li>
      </ul>
      <button className={s.btnOutline}>View Full Summary</button>
    </div>
  )
}
