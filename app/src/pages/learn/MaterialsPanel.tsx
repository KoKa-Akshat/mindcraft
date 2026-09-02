import type { RefObject } from 'react'
import MathText from '../../components/MathText'
import { Eyebrow, TEXT_FAINT, TEXT_PRIMARY, TEXT_SOFT, type MaterialsState } from './shared'

export interface MaterialsPanelProps {
  materials: MaterialsState | null
  materialsBusy: string
  materialsError: string
  selectedQ: number | null
  materialsFileRef: RefObject<HTMLInputElement>
  materialsAccept: string
  onFileChosen: (file: File) => void
  onSelectQuestion: (i: number) => void
  onClearMaterials: () => void
}

/** "Your materials" upload button + extracted-question list. Purely
 * presentational, extraction/upload/selection logic lives in Learn.tsx. */
export default function MaterialsPanel({
  materials, materialsBusy, materialsError, selectedQ, materialsFileRef,
  materialsAccept, onFileChosen, onSelectQuestion, onClearMaterials,
}: MaterialsPanelProps) {
  return (
    <div>
      <Eyebrow color="#5EC8F0">Your materials</Eyebrow>
      {!materials ? (
        <>
          <p style={{ margin: '8px 0 12px', fontSize: 13.5, lineHeight: 1.65, color: TEXT_SOFT }}>
            Working from a real worksheet? Upload it and every question becomes clickable, each with its own hint path next to the reading. We read and split your pages; we never solve them for you.
          </p>
          <input
            ref={materialsFileRef}
            type="file"
            accept={materialsAccept}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFileChosen(f)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => materialsFileRef.current?.click()}
            disabled={!!materialsBusy}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px dashed rgba(94,200,240,0.5)', background: 'rgba(94,200,240,0.07)', color: '#5EC8F0', fontWeight: 700, fontSize: 13, cursor: materialsBusy ? 'default' : 'pointer' }}
          >
            {materialsBusy || 'Upload a worksheet (PDF or photo)'}
          </button>
        </>
      ) : (
        <>
          <p style={{ margin: '8px 0 12px', fontSize: 12.5, lineHeight: 1.55, color: TEXT_FAINT }}>
            {materials.fileName} · {materials.pageCount} page{materials.pageCount > 1 ? 's' : ''} · {materials.questions.length} question{materials.questions.length > 1 ? 's' : ''} found. Tap a question and its help opens on the left, next to the reading.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {materials.questions.map((q, i) => {
              const active = selectedQ === i
              return (
                <button
                  key={q.id}
                  className="lrn-qrow"
                  onClick={() => onSelectQuestion(i)}
                  style={{
                    textAlign: 'left', padding: '11px 13px', borderRadius: 11, cursor: 'pointer',
                    border: `1px solid ${active ? 'rgba(94,200,240,0.6)' : 'rgba(205,220,208,0.13)'}`,
                    background: active ? 'rgba(94,200,240,0.12)' : 'rgba(205,220,208,0.04)',
                    color: TEXT_PRIMARY, fontSize: 14, lineHeight: 1.55,
                  }}
                >
                  <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: active ? '#5EC8F0' : TEXT_FAINT }}>
                      {q.number ? `Q${q.number}` : `#${i + 1}`}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <MathText text={q.text.length > 220 ? `${q.text.slice(0, 220)}...` : q.text} />
                    </span>
                  </span>
                  {q.ambiguous && (
                    <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#F0C060' }}>
                      We may have split this one oddly. Read it before you start.
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <button
            onClick={onClearMaterials}
            style={{ marginTop: 12, fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(205,220,208,0.2)', background: 'transparent', color: TEXT_FAINT, cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            Clear and upload a different file
          </button>
        </>
      )}
      {materialsError && <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.55, color: '#FF7B7B' }}>{materialsError}</p>}
    </div>
  )
}

