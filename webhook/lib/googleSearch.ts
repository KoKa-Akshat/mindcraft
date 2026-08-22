/**
 * Shared Google Custom Search JSON API client — factored out of
 * researchAgent.ts (2026-08-22) so discover-internships.ts can reuse the
 * exact same real search plumbing instead of a second implementation. This
 * is the ONE real live-web-search capability anywhere in this repo — no
 * Anthropic web-search tool exists here; do not build a second one.
 */

export type SourceKind = 'google' | 'reddit' | 'quora' | 'forum'

export interface SearchResult {
  title: string
  url: string
  displayLink: string
  snippet: string
  kind: SourceKind
}

const GOOGLE_SEARCH_API = 'https://www.googleapis.com/customsearch/v1'
const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY ?? ''
const GOOGLE_CX = process.env.GOOGLE_SEARCH_ENGINE_ID ?? ''

const SOURCE_KIND_BY_QUERY: { pattern: RegExp; kind: SourceKind }[] = [
  { pattern: /site:reddit\.com/i, kind: 'reddit' },
  { pattern: /site:quora\.com/i, kind: 'quora' },
  { pattern: /forum|discussion|students/i, kind: 'forum' },
]

function sourceKindFor(query: string, url: string): SourceKind {
  if (/reddit\.com/i.test(url)) return 'reddit'
  if (/quora\.com/i.test(url)) return 'quora'
  return SOURCE_KIND_BY_QUERY.find((rule) => rule.pattern.test(query))?.kind ?? 'google'
}

function safePreview(snippet: string): string {
  return snippet.replace(/\s+/g, ' ').trim().slice(0, 260)
}

export async function googleSearch(query: string, num = 5): Promise<SearchResult[]> {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    throw new Error('GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID must be configured.')
  }

  const url = new URL(GOOGLE_SEARCH_API)
  url.searchParams.set('key', GOOGLE_API_KEY)
  url.searchParams.set('cx', GOOGLE_CX)
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(num))
  url.searchParams.set('safe', 'active')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Google Search failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    items?: { title?: string; link?: string; displayLink?: string; snippet?: string }[]
  }

  return (data.items ?? [])
    .filter((item) => item.link && item.title)
    .map((item) => ({
      title: item.title ?? '',
      url: item.link ?? '',
      displayLink: item.displayLink ?? new URL(item.link ?? 'https://example.com').hostname,
      snippet: safePreview(item.snippet ?? ''),
      kind: sourceKindFor(query, item.link ?? ''),
    }))
}
