/**
 * MathText — render inline and block LaTeX in question text.
 *
 * Patterns recognized:
 *   $$...$$ — block (display) math
 *   $...$   — inline math
 *   \frac, \sqrt, etc. — standalone TeX expressions (auto-wrapped)
 *
 * Graceful fallback: if KaTeX isn't loaded or the expression is malformed,
 * renders the raw TeX string so the question is still legible.
 */
import { useMemo } from 'react'
import AltDiagramCallout from './AltDiagramCallout'
import { splitAltDiagramSegments } from '../lib/altDiagram'
import { isGraphShapedAlt } from '../lib/plottablePoints'
import { renderNoBreakCoordinates } from '../lib/noBreakCoords'
import s from './MathText.module.css'

// Lazy KaTeX import — avoids bundling unless math is actually present.
let katexRenderToString: ((expr: string, opts: object) => string) | null = null

async function loadKatex() {
  if (katexRenderToString) return
  try {
    const mod = await import('katex')
    katexRenderToString = mod.default.renderToString
    // Import the KaTeX CSS (bundler handles this once)
    await import('katex/dist/katex.min.css')
  } catch {
    // KaTeX not available — fallback to plain text rendering
  }
}

// Pre-load on first module evaluation (non-blocking)
loadKatex()

function renderLatex(expr: string, displayMode = false): string {
  if (!katexRenderToString) return expr
  try {
    return katexRenderToString(expr, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    })
  } catch {
    return expr
  }
}

// Split text into segments: plain text, math expressions, and diagram callouts.
type Segment =
  | { type: 'text'; content: string }
  | { type: 'inline'; expr: string }
  | { type: 'block'; expr: string }
  | { type: 'diagram'; alt: string }

/** Reject prose-with-currency mistaken for inline LaTeX (e.g. $14 ... $16). */
function looksLikeMath(expr: string): boolean {
  if (/\\[a-zA-Z]+/.test(expr)) return true
  const words = expr.trim().split(/\s+/)
  const alphaWords = words.filter(w => /^[a-zA-Z]+$/.test(w))
  const hasOperator = /[+*/^_=]/.test(expr) || /\d\s*[-+]\s*\d/.test(expr)
  if (hasOperator) return true
  // Currency-like decimal (e.g. "3.25") plus a trailing word → price line, not math.
  if (/\d+\.\d{2}\b/.test(expr) && alphaWords.length >= 1) return false
  if (alphaWords.length >= 2) return false
  return true
}

/**
 * Eedi-sourced items embed accessibility descriptions as markdown images with
 * empty URLs (`![long alt text]()`). Ingestion rewrites stems but choice text
 * can still carry the raw markdown — surface the alt text instead.
 */
function replaceMarkdownImages(text: string): string {
  return text.replace(/!\[([^\]]*)\]\(\s*[^)]*\)/g, (_, alt: string) => {
    const trimmed = alt.trim()
    return trimmed ? `(Diagram: ${trimmed})` : '(Diagram)'
  })
}

/** Parse LaTeX/plain-text segments within a chunk already known to contain
 * no `(Diagram: ...)` callouts (those are split out first, see parse()). */
function parseMath(text: string): Segment[] {
  const segments: Segment[] = []
  // Match (in priority order):
  //   $$...$$  block dollar
  //   \[...\]  block LaTeX
  //   $...$    inline dollar
  //   \(...\)  inline LaTeX
  const re = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ type: 'text', content: text.slice(last, m.index) })
    }
    const raw = m[0]
    if (raw.startsWith('$$') || raw.startsWith('\\[')) {
      const expr = raw.startsWith('$$') ? raw.slice(2, -2).trim() : raw.slice(2, -2).trim()
      segments.push({ type: 'block', expr })
    } else if (raw.startsWith('\\(')) {
      segments.push({ type: 'inline', expr: raw.slice(2, -2).trim() })
    } else {
      const expr = raw.slice(1, -1).trim()
      if (looksLikeMath(expr)) {
        segments.push({ type: 'inline', expr })
      } else {
        segments.push({ type: 'text', content: raw })
      }
    }
    last = m.index + raw.length
  }
  if (last < text.length) {
    segments.push({ type: 'text', content: text.slice(last) })
  }
  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}

/** Eedi ingestion rewrites unusable images into `(Diagram: alt text)` — see
 * CLAUDE.md "Question bank" and lib/altDiagram.ts. Split those out first so
 * they render as a real diagram or a clearly-framed caption (AltDiagramCallout)
 * instead of a raw sentence buried mid-choice, then parse the rest for math
 * as before. */
function parse(text: string): Segment[] {
  const parts = splitAltDiagramSegments(text)
  const segments: Segment[] = []
  for (const part of parts) {
    if (part.kind === 'diagram') {
      segments.push({ type: 'diagram', alt: part.alt })
    } else if (part.content) {
      segments.push(...parseMath(part.content))
    }
  }
  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}

interface Props {
  text: string
  className?: string
  questionId?: string
  /** True when a GraphBox panel elsewhere on the page is already plotting
   * this same question's points/expression (see lib/plottablePoints.ts). A
   * graph-shaped `(Diagram: ...)` segment then renders as a short pointer
   * instead of a second "Picture: ..." caption or parsed figure describing
   * the identical axes/points — the reported "picture card AND graph panel
   * both show the same thing" bug. Non-graph diagram segments (a Venn
   * diagram, a dimensioned shape) are unaffected. */
  graphAlreadyShown?: boolean
}

export default function MathText({ text, className, questionId, graphAlreadyShown }: Props) {
  const cleaned = useMemo(() => replaceMarkdownImages(text), [text])
  const segments = useMemo(() => parse(cleaned), [cleaned])

  const hasMath = segments.some(s => s.type !== 'text')

  if (!hasMath) {
    return <span className={className}>{renderNoBreakCoordinates(cleaned)}</span>
  }

  return (
    <span className={`${s.mathText} ${className ?? ''}`}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{renderNoBreakCoordinates(seg.content, `mt-${i}`)}</span>
        }
        if (seg.type === 'diagram') {
          if (graphAlreadyShown && isGraphShapedAlt(seg.alt)) {
            return <span key={i} className={s.graphRefNote}>(see graph →)</span>
          }
          return <AltDiagramCallout key={i} alt={seg.alt} questionId={questionId} />
        }
        if (seg.type === 'inline') {
          const html = renderLatex(seg.expr, false)
          if (html === seg.expr) {
            return <span key={i} className={s.texFallback}>{seg.expr}</span>
          }
          return (
            <span
              key={i}
              className={s.mathInline}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        }
        // block
        const html = renderLatex(seg.expr, true)
        if (html === seg.expr) {
          return <div key={i} className={s.texFallback}>{seg.expr}</div>
        }
        return (
          <div
            key={i}
            className={s.mathBlock}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      })}
    </span>
  )
}
