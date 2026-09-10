import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.DESK_OS_URL
  || 'http://127.0.0.1:8894/agent_work/product/desk_os/?mcEmail=test@example.com&mcName=Maya&mcRole=student';
const captureScreenshots = process.env.DESK_OS_CAPTURE !== '0';
const blockGraph = process.env.DESK_OS_BLOCK_GRAPH === '1';

const browser = await chromium.launch({ headless: true });
const screenshots = [];

async function capture(page, path, options = {}) {
  if (!captureScreenshots) return;
  await page.screenshot({ path, ...options });
  screenshots.push(path);
}

async function nativeClick(locator) {
  await locator.waitFor({ state: 'visible' });
  assert.equal(await locator.isEnabled(), true);
  await locator.evaluate((button) => button.click());
}

async function preparePage(page) {
  if (blockGraph) {
    await page.route('**/full-graph-viewer.html*', (route) => route.abort());
  }
}

async function waitForValue(readValue, predicate, label) {
  const deadline = Date.now() + 5000;
  let value = '';
  while (Date.now() < deadline) {
    value = await readValue();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`${label}: last value was ${value}`);
}

// The tab row that used to gate this is retired (2026-09-04: one
// integrated world, not pages to switch between), boot lands here directly,
// nothing to click or tap-target-check anymore.
async function waitForStudio(page) {
  await page.locator('#hubSimStudio').waitFor({ state: 'visible' });
  await page.waitForFunction(() => (
    document.querySelectorAll('[data-sim-node]:not(.is-loading)').length === 3
    && document.querySelectorAll('.sim-wire').length === 3
  ));
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await preparePage(page);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#hubStage').waitFor({ state: 'visible' });

  // The world is the landing now (2026-09-04 ask): boot goes straight into
  // Sim Studio, no click into it, no separate Workspace dashboard first.
  await waitForStudio(page);
  assert.equal(await page.locator('[data-hub-tab2="sim"]').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#hubWorkspace').isHidden(), true);

  const landingShot = '/private/tmp/mindcraft-deskos-landing-desktop.png';
  await capture(page, landingShot, { fullPage: true });

  // The tab row itself is gone from view (2026-09-04: one integrated world,
  // not a set of pages), Workspace is retired, not just deprioritized.
  assert.equal(await page.locator('.hub-tabs2').isHidden(), true);
  assert.equal(await page.locator('.sim-wire').count(), 3);
  assert.match(await page.locator('[data-sim-status]').innerText(), /3 sims live, 3 wires/);

  const sunSlider = page.frameLocator('[data-sim-node^="sun-"] iframe').locator('[data-input="angle"]');
  const shadeLight = page.frameLocator('[data-sim-node^="shade-"] iframe').locator('[data-input="light"]');
  const plantGrowth = page.frameLocator('[data-sim-node^="plant-"] iframe').locator('[data-output="growth"] strong');
  const growthBefore = await plantGrowth.innerText();

  await sunSlider.evaluate((input) => {
    input.value = '5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await waitForValue(() => shadeLight.inputValue(), (value) => value === '9', 'downstream light');
  assert.equal(await shadeLight.inputValue(), '9');
  const growthAfter = await waitForValue(
    () => plantGrowth.innerText(),
    (value) => Boolean(value && value !== growthBefore),
    'downstream plant growth',
  );
  assert.notEqual(growthAfter, growthBefore);
  assert.match(
    await page.locator('[data-sim-node^="sun-"] [data-direction="output"] [data-sim-port-value]').innerText(),
    /8\.7 %/,
  );

  // The Parts bin + wiring board live inside the Workshop building now
  // (2026-09-04, one integrated world: #simWorkbench ships hidden and is
  // adopted into the in-world overlay on open), so open the Workshop the
  // same way a student would to reach the real drag targets. The drags
  // themselves are unchanged.
  await page.locator('[data-world-object="workshop"]').evaluate((button) => button.click());
  await page.locator('[data-world-overlay-mount] #simWorkbench').waitFor({ state: 'visible' });
  await page.locator('[data-sim-viewport]').scrollIntoViewIfNeeded();

  const sunNode = page.locator('[data-sim-node^="sun-"]').first();
  await sunNode.scrollIntoViewIfNeeded();
  const sunHeader = sunNode.locator('.sim-node-head');
  const nodeBoxBefore = await sunNode.boundingBox();
  const headerBox = await sunHeader.boundingBox();
  assert.ok(nodeBoxBefore && headerBox);
  await page.mouse.move(headerBox.x + 140, headerBox.y + headerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(headerBox.x + 205, headerBox.y + headerBox.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  const nodeBoxAfter = await sunNode.boundingBox();
  assert.ok(nodeBoxAfter && nodeBoxAfter.x > nodeBoxBefore.x + 40, 'Sun dial moves when dragged');

  await nativeClick(page.locator('[data-sim-clear-wires]'));
  assert.equal(await page.locator('.sim-wire').count(), 0);
  const outputPort = sunNode.locator('[data-direction="output"][data-port-id="light"]');
  const inputPort = page.locator('[data-sim-node^="shade-"] [data-direction="input"][data-port-id="light"]');
  // Wires finish on a real pointerup over the target port, so the drop
  // point must actually be inside the overlay mount's visible area; the
  // shade node sits lower than one overlay-screen, scroll it into reach.
  await inputPort.scrollIntoViewIfNeeded();
  const outputBox = await outputPort.boundingBox();
  const inputBox = await inputPort.boundingBox();
  assert.ok(outputBox && inputBox);
  await page.mouse.move(outputBox.x + outputBox.width / 2, outputBox.y + outputBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(inputBox.x + inputBox.width / 2, inputBox.y + inputBox.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll('.sim-wire').length === 1);
  assert.match(await page.locator('[data-sim-status]').innerText(), /3 sims live, 1 wires/);

  await nativeClick(page.locator('[data-sim-reset]'));
  await page.waitForFunction(() => document.querySelectorAll('.sim-wire').length === 3);

  await nativeClick(page.locator('[data-sim-node] [data-sim-focus]').first());
  assert.equal(await page.locator('[data-sim-solo-dialog]').evaluate((dialog) => dialog.open), true);
  await nativeClick(page.locator('[data-sim-solo-close]'));
  assert.equal(await page.locator('[data-sim-solo-dialog]').evaluate((dialog) => dialog.open), false);

  await nativeClick(page.locator('[data-sim-template="sun"]'));
  await page.waitForFunction(() => document.querySelectorAll('[data-sim-node]').length === 4);
  assert.equal(await page.locator('[data-sim-node]').count(), 4);

  // Back out to the world: the workbench returns to its hidden home slot
  // and the closing screenshot shows the scene, not the overlay.
  await page.locator('[data-world-overlay-close]').evaluate((button) => button.click());
  await page.waitForFunction(() => document.querySelector('[data-world-overlay]')?.hidden === true);
  assert.equal(await page.locator('#simWorkbench').isHidden(), true);

  const studioShot = '/private/tmp/mindcraft-sim-studio-desktop.png';
  await capture(page, studioShot, { fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.deepEqual(pageErrors, []);
  await page.close();

  for (const viewport of [
    { name: 'ipad-portrait', width: 820, height: 1180 },
    { name: 'phone', width: 390, height: 844 },
  ]) {
    const responsivePage = await browser.newPage({ viewport });
    await preparePage(responsivePage);
    const errors = [];
    responsivePage.on('pageerror', (error) => errors.push(error.message));
    await responsivePage.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    // The world is the landing now: boots straight into it, no Workspace
    // dashboard first (2026-09-04 ask), same as the desktop pass above.
    await waitForStudio(responsivePage);
    assert.equal(
      await responsivePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
    );
    const landingPath = `/private/tmp/mindcraft-deskos-landing-${viewport.name}.png`;
    await capture(responsivePage, landingPath);

    assert.equal(await responsivePage.locator('.hub-tabs2').isHidden(), true);
    assert.equal(
      await responsivePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
    );
    const studioPath = `/private/tmp/mindcraft-sim-studio-${viewport.name}.png`;
    await capture(responsivePage, studioPath);
    assert.deepEqual(errors, []);
    await responsivePage.close();
  }

  console.log(JSON.stringify({ ok: true, screenshots }, null, 2));
} finally {
  await browser.close();
}
