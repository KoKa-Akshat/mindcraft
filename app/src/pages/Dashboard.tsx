import { useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import Sidebar from '../components/Sidebar'
import HeroBar from '../components/HeroBar'
import LastSession from '../components/LastSession'
import ConstellationCard from '../components/ConstellationCard'
import s from './Dashboard.module.css'

// ── Subject tile config ────────────────────────────────────────────────────────

const SUBJECTS = [
  { key: 'algebra',  label: 'Algebra',  color: 'var(--c-algebra)',  icon: '∑', sessions: 4, goal: 5 },
  { key: 'geometry', label: 'Geometry', color: 'var(--c-geometry)', icon: '△', sessions: 2, goal: 4 },
  { key: 'trig',     label: 'Trig',     color: 'var(--c-trig)',     icon: '∿', sessions: 1, goal: 3 },
  { key: 'stats',    label: 'Stats',    color: 'var(--c-stats)',     icon: 'σ', sessions: 3, goal: 4 },
]

// ── Streak helpers ─────────────────────────────────────────────────────────────

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// Returns which day-of-week indices are "completed" based on streak count
function streakDays(streakCount: number): boolean[] {
  const todayDow = (new Date().getDay() + 6) % 7 // Monday=0
  return DAYS.map((_, i) => i <= todayDow && todayDow - i < streakCount)
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const user     = useUser()
  const navigate = useNavigate()
  const data     = useStudentData(user)

  // Today's card — file upload state
  const [problemText, setProblemText] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setUploadedFile(file)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setUploadedFile(file)
  }

  function startHomework() {
    if (problemText.trim()) {
      navigate('/practice', { state: { problemText, file: null } })
    } else if (uploadedFile) {
      navigate('/practice', { state: { problemText: '', fileName: uploadedFile.name } })
    }
  }

  const activeDays  = streakDays(data.streak)
  const todayDow    = (new Date().getDay() + 6) % 7

  return (
    <div className={s.shell}>
      <Sidebar />

      <main className={s.page}>
        <HeroBar
          greeting={greeting()}
          name={data.displayName}
          nextSession={data.nextSession}
          tutorId={data.tutorId}
        />

        {data.loading ? (
          <div className={s.loading}><div className={s.spinner} /></div>
        ) : (
          <div className={s.layout}>

            {/* ── Main column ── */}
            <div className={s.main}>

              {/* Subject tiles */}
              <section className={s.section}>
                <h2 className={s.sectionTitle}>This Week</h2>
                <div className={s.tiles}>
                  {SUBJECTS.map((sub, i) => (
                    <div
                      key={sub.key}
                      className={s.tile}
                      style={{ '--tile-color': sub.color, animationDelay: `${i * 0.08}s` } as React.CSSProperties}
                      onClick={() => navigate('/practice')}
                    >
                      <span className={s.tileIcon}>{sub.icon}</span>
                      <div className={s.tileCount}>{sub.sessions}</div>
                      <div className={s.tileLabel}>{sub.label}</div>
                      <div className={s.tileBar}>
                        <div
                          className={s.tileBarFill}
                          style={{ width: `${Math.round((sub.sessions / sub.goal) * 100)}%` }}
                        />
                      </div>
                      <div className={s.tileGoal}>{sub.sessions}/{sub.goal} sessions</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Constellation */}
              <section className={s.section}>
                <h2 className={s.sectionTitle}>Constellation</h2>
                <ConstellationCard userId={user.uid} />
              </section>

              {/* Last session */}
              <section className={s.section}>
                <h2 className={s.sectionTitle}>Last Session</h2>
                <LastSession session={data.lastSession} />
              </section>
            </div>

            {/* ── Right panel ── */}
            <div className={s.panel}>

              {/* Today's problem card */}
              <div className={s.todayCard}>
                <div className={s.todayHeader}>
                  <span className={s.todayTitle}>Today's Problem</span>
                  <span className={s.todayChip}>Homework Help</span>
                </div>

                {uploadedFile ? (
                  <div className={s.filePreview}>
                    <span className={s.fileIcon}>{uploadedFile.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                    <span className={s.fileName}>{uploadedFile.name}</span>
                    <button className={s.fileRemove} onClick={() => setUploadedFile(null)}>✕</button>
                  </div>
                ) : (
                  <div
                    className={s.dropZone}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileRef.current?.click()}
                  >
                    <span className={s.dropIcon}>⬆</span>
                    <span className={s.dropText}>Drop image or PDF</span>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,.pdf"
                      className={s.fileInput}
                      onChange={handleFileInput}
                    />
                  </div>
                )}

                <textarea
                  className={s.problemInput}
                  placeholder="Or type your problem here…"
                  value={problemText}
                  rows={3}
                  onChange={e => setProblemText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) startHomework() }}
                />

                <button
                  className={s.hintBtn}
                  onClick={startHomework}
                  disabled={!problemText.trim() && !uploadedFile}
                >
                  Get hints →
                </button>
              </div>

              {/* Streak widget */}
              <div className={s.streakCard}>
                <div className={s.streakRow}>
                  {DAYS.map((day, i) => (
                    <div key={i} className={s.streakCol}>
                      <div
                        className={s.streakDot}
                        style={{
                          background:  activeDays[i] ? SUBJECTS[i % 4].color : 'var(--surface-2)',
                          border:      i === todayDow ? '2px solid var(--accent)' : '2px solid transparent',
                          animationDelay: `${i * 0.06}s`,
                        }}
                      />
                      <span className={s.streakDay}>{day}</span>
                    </div>
                  ))}
                </div>
                <p className={s.streakLabel}>
                  {data.streak > 0 ? `🔥 ${data.streak}-day streak` : 'Start your streak today'}
                </p>
              </div>

              {/* Quick stats */}
              <div className={s.statsCard}>
                <div className={s.statItem}>
                  <span className={s.statNum}>{data.practiceCount}</span>
                  <span className={s.statLbl}>Practice sessions</span>
                </div>
                <div className={s.statDivider} />
                <div className={s.statItem}>
                  <span className={s.statNum}>{SUBJECTS.reduce((a, b) => a + b.sessions, 0)}</span>
                  <span className={s.statLbl}>Sessions this week</span>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  )
}
