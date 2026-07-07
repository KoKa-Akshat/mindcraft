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

// Split text into segments: plain text and math expressions.
type Segment =
  | { type: 'text'; content: string }
  | { type: 'inline'; expr: string }
  | { type: 'block'; expr: string }

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

function parse(text: string): Segment[] {
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

interface Props {
  text: string
  className?: string
}

export default function MathText({ text, className }: Props) {
  const cleaned = useMemo(() => replaceMarkdownImages(text), [text])
  const segments = useMemo(() => parse(cleaned), [cleaned])

  const hasMath = segments.some(s => s.type !== 'text')

  if (!hasMath) {
    return <span className={className}>{cleaned}</span>
  }

  return (
    <span className={`${s.mathText} ${className ?? ''}`}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{seg.content}</span>
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
