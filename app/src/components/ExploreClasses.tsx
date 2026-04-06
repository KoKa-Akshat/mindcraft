import s from './Card.module.css'

const classes = [
  { icon: '💻', bg: 'rgba(88,204,2,.1)',    name: 'Intro to Coding',    sub: 'Python basics · Starts Apr 14', badge: 'New',  badgeType: 'new'  },
  { icon: '🤖', bg: 'rgba(74,123,247,.1)',  name: 'AI Fundamentals',   sub: 'How AI works · Free event',     badge: 'Free', badgeType: 'free' },
  { icon: '🎹', bg: 'rgba(245,158,11,.1)', name: 'Piano Foundations', sub: 'Beginner · Coming soon',        badge: 'Soon', badgeType: 'soon' },
]

export default function ExploreClasses() {
  return (
    <div className={s.card}>
      <p className={s.label}>Explore Classes</p>
      {classes.map((c, i) => (
        <div key={i} className={s.classRow}>
          <div className={s.classIcon} style={{ background: c.bg }}>{c.icon}</div>
          <div className={s.classInfo}>
            <strong>{c.name}</strong>
            <span>{c.sub}</span>
          </div>
          <span className={`${s.badge} ${s[`badge_${c.badgeType}`]}`}>{c.badge}</span>
        </div>
      ))}
      <div className={s.divider} />
      <button className={s.btnOutline} style={{ fontSize: 12 }}>See all classes →</button>
    </div>
  )
}
