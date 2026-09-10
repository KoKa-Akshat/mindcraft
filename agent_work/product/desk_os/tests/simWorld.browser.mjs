/**
 * simWorld.browser.mjs: the walkable world + in-world overlays (2026-09-04).
 *
 * Second pass tonight: the world is a fixed 3200x2000 px map behind a
 * clamped, character-centered camera (see simWorld.js), so movement
 * assertions here read WORLD coordinates (character rect relative to the
 * [data-world-map] layer), not viewport pixels: mid-map the camera pans and
 * the character's viewport box barely moves at all. New coverage: the
 * camera keeps the character centered mid-map, clamps flush at the map
 * edges without ever framing past the world, and a building that starts
 * well outside the first screen is only in frame after really walking there.
 *
 * Runs against the Vite dev server because the Research library overlay
 * frames the real React /learn route, and Vite is the one local origin that
 * serves BOTH the Desk OS static shell (app/public/desk-os) and the React
 * app, exactly like Firebase Hosting does in prod (see fire.js's header
 * comment). If nothing answers on the port, this test starts Vite itself
 * and stops it when done.
 *
 *   node agent_work/product/desk_os/tests/simWorld.browser.mjs
 *
 * The authed-Learn assertion creates a throwaway Firebase auth user through
 * the project's public web API key (the same key the client bundle ships),
 * signs it in via the page's own fire.js, and deletes the account in the
 * finally block. Same practice as the repo's existing setup/cleanup test
 * account scripts.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PORT = process.env.DESK_OS_WORLD_PORT || '5199';
const ORIGIN = process.env.DESK_OS_WORLD_ORIGIN || `http://127.0.0.1:${PORT}`;
const baseUrl = `${ORIGIN}/desk-os/index.html?mcEmail=test@example.com&mcName=Maya&mcRole=student`;
const captureScreenshots = process.env.DESK_OS_CAPTURE !== '0';

// Public web client config, identical to app/src/firebase.ts and fire.js.
const FIREBASE_API_KEY = 'AIzaSyBetzXAekac3zTdzgJ3vGxqKCQAXc3tcsU';

const testDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(testDir, '..', '..', '..', '..', 'app');

const screenshots = [];
let viteChild = null;
let account = null;

async function capture(page, path, options = {}) {
  if (!captureScreenshots) return;
  await page.screenshot({ path, ...options });
  screenshots.push(path);
}

async function serverUp() {
  try {
    const response = await fetch(`${ORIGIN}/desk-os/index.html`);
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverUp()) return;
  viteChild = spawn(
    join(appDir, 'node_modules', '.bin', 'vite'),
    ['--port', PORT, '--strictPort', '--host', '127.0.0.1'],
    { cwd: appDir, stdio: 'ignore' },
  );
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await serverUp()) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert.fail('Vite dev server did not come up');
}

async function createThrowawayAccount() {
  const email = `deskos.world.e2e.${Date.now()}@example.com`;
  const password = `E2e-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const payload = await response.json();
  assert.ok(payload.idToken, `Could not create throwaway auth user: ${JSON.stringify(payload).slice(0, 200)}`);
  return { email, password, idToken: payload.idToken };
}

async function deleteThrowawayAccount(creds) {
  if (!creds?.idToken) return;
  try {
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: creds.idToken }),
      },
    );
  } catch {
    // Best effort; the account is inert either way.
  }
}

// The tab row is retired (2026-09-04: one integrated world), boot lands
// here directly now, nothing to click.
async function waitForStudio(page) {
  await page.locator('#hubSimStudio').waitFor({ state: 'visible' });
  await page.waitForFunction(() => (
    document.querySelectorAll('[data-sim-node]:not(.is-loading)').length === 3
    && document.querySelectorAll('.sim-wire').length === 3
  ));
}

async function overlayOpen(page) {
  return page.evaluate(() => Boolean(document.querySelector('[data-world-overlay]:not([hidden])')));
}

async function charBox(page) {
  const box = await page.locator('[data-world-char]').boundingBox();
  assert.ok(box, 'character has a bounding box');
  return box;
}

/** Real geometry of the camera system, all from live client rects: the
 * stage (the window), the world layer (the map), and the character in both
 * viewport and world coordinates. The world layer's transform is a pure
 * translation, so subtracting its rect converts viewport px to world px. */
async function worldGeom(page) {
  const geom = await page.evaluate(() => {
    const stage = document.querySelector('[data-world-stage]');
    const world = document.querySelector('[data-world-map]');
    const char = document.querySelector('[data-world-char]');
    if (!stage || !world || !char) return null;
    const s = stage.getBoundingClientRect();
    const w = world.getBoundingClientRect();
    const c = char.getBoundingClientRect();
    return {
      stage: { left: s.left, top: s.top, right: s.right, bottom: s.bottom, width: s.width, height: s.height },
      world: { left: w.left, top: w.top, right: w.right, bottom: w.bottom, width: w.width, height: w.height },
      char: {
        viewX: c.left + c.width / 2,
        viewY: c.top + c.height / 2,
        worldX: c.left + c.width / 2 - w.left,
        worldY: c.top + c.height / 2 - w.top,
      },
    };
  });
  assert.ok(geom, 'stage, world layer, and character all exist');
  return geom;
}

/** The clamp invariant: the map always covers the whole window, the camera
 * never frames void past a world edge. */
function assertWorldCoversStage(geom, label) {
  assert.ok(geom.world.left <= geom.stage.left + 1, `${label}: no void west of the map`);
  assert.ok(geom.world.top <= geom.stage.top + 1, `${label}: no void north of the map`);
  assert.ok(geom.world.right >= geom.stage.right - 1, `${label}: no void east of the map`);
  assert.ok(geom.world.bottom >= geom.stage.bottom - 1, `${label}: no void south of the map`);
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Walks the character toward an object by holding real arrow keys in short
 * bursts, until the proximity trigger opens the overlay. */
async function walkUntilOverlay(page, objectId, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await overlayOpen(page)) return true;
    // Aim just below the sprite (its south door), so the route never grazes
    // another object's trigger zone on the way past.
    const delta = await page.evaluate((id) => {
      const char = document.querySelector('[data-world-char]');
      const sprite = document.querySelector(`[data-world-object="${id}"] .sim-world-obj-sprite`);
      if (!char || !sprite) return null;
      const c = char.getBoundingClientRect();
      const t = sprite.getBoundingClientRect();
      return {
        dx: (t.left + t.width / 2) - (c.left + c.width / 2),
        dy: (t.bottom + 20) - (c.top + c.height / 2),
      };
    }, objectId);
    assert.ok(delta, 'character and target exist');
    if (process.env.DESK_OS_WORLD_DEBUG === '1') {
      console.error(`walk ${objectId}: dx=${Math.round(delta.dx)} dy=${Math.round(delta.dy)}`);
    }
    const held = [];
    if (Math.abs(delta.dx) > 6) held.push(delta.dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    if (Math.abs(delta.dy) > 6) held.push(delta.dy > 0 ? 'ArrowDown' : 'ArrowUp');
    if (!held.length) break;
    for (const key of held) await page.keyboard.down(key);
    await page.waitForTimeout(320);
    for (const key of held) await page.keyboard.up(key);
  }
  return overlayOpen(page);
}

/** The one explicit correction over tonight's earlier version: content opens
 * as a panel over the scene, never a full-screen dialog, with the world
 * still present around it. */
async function assertInWorldOverlay(page) {
  assert.equal(await overlayOpen(page), true, 'in-world overlay is open');
  assert.equal(
    await page.evaluate(() => Boolean(document.querySelector('dialog[open]'))),
    false,
    'no full-screen <dialog> is involved',
  );
  const viewport = page.viewportSize();
  const panelBox = await page.locator('[data-world-overlay-panel]').boundingBox();
  assert.ok(panelBox, 'overlay panel has a box');
  // The console is full-viewport now (2026-09-04 fullscreen ask), so the
  // panel, which insets from the FRAME's edges, legitimately gets close to
  // viewport-sized; the old 0.92/0.8 ratios were tuned for the constrained
  // card layout. The invariant that still matters: a visible dimmed-world
  // margin must survive on every side, i.e. the panel can never become
  // exactly viewport-sized.
  assert.ok(panelBox.width < viewport.width - 10, 'overlay panel leaves dimmed world visible left and right');
  assert.ok(panelBox.height < viewport.height - 10, 'overlay panel leaves dimmed world visible above and below');
  const stageBox = await page.locator('[data-world-stage]').boundingBox();
  assert.ok(stageBox && stageBox.height > 200, 'world stage is still present behind the overlay');
  assert.ok(await charBox(page), 'character is still in the scene');
}

async function closeOverlay(page) {
  await page.locator('[data-world-overlay-close]').evaluate((button) => button.click());
  await page.waitForFunction(() => document.querySelector('[data-world-overlay]')?.hidden === true);
}

const browser = await chromium.launch({ headless: true });
try {
  await ensureServer();
  account = await createThrowawayAccount();

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // The background knowledge-graph iframe is heavy enough to stall the
  // renderer for tens of seconds in headless runs, which starves the walk
  // loop's evaluates. Same known issue the main suite handles with its
  // DESK_OS_BLOCK_GRAPH escape hatch; nothing asserted here depends on it.
  await page.route('**/full-graph-viewer.html*', (route) => route.abort());

  // Warm the React module graph on a separate page so the Research overlay
  // is not waiting on Vite's first compile later, and so any React-side
  // console noise never lands in this page's error log.
  const warmPage = await browser.newPage();
  await warmPage.goto(`${ORIGIN}/learn`, { waitUntil: 'domcontentloaded' });
  await warmPage.waitForTimeout(4000);
  await warmPage.close();

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  // The world is the landing now (2026-09-04), boot goes straight there,
  // Workspace is retired, not a step along the way anymore.
  await waitForStudio(page);
  assert.equal(await page.locator('#hubWorkspace').isHidden(), true);

  // ---------- the world exists ----------
  await page.locator('[data-world-stage]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-world-object]').count(), 5, 'plant + four buildings');
  for (const id of ['plant', 'careers', 'library', 'tutors', 'workshop']) {
    await page.locator(`[data-world-object="${id}"]`).waitFor({ state: 'visible' });
  }
  await capture(page, '/private/tmp/mindcraft-world-scene.png');

  // ---------- the world really is bigger than one screen ----------
  const boot = await worldGeom(page);
  assert.ok(
    boot.world.width > boot.stage.width * 2,
    `world is at least two screens wide (${boot.world.width} vs stage ${boot.stage.width})`,
  );
  // Height ratio relaxed from 2x on purpose (2026-09-04 fullscreen ask): the
  // console now fills the viewport, so at this 1000px-tall window the fixed
  // 2000px map is EXACTLY two screens tall and a strict > 2x is false by
  // definition, not by regression. The real invariant is unchanged: the map
  // extends well past one screen vertically, so exploring means walking.
  assert.ok(
    boot.world.height > boot.stage.height * 1.5,
    `world is well over one screen tall (${boot.world.height} vs stage ${boot.stage.height})`,
  );
  assertWorldCoversStage(boot, 'at spawn');
  assert.ok(
    Math.abs(boot.char.viewX - (boot.stage.left + boot.stage.width / 2)) < 30,
    'the camera starts centered on the character (x)',
  );
  assert.ok(
    Math.abs(boot.char.viewY - (boot.stage.top + boot.stage.height / 2)) < 40,
    'the camera starts centered on the character (y)',
  );

  // ---------- the character actually moves on key input (world px) ----------
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  const afterRight = await worldGeom(page);
  assert.ok(
    afterRight.char.worldX > boot.char.worldX + 25,
    `character walked right in world space (${boot.char.worldX} -> ${afterRight.char.worldX})`,
  );
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  const afterUp = await worldGeom(page);
  assert.ok(
    afterUp.char.worldY < afterRight.char.worldY - 15,
    `character walked up with WASD (${afterRight.char.worldY} -> ${afterUp.char.worldY})`,
  );

  // ---------- camera follow: centered while crossing the middle ----------
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowRight');
  const midWalk = await worldGeom(page);
  assert.ok(
    midWalk.char.worldX > afterUp.char.worldX + 120,
    `the walk covered real ground (${afterUp.char.worldX} -> ${midWalk.char.worldX})`,
  );
  assert.ok(
    Math.abs(midWalk.char.viewX - (midWalk.stage.left + midWalk.stage.width / 2)) < 30,
    'the camera kept the character centered while crossing the middle of the map',
  );
  assertWorldCoversStage(midWalk, 'mid-walk');

  // ---------- camera clamp: flush at the south edge, never past it ----------
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(3800);
  await page.keyboard.up('ArrowDown');
  const atEdge = await worldGeom(page);
  assert.ok(
    Math.abs(atEdge.world.bottom - atEdge.stage.bottom) < 2,
    `camera clamped flush with the south edge (map bottom ${atEdge.world.bottom} vs stage bottom ${atEdge.stage.bottom})`,
  );
  assertWorldCoversStage(atEdge, 'at the south edge');
  assert.ok(
    atEdge.char.viewY > atEdge.stage.top + atEdge.stage.height / 2 + 100,
    'at the clamped edge the character leaves center screen instead of the camera framing past the map',
  );
  await capture(page, '/private/tmp/mindcraft-world-south-edge.png');

  // ---------- a far building exists off screen until you walk there ----------
  const stageBoxAtEdge = await page.locator('[data-world-stage]').boundingBox();
  const workshopBefore = await page.locator('[data-world-object="workshop"]').boundingBox();
  assert.ok(stageBoxAtEdge && workshopBefore, 'stage and workshop have boxes');
  assert.equal(
    rectsIntersect(workshopBefore, stageBoxAtEdge),
    false,
    'the Workshop starts well outside the camera view',
  );
  assert.equal(await walkUntilOverlay(page, 'workshop'), true, 'the cross-map trek reached the Workshop');
  await assertInWorldOverlay(page);
  assert.match(await page.locator('[data-world-overlay-title]').innerText(), /Workshop/);
  const workshopAfter = await page.locator('[data-world-object="workshop"]').boundingBox();
  assert.ok(workshopAfter, 'workshop still has a box');
  assert.equal(
    rectsIntersect(workshopAfter, stageBoxAtEdge),
    true,
    'after the trek the Workshop is actually in frame',
  );
  await capture(page, '/private/tmp/mindcraft-world-workshop-trek.png');
  await closeOverlay(page);

  // ---------- walking up to the plant opens its real sim + docs ----------
  assert.equal(await walkUntilOverlay(page, 'plant'), true, 'walking to the plant opened its overlay');
  await assertInWorldOverlay(page);
  assert.match(await page.locator('[data-world-overlay-title]').innerText(), /Plant bed/);

  const plantFrame = page.frameLocator('[data-world-overlay-mount] iframe');
  const growth = plantFrame.locator('[data-output="growth"] strong');
  await growth.waitFor({ state: 'visible' });
  const growthBefore = await growth.innerText();
  await plantFrame.locator('[data-input="temperature"]').evaluate((input) => {
    input.value = '40';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  const growthAfter = await growth.innerText();
  assert.notEqual(growthAfter, growthBefore, `growth responded to the slider (${growthBefore} -> ${growthAfter})`);

  const doc = page.locator('[data-world-overlay-doc]');
  await doc.waitFor({ state: 'visible' });
  assert.match(await doc.innerText(), /What actually makes a plant grow/);
  await doc.locator('[data-doc-input="water"]').evaluate((button) => button.click());
  await plantFrame.locator('label.is-highlighted').waitFor({ state: 'visible' });
  await capture(page, '/private/tmp/mindcraft-world-plant-overlay.png');
  await closeOverlay(page);

  // The adopted node went straight back to the wiring board.
  await page.waitForFunction(() => Boolean(document.querySelector('[data-sim-board] [data-sim-node^="plant-"]')));
  assert.equal(await page.locator('.sim-wire').count(), 3, 'board wires survived the world trip');

  // ---------- the Careers office hosts the ONE real Resume Helper ----------
  await page.locator('[data-world-object="careers"]').evaluate((button) => button.click());
  await assertInWorldOverlay(page);
  await page.locator('[data-world-overlay-mount] #hubResume').waitFor({ state: 'visible' });
  await page.locator('[data-world-overlay-mount] .rh-app').waitFor({ state: 'visible' });
  await capture(page, '/private/tmp/mindcraft-world-careers-overlay.png');
  await closeOverlay(page);
  assert.equal(
    await page.evaluate(() => (
      !document.querySelector('[data-world-overlay-mount] #hubResume')
      && document.getElementById('hubResume')?.hidden === true
    )),
    true,
    'the resume panel went back to its own slot, hidden again',
  );

  // ---------- Tutors & events hosts the ONE real tutor map ----------
  await page.locator('[data-world-object="tutors"]').evaluate((button) => button.click());
  await assertInWorldOverlay(page);
  await page.locator('[data-world-overlay-mount] #hubTutorMap').waitFor({ state: 'visible' });
  await page.locator('[data-world-overlay-mount] .hub-tutors-title').waitFor({ state: 'visible' });
  await capture(page, '/private/tmp/mindcraft-world-tutors-overlay.png');
  await closeOverlay(page);
  assert.equal(
    await page.evaluate(() => (
      !document.querySelector('[data-world-overlay-mount] #hubTutorMap')
      && document.getElementById('hubTutorMap')?.hidden === true
    )),
    true,
    'the tutor map went back to its own slot, hidden again',
  );

  // ---------- the Workshop hosts the ONE real Parts bin + wiring board ----------
  assert.equal(await page.locator('#simWorkbench').isHidden(), true, 'no standalone board section under the world');
  await page.locator('[data-world-object="workshop"]').evaluate((button) => button.click());
  await assertInWorldOverlay(page);
  await page.locator('[data-world-overlay-mount] #simWorkbench').waitFor({ state: 'visible' });
  await page.locator('[data-world-overlay-mount] [data-sim-template="sun"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-world-overlay-mount] .sim-wire').count(), 3, 'the real board, wires intact');
  await capture(page, '/private/tmp/mindcraft-world-workshop-overlay.png');
  await closeOverlay(page);
  assert.equal(
    await page.evaluate(() => (
      !document.querySelector('[data-world-overlay-mount] #simWorkbench')
      && document.getElementById('simWorkbench')?.hidden === true
    )),
    true,
    'the workbench went back to its own slot, hidden again',
  );

  assert.deepEqual(pageErrors, [], 'no page errors through the plant, careers, tutors, and workshop flows');

  // ---------- the Research library frames the real authed Learn ----------
  await page.evaluate(async ({ email, password }) => {
    const fireMod = await import('/desk-os/js/fire.js');
    const fire = await fireMod.ensureFire();
    if (!fire) throw new Error('Firebase SDK did not load in the page');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    await authMod.signInWithEmailAndPassword(fire.auth, email, password);
  }, { email: account.email, password: account.password });

  await page.locator('[data-world-object="library"]').evaluate((button) => button.click());
  await assertInWorldOverlay(page);
  const learnFrameEl = page.locator('[data-world-overlay-mount] iframe.sim-world-embed');
  await learnFrameEl.waitFor({ state: 'visible' });
  assert.match(await learnFrameEl.getAttribute('src'), /\/learn\?embed=1/);
  assert.equal(
    await page.locator('[data-world-overlay-full]').getAttribute('href'),
    '/learn',
    'the honest full-page escape hatch points at real Learn',
  );

  // Real Learn content, not just an iframe tag: Jesse's entry stage renders
  // only once the real React app booted, AuthGuard passed, and Learn mounted.
  const learnFrame = page.frameLocator('[data-world-overlay-mount] iframe.sim-world-embed');
  await learnFrame
    .getByText('What would you like to work on?')
    .waitFor({ state: 'visible', timeout: 90000 });
  assert.ok(await charBox(page), 'the world is still present around embedded Learn');
  await capture(page, '/private/tmp/mindcraft-world-library-overlay.png');
  await closeOverlay(page);

  await page.close();
  console.log(JSON.stringify({ ok: true, screenshots }, null, 2));
} finally {
  await deleteThrowawayAccount(account);
  await browser.close();
  if (viteChild) viteChild.kill();
}
