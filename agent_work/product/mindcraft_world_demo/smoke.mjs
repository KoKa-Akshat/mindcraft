import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.env.MINDCRAFT_WORLD_URL || 'http://127.0.0.1:8896/index.html';
const browser = await chromium.launch({ headless: true });

async function canvasStats(page) {
  return page.evaluate(() => {
    const { renderer, scene, camera } = window.mindcraftWorld;
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let colored = 0;
    let visible = 0;
    for (let index = 0; index < pixels.length; index += 160) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      if (alpha > 0) visible += 1;
      if (Math.max(red, green, blue) - Math.min(red, green, blue) > 18) colored += 1;
    }
    return { width, height, colored, visible };
  });
}

async function projectObject(page, id, yOffset = 1) {
  return page.evaluate(({ id: objectId, y }) => {
    const { scene, camera, renderer } = window.mindcraftWorld;
    const object = scene.children.find((child) => child.userData.interactiveId === objectId);
    const point = object.position.clone();
    point.y += y;
    point.project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + (point.x + 1) * rect.width / 2,
      y: rect.top + (1 - point.y) * rect.height / 2,
    };
  }, { id, y: yOffset });
}

async function projectGround(page, x, z) {
  return page.evaluate(({ worldX, worldZ }) => {
    const { scene, camera, renderer } = window.mindcraftWorld;
    const ground = scene.children.find((child) => child.userData.isGround);
    const point = ground.position.clone().set(worldX, 0.06, worldZ).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + (point.x + 1) * rect.width / 2,
      y: rect.top + (1 - point.y) * rect.height / 2,
    };
  }, { worldX: x, worldZ: z });
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.mindcraftWorld?.renderer));
  await page.locator('#worldLoading.is-gone').waitFor();

  const desktopStats = await canvasStats(page);
  assert.ok(desktopStats.width >= 1200 && desktopStats.height >= 800);
  assert.ok(desktopStats.visible > 1000);
  assert.ok(desktopStats.colored > 200);
  await page.screenshot({ path: '/private/tmp/mindcraft-world-desktop.png' });

  const gardenPoint = await projectObject(page, 'garden', 1.25);
  await page.mouse.click(gardenPoint.x, gardenPoint.y);
  await page.locator('#flowDeck').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-flow-node]').count(), 3);
  const gardenOutputBefore = await page.locator('[data-flow-node="soil"] output').innerText();
  await page.locator('[data-flow-node="sun"]').click();
  await page.locator('#nodeSlider').evaluate((slider) => {
    slider.value = '18';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const gardenOutputAfter = await page.locator('[data-flow-node="soil"] output').innerText();
  assert.notEqual(gardenOutputAfter, gardenOutputBefore);
  await page.locator('#flowClose').click();

  const hearthPoint = await projectObject(page, 'hearth', 1.1);
  await page.mouse.click(hearthPoint.x, hearthPoint.y);
  await page.locator('#focusNote').waitFor({ state: 'visible' });
  await page.locator('#focusAction').click();
  await page.locator('#hearthWorkspace').waitFor({ state: 'visible' });
  await page.locator('#curiosityForm button').click();
  assert.equal(await page.locator('[data-build="fan"]').getAttribute('aria-disabled'), null);
  assert.match(await page.locator('#hearthResponse p').innerText(), /input you can measure/i);
  await page.locator('[data-close-workspace]').click();

  await page.locator('[data-build="sensor"]').click();
  await page.locator('#buildButton').click();
  const buildPoint = await projectGround(page, 7, 4);
  await page.mouse.click(buildPoint.x, buildPoint.y);
  const placedCount = await page.evaluate(() => {
    let count = 0;
    window.mindcraftWorld.scene.traverse((object) => {
      if (String(object.userData.interactiveId || '').startsWith('placed-')) count += 1;
    });
    return count;
  });
  assert.ok(placedCount > 0);
  assert.match(await page.locator('#missionScore').innerText(), /complete/i);
  assert.deepEqual(errors, []);
  await page.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const phoneErrors = [];
  phone.on('pageerror', (error) => phoneErrors.push(error.message));
  await phone.goto(url, { waitUntil: 'networkidle' });
  await phone.waitForFunction(() => Boolean(window.mindcraftWorld?.renderer));
  await phone.locator('#worldLoading.is-gone').waitFor();
  const phoneStats = await canvasStats(phone);
  assert.ok(phoneStats.colored > 80);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  await phone.screenshot({ path: '/private/tmp/mindcraft-world-phone.png' });
  assert.deepEqual(phoneErrors, []);
  await phone.close();

  console.log(JSON.stringify({ desktopStats, phoneStats, ok: true }, null, 2));
} finally {
  await browser.close();
}
