/**
 * GET/POST /api/microsims
 *
 * Serves Dan McCreary's FULL extracted MicroSim corpus to the app — the
 * third leg of the Archive-Simulations union (ARCHIVE_SIMS: Store C). Same
 * bug shape archive-books.ts documents for books: the iOS Archive only ever
 * showed sims from the one narrow source it happened to read (assembled
 * books' inlined sim_html, ~9 subjects), while a COMPLETE, already-extracted
 * corpus — 4,013 real p5.js sims across 95 of Dan's repos, pulled by
 * mindcraft-content-engine's microsim_extractor.py — sat unreachable (only
 * the 123-sim Calculus set is bundled into the app binary; ~88MB total is
 * far too big to bundle wholesale).
 *
 * Split the same way archive-books.ts split list-vs-content: the LIST is a
 * small derived manifest (data/microsims-manifest.json, regenerate via
 * scripts/build-microsims-manifest.ts — metadata + upstream fetch
 * coordinates only, never the 88MB of content), and CONTENT is assembled on
 * demand per sim by fetching the real files from Dan's own GitHub repos
 * (raw.githubusercontent.com) and inlining .js/.css into one self-contained
 * html — the same end shape MicroSimRecord.selfContainedHTML produces
 * on-device for the bundled set and generatedSimContract.inlineGeneratedJs
 * produces for generated sims. Inlining (rather than letting WKWebView
 * resolve a baseURL) is load-bearing, not cosmetic: raw.githubusercontent
 * serves .js/.css as text/plain WITH X-Content-Type-Options: nosniff, which
 * WebKit blocks for script/style subresources — only images survive the
 * baseURL route, so those are absolutized instead of inlined.
 *
 * Known honest limitation: content comes from the repos' live HEAD, so a
 * sim Dan renames/deletes upstream after extraction 404s here until the
 * manifest is rebuilt — the list stays complete (it's snapshot-derived),
 * and the app shows its "isn't available right now" state for that sim.
 *
 * No auth, same reasoning as get-book.ts / archive-books.ts: this only ever
 * serves already-public, already-extracted content (CC-licensed, commercial
 * use authorized via Dan's advisor relationship — see MicroSimLoader.swift's
 * paper-trail comment); there is no live spend to protect.
 *
 * Two request shapes:
 *   {} or GET  -> { count, sims: [{ id, subject, title, description }] }
 *   { id }     -> { sim: { id, subject, title, description, sourceUrl, html } }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../cors'
import manifest from '../../data/microsims-manifest.json'

type ManifestSim = {
  id: string
  repo: string
  branch: string
  path: string
  entry: string
  assets: string[]
  subject: string
  title: string
  description: string
}

const SIMS: ManifestSim[] = (manifest as { sims: ManifestSim[] }).sims ?? []
const BY_ID = new Map(SIMS.map((s) => [s.id, s]))

/** Pre-serialized once per warm instance — the list is static per deploy. */
const LIST_BODY = JSON.stringify({
  count: SIMS.length,
  sims: SIMS.map(({ id, subject, title, description }) => ({ id, subject, title, description })),
})

function rawBase(sim: ManifestSim): string {
  return `https://raw.githubusercontent.com/${sim.repo}/${sim.branch}/${sim.path}/`
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** "./x.js" and "x.js" are the same file — the html may use either form. */
function refVariants(ref: string): string[] {
  const bare = ref.replace(/^\.\//, '')
  return ref === bare ? [ref] : [ref, bare]
}

/** Rewrites relative media src attributes to absolute raw URLs so images
 * still load once the page is a baseURL-less loadHTMLString document. Runs
 * on the PRISTINE entry html, before any asset content is inlined, so this
 * regex never scans inlined JS text (which could contain src="…" string
 * literals it must not touch). Scoped to media tags so <script src> is left
 * alone for the inline pass below. */
function absolutizeMediaSrc(html: string, base: string): string {
  return html.replace(
    /(<(?:img|source|video|audio)\b[^>]*?\ssrc=")(?!https?:|data:|\/\/)([^"]+)(")/gi,
    (_m, pre: string, rel: string, post: string) => {
      try {
        return `${pre}${new URL(rel, base).href}${post}`
      } catch {
        return `${pre}${rel}${post}`
      }
    },
  )
}

function inlineCss(html: string, ref: string, css: string): string {
  for (const variant of refVariants(ref)) {
    const linkTag = new RegExp(`<link\\b[^>]*href="${escapeRegExp(variant)}"[^>]*>`, 'i')
    if (linkTag.test(html)) return html.replace(linkTag, `<style>\n${css}\n</style>`)
  }
  // Referenced some other way (or not at all) — appending a <style> is
  // harmless and beats silently dropping real styling.
  if (html.includes('</head>')) return html.replace('</head>', `<style>\n${css}\n</style></head>`)
  return `<style>\n${css}\n</style>\n${html}`
}

function inlineJs(html: string, ref: string, js: string): string {
  for (const variant of refVariants(ref)) {
    const scriptTag = new RegExp(
      `<script\\b[^>]*src="${escapeRegExp(variant)}"[^>]*>\\s*</script>`,
      'i',
    )
    if (scriptTag.test(html)) return html.replace(scriptTag, `<script>\n${js}\n</script>`)
  }
  // Same fallback discipline as generatedSimContract.inlineGeneratedJs: a
  // sketch the html forgot (or oddly referenced) still ships, appended
  // before </body> rather than silently dropped.
  if (html.includes('</body>')) return html.replace('</body>', `<script>\n${js}\n</script></body>`)
  return `${html}\n<script>\n${js}\n</script>`
}

async function assemble(sim: ManifestSim): Promise<string | null> {
  const base = rawBase(sim)
  const entryHtml = await fetchText(new URL(sim.entry, base).href)
  if (!entryHtml) return null
  let html = absolutizeMediaSrc(entryHtml, base)
  // Assets fetched concurrently; a single missing asset degrades that one
  // inline (skipped), not the whole sim — many sims are html-only anyway.
  const contents = await Promise.all(
    sim.assets.map(async (ref) => ({ ref, text: await fetchText(new URL(ref, base).href) })),
  )
  for (const { ref, text } of contents) {
    if (text === null) continue
    html = ref.endsWith('.css') ? inlineCss(html, ref, text) : inlineJs(html, ref, text)
  }
  return html
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = (req.body || {}) as { id?: string }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) {
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).send(LIST_BODY)
  }

  const sim = BY_ID.get(id)
  if (!sim) return res.status(404).json({ error: `Unknown MicroSim id: ${id}` })
  const html = await assemble(sim)
  if (!html) {
    return res.status(502).json({
      error: `Couldn't fetch this sim's files from ${sim.repo} right now — it may have moved upstream since extraction.`,
    })
  }
  return res.status(200).json({
    sim: {
      id: sim.id,
      subject: sim.subject,
      title: sim.title,
      description: sim.description,
      sourceUrl: `https://github.com/${sim.repo}/tree/${sim.branch}/${sim.path}`,
      html,
    },
  })
}
