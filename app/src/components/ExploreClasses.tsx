import s from './Card.module.css'

const classes = [
  {
    icon: '💻', bg: 'linear-gradient(135deg, #2D5016, #58CC02)',
    name: 'Intro to Coding', sub: 'Python basics', start: 'Starts Apr 14',
    badge: 'New', badgeType: 'new',
  },
  {
    icon: '🤖', bg: 'linear-gradient(135deg, #1A2A6C, #4A7BF7)',
    name: 'AI Fundamentals', sub: 'How AI works', start: 'Free event',
    badge: 'Free', badgeType: 'free',
  },
  {
    icon: '🎹', bg: 'linear-gradient(135deg, #7B4F00, #F59E0B)',
    name: 'Piano Foundations', sub: 'Beginner level', start: 'Coming soon',
    badge: 'Soon', badgeType: 'soon',
  },
]

export default function ExploreClasses() {
  return (
    <div className={s.card}>
      <p className={s.label}>Explore Classes</p>
      <div className={s.classCardGrid}>
        {classes.map((c, i) => (
          <div key={i} className={s.classCardTile}>
            <div className={s.classCardThumb} style={{ background: c.bg }}>
              <span className={s.classCardEmoji}>{c.icon}</span>
              <span className={`${s.badge} ${s[`badge_${c.badgeType}`]} ${s.badgeOverlay}`}>{c.badge}</span>
            </div>
            <div className={s.classCardBody}>
              <div className={s.classCardName}>{c.name}</div>
              <div className={s.classCardSub}>{c.sub}</div>
              <div className={s.classCardStart}>{c.start}</div>
            </div>
          </div>
        ))}
      </div>
      <div className={s.divider} />
      <button className={s.btnOutline} style={{ fontSize: 12 }}>See all classes →</button>
    </div>
  )
}
