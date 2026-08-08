import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } })
await page.goto('http://localhost:5199/try/dashboard', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const info = await page.evaluate(() => {
  const toc = document.querySelector('[class*="horizontalToc"]')
  const lanes = [...document.querySelectorAll('[class*="tocLane"]')].filter(el => el.matches('section'))
  const tracks = [...document.querySelectorAll('[class*="tocTrack"]')]
  const out = { tocRect: toc?.getBoundingClientRect(), tocStyle: toc ? getComputedStyle(toc).gridTemplateRows : null }
  out.lanes = lanes.map(l => ({
    dataLane: l.getAttribute('data-lane'),
    rect: l.getBoundingClientRect(),
    laneSpan: getComputedStyle(l).getPropertyValue('--lane-span'),
    gridColumn: getComputedStyle(l).gridColumn,
  }))
  out.tracks = tracks.map(t => ({
    rect: t.getBoundingClientRect(),
    cols: getComputedStyle(t).gridTemplateColumns,
    rows: getComputedStyle(t).gridTemplateRows,
    laneColumns: getComputedStyle(t).getPropertyValue('--lane-columns'),
  }))
  return out
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
