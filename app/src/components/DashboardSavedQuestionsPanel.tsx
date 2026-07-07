import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getQuestionById } from '../lib/questionBank'
import { toggleBookmark } from '../lib/dashboardPersonalization'
import BookmarkButton from './BookmarkButton'
import EtchedQuestion from './book/EtchedQuestion'
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
                <EtchedQuestion
                  text={q.question}
                  tag={`${q.examTag ?? 'practice'} · L${q.level}`}
                  compact
                />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
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
