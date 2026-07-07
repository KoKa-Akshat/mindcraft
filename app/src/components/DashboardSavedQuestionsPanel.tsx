import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getQuestionById } from '../lib/questionBank'
import { toggleBookmark } from '../lib/dashboardPersonalization'
import BookmarkButton from './BookmarkButton'
import n from './DashboardPanels.module.css'

export default function DashboardSavedQuestionsPanel({
  uid,
  bookmarkedIds,
  onBookmarksChange,
}: {
  uid: string
  bookmarkedIds: string[]
  onBookmarksChange: (ids: string[]) => void
}) {
  const navigate = useNavigate()

  const items = useMemo(
    () => bookmarkedIds
      .map(id => ({ id, q: getQuestionById(id) }))
      .filter((item): item is { id: string; q: NonNullable<ReturnType<typeof getQuestionById>> } => !!item.q),
    [bookmarkedIds],
  )

  async function handleUnbookmark(questionId: string) {
    const next = await toggleBookmark(uid, questionId, bookmarkedIds)
    onBookmarksChange(next)
  }

  return (
    <div className={n.paperPanelBody}>
      <div className={n.scrollBody}>
        {items.length === 0 ? (
          <p className={n.paperEmptyHint}>
            No saved questions yet. Bookmark one from practice or a chapter page.
          </p>
        ) : (
          <div className={n.notesList}>
            {items.map(({ id, q }) => (
              <article key={id} className={n.noteEntry}>
                <div className={n.noteHead}>
                  <span className={n.noteMeta}>
                    {q.examTag ?? 'practice'} · level {q.level}
                  </span>
                  <button
                    type="button"
                    className={n.noteTitle}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => navigate('/practice', { state: { questionId: id, conceptId: q.conceptId } })}
                  >
                    {q.question.length > 120 ? `${q.question.slice(0, 119)}…` : q.question}
                  </button>
                  <span className={n.noteTutor}>{q.conceptId.replace(/_/g, ' ')}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                  <button
                    type="button"
                    className={n.paperTextLink}
                    onClick={() => navigate('/practice', { state: { questionId: id, conceptId: q.conceptId } })}
                  >
                    Open in practice →
                  </button>
                  <BookmarkButton
                    active
                    onToggle={() => void handleUnbookmark(id)}
                    label="Remove bookmark"
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
