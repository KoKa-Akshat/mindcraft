import { chromium } from 'playwright'

const BASE = 'http://localhost:5199'

const confidence = {
  // warmups (7)
  fractions_decimals: 'easy',
  ratios_proportions: 'kinda',
  order_of_operations: 'hard',
  basic_equations: 'easy',
  // algebra (11) - leave some untouched
  linear_equations: 'easy',
  functions_basics: 'kinda',
  quadratic_equations: 'hard',
  // geometry (7)
  right_triangle_geometry: 'easy',
  trigonometry_basics: 'hard',
  // data (2)
  descriptive_statistics: 'kinda',
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } })

  await page.goto(`${BASE}/try/dashboard`, { waitUntil: 'networkidle' })
  await page.evaluate((conf) => {
    sessionStorage.setItem('mc-demo-mode', '1')
    sessionStorage.setItem('mc-demo-diagnostic', JSON.stringify({ exam: 'ACT', confidence: conf }))
  }, confidence)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  // Full contents grid
  const toc = page.locator('[class*="horizontalToc"]')
  await toc.first().waitFor({ state: 'visible', timeout: 10000 })
  await page.screenshot({
    path: '/Users/akoirala/Developer/mindcraft/agent_work/product/screenshots_2026-08-05/dashboard_contents_grid_computed_full_1440.png',
    fullPage: false,
  })
  await toc.first().screenshot({
    path: '/Users/akoirala/Developer/mindcraft/agent_work/product/screenshots_2026-08-05/dashboard_contents_grid_computed_toc_only_1440.png',
  })

  await browser.close()
}

run().catch(e => { console.error(e); process.exit(1) })
