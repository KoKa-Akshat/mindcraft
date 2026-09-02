/**
 * Shared real-web-search client — factored out of researchAgent.ts
 * (2026-08-22) so discover-internships.ts can reuse the exact same search
 * plumbing instead of a second implementation. This is the ONE real
 * live-web-search capability anywhere in this repo — no Anthropic
 * web-search tool exists here; do not build a second one.
 *
 * Backed by Serper (google.serper.dev), not Google's own Custom Search JSON
 * API, as of 2026-09-02. Two real, unrelated problems with Google's own API
 * forced the switch, both confirmed via live testing, not assumed:
 *   1. Google changed Programmable Search Engine policy on 2026-01-20: a
 *      NEWLY created engine can no longer search the whole web, only a
 *      curated "Sites to search" list capped at 50 domains. Workable for
 *      job search specifically (postings concentrate on a handful of
 *      boards + ATS platforms), but ruled out broader use.
 *   2. Separately, and worse: the Custom Search JSON API returned
 *      `403 "This project does not have the access to Custom Search JSON
 *      API"` on every single call, from a project with the API enabled, a
 *      linked billing account, and a freshly created search engine, the
 *      correct project selected the whole time. This is a known, currently
 *      unresolved issue on Google's side (multiple 2026 Google Developer
 *      forum threads report the exact same error on both new and
 *      years-old projects), not a configuration mistake, confirmed by
 *      exhausting every documented fix before switching.
 * Serper proxies real Google search results (see a live response: JPMorgan,
 * Harvard career services, Indeed, Glassdoor all showed up correctly for a
 * real internship query), no domain cap, works today. One real trade-off,
 * disclosed not silent: the old call passed `safe=active`; Serper's API has
 * no documented safe-search parameter. Acceptable here since every query
 * this file serves is a narrow, specific job/program search, not
 * open-ended, but worth knowing if this file ever serves a broader query.
 */

export type SourceKind = 'google' | 'reddit' | 'quora' | 'forum'

export interface SearchResult {
  title: string
  url: string
  displayLink: string
  snippet: string
  kind: SourceKind
}

const SERPER_SEARCH_API = 'https://google.serper.dev/search'
const SERPER_API_KEY = process.env.SERPER_API_KEY ?? ''

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
  if (!SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY must be configured.')
  }

  const response = await fetch(SERPER_SEARCH_API, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num }),
  })
  if (!response.ok) {
    throw new Error(`Serper search failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    organic?: { title?: string; link?: string; snippet?: string }[]
  }

  return (data.organic ?? [])
    .filter((item) => item.link && item.title)
    .map((item) => ({
      title: item.title ?? '',
      url: item.link ?? '',
      displayLink: new URL(item.link ?? 'https://example.com').hostname,
      snippet: safePreview(item.snippet ?? ''),
      kind: sourceKindFor(query, item.link ?? ''),
    }))
}
