import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SessionSummary } from '../hooks/useStudentData'
import s from './LastSession.module.css'

interface Props { session: SessionSummary | null }

const PREVIEW_COUNT = 3

function buildPrompt(session: SessionSummary): string {
  const focus = session.bullets.slice(0, 2).join('; ').toLowerCase()
  return `Review from your ${session.subject} session on ${session.date}: ${focus}. Work through the assigned problems focusing on accuracy before speed.`
}

export default function LastSession({ session }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const navigate = useNavigate()

  if (!session) {
    return (
      <div className={s.card}>
        <p className={s.label}>Last Session</p>
        <div className={s.empty}>
          <span>No sessions yet</span>
          <p>Your session summary will appear here after your first session.</p>
        </div>
      </div>
    )
  }

  const previewBullets = session.bullets.slice(0, PREVIEW_COUNT)
  const hasMore = session.bullets.length > PREVIEW_COUNT

  return (
    <>
      <div className={s.card}>
        <p className={s.label}>Last Session</p>
        <div className={s.summaryHeader}>
          <span className={s.tag}>{session.subject}</span>
          <span className={s.date}>{session.date} · {session.duration}</span>
        </div>
        <div className={s.title}>{session.title}</div>
        <ul className={s.list}>
          {previewBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        {hasMore && (
          <button className={s.showMoreBtn} onClick={() => setModalOpen(true)}>
            +{session.bullets.length - PREVIEW_COUNT} more topics
          </button>
        )}

        <div className={s.divider} />

        <div className={s.promptBox}>
          <p className={s.promptLabel}>Practice Prompt</p>
          <p className={s.promptText}>{buildPrompt(session)}</p>
          <button className={s.practiceBtn} onClick={() => navigate('/practice')}>
            Start Practice Session →
          </button>
        </div>
      </div>

      {/* Full summary modal */}
      {modalOpen && (
        <div className={s.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={s.modalCard} onClick={e => e.stopPropagation()}>
            <button className={s.modalClose} onClick={() => setModalOpen(false)}>✕</button>
            <div className={s.summaryHeader}>
              <span className={s.tag}>{session.subject}</span>
              <span className={s.date}>{session.date} · {session.duration}</span>
            </div>
            <div className={s.title}>{session.title}</div>
            <ul className={s.list}>
              {session.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
            <div className={s.divider} />
            <div className={s.promptBox}>
              <p className={s.promptLabel}>Practice Prompt</p>
              <p className={s.promptText}>{buildPrompt(session)}</p>
              <button className={s.practiceBtn} onClick={() => { navigate('/practice'); setModalOpen(false) }}>
                Start Practice Session →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
