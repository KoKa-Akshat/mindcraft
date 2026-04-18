/**
 * OrganizeNotes.tsx
 *
 * Student-facing page to upload their own notes, have AI generate a
 * structured summary card, edit it, and publish it to their Session Notes.
 */

import { useRef, useState } from 'react'
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useUser } from '../App'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'
import s from './OrganizeNotes.module.css'

const GENERATE_URL = 'https://mindcraft-webhook.vercel.app/api/generate-summary'

interface SummaryCard {
  title:    string
  topics:   string[]
  homework: string[]
  progress: string
  tutorNote: string
}

const BLANK: SummaryCard = { title: '', topics: [], homework: [], progress: '', tutorNote: '' }

export default function OrganizeNotes() {
  const user     = useUser()
  const navigate = useNavigate()

  const [notes, setNotes]         = useState('')
  const [subject, setSubject]     = useState('')
  const [file, setFile]           = useState<File | null>(null)
  const [generating, setGenerating] = useState(false)
  const [card, setCard]           = useState<SummaryCard>(BLANK)
  const [cardReady, setCardReady] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError]         = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Read file text when a file is attached
  async function handleFile(f: File) {
    setFile(f)
    const text = await f.text()
    setNotes(prev => prev ? prev + '\n\n' + text : text)
  }

  async function generate() {
    if (!notes.trim()) { setError('Paste or upload your notes first.'); return }
    setError(''); setGenerating(true); setCardReady(false)
    try {
      const res = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorNotes: notes,
          subject: subject || 'General',
          studentName: user.displayName || 'Student',
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      const c: SummaryCard = data.summaryCard || BLANK
      setCard(c)
      setCardReady(true)
    } catch {
      setError('Could not generate summary. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function publish() {
    if (!cardReady) return
    setPublishing(true); setError('')
    try {
      await addDoc(collection(db, 'sessions'), {
        studentId:     user.uid,
        studentEmail:  user.email,
        studentName:   user.displayName || 'Student',
        subject:       subject || 'General',
        date:          new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        scheduledAt:   Date.now(),
        duration:      '—',
        tutorId:       null,
        tutorName:     'Self',
        status:        'completed',
        summaryStatus: 'published',
        summaryCard:   card,
        summary: {
          published: true,
          title:     card.title,
          bullets:   card.topics,
          subject:   subject || 'General',
          date:      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          duration:  '—',
        },
        createdAt: serverTimestamp(),
        selfAuthored: true,
      })
      setPublished(true)
    } catch {
      setError('Could not publish. Please try again.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className={s.shell}>
      <Navbar user={user} onSignOut={() => signOut(auth).then(() => navigate('/login', { replace: true }))} />
      <Sidebar />
      <main className={s.page}>
        <div className={s.header}>
          <h1>Organize Notes</h1>
          <p>Paste or upload your notes — AI will build a structured summary card you can save to Session Notes.</p>
        </div>

        {published ? (
          <div className={s.successBox}>
            <div className={s.successIcon}>✓</div>
            <h2>Summary card saved!</h2>
            <p>It's now in your Session Notes.</p>
            <div className={s.successBtns}>
              <button className={s.btnPrimary} onClick={() => navigate('/sessions')}>View Session Notes</button>
              <button className={s.btnOutline} onClick={() => { setPublished(false); setCardReady(false); setNotes(''); setCard(BLANK); setSubject('') }}>Create Another</button>
            </div>
          </div>
        ) : (
          <div className={s.layout}>
            {/* Left: input */}
            <div className={s.inputCol}>
              <div className={s.field}>
                <label className={s.label}>Subject</label>
                <input
                  className={s.input}
                  placeholder="e.g. Calculus, Chemistry, SAT Prep"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>

              <div className={s.field}>
                <label className={s.label}>Your Notes</label>
                <textarea
                  className={s.textarea}
                  placeholder="Paste your handwritten notes, typed notes, or anything you want summarized..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={14}
                />
              </div>

              <div className={s.fileRow}>
                <button className={s.btnOutline} onClick={() => fileRef.current?.click()}>
                  ↑ Attach File
                </button>
                {file && <span className={s.fileName}>{file.name}</span>}
                <input ref={fileRef} type="file" accept=".txt,.md,.pdf" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

              {error && <p className={s.error}>{error}</p>}

              <button
                className={s.btnGenerate}
                onClick={generate}
                disabled={generating || !notes.trim()}
              >
                {generating ? '✦ Generating…' : '✦ Generate Summary with AI'}
              </button>
            </div>

            {/* Right: summary card preview */}
            <div className={s.cardCol}>
              <div className={s.cardLabel}>Summary Card Preview</div>
              {!cardReady && !generating && (
                <div className={s.emptyCard}>
                  <span>Your summary card will appear here</span>
                  <p>Add your notes and click Generate to build it.</p>
                </div>
              )}
              {generating && (
                <div className={s.emptyCard}>
                  <div className={s.spinner} />
                  <span>Generating your summary…</span>
                </div>
              )}
              {cardReady && (
                <div className={s.previewCard}>
                  <div className={s.fieldGroup}>
                    <label className={s.cardFieldLabel}>Title</label>
                    <input className={s.cardInput} value={card.title}
                      onChange={e => setCard(c => ({ ...c, title: e.target.value }))} />
                  </div>

                  <div className={s.fieldGroup}>
                    <label className={s.cardFieldLabel}>Topics Covered</label>
                    {card.topics.map((t, i) => (
                      <div key={i} className={s.topicRow}>
                        <input className={s.cardInput} value={t}
                          onChange={e => setCard(c => { const tt = [...c.topics]; tt[i] = e.target.value; return { ...c, topics: tt } })} />
                        <button className={s.removeBtn} onClick={() => setCard(c => ({ ...c, topics: c.topics.filter((_, j) => j !== i) }))}>✕</button>
                      </div>
                    ))}
                    <button className={s.addBtn} onClick={() => setCard(c => ({ ...c, topics: [...c.topics, ''] }))}>+ Add topic</button>
                  </div>

                  <div className={s.fieldGroup}>
                    <label className={s.cardFieldLabel}>Key Takeaways / Next Steps</label>
                    {card.homework.map((h, i) => (
                      <div key={i} className={s.topicRow}>
                        <input className={s.cardInput} value={h}
                          onChange={e => setCard(c => { const hh = [...c.homework]; hh[i] = e.target.value; return { ...c, homework: hh } })} />
                        <button className={s.removeBtn} onClick={() => setCard(c => ({ ...c, homework: c.homework.filter((_, j) => j !== i) }))}>✕</button>
                      </div>
                    ))}
                    <button className={s.addBtn} onClick={() => setCard(c => ({ ...c, homework: [...c.homework, ''] }))}>+ Add item</button>
                  </div>

                  <div className={s.fieldGroup}>
                    <label className={s.cardFieldLabel}>Progress Note</label>
                    <textarea className={s.cardTextarea} rows={3} value={card.progress}
                      onChange={e => setCard(c => ({ ...c, progress: e.target.value }))} />
                  </div>

                  <button className={s.btnPrimary} onClick={publish} disabled={publishing || !card.title}>
                    {publishing ? 'Saving…' : 'Save to Session Notes →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
