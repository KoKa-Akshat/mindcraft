/**
 * SessionDetail.tsx
 *
 * Tutor-only review page for a completed session.
 *
 * Workflow:
 *   1. Tutor views transcript (if Fireflies processed it) and adds notes
 *   2. Clicks "Generate Summary" → AI creates a structured summary card
 *   3. Tutor edits the card inline, then publishes it to the student
 *
 * On publish, the summary is written to both the session doc (summaryStatus: 'published')
 * and the student's user doc (lastSession field) so it shows on their dashboard.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { useUser } from '../App'
import { useToast } from '../hooks/useToast'
import { fmtDateTime } from '../utils/format'
import s from './SessionDetail.module.css'

const GENERATE_URL  = 'https://mindcraft-webhook.vercel.app/api/generate-summary'
const DELETE_URL    = 'https://mindcraft-webhook.vercel.app/api/delete-session'

// Shape of the AI-generated summary card
interface SummaryCard {
  title:     string
  topics:    string[]
  homework:  string[]
  progress:  string
  tutorNote: string
}

// Shape of the session document as returned from Firestore
interface SessionData {
  studentName:   string
  studentEmail:  string
  studentId:     string | null
  subject:       string
  date:          string
  scheduledAt:   number
  duration:      string
  tutorId:       string
  tutorName:     string
  status:        string
  summaryStatus?: 'pending' | 'draft' | 'published'
  summaryCard?:   SummaryCard
  tutorNotes?:    string
  tutorNotesUrl?: string
  transcript?: {
    fullText:  string
    sentences: any[]
    summary:   any
    duration:  number
  }
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const user = useUser()
  const navigate = useNavigate()

  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  const [tutorNotes, setTutorNotes] = useState('')
  const [notesFile, setNotesFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  const { toast, showToast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [card, setCard]             = useState<SummaryCard>({ title: '', topics: [], homework: [], progress: '', tutorNote: '' })
  const [publishing, setPublishing] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'sessions', id)).then(snap => {
      if (!snap.exists()) { navigate('/tutor', { replace: true }); return }
      const data = snap.data() as SessionData
      // Guard: only the assigned tutor can review
      if (data.tutorId !== user.uid) { navigate('/tutor', { replace: true }); return }
      setSession(data)
      setTutorNotes(data.tutorNotes ?? '')
      if (data.summaryCard) setCard(data.summaryCard)
      setLoading(false)
    }).catch(() => navigate('/tutor', { replace: true }))
  }, [id, user, navigate])


  async function handleFileUpload() {
    if (!notesFile || !id) return
    setUploadingFile(true)
    try {
      const path = storageRef(storage, `sessions/${id}/notes/${notesFile.name}`)
      await uploadBytes(path, notesFile)
      const url = await getDownloadURL(path)
      await updateDoc(doc(db, 'sessions', id), { tutorNotesUrl: url })
      setSession(prev => prev ? { ...prev, tutorNotesUrl: url } : prev)
      showToast('File uploaded')
    } catch (err) {
      showToast('Upload failed')
    } finally {
      setUploadingFile(false)
      setNotesFile(null)
    }
  }

  async function handleGenerate() {
    if (!id) return
    setGenerating(true)
    try {
      const res = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, tutorNotes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCard(data.summaryCard)
      setSession(prev => prev ? { ...prev, summaryStatus: 'draft', summaryCard: data.summaryCard } : prev)
      showToast('Summary generated — review and publish')
    } catch (err: any) {
      showToast(err.message ?? 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete() {
    if (!id || !session || !window.confirm('Delete this session? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch('https://mindcraft-webhook.vercel.app/api/delete-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, tutorId: session.tutorId }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      navigate('/tutor', { replace: true })
    } catch (err: any) {
      showToast(err.message ?? 'Delete failed')
      setDeleting(false)
    }
  }

  async function handlePublish() {
    if (!id || !session) return
    if (!card.title) { showToast('Add a title before publishing'); return }
    setPublishing(true)
    try {
      // Save tutorNotes if changed
      const updates: Record<string, any> = {
        summaryCard: card,
        summaryStatus: 'published',
        tutorNotes: tutorNotes || null,
      }
      await updateDoc(doc(db, 'sessions', id), updates)

      // Push to student's lastSession
      if (session.studentId) {
        await updateDoc(doc(db, 'users', session.studentId), {
          lastSession: {
            id,
            subject: session.subject,
            date: session.date,
            duration: session.duration,
            title: card.title,
            bullets: [...card.topics.slice(0, 2), ...card.homework.slice(0, 2)].filter(Boolean),
            tutorName: session.tutorName,
            scheduledAt: session.scheduledAt,
            tutorNote: card.tutorNote,
            progress: card.progress,
          },
        })
      }

      setSession(prev => prev ? { ...prev, summaryStatus: 'published' } : prev)
      showToast('Published to student dashboard')
    } catch {
      showToast('Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  function updateTopic(i: number, val: string) {
    setCard(c => { const t = [...c.topics]; t[i] = val; return { ...c, topics: t } })
  }
  function addTopic() { setCard(c => ({ ...c, topics: [...c.topics, ''] })) }
  function removeTopic(i: number) { setCard(c => ({ ...c, topics: c.topics.filter((_, j) => j !== i) })) }

  function updateHw(i: number, val: string) {
    setCard(c => { const h = [...c.homework]; h[i] = val; return { ...c, homework: h } })
  }
  function addHw() { setCard(c => ({ ...c, homework: [...c.homework, ''] })) }
  function removeHw(i: number) { setCard(c => ({ ...c, homework: c.homework.filter((_, j) => j !== i) })) }

  if (loading) return (
    <div className={s.loadWrap}><div className={s.spinner} /></div>
  )

  if (!session) return null

  const isPublished = session.summaryStatus === 'published'
  const hasTranscript = !!session.transcript?.fullText
  const hasDraft = !!session.summaryCard

  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <Link to="/tutor" className={s.logo}>Mind<span>Craft</span></Link>
        <div className={s.navRight}>
          <span className={s.navRole}>Tutor</span>
        </div>
      </nav>

      <main className={s.page}>
        {/* Header */}
        <div className={s.header}>
          <Link to="/tutor" className={s.back}>← Back</Link>
          <div className={s.headerInfo}>
            <h1>{session.studentName} <span>·</span> {session.subject}</h1>
            <p>{fmtDateTime(session.scheduledAt)} · {session.duration}</p>
          </div>
          <div className={s.headerRight}>
            <span className={`${s.statusBadge} ${isPublished ? s.badgePublished : hasDraft ? s.badgeDraft : s.badgePending}`}>
              {isPublished ? 'Published' : hasDraft ? 'Draft' : 'Pending Review'}
            </span>
            <button className={s.btnDelete} onClick={handleDelete} disabled={deleting} title="Delete session">
              {deleting ? '…' : 'Delete'}
            </button>
          </div>
        </div>

        <div className={s.grid}>
          {/* LEFT: transcript + notes */}
          <div className={s.left}>
            {/* Transcript */}
            <div className={s.card}>
              <button className={s.transcriptToggle} onClick={() => setTranscriptOpen(o => !o)}>
                <span className={s.cardLabel}>Session Transcript</span>
                <span className={s.toggleIcon}>{transcriptOpen ? '▲' : '▼'}</span>
                {!hasTranscript && <span className={s.noTranscript}>Not yet available</span>}
              </button>
              {transcriptOpen && hasTranscript && (
                <div className={s.transcriptBody}>
                  {session.transcript!.sentences?.length ? (
                    session.transcript!.sentences.map((sen: any, i: number) => (
                      <div key={i} className={s.sentence}>
                        <span className={s.speaker}>{sen.speaker_name}</span>
                        <span className={s.sentenceText}>{sen.text}</span>
                      </div>
                    ))
                  ) : (
                    <pre className={s.transcriptPre}>{session.transcript!.fullText}</pre>
                  )}
                </div>
              )}
              {transcriptOpen && !hasTranscript && (
                <p className={s.noTranscriptMsg}>Transcript will appear here once the Fireflies recording is processed.</p>
              )}
            </div>

            {/* Tutor Notes */}
            <div className={s.card}>
              <div className={s.cardLabel} style={{ marginBottom: 12 }}>Your Notes</div>
              <textarea
                className={s.notesArea}
                placeholder="Add your session notes here — what you covered, observations about the student, areas to focus on next..."
                value={tutorNotes}
                onChange={e => setTutorNotes(e.target.value)}
                rows={6}
              />
              <div className={s.fileRow}>
                <input
                  ref={fileRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg"
                  onChange={e => setNotesFile(e.target.files?.[0] ?? null)}
                />
                <button className={s.btnOutline} onClick={() => fileRef.current?.click()}>
                  {notesFile ? notesFile.name : '↑ Attach File'}
                </button>
                {notesFile && (
                  <button className={s.btnOutline} onClick={handleFileUpload} disabled={uploadingFile}>
                    {uploadingFile ? 'Uploading…' : 'Upload'}
                  </button>
                )}
                {session.tutorNotesUrl && !notesFile && (
                  <a href={session.tutorNotesUrl} target="_blank" rel="noopener" className={s.fileLink}>
                    View attached file →
                  </a>
                )}
              </div>
            </div>

            <button className={s.btnGenerate} onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <><span className={s.btnSpinner} /> Generating…</>
              ) : (
                hasDraft ? '↺ Regenerate Summary' : '✦ Generate Summary with AI'
              )}
            </button>
          </div>

          {/* RIGHT: summary card editor */}
          <div className={s.right}>
            <div className={s.card}>
              <div className={s.cardLabel} style={{ marginBottom: 16 }}>Summary Card</div>

              <label className={s.fieldLabel}>Session Title</label>
              <input
                className={s.fieldInput}
                placeholder="e.g. Quadratic Equations — Introduction"
                value={card.title}
                onChange={e => setCard(c => ({ ...c, title: e.target.value }))}
              />

              <label className={s.fieldLabel}>Topics Covered</label>
              {card.topics.map((t, i) => (
                <div key={i} className={s.listRow}>
                  <input
                    className={s.fieldInput}
                    value={t}
                    onChange={e => updateTopic(i, e.target.value)}
                    placeholder={`Topic ${i + 1}`}
                  />
                  <button className={s.removeBtn} onClick={() => removeTopic(i)}>✕</button>
                </div>
              ))}
              <button className={s.addBtn} onClick={addTopic}>+ Add topic</button>

              <label className={s.fieldLabel} style={{ marginTop: 16 }}>Homework Assigned</label>
              {card.homework.map((h, i) => (
                <div key={i} className={s.listRow}>
                  <input
                    className={s.fieldInput}
                    value={h}
                    onChange={e => updateHw(i, e.target.value)}
                    placeholder={`Homework ${i + 1}`}
                  />
                  <button className={s.removeBtn} onClick={() => removeHw(i)}>✕</button>
                </div>
              ))}
              <button className={s.addBtn} onClick={addHw}>+ Add homework</button>

              <label className={s.fieldLabel} style={{ marginTop: 16 }}>Progress Note</label>
              <textarea
                className={s.fieldTextarea}
                placeholder="How did the student do this session?"
                value={card.progress}
                onChange={e => setCard(c => ({ ...c, progress: e.target.value }))}
                rows={2}
              />

              <label className={s.fieldLabel}>Personal Note to Student</label>
              <textarea
                className={s.fieldTextarea}
                placeholder="An encouraging, personal message to the student..."
                value={card.tutorNote}
                onChange={e => setCard(c => ({ ...c, tutorNote: e.target.value }))}
                rows={3}
              />

              <div className={s.publishRow}>
                {isPublished && (
                  <span className={s.publishedNote}>✓ Published to student</span>
                )}
                <button
                  className={`${s.btnPublish} ${isPublished ? s.btnRepublish : ''}`}
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? 'Publishing…' : isPublished ? 'Update & Republish' : 'Publish to Student →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  )
}
