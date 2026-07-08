import { useEffect, useRef, useState } from 'react'
import { auth } from '../firebase'
import { WEBHOOK_BASE, checkWork, type CheckWorkResult } from '../lib/mlApi'
import { mapCheckWorkRule } from '../lib/workEvidence'
import {
  buildInkLines,
  exportLineCrop,
  lineInkFingerprint,
} from '../lib/inkLines'
import type { ScratchStrokeData, WorkLine } from '../types'
import MathText from './MathText'
import s from './ScratchTranscriptionPane.module.css'

export interface ScratchTranscription {
  text: string
  latex: string
  editedByStudent: boolean
}

export interface ScratchInkState {
  transcription: ScratchTranscription
  workLines: WorkLine[]
}

interface Props {
  imageDataUrl: string
  strokeData?: ScratchStrokeData | null
  resetKey?: string | number
  className?: string
  onChange?: (value: ScratchInkState | null) => void
  onDebugChange?: (show: boolean) => void
}

function emptyTranscription(): ScratchTranscription {
  return { text: '', latex: '', editedByStudent: false }
}

function deriveTranscription(workLines: WorkLine[]): ScratchTranscription {
  return {
    text: workLines.map(l => l.text).filter(Boolean).join('\n'),
    latex: workLines.map(l => l.latex).filter(Boolean).join('\n'),
    editedByStudent: workLines.some(l => l.editedByStudent),
  }
}

function isEmptyWork(workLines: WorkLine[]): boolean {
  return workLines.every(l => !l.text && !l.latex)
}

export default function ScratchTranscriptionPane({
  imageDataUrl,
  strokeData,
  resetKey,
  className,
  onChange,
  onDebugChange,
}: Props) {
  const [workLines, setWorkLines] = useState<WorkLine[]>([])
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [debugOutlines, setDebugOutlines] = useState(false)
  const [workCheck, setWorkCheck] = useState<CheckWorkResult | null>(null)
  const [lastInkKey, setLastInkKey] = useState('')
  const seqRef = useRef(0)
  const onChangeRef = useRef(onChange)
  const workLinesRef = useRef(workLines)
  const latestImageRef = useRef(imageDataUrl)
  const latestStrokeRef = useRef(strokeData)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    workLinesRef.current = workLines
  }, [workLines])

  useEffect(() => {
    latestImageRef.current = imageDataUrl
  }, [imageDataUrl])

  useEffect(() => {
    latestStrokeRef.current = strokeData
  }, [strokeData])

  useEffect(() => {
    onDebugChange?.(debugOutlines)
  }, [debugOutlines, onDebugChange])

  function emit(workLinesNext: WorkLine[]) {
    setWorkLines(workLinesNext)
    workLinesRef.current = workLinesNext
    onChangeRef.current?.({
      transcription: deriveTranscription(workLinesNext),
      workLines: workLinesNext,
    })
  }

  useEffect(() => {
    setWorkLines([])
    workLinesRef.current = []
    setVisible(false)
    setLoading(false)
    setFailed(false)
    setEditing(false)
    setDebugOutlines(false)
    setWorkCheck(null)
    setLastInkKey('')
    onChangeRef.current?.(null)
    onDebugChange?.(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useEffect(() => {
    const strokes = strokeData?.strokes
    if (!imageDataUrl || !strokes?.length) return
    const inkKey = JSON.stringify(strokes)
    if (inkKey === lastInkKey) return
    if (loading) return

    const seq = ++seqRef.current
    const targetStrokeData = strokeData!
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setFailed(false)
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) return

        const segments = buildInkLines(
          targetStrokeData.strokes,
          targetStrokeData.width,
          targetStrokeData.height,
        )
        if (!segments.length) return

        const prevLines = workLinesRef.current
        const preserved = new Map<string, WorkLine>()
        for (const line of prevLines) {
          if (!line.editedByStudent) continue
          preserved.set(
            lineInkFingerprint(targetStrokeData.strokes, line.strokeIdx),
            line,
          )
        }

        const toTranscribe: Array<{ seg: (typeof segments)[number]; crop: string }> = []

        for (const seg of segments) {
          const fp = lineInkFingerprint(targetStrokeData.strokes, seg.strokeIdx)
          if (preserved.has(fp)) continue
          toTranscribe.push({
            seg,
            crop: exportLineCrop(targetStrokeData.strokes, seg.strokeIdx, seg.bbox, 2),
          })
        }

        let unavailable = false
        const freshResults: Array<{ text: string; latex: string }> = []

        if (toTranscribe.length > 0) {
          const res = await fetch(`${WEBHOOK_BASE}/api/transcribe-scratch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              lines: toTranscribe.map(t => ({ imageBase64: t.crop })),
            }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || data.unavailable) unavailable = true
          const perLine: unknown[] = Array.isArray(data.perLine) ? data.perLine : []
          for (let i = 0; i < toTranscribe.length; i++) {
            const row = perLine[i] as { text?: string; latex?: string } | undefined
            freshResults.push({
              text: typeof row?.text === 'string' ? row.text : '',
              latex: typeof row?.latex === 'string' ? row.latex : '',
            })
          }
        }

        if (seq !== seqRef.current) return
        if (latestStrokeRef.current !== targetStrokeData) return

        let freshIdx = 0
        const workLinesNext: WorkLine[] = segments.map(seg => {
          const fp = lineInkFingerprint(targetStrokeData.strokes, seg.strokeIdx)
          const kept = preserved.get(fp)
          if (kept) {
            return { ...kept, bbox: seg.bbox, strokeIdx: seg.strokeIdx }
          }
          const result = freshResults[freshIdx++] ?? { text: '', latex: '' }
          return {
            bbox: seg.bbox,
            strokeIdx: seg.strokeIdx,
            text: result.text,
            latex: result.latex,
            editedByStudent: false,
          }
        })

        setLastInkKey(inkKey)
        const empty = isEmptyWork(workLinesNext)
        setFailed(unavailable || empty)
        setVisible(true)
        setEditing(unavailable || empty)
        emit(workLinesNext)
      } catch {
        if (seq === seqRef.current && latestStrokeRef.current === targetStrokeData) {
          const segments = buildInkLines(
            targetStrokeData.strokes,
            targetStrokeData.width,
            targetStrokeData.height,
          )
          const workLinesNext: WorkLine[] = segments.map(seg => ({
            bbox: seg.bbox,
            strokeIdx: seg.strokeIdx,
            text: '',
            latex: '',
            editedByStudent: false,
          }))
          setLastInkKey(inkKey)
          setFailed(true)
          setVisible(true)
          setEditing(true)
          emit(workLinesNext)
        }
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [imageDataUrl, strokeData, lastInkKey, loading])

  function editLine(index: number, field: 'text' | 'latex', value: string) {
    const workLinesNext = workLines.map((line, i) => (
      i === index
        ? { ...line, [field]: value, editedByStudent: true }
        : line
    ))
    setFailed(false)
    setWorkCheck(null)
    emit(workLinesNext)
  }

  function toggleDebug() {
    setDebugOutlines(v => !v)
  }

  const transcription = deriveTranscription(workLines)
  const latexKey = workLines.map(line => line.latex.trim()).join('\n')

  useEffect(() => {
    const lines = workLines
      .map(line => line.latex.trim())
      .filter(Boolean)
      .map(latex => ({ latex }))
    if (!visible || loading || failed || lines.length < 2) {
      setWorkCheck(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      const studentId = auth.currentUser?.uid
      if (!studentId) return
      const result = await checkWork(studentId, lines)
      if (cancelled) return
      setWorkCheck(result)
      if (!result) return

      setWorkLines(prev => {
        const updated = prev.map((line, i) => {
          const verdict = result.verdictPerLine.find(v => v.line === i)
          return verdict
            ? {
                ...line,
                verdict: verdict.verdict,
                checkReason: verdict.reason,
                rule: mapCheckWorkRule(verdict.rule),
              }
            : line
        })
        workLinesRef.current = updated
        onChangeRef.current?.({
          transcription: deriveTranscription(updated),
          workLines: updated,
        })
        return updated
      })
    }, 700)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latexKey, visible, loading, failed])

  if (!imageDataUrl || (!visible && !loading && !failed)) return null

  return (
    <section className={`${s.pane} ${className ?? ''}`}>
      <div className={s.header}>
        <span className={s.label}>What we read</span>
        <div className={s.headerActions}>
          {workLines.length > 1 && (
            <button type="button" className={s.editBtn} onClick={toggleDebug}>
              {debugOutlines ? 'hide lines' : 'show lines'}
            </button>
          )}
          {(visible || failed) && !loading && (
            <button type="button" className={s.editBtn} onClick={() => setEditing(v => !v)}>
              {editing ? 'preview' : 'fix anything we misread'}
            </button>
          )}
        </div>
      </div>

      {failed && (
        <p className={s.failedMsg}>
          Couldn&apos;t read this yet — keep writing or fix it by hand.
        </p>
      )}

      {loading && !visible && !failed ? (
        <div className={s.loading}>Reading your work...</div>
      ) : editing ? (
        <div className={s.lineEditList}>
          {workLines.map((line, i) => (
            <div key={i} className={s.lineEditBlock}>
              <span className={s.lineLabel}>Line {i + 1}</span>
              <label className={s.field}>
                <span>plain text</span>
                <textarea
                  value={line.text}
                  onChange={e => editLine(i, 'text', e.target.value)}
                  rows={2}
                />
              </label>
              <label className={s.field}>
                <span>LaTeX</span>
                <textarea
                  value={line.latex}
                  onChange={e => editLine(i, 'latex', e.target.value)}
                  rows={2}
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <div className={s.preview}>
          {workLines.length > 0 ? (
            workLines.map((line, i) => (
              <div key={i} className={line.verdict === 'wrong' ? s.suspectLine : s.linePreview}>
                {line.latex
                  ? <MathText text={line.latex} />
                  : line.text
                    ? <span>{line.text}</span>
                    : null}
                {line.rule?.label && (
                  <span className={s.ruleChip}>{line.rule.label}</span>
                )}
              </div>
            ))
          ) : transcription.latex ? (
            <MathText text={transcription.latex} />
          ) : (
            <span>{transcription.text}</span>
          )}
        </div>
      )}

      {workCheck?.hypothesis && (
        <div className={s.hintChip}>
          <span>Check this step</span>
          {workCheck.hypothesis.label}
        </div>
      )}
    </section>
  )
}
