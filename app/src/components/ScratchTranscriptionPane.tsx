import { useEffect, useRef, useState } from 'react'
import { auth } from '../firebase'
import { WEBHOOK_BASE } from '../lib/mlApi'
import MathText from './MathText'
import s from './ScratchTranscriptionPane.module.css'

export interface ScratchTranscription {
  text: string
  latex: string
  editedByStudent: boolean
}

interface Props {
  imageDataUrl: string
  resetKey?: string | number
  className?: string
  onChange?: (value: ScratchTranscription | null) => void
}

function emptyTranscription(): ScratchTranscription {
  return { text: '', latex: '', editedByStudent: false }
}

export default function ScratchTranscriptionPane({ imageDataUrl, resetKey, className, onChange }: Props) {
  const [value, setValue] = useState<ScratchTranscription>(() => emptyTranscription())
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [lastImage, setLastImage] = useState('')
  const seqRef = useRef(0)
  const onChangeRef = useRef(onChange)
  const latestImageRef = useRef(imageDataUrl)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    latestImageRef.current = imageDataUrl
  }, [imageDataUrl])

  useEffect(() => {
    const next = emptyTranscription()
    setValue(next)
    setVisible(false)
    setLoading(false)
    setEditing(false)
    setLastImage('')
    onChangeRef.current?.(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useEffect(() => {
    if (!imageDataUrl || imageDataUrl === lastImage) return
    if (loading) return

    const seq = ++seqRef.current
    const targetImage = imageDataUrl
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) return
        const res = await fetch(`${WEBHOOK_BASE}/api/transcribe-scratch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageBase64: targetImage }),
        })
        const data = await res.json().catch(() => ({}))
        if (seq !== seqRef.current) return
        if (latestImageRef.current !== targetImage) return
        setLastImage(targetImage)
        if (!res.ok || data.unavailable) {
          setVisible(false)
          onChangeRef.current?.(null)
          return
        }
        const next = {
          text: typeof data.text === 'string' ? data.text : '',
          latex: typeof data.latex === 'string' ? data.latex : '',
          editedByStudent: false,
        }
        setValue(next)
        setVisible(Boolean(next.text || next.latex))
        setEditing(false)
        onChangeRef.current?.(next)
      } catch {
        if (seq === seqRef.current && latestImageRef.current === targetImage) {
          setVisible(false)
          onChangeRef.current?.(null)
        }
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [imageDataUrl, lastImage, loading])

  function editLatex(latex: string) {
    const next = { ...value, latex, editedByStudent: true }
    setValue(next)
    onChangeRef.current?.(next)
  }

  function editText(text: string) {
    const next = { ...value, text, editedByStudent: true }
    setValue(next)
    onChangeRef.current?.(next)
  }

  if (!imageDataUrl || (!visible && !loading)) return null

  return (
    <section className={`${s.pane} ${className ?? ''}`}>
      <div className={s.header}>
        <span className={s.label}>What we read</span>
        {visible && (
          <button type="button" className={s.editBtn} onClick={() => setEditing(v => !v)}>
            {editing ? 'preview' : 'fix anything we misread'}
          </button>
        )}
      </div>

      {loading && !visible ? (
        <div className={s.loading}>Reading your work...</div>
      ) : editing ? (
        <div className={s.editGrid}>
          <label className={s.field}>
            <span>plain text</span>
            <textarea value={value.text} onChange={e => editText(e.target.value)} rows={3} />
          </label>
          <label className={s.field}>
            <span>LaTeX</span>
            <textarea value={value.latex} onChange={e => editLatex(e.target.value)} rows={3} />
          </label>
        </div>
      ) : (
        <div className={s.preview}>
          {value.latex ? <MathText text={value.latex} /> : <span>{value.text}</span>}
        </div>
      )}
    </section>
  )
}
