const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:5173'
const OUT_DIR = '/Users/akoirala/Developer/mindcraft/agent_work/story-scenes/screenshots'
const LOG_PATH = path.join(OUT_DIR, 'scene-log.txt')

fs.mkdirSync(OUT_DIR, { recursive: true })
const logLines = []
function log(line) {
  console.log(line)
  logLines.push(line)
}

async function grabText(page) {
  return page.evaluate(() => document.body.innerText)
}

function extractRelevant(fullText) {
  return fullText.split('\n').map(l => l.trim()).filter(Boolean).join(' | ')
}

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', err => consoleErrors.push('pageerror: ' + err.message))

  log('=== CHAPTER VIEW: /concept/fractions_decimals — all 10 quest panels ===')
  await page.goto(`${BASE}/concept/fractions_decimals`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Fractions and Decimals', { timeout: 20000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT_DIR, '01-chapter-opener.png') })
  log('01-chapter-opener.png — opening panel (Simon Stevin origin story)')

  const chapterSceneHits = []
  for (let i = 1; i <= 10; i++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(450)
    const text = extractRelevant(await grabText(page))
    const shotName = `${String(i + 1).padStart(2, '0')}-chapter-q${i}.png`
    await page.screenshot({ path: path.join(OUT_DIR, shotName) })
    const sceneMatch = text.match(/✦ Antwerp, Simon's counting house, ([^,]+), 1585 ([^|]*)/)
    chapterSceneHits.push(sceneMatch ? sceneMatch[0].slice(0, 140) : '(no scene line found)')
    log(`${shotName} — chapter question panel ${i}`)
    log(`  TEXT: ${text.slice(0, 1000)}`)
  }
  log('')
  log('--- chapter scene-line summary (one per question, proves rotation) ---')
  chapterSceneHits.forEach((h, i) => log(`  Q${i + 1}: ${h}`))
  log(`  distinct scene lines seen: ${new Set(chapterSceneHits).size} of ${chapterSceneHits.length}`)

  log('')
  log('=== PRACTICE VIEW: launch fresh "practice ->" sessions 3x, real in-app nav ===')
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(`${BASE}/concept/fractions_decimals`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('text=Fractions and Decimals', { timeout: 20000 })
    await page.waitForTimeout(400)
    const dots = await page.$$('[aria-label^="Panel "]')
    if (dots.length) {
      await dots[dots.length - 1].click()
      await page.waitForTimeout(400)
    }
    const practiceBtn = await page.$('text=practice →')
    if (!practiceBtn) {
      log(`  attempt ${attempt}: "practice ->" button not found, skipping`)
      continue
    }
    await practiceBtn.click()
    // Full render (story module resolve / offline fallback) needs a beat.
    await page.waitForTimeout(2200)
    const shotName = `${20 + attempt}-practice-session-${attempt}.png`
    await page.screenshot({ path: path.join(OUT_DIR, shotName) })
    const text = extractRelevant(await grabText(page))
    log(`${shotName} — Practice session, attempt ${attempt}`)
    log(`  TEXT: ${text.slice(0, 1200)}`)
  }

  log('')
  log('=== console page errors ===')
  log(consoleErrors.length ? consoleErrors.join('\n') : '(none)')

  fs.writeFileSync(LOG_PATH, logLines.join('\n') + '\n')
  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
