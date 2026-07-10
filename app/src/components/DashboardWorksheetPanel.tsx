/**
 * DashboardWorksheetPanel.tsx — homework upload entry point on the Field
 * Journal dashboard. Drop a PDF or photo of homework, Craft reads the pages
 * and splits them into questions, then hands off to /homework/:id where the
 * student works through them one at a time.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../App'
import {
  pagesFromFile, parseHomeworkPages, createHomeworkSession, listHomeworkSessions,
} from '../lib/homework'
import type { HomeworkSessionDoc } from '../types'
import n from './DashboardPanels.module.css'

type Stage = 'idle' | 'reading' | 'ready' | 'error'

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'

export default function DashboardWorksheetPanel() {
  const navigate = useNavigate()
  const user = useUser()
  const fileRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('idle')
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [past, setPast] = useState<HomeworkSessionDoc[]>([])
  const [loadingPast, setLoadingPast] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    void listHomeworkSessions(user.uid).then(sessions => {
      if (!cancelled) { setPast(sessions); setLoadingPast(false) }
    })
    return () => { cancelled = true }
  }, [user?.uid])

  async function handleFile(file: File) {
    if (!user?.uid) return
    setError('')
    setStage('reading')
    setStatusText('Reading your pages…')

    try {
      const pages = await pagesFromFile(file)
      if (pages.length === 0) {
        setError('We could not read that upload. It’s on us. Try a clearer photo or a different page.')
        setStage('error')
        return
      }

      const { questions, unavailable } = await parseHomeworkPages(pages)
      if (unavailable || questions.length === 0) {
        setError('We could not read that upload. It’s on us. Try a clearer photo or a different page.')
        setStage('error')
        return
      }

      setStatusText(`Found ${questions.length} question${questions.length === 1 ? '' : 's'}.`)
      const homeworkId = await createHomeworkSession(user.uid, file.name, pages.length, questions)
      setStage('ready')
      navigate(`/homework/${homeworkId}`)
    } catch {
      setError('We could not read that upload. It’s on us. Try a clearer photo or a different page.')
      setStage('error')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) void handleFile(f)
  }

  return (
    <div className={n.paperPanelBody}>
      <p className={n.worksheetIntro}>
        Drop your homework here. A PDF or a clear photo works.
      </p>

      <div
        className={`${n.worksheetDropzone} ${dragging ? n.worksheetDropzoneOver : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => stage !== 'reading' && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
        />
        {stage === 'reading' ? (
          <div className={n.worksheetStatus}>
            <span>{statusText}</span>
          </div>
        ) : (
          <>
            <span className={n.worksheetDropIcon}>&uarr;</span>
            <span className={n.worksheetDropLabel}>Drop your homework here</span>
            <span className={n.worksheetDropFormats}>PDF &middot; JPG &middot; PNG</span>
          </>
        )}
      </div>

      {error && <p className={n.worksheetError}>{error}</p>}

      <div className={n.scrollBody}>
        {loadingPast ? (
          <p className={n.paperLoading}>Loading your worksheets…</p>
        ) : past.length === 0 ? (
          <p className={n.paperEmptyHint}>No worksheets yet. Upload one to get started.</p>
        ) : (
          <div className={n.worksheetPastList}>
            {past.map(session => (
              <button
                key={session.id}
                type="button"
                className={n.worksheetPastItem}
                onClick={() => navigate(`/homework/${session.id}`)}
              >
                <span className={n.worksheetPastTitle}>{session.title}</span>
                <span className={n.worksheetPastMeta}>
                  {session.status === 'completed' ? 'Saved to your journal' : `Question ${session.currentIndex + 1} of ${session.questions.length}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
