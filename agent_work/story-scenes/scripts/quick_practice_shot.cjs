const { chromium } = require('playwright')
const path = require('path')
const OUT_DIR = '/Users/akoirala/Developer/mindcraft/agent_work/story-scenes/screenshots'

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  await page.goto('http://localhost:5173/concept/fractions_decimals', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Fractions and Decimals', { timeout: 20000 })
  await page.waitForTimeout(400)
  const dots = await page.$$('[aria-label^="Panel "]')
  if (dots.length) { await dots[dots.length - 1].click(); await page.waitForTimeout(300) }
  const btn = await page.$('text=practice →')
  await btn.click()
  await page.waitForTimeout(650)
  await page.screenshot({ path: path.join(OUT_DIR, '21-practice-session-early.png') })
  const text = await page.evaluate(() => document.body.innerText)
  console.log(text.split('\n').map(l => l.trim()).filter(Boolean).join(' | ').slice(0, 1400))
  await browser.close()
}
main()
