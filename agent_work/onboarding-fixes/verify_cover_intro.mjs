import { chromium } from '../../app/node_modules/playwright/index.mjs'
const BASE = 'http://localhost:5173'
const OUT = '/Users/akoirala/Developer/mindcraft/agent_work/onboarding-fixes/screenshots'
const stamp = Date.now()
const email = `qa-cover-${stamp}@example.com`
const password = 'Test1234!verify'

function shot(page, name) { return page.screenshot({ path: `${OUT}/${name}.png` }) }

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  await page.goto(`${BASE}/login?qaEmail=1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#email', { timeout: 10000 })
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button.submitBtn, button[type="submit"]')
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 20000 })
  await page.waitForTimeout(1000)

  // Race straight through diagnostic to get to the dashboard/cover quickly.
  if (page.url().includes('/diagnostic')) {
    const hotspot = await page.$('button[aria-label="Step into Jesse\'s kitchen and begin"]')
    if (hotspot) { await hotspot.click(); await page.waitForTimeout(700) }
    await (await page.$('textarea'))?.fill('quick test')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /^1 week/ }).click()
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.waitForTimeout(300)
    const probeButtons = await page.$$('button:has-text("Seen it before")')
    for (const b of probeButtons) await b.click()
    await page.waitForTimeout(150)
    const useAnchors = await page.$('button:has-text("Use these anchors")')
    if (useAnchors) { await useAnchors.click(); await page.waitForTimeout(300) }
    const gotIt = await page.$$('button:has-text("Got it")')
    for (const b of gotIt) await b.click()
    await page.waitForTimeout(200)
    await page.click('button:has-text("Finish")')
    await page.waitForFunction(() => location.pathname.startsWith('/dashboard'), { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1200)
  }

  console.log('at', page.url())
  await shot(page, '01_cover')

  const nameInput = await page.$('#cover-name')
  if (nameInput) {
    await nameInput.click()
    await nameInput.type('Maya', { delay: 40 })
    await page.waitForTimeout(200)
    await shot(page, '01b_cover_with_name')
    console.log('typed name, button should now say Let\'s go, Maya')
  }

  const openBtn = page.getByRole('button', { name: /Let's go|Tap to open/ })
  await openBtn.click()
  await page.waitForTimeout(900)
  await shot(page, '02_notebook_intro')
  console.log('captured notebook intro')

  // Single-tap the whole card (click somewhere neutral inside it, not on
  // the WizardMascot bubble or a nested element with its own handler).
  const introCard = page.getByRole('button', { name: 'Continue to your ACT notebook' })
  await introCard.click({ position: { x: 30, y: 30 } })
  await page.waitForTimeout(700)
  await shot(page, '02b_dashboard_after_intro_tap')
  console.log('at after intro tap:', page.url())

  // ── Map tab, real ML backend (production HF Space, real Firebase ID
  // token from this signed-in test user) ──
  const mapTab = page.getByRole('button', { name: 'Map', exact: true })
  await mapTab.click()
  console.log('waiting for real /knowledge-graph fetch (HF Space cold start can take up to ~60s)...')
  await page.waitForTimeout(9000)
  await shot(page, '10_dashboard_map')

  const svgBreakdown = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('svg')).map(svg => ({
      viewBox: svg.getAttribute('viewBox'),
      lineCount: svg.querySelectorAll('line').length,
      circleCount: svg.querySelectorAll('circle').length,
    })).filter(s => s.lineCount > 0 || s.circleCount > 0)
  })
  console.log('SVG breakdown on Map view:', JSON.stringify(svgBreakdown))

  const bodyText = await page.$eval('body', el => el.innerText)
  const coverageMatch = bodyText.match(/(\d+)\s*of\s*(\d+)\s*stable/)
  console.log('Coverage readout:', coverageMatch ? coverageMatch[0] : 'not found')

  await browser.close()
}
main().catch(e => { console.error(e); process.exit(1) })
