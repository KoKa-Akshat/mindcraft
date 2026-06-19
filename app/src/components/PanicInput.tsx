/**
 * PanicInput.tsx — First screen of the student prep loop.
 * "What's making you anxious?" → triggers diagnose-gaps endpoint.
 * Design: no nav, no sidebar, centered, max-width 600px.
 */

import { useState, useRef, useCallback } from 'react'
import type { DiagnoseResult } from '../pages/Prep'
import s from './PanicInput.module.css'

type ExamPill = 'SAT_MATH' | 'ACT_MATH' | 'IB_MATH_AA' | 'IB_MATH_AI' | 'AP_CALC_AB'
type TimeHorizon = 1 | 3 | 7 | 30

const PILLS: { id: ExamPill; label: string }[] = [
  { id: 'SAT_MATH',   label: 'SAT Math'   },
  { id: 'ACT_MATH',   label: 'ACT Math'   },
  { id: 'IB_MATH_AA', label: 'IB Math'    },
  { id: 'AP_CALC_AB', label: 'AP Calc'    },
]

const TIME_OPTIONS: { value: TimeHorizon; label: string; sublabel: string }[] = [
  { value: 1,  label: 'Today',    sublabel: 'Exam is today or tomorrow' },
  { value: 3,  label: '3 days',   sublabel: 'This week' },
  { value: 7,  label: '1 week',   sublabel: 'Next week' },
  { value: 30, label: '2+ weeks', sublabel: 'Building from scratch' },
]

const API_BASE = import.meta.env.VITE_WEBHOOK_URL ?? 'https://mindcraft-webhook.vercel.app'

interface Props {
  diagnosing: boolean
  onDiagnosing: () => void
  onDiagnosed:  (r: DiagnoseResult) => void
  studentId?:   string
}

export default function PanicInput({ diagnosing, onDiagnosing, onDiagnosed, studentId }: Props) {
  const [text,        setText]        = useState('')
  const [examType,    setExamType]    = useState<ExamPill | null>(null)
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>(7)
  const [file,        setFile]        = useState<File | null>(null)
  const [dragging,    setDragging]    = useState(false)
  const [error,       setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const mode = timeHorizon <= 4 ? 'triage' : 'foundation'

  const onFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }, [])

  async function submit() {
    if (!examType) { setError('Pick an exam type first.'); return }
    if (!text.trim() && !file) { setError('Describe your exam or drop a practice test.'); return }
    setError('')
    onDiagnosing()

    try {
      let body: Record<string, unknown>

      if (file) {
        const base64 = await fileToBase64(file)
        body = {
          examType, timeToExam: timeHorizon,
          inputType:    'file',
          fileBase64:   base64,
          fileMimeType: file.type || 'image/jpeg',
          studentId,
        }
      } else {
        body = {
          examType, timeToExam: timeHorizon,
          inputType:       'text',
          textDescription: text.trim(),
          studentId,
        }
      }

      const res = await fetch(`${API_BASE}/api/gemini`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'diagnose', ...body }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Diagnosis failed')
      }

      const data = await res.json() as DiagnoseResult
      onDiagnosed(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong — try again.')
    }
  }

  return (
    <div className={s.shell}>
      <div className={s.inner}>

        <div className={s.brand}>Mind<span>Craft</span></div>

        <h1 className={s.headline}>What's making you anxious?</h1>
        <p  className={s.sub}>Tell me your exam or drop a practice test.</p>

        {/* Time to exam */}
        <div className={s.timeRow}>
          <span className={s.timeLabel}>When is your exam?</span>
          <div className={s.timePills}>
            {TIME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`${s.timePill} ${timeHorizon === opt.value ? s.timePillActive : ''}`}
                onClick={() => setTimeHorizon(opt.value)}
                type="button"
                title={opt.sublabel}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode badge */}
        <div className={`${s.modeBadge} ${mode === 'triage' ? s.modeTriage : s.modeFoundation}`}>
          {mode === 'triage'
            ? '🚨 Triage mode — targeting exam traps, not full mastery'
            : '🔧 Foundation mode — repairing from the root up'}
        </div>

        {/* Exam pills */}
        <div className={s.pills}>
          {PILLS.map(p => (
            <button
              key={p.id}
              className={`${s.pill} ${examType === p.id ? s.pillActive : ''}`}
              onClick={() => setExamType(p.id)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Text input */}
        <textarea
          className={s.textarea}
          placeholder="e.g. SAT Math in 5 days, keep failing on quadratics"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          disabled={diagnosing}
        />

        {/* File drop zone */}
        <div
          className={`${s.dropzone} ${dragging ? s.dropzoneOver : ''} ${file ? s.dropzoneHasFile : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onFileDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
          />
          {file ? (
            <span className={s.fileName}>
              {diagnosing ? '⏳ extracting…' : `📄 ${file.name}`}
              {!diagnosing && (
                <button
                  className={s.removeFile}
                  onClick={e => { e.stopPropagation(); setFile(null) }}
                  type="button"
                >✕</button>
              )}
            </span>
          ) : (
            <span className={s.dropHint}>
              <span className={s.dropIcon}>↑</span>
              Drop a practice test or photo of notes
              <span className={s.dropFormats}>JPG · PNG · PDF</span>
            </span>
          )}
        </div>

        {error && <p className={s.error}>{error}</p>}

        <button
          className={s.submitBtn}
          onClick={submit}
          disabled={diagnosing}
          type="button"
        >
          {diagnosing
            ? <><span className={s.btnSpinner} /> Finding your gaps…</>
            : 'Show me my gaps →'
          }
        </button>

        <p className={s.freeNote}>Gap map is always free. No account needed to start.</p>
      </div>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
