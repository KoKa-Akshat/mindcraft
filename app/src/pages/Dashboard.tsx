import { useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import { useUser } from '../App'
import { useStudentData } from '../hooks/useStudentData'
import Sidebar from '../components/Sidebar'
import HeroBar from '../components/HeroBar'
import LastSession from '../components/LastSession'
import ConstellationCard from '../components/ConstellationCard'
import LearningGPS from '../components/LearningGPS'
import HomeworkProgress from '../components/HomeworkProgress'
import s from './Dashboard.module.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const user     = useUser()
  const navigate = useNavigate()
  const data     = useStudentData(user)

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

              {/* Constellation — top, full prominence */}
              <section className={s.section}>
                <h2 className={s.sectionTitle}>Your Constellation</h2>
                <ConstellationCard userId={user.uid} />
              </section>

              {/* Homework progress — assigned by tutor */}
              <HomeworkProgress homework={data.homework} />

              {/* Last session summary */}
              <LastSession session={data.lastSession} />
            </div>

            {/* ── Right panel ── */}
            <div className={s.panel}>

              {/* Homework Help — vivid */}
              <div className={s.homeworkCard}>
                <div className={s.homeworkHeader}>
                  <span className={s.homeworkTitle}>Homework Help</span>
                  <span className={s.homeworkBadge}>AI-Powered</span>
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

              {/* Learning GPS */}
              <LearningGPS userId={user.uid} />

            </div>
          </div>
        )}
      </main>
    </div>
  )
}
