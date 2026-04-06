import s from './Card.module.css'

export default function PracticeReady() {
  return (
    <div className={s.card}>
      <p className={s.label}>Practice Ready</p>
      <div className={s.practiceNum}>12 <span>questions</span></div>
      <p className={s.practiceSub}>Based on last session — Derivatives &amp; Chain Rule</p>
      <button className={s.btnGreen}>Start Practice →</button>
    </div>
  )
}
