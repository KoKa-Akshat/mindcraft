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

async function waitForStudio(page) {
  const nav = page.locator('[data-hub-sim-nav]').first();
  await nav.waitFor({ state: 'visible' });
  assert.equal(await nav.isEnabled(), true);
  const box = await nav.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, 'Sim Studio tab has a usable tap target');
  const receivesTap = await page.evaluate(({ x, y }) => {
    return Boolean(document.elementFromPoint(x, y)?.closest('[data-hub-sim-nav]'));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  assert.equal(receivesTap, true);
  await nav.evaluate((button) => button.click());
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
  await page.locator('#hubWorkspace').waitFor({ state: 'visible' });
  assert.match(await page.locator('#hubWorkspace h1').innerText(), /curious/i);

  await nativeClick(page.locator('[data-hub-starter]').first());
  assert.equal(
    await page.locator('[data-hub-hero-search-input]').inputValue(),
    'Why do city streets get so hot?',
  );
  await page.locator('[data-hub-hero-search-result]').waitFor({ state: 'visible' });

  const landingShot = '/private/tmp/mindcraft-deskos-landing-desktop.png';
  await capture(page, landingShot, { fullPage: true });

  await waitForStudio(page);
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

  const sunNode = page.locator('[data-sim-node^="sun-"]').first();
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
    await responsivePage.locator('#hubWorkspace').waitFor({ state: 'visible' });
    assert.equal(
      await responsivePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
    );
    const landingPath = `/private/tmp/mindcraft-deskos-landing-${viewport.name}.png`;
    await capture(responsivePage, landingPath);

    await waitForStudio(responsivePage);
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
