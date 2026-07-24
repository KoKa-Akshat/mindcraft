// Temporary verification script (2026-07-23 pass). Not part of the app,
// lives outside app/src. Drives a real dev-server session through the full
// onboarding flow with a fresh throwaway test student, using the ?qaEmail=1
// shim in Login.tsx (reverted at the end of this pass), and captures real
// screenshots of every item in the brief.
import { chromium } from '../../app/node_modules/playwright/index.mjs'

const BASE = 'http://localhost:5173'
const OUT = '/Users/akoirala/Developer/mindcraft/agent_work/onboarding-fixes/screenshots'
const stamp = Date.now()
const email = `qa-onboarding-${stamp}@example.com`
const password = 'Test1234!verify'

function shot(page, name) {
  return page.screenshot({ path: `${OUT}/${name}.png` })
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text())
  })

  console.log('Navigating to login with qaEmail shim...')
  await page.goto(`${BASE}/login?qaEmail=1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#email', { timeout: 10000 })
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button.submitBtn, button[type="submit"]')
  console.log('Submitted signup for', email)

  // Wait for navigation away from /login (either to /diagnostic or /dashboard)
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 20000 })
  console.log('Post-login URL:', page.url())
  await page.waitForTimeout(1500)

  // ── Cover ──
  if (page.url().includes('/dashboard')) {
    await page.waitForTimeout(1200)
    await shot(page, '01_cover')
    console.log('Captured cover')

    // Type a name into the cover's name input if present
    const nameInput = await page.$('#cover-name')
    if (nameInput) {
      await nameInput.fill('Maya')
      await shot(page, '01b_cover_with_name')
      console.log('Captured cover with name typed')
    }

    // Open the cover
    const openBtn = await page.$('button:has-text("Let\'s go"), button:has-text("Tap to open")')
    if (openBtn) {
      await openBtn.click()
      await page.waitForTimeout(900)
    }

    // ── NotebookIntro ──
    await shot(page, '02_notebook_intro');
    console.log('Captured notebook intro')
    const introCard = await page.$('button:has-text("Show me contents")')
    if (introCard) {
      await introCard.click()
      await page.waitForTimeout(600)
    }
  }

  await page.waitForTimeout(800)
  console.log('URL after intro/cover:', page.url())

  // If we're not already in diagnostic, navigate there directly (fresh
  // student should be gated into it anyway, but be defensive).
  if (!page.url().includes('/diagnostic')) {
    await page.goto(`${BASE}/diagnostic`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
  }

  // ── Diagnostic: intro (Jesse's kitchen) ──
  await shot(page, '03_diagnostic_intro')
  console.log('Captured diagnostic intro (Jesse\'s kitchen)')

  const hotspot = await page.$('button[aria-label="Step into Jesse\'s kitchen and begin"]')
  if (hotspot) {
    await hotspot.click()
    await page.waitForTimeout(400)
    await shot(page, '03b_diagnostic_intro_zooming')
    console.log('Captured intro mid-zoom')
    await page.waitForTimeout(700)
  }

  // ── Goals step ──
  await shot(page, '04_diagnostic_goals')
  console.log('Captured goals step')
  const goalsTextarea = await page.$('textarea')
  if (goalsTextarea) await goalsTextarea.fill('ACT in three weeks, algebra is my weak spot')
  const goalsNext = page.getByRole('button', { name: 'Next', exact: true })
  await goalsNext.click(); await page.waitForTimeout(400)

  // ── Horizon step ──
  await shot(page, '05_diagnostic_horizon')
  console.log('Captured horizon step')
  const weekBtn = page.getByRole('button', { name: /^1 week/ })
  await weekBtn.click()
  await page.waitForTimeout(300)
  await shot(page, '05b_diagnostic_horizon_selected')
  const horizonNext = page.getByRole('button', { name: 'Next', exact: true })
  await horizonNext.click(); await page.waitForTimeout(400)

  console.log('URL after horizon:', page.url())

  // ── Probe step (if present) ──
  const probeButtons = await page.$$('button:has-text("Seen it before")')
  if (probeButtons.length > 0) {
    await shot(page, '06_diagnostic_probe')
    for (const btn of probeButtons) await btn.click()
    await page.waitForTimeout(200)
    const useAnchors = await page.$('button:has-text("Use these anchors")')
    if (useAnchors) { await useAnchors.click(); await page.waitForTimeout(400) }
  }

  // ── Confidence step: 3 boxes ──
  await shot(page, '07_diagnostic_confidence')
  console.log('Captured confidence step (3 boxes)')
  const scaleButtons = await page.$$('button:has-text("Got it")')
  console.log('Found', scaleButtons.length, '"Got it" buttons to click')
  for (const btn of scaleButtons) await btn.click()
  await page.waitForTimeout(300)
  await shot(page, '07b_diagnostic_confidence_filled')

  const finishBtn = await page.$('button:has-text("Finish")')
  if (finishBtn) {
    await finishBtn.click()
    await page.waitForTimeout(250)
    await shot(page, '08_diagnostic_loading')
    console.log('Captured loading transition')
  }

  await page.waitForFunction(() => location.pathname.startsWith('/dashboard'), { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  console.log('URL after finish:', page.url())
  await shot(page, '09_dashboard_home')

  // ── Map tab with real edges ──
  await page.goto(`${BASE}/dashboard?view=map`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await shot(page, '10_dashboard_map')
  console.log('Captured Map tab')

  // Count rendered link lines and nodes for a real, non-asserted number
  const linkCount = await page.$$eval('svg line', els => els.length).catch(() => -1)
  const nodeCount = await page.$$eval('[class*="node"]', els => els.length).catch(() => -1)
  console.log('Rendered <line> count on Map:', linkCount)
  console.log('Rendered node-ish elements on Map:', nodeCount)

  await browser.close()
  console.log('DONE')
}

main().catch(err => { console.error(err); process.exit(1) })
