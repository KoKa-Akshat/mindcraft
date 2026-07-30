import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { ROOT, TOKENS, escapeHtml, flattenText } from './lib.mjs'

const require = createRequire(import.meta.url)
let katex
try { katex = require('katex') } catch { try { katex = require('../../app/node_modules/katex') } catch {} }

function mathHtml(text) {
  if (!katex) return escapeHtml(text)
  return escapeHtml(text).replace(/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g, (_, display, inline) => {
    try { return katex.renderToString(display || inline, { displayMode: Boolean(display), throwOnError: false }) } catch { return escapeHtml(_) }
  }).replaceAll('\n','<br>')
}

export function slideHtml(slide) {
  const c=slide.copy; const story=slide.template==='katha_page'; const image=slide.image ? `background-image:linear-gradient(90deg,rgba(8,14,20,.96),rgba(8,14,20,.60)),url('${path.resolve(ROOT,slide.image)}');` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @import url('${path.resolve(ROOT,'app/node_modules/katex/dist/katex.min.css')}');
  :root{--deep-field:${TOKENS.deepField};--chalk:${TOKENS.chalk};--click:${TOKENS.click};--stakes:${TOKENS.stakes};--depth:${TOKENS.depth}}
  *{box-sizing:border-box}html,body{margin:0;width:1080px;height:1350px;overflow:hidden;background:var(--deep-field)}
  body{color:var(--chalk);font-family:Inter,Arial,sans-serif;background-size:cover;background-position:center;${image}}
  main{height:100%;padding:112px 96px 126px;display:flex;flex-direction:column;justify-content:space-between}
  .eyebrow{font-size:28px;text-transform:uppercase;letter-spacing:.16em;color:${story?'var(--stakes)':'var(--click)'};font-weight:800}
  h1{font-size:${story?78:92}px;line-height:.96;letter-spacing:-.045em;max-width:880px;margin:36px 0 54px}
  .body{font-family:${story?'Georgia,serif':'Inter,Arial,sans-serif'};font-size:${story?31:40}px;line-height:${story?1.45:1.25};max-height:700px;overflow:hidden}
  .answer{font-size:54px;line-height:1.2;padding:36px 0;border-top:3px solid var(--depth)}
  footer{font-size:22px;letter-spacing:.14em;text-transform:uppercase;opacity:.7}.mark{color:${story?'var(--stakes)':'var(--click)'}}
  .katex{color:var(--chalk)}
  </style></head><body><main><section><div class="eyebrow">${escapeHtml(c.eyebrow||'MindCraft')}</div><h1>${escapeHtml(c.headline||'')}</h1><div class="body">${mathHtml(c.question||c.body||'')}</div>${c.answer?`<div class="answer">${mathHtml(c.answer)}</div>`:''}</section><footer><span class="mark">●</span> MindCraft</footer></main></body></html>`
}

export async function renderPosts(posts, runDir) {
  let chromium
  try { ({ chromium } = await import('playwright')) } catch { throw new Error('Playwright is required. Run npm install, then npx playwright install chromium.') }
  const browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1})
  try {
    for(const post of posts){ const dir=path.join(runDir,post.id.slice(-3)); fs.mkdirSync(dir,{recursive:true}); for(const slide of post.slides){ const html=slideHtml(slide); const htmlPath=path.join(dir,`slide-${slide.n}.html`); const pngPath=path.join(dir,`slide-${slide.n}.png`); fs.writeFileSync(htmlPath,html); await page.goto(`file://${htmlPath}`,{waitUntil:'networkidle'}); await page.screenshot({path:pngPath,type:'png'}); slide.png=path.relative(path.resolve(ROOT,'marketing'),pngPath).replaceAll('\\','/') } }
  } finally { await browser.close() }
}

export async function renderPdf(htmlPath, pdfPath) {
  let chromium
  try { ({ chromium } = await import('playwright')) } catch { throw new Error('Playwright is required. Run npm install, then npx playwright install chromium.') }
  const browser=await chromium.launch({headless:true}); const page=await browser.newPage()
  try { await page.goto(`file://${htmlPath}`,{waitUntil:'networkidle'}); await page.pdf({path:pdfPath,format:'A4',printBackground:true}) } finally { await browser.close() }
  return pdfPath
}

export function lintComposition(post) {
  const failures=[]
  for(const slide of post.slides){ const all=flattenText(slide.copy).join(' '); const limeCount=slide.limeElements ?? 1; if(limeCount>1) failures.push({slide:slide.n,rule:'one lime element',reason:'If lime appears everywhere, the click means nothing.'}); if(all.length>1300) failures.push({slide:slide.n,rule:'safe area',reason:'Text exceeds the template safe-area capacity.'}) }
  return {status:failures.length?'fail':'pass',failures}
}
