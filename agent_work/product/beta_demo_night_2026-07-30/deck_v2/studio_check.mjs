import { chromium, webkit } from 'playwright';

const urls = [
  'https://mindcraft-93858.web.app/desk-os/studio/?v=spatial2&from=jesse',
  'https://mindcraft-93858.web.app/desk-os/studio/?v=create10',
];

for (const engine of [chromium, webkit]) {
  for (const url of urls) {
    const browser = await engine.launch();
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    const consoleMsgs = [];
    page.on('console', msg => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => consoleMsgs.push(`[pageerror] ${err.message}`));
    const start = Date.now();
    let status = 'ok';
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
    } catch (e) {
      status = 'ERROR: ' + e.message;
    }
    const elapsed = Date.now() - start;
    await page.waitForTimeout(2000);
    const fname = `/private/tmp/claude-501/-Users-akoirala/9142cd27-6632-4399-8961-042a25948541/scratchpad/studio_${engine.name()}_${url.includes('spatial2')?'spatial2':'create10'}.png`;
    await page.screenshot({ path: fname, fullPage: false });
    console.log('=== ENGINE', engine.name(), 'URL', url, '===');
    console.log('status:', status, 'loadMs:', elapsed);
    console.log('title:', await page.title().catch(()=> 'n/a'));
    console.log('console msgs:', JSON.stringify(consoleMsgs.slice(0, 30), null, 2));
    console.log('screenshot:', fname);
    await browser.close();
  }
}
