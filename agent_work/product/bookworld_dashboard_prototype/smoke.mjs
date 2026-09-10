import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:8894/agent_work/product/bookworld_dashboard_prototype/'
const browser = await chromium.launch({ headless: true })
const failures = []
const consoleErrors = []

async function openAt(viewport, screenshotPath) {
  const page = await browser.newPage({ viewport })
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const value = message.text()
    if (!value.includes('Failed to load resource') && !value.includes('ERR_')) {
      consoleErrors.push(value)
    }
  })

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.locator('#worldCanvas canvas').waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(900)

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))
  if (overflow.documentWidth > overflow.viewportWidth + 2) {
    const wideElements = await page.evaluate(() => [...document.querySelectorAll('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.className || '').slice(0, 80),
          id: element.id,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }
      })
      .filter((item) => item.right > document.documentElement.clientWidth + 2 || item.left < -2 || item.width > document.documentElement.clientWidth + 2)
      .sort((a, b) => b.width - a.width)
      .slice(0, 16))
    failures.push(`horizontal overflow at ${viewport.width}x${viewport.height}: ${JSON.stringify({ ...overflow, wideElements })}`)
  }

  if (screenshotPath) await page.screenshot({ path: screenshotPath })
  return page
}

try {
  const desktop = await openAt(
    { width: 1440, height: 900 },
    '/private/tmp/bookworld-dashboard-desktop.png',
  )

  const canvasReport = await desktop.locator('#worldCanvas canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return { error: 'No WebGL context' }

    const width = gl.drawingBufferWidth
    const height = gl.drawingBufferHeight
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    let opaque = 0
    const colors = new Set()
    const stride = Math.max(4, Math.floor(pixels.length / 12000 / 4) * 4)
    for (let index = 0; index < pixels.length; index += stride) {
      if (pixels[index + 3] > 10) opaque += 1
      colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`)
    }

    return { width, height, opaque, uniqueColors: colors.size }
  })

  if (canvasReport.error || canvasReport.width < 300 || canvasReport.height < 300) {
    failures.push(`canvas dimensions: ${JSON.stringify(canvasReport)}`)
  }
  if ((canvasReport.opaque || 0) < 100 || (canvasReport.uniqueColors || 0) < 20) {
    failures.push(`canvas appears blank: ${JSON.stringify(canvasReport)}`)
  }

  await desktop.locator('[data-mode="simulation"]').click()
  await desktop.locator('#sunAngle').evaluate((element) => {
    element.value = '72'
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await desktop.locator('#runButton').click()
  await desktop.waitForTimeout(1800)

  const simulationPinned = await desktop
    .locator('[data-evidence="simulation"]')
    .evaluate((element) => element.classList.contains('is-pinned') && element.getAttribute('aria-pressed') === 'true')
  if (!simulationPinned) failures.push('simulation result did not pin to the book')
  await desktop.screenshot({ path: '/private/tmp/bookworld-dashboard-sim.png' })

  await desktop.locator('#previewButton').click()
  const dialogOpen = await desktop.locator('#bookDialog').evaluate((element) => element.open)
  if (!dialogOpen) failures.push('book preview did not open')
  await desktop.screenshot({ path: '/private/tmp/bookworld-dashboard-book.png' })
  await desktop.locator('#closeDialog').click()

  await desktop.locator('[data-mode="camera"]').click()
  const cameraHidden = await desktop.locator('#cameraLab').getAttribute('hidden')
  if (cameraHidden !== null) failures.push('camera mission did not become visible')
  await desktop.close()

  const ipadLandscape = await openAt(
    { width: 1024, height: 768 },
    '/private/tmp/bookworld-dashboard-ipad-landscape.png',
  )
  await ipadLandscape.close()

  const ipadPortrait = await openAt(
    { width: 768, height: 1024 },
    '/private/tmp/bookworld-dashboard-ipad-portrait.png',
  )
  await ipadPortrait.close()

  const phone = await openAt(
    { width: 390, height: 844 },
    '/private/tmp/bookworld-dashboard-phone.png',
  )
  await phone.close()

  failures.push(...consoleErrors.map((error) => `console: ${error}`))
  console.log(JSON.stringify({ canvasReport, failures }, null, 2))
  if (failures.length > 0) process.exitCode = 1
} finally {
  await browser.close()
}
