/**
 * simWorld.js: the walkable garden world inside Sim Studio (2026-09-04
 * founder ask). A top-down 2D tile scene, drawn entirely with DOM + CSS in
 * the Desk OS flat-ink style (no engine, no image assets, no bundler, the
 * same constraints every other Desk OS module lives with). A small blocky
 * character walks with arrow keys or WASD; stepping up to an object, or
 * clicking it, opens that object's REAL feature in an in-world overlay: a
 * panel over the scene with the world still visible and dimmed around it.
 * Explicitly NOT a full-screen dialog: the founder rejected tonight's
 * earlier full-screen <dialog> takeover ("the sims appear when you click on
 * objects and is not the entire screen in and of itself").
 *
 * COORDINATES + CAMERA (2026-09-04, second pass tonight): everything here
 * used to be a percentage of the visible stage, which meant the whole map
 * was always on screen at once and could never read as bigger than one
 * screen no matter how it was styled. The world is now a fixed
 * WORLD_W x WORLD_H pixel map rendered into one absolutely positioned layer
 * ([data-world-map]) inside the stage, and the stage acts as a camera: a
 * CSS translate3d pans that layer so the character stays centered, clamped
 * at the map edges so the view never shows past the world (the stage DOM
 * itself never resizes, it is just the window). Character position, the
 * objects, decor, terrain, and all collision math live in world pixels now;
 * the stage size only decides how much of the map is in frame at once.
 *
 * Three object kinds, each one a door into something that already exists:
 *   sim   -> adopts the object's real wiring-board node (same live iframe,
 *            same sim:ready/sim:output bridge) into the overlay, next to its
 *            DOCS reference panel with the click-to-highlight bridge.
 *   panel -> adopts a real existing panel (#hubResume for resumeHelper.js,
 *            #hubTutorMap for tutorMap.js, see the PANELS table below) into
 *            the overlay and opens it with its own real open(). Never a
 *            second copy of either.
 *   embed -> frames a real same-origin app route. Tonight: /learn?embed=1,
 *            which App.tsx renders as <Learn embedded /> (the exact embed
 *            mechanism Dashboard's view=learn already uses).
 *
 * UNLOCK CONTRACT (designed, deliberately not faked): an entry may carry
 *   unlocked: false, unlock: { source: 'book', conceptId: '...' }
 * and renderWorld() will simply skip it until unlocked flips true. Nothing
 * tonight flips it: there is no real, queryable "this student finished a
 * book about X" signal reachable from this static shell (BookReader logs
 * learn activity to Firestore per event, but exposes no completion flag,
 * and no pipeline mints a sim template from a finished book). When that
 * signal exists, the honest slot-in is: read the student's unlocks at boot,
 * append entries here with kind 'sim' whose templateId points at a sim
 * registered through the same mountNode path invented and library sims
 * already use in simStudio.js. No rewrite needed, just real data.
 */

const SPEED = 175; // px per second
const CHAR_W = 26;
const CHAR_H = 40;
const DOOR_PAD = 26; // px around a sprite that counts as "at the door"

/** The fixed world size, in real pixels. Sized so the map is several
 * screens in both directions at the stage's real size (roughly 1300x480 on
 * a desktop, much smaller on a phone): about 2.5 screens wide and 4 tall on
 * desktop, so walking edge to edge takes ~18s at SPEED and every trip
 * between buildings is real traversal, while five destinations plus decor
 * still keep it feeling inhabited rather than padded. Room to grow: new
 * unlocked buildings can land in the open quarters without a resize. */
export const WORLD_W = 3200;
export const WORLD_H = 2000;
const TILE = 50; // terrain tile size in world px
const TERRAIN_COLS = WORLD_W / TILE; // 64
const TERRAIN_ROWS = WORLD_H / TILE; // 40
const PATH_Y = 1520; // the east-west road's top edge, in world px
const SPAWN = { x: WORLD_W / 2, y: PATH_Y + 20 }; // on the road, mid-map

/** All positions below are world pixels, anchored at each sprite's
 * bottom-center (the CSS translate(-50%, -100%) anchor). Spread across the
 * whole map on purpose: workshop far northwest, careers north off the road
 * spur, library far northeast, tutors east of spawn (the one neighbor in
 * frame when you arrive), plant southwest past the road. */
export const WORLD_OBJECTS = [
  {
    id: 'plant',
    kind: 'sim',
    templateId: 'plant',
    label: 'Plant',
    title: 'Plant bed',
    accent: 'sage',
    sprite: 'plant',
    x: 600, y: 1650,
    unlocked: true,
  },
  {
    id: 'careers',
    kind: 'panel',
    panel: 'resume',
    label: 'Careers office',
    title: 'Careers office',
    accent: 'gold',
    sprite: 'careers',
    x: 1550, y: 550,
    unlocked: true,
  },
  {
    id: 'library',
    kind: 'embed',
    href: '/learn?embed=1',
    fullHref: '/learn',
    label: 'Research library',
    title: 'Research library',
    accent: 'navy',
    sprite: 'library',
    x: 2750, y: 620,
    unlocked: true,
  },
  {
    id: 'tutors',
    kind: 'panel',
    panel: 'tutors',
    label: 'Tutors & events',
    title: 'Tutors & events',
    accent: 'coral',
    sprite: 'tutors',
    x: 2150, y: 1420,
    unlocked: true,
  },
  {
    id: 'workshop',
    kind: 'panel',
    panel: 'workshop',
    label: 'Workshop',
    title: 'Workshop',
    accent: 'gray',
    sprite: 'workshop',
    x: 450, y: 380,
    unlocked: true,
  },
];

/** Which real element + real bridge a 'panel' kind adopts, keyed by
 * object.panel. Add a row here, not a new if-branch, when a 4th panel
 * building shows up, same "data, not special cases" discipline as
 * WORLD_OBJECTS itself. */
const PANELS = {
  resume: { elementId: 'hubResume', label: 'The Careers office' },
  tutors: { elementId: 'hubTutorMap', label: 'Tutors & events' },
  // The whole Parts bin + wiring canvas, adopted as one unit exactly like
  // Resume and Tutors above (2026-09-04 ask: no separate board section
  // sitting under the world, one integrated world only). No dedicated
  // open/close bridge exists for this one, none is needed: it is a plain
  // DOM element with no module instance behind it, so the generic
  // `el.hidden = false/true` fallback in openObject/closeOverlay already
  // does the right thing without a panelBridges.workshop entry at all.
  workshop: { elementId: 'simWorkbench', label: 'Workshop' },
};

// Pure decoration, never interactive, never solid. Hand-placed accents in
// world px: one by the spawn, the rest clustered near the destinations so
// arriving somewhere feels arrived-at.
const DECOR = [
  { sprite: 'plant', x: 1520, y: 1490 }, // right where a student spawns
  { sprite: 'flower', x: 1680, y: 1620 },
  { sprite: 'flower', x: 540, y: 480 }, // by the workshop
  { sprite: 'flower', x: 2260, y: 1560 }, // by tutors
  { sprite: 'rock', x: 2850, y: 700 }, // by the library
  { sprite: 'bush', x: 1400, y: 620 }, // by careers
  { sprite: 'bush', x: 700, y: 1560 }, // by the plant bed
];

// A real (if tiny) procedural terrain generator, the same idea actual
// terrain tools use, layered noise deciding what each patch of ground is,
// not a hand-painted or extracted image (2026-09-04 ask, after looking at a
// couple of real planet/terrain generators: borrow the *technique*, not an
// asset pipeline neither tool can actually hand us here). Deterministic
// hash instead of Math.random() so the same map renders the same way every
// load, it is a place, not a reshuffle. Now covers the full 64x40 world
// grid instead of one screen's worth of tiles.
function hashTile(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
const TERRAIN_KINDS = [
  { kind: 'grass-a', weight: 0.40 },
  { kind: 'grass-b', weight: 0.36 },
  { kind: 'grass-c', weight: 0.15 },
  { kind: 'dirt', weight: 0.06 },
  { kind: 'stone', weight: 0.03 },
];
function terrainAt(x, y) {
  // Blend the tile's own roll with its neighbors' so same-kind patches
  // actually cluster into small biomes instead of salt-and-pepper noise,
  // a cheap stand-in for real value noise.
  const roll = (hashTile(x, y) * 3 + hashTile(x - 1, y) + hashTile(x + 1, y) + hashTile(x, y - 1) + hashTile(x, y + 1)) / 7;
  let acc = 0;
  for (const entry of TERRAIN_KINDS) {
    acc += entry.weight;
    if (roll < acc) return entry.kind;
  }
  return 'grass-a';
}

/** Deterministic decorative scatter over the whole map, the same hash-noise
 * technique as the terrain, so ten screens of world do not read as empty
 * lawn between the five real destinations. Same contract as DECOR: never
 * interactive, never solid. Offsets into different hash domains keep it
 * uncorrelated with the ground pattern; the road band stays clear. */
function scatterDecor() {
  const out = [];
  for (let gy = 0; gy < TERRAIN_ROWS; gy++) {
    for (let gx = 0; gx < TERRAIN_COLS; gx++) {
      const roll = hashTile(gx + 211, gy + 97);
      if (roll >= 0.05) continue;
      const x = gx * TILE + 10 + hashTile(gx + 401, gy) * (TILE - 20);
      const y = gy * TILE + 10 + hashTile(gx, gy + 619) * (TILE - 20);
      if (y > PATH_Y - 24 && y < PATH_Y + 60) continue; // keep the road clear
      const sprite = roll < 0.02 ? 'flower' : roll < 0.038 ? 'bush' : 'rock';
      out.push({ sprite, x, y });
    }
  }
  return out;
}
const SCATTER = scatterDecor();

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function inflate(rect, pad) {
  return {
    left: rect.left - pad,
    top: rect.top - pad,
    right: rect.right + pad,
    bottom: rect.bottom + pad,
  };
}

const SPRITES = {
  plant: `
    <span class="wsp-plant-leaf left"></span>
    <span class="wsp-plant-leaf right"></span>
    <span class="wsp-plant-stem"></span>
    <span class="wsp-plant-pot"></span>`,
  careers: `
    <span class="wsp-roof"></span>
    <span class="wsp-wall is-gold">
      <span class="wsp-window is-screen"></span>
      <span class="wsp-door"></span>
    </span>`,
  library: `
    <span class="wsp-roof is-navy"></span>
    <span class="wsp-wall is-paper">
      <span class="wsp-window"></span>
      <span class="wsp-book"></span>
      <span class="wsp-door"></span>
    </span>`,
  tutors: `
    <span class="wsp-roof is-coral"></span>
    <span class="wsp-wall is-coral-wall">
      <span class="wsp-window"></span>
      <span class="wsp-window"></span>
      <span class="wsp-door"></span>
    </span>`,
  workshop: `
    <span class="wsp-roof is-gray"></span>
    <span class="wsp-wall is-gray-wall">
      <span class="wsp-gear"></span>
      <span class="wsp-door"></span>
    </span>`,
  flower: '<span class="wsp-flower"></span>',
  rock: '<span class="wsp-rock"></span>',
  bush: '<span class="wsp-bush"></span>',
};

export function createSimWorld({ root, bridge, resume = null, tutorMap = null, objects = WORLD_OBJECTS } = {}) {
  const panelBridges = { resume, tutors: tutorMap };
  if (!root || !bridge) return { closeOverlay() {}, layout() {}, destroy() {} };

  const stage = root.querySelector('[data-world-stage]');
  const overlay = root.querySelector('[data-world-overlay]');
  const panel = root.querySelector('[data-world-overlay-panel]');
  const overlayTitle = root.querySelector('[data-world-overlay-title]');
  const overlayFull = root.querySelector('[data-world-overlay-full]');
  const overlayDoc = root.querySelector('[data-world-overlay-doc]');
  const overlayMount = root.querySelector('[data-world-overlay-mount]');
  const overlayClose = root.querySelector('[data-world-overlay-close]');
  if (!stage || !overlay || !overlayMount) return { closeOverlay() {}, layout() {}, destroy() {} };

  const objectEls = new Map(); // id -> { button, sprite }
  let open = null; // { object, node, panelEl, panelPlaceholder }
  let suppressId = null; // do not auto-reopen this object until we walk away
  let worldEl = null; // the WORLD_W x WORLD_H layer the camera pans

  // Character position in world pixels, anchored at the feet (bottom-center
  // of the drawn box). The camera, not the coordinates, absorbs any stage
  // resize now.
  const pos = { x: SPAWN.x, y: SPAWN.y };
  let facing = 'right';
  const keys = new Set();
  let raf = 0;
  let lastT = 0;

  function renderWorld() {
    stage.replaceChildren();
    worldEl = document.createElement('div');
    worldEl.className = 'sim-world-map';
    worldEl.dataset.worldMap = '';
    worldEl.style.width = `${WORLD_W}px`;
    worldEl.style.height = `${WORLD_H}px`;
    stage.appendChild(worldEl);

    const terrain = document.createElement('div');
    terrain.className = 'sim-world-terrain';
    terrain.setAttribute('aria-hidden', 'true');
    terrain.style.gridTemplateColumns = `repeat(${TERRAIN_COLS}, 1fr)`;
    terrain.style.gridTemplateRows = `repeat(${TERRAIN_ROWS}, 1fr)`;
    for (let y = 0; y < TERRAIN_ROWS; y++) {
      for (let x = 0; x < TERRAIN_COLS; x++) {
        const tile = document.createElement('span');
        tile.className = `sim-world-tile is-${terrainAt(x, y)}`;
        terrain.appendChild(tile);
      }
    }
    worldEl.appendChild(terrain);

    // The east-west road through spawn, plus a north spur to the Careers
    // office door, so the far buildings read as connected, not scattered.
    const path = document.createElement('span');
    path.className = 'sim-world-path';
    path.setAttribute('aria-hidden', 'true');
    path.style.top = `${PATH_Y}px`;
    worldEl.appendChild(path);
    const spur = document.createElement('span');
    spur.className = 'sim-world-path is-vertical';
    spur.setAttribute('aria-hidden', 'true');
    spur.style.left = '1532px';
    spur.style.top = '550px';
    spur.style.height = `${PATH_Y - 550}px`;
    worldEl.appendChild(spur);

    [...DECOR, ...SCATTER].forEach((decor) => {
      const el = document.createElement('span');
      el.className = `sim-world-decor is-${decor.sprite}`;
      el.setAttribute('aria-hidden', 'true');
      el.style.left = `${decor.x}px`;
      el.style.top = `${decor.y}px`;
      el.innerHTML = SPRITES[decor.sprite] || '';
      worldEl.appendChild(el);
    });

    objectEls.clear();
    objects.filter((object) => object.unlocked !== false).forEach((object) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `sim-world-obj is-${object.accent}`;
      button.dataset.worldObject = object.id;
      button.setAttribute('aria-label', `Open ${object.label}`);
      button.style.left = `${object.x}px`;
      button.style.top = `${object.y}px`;
      button.innerHTML = `
        <span class="sim-world-obj-sprite is-${object.sprite}" aria-hidden="true">${SPRITES[object.sprite] || ''}</span>
        <span class="sim-world-obj-label">${object.label}</span>`;
      button.addEventListener('click', () => {
        suppressId = object.id;
        void openObject(object);
      });
      worldEl.appendChild(button);
      objectEls.set(object.id, {
        button,
        sprite: button.querySelector('.sim-world-obj-sprite'),
      });
    });

    const char = document.createElement('div');
    char.className = 'sim-world-char';
    char.dataset.worldChar = '';
    char.setAttribute('aria-hidden', 'true');
    let name = '';
    try {
      name = String(JSON.parse(localStorage.getItem('deskOs.user') || '{}')?.name || '').split(/\s+/)[0];
    } catch { /* ignore */ }
    char.innerHTML = `
      ${name ? `<span class="sim-world-char-name">${name}</span>` : ''}
      <span class="sim-world-char-head"></span>
      <span class="sim-world-char-body"></span>
      <span class="sim-world-char-legs"><span></span><span></span></span>`;
    worldEl.appendChild(char);
    layout();
  }

  function charEl() {
    return stage.querySelector('[data-world-char]');
  }

  /** The character's box in world pixels. */
  function charRect() {
    const x = pos.x - CHAR_W / 2;
    const y = pos.y - CHAR_H;
    return { left: x, top: y, right: x + CHAR_W, bottom: y + CHAR_H };
  }

  /** Sprite boxes in world pixels. The world layer's transform is a pure
   * translation, so subtracting its client rect turns viewport rects back
   * into world coordinates without any scale math. The label chip below a
   * sprite stays walkable, only the drawn body blocks. */
  function solidRects() {
    if (!worldEl) return [];
    const worldBox = worldEl.getBoundingClientRect();
    return [...objectEls.values()].map(({ sprite }) => {
      const r = sprite.getBoundingClientRect();
      return {
        left: r.left - worldBox.left,
        top: r.top - worldBox.top,
        right: r.right - worldBox.left,
        bottom: r.bottom - worldBox.top,
      };
    });
  }

  function paintChar() {
    const el = charEl();
    if (!el) return;
    el.style.left = `${pos.x - CHAR_W / 2}px`;
    el.style.top = `${pos.y - CHAR_H}px`;
    el.dataset.facing = facing;
  }

  /** The camera: center the view on the character, clamp at the map edges
   * so the stage never frames past the world. Implemented as a transform on
   * the world layer, the stage DOM itself never moves or resizes. */
  function updateCamera() {
    if (!worldEl) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const camX = Math.min(Math.max(0, WORLD_W - w), Math.max(0, pos.x - w / 2));
    const camY = Math.min(Math.max(0, WORLD_H - h), Math.max(0, pos.y - CHAR_H / 2 - h / 2));
    worldEl.style.transform = `translate3d(${-Math.round(camX)}px, ${-Math.round(camY)}px, 0)`;
  }

  function layout() {
    paintChar();
    updateCamera();
  }

  function worldActive() {
    return stage.offsetParent !== null && !open;
  }

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };

  function onKeyDown(event) {
    if (open) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeOverlay();
      }
      return;
    }
    if (!worldActive()) return;
    const target = event.target;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const dir = KEYMAP[event.code];
    if (!dir) return;
    event.preventDefault();
    keys.add(dir);
    startLoop();
  }

  function onKeyUp(event) {
    const dir = KEYMAP[event.code];
    if (dir) keys.delete(dir);
  }

  function startLoop() {
    if (raf) return;
    lastT = performance.now();
    raf = requestAnimationFrame(tick);
    charEl()?.classList.add('is-walking');
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    charEl()?.classList.remove('is-walking');
  }

  function tick(t) {
    raf = 0;
    // Cap a frame's worth of travel so a slow frame never tunnels the
    // character through a wall, but keep the cap loose enough that a low
    // frame rate (headless test runs, busy tabs) still moves at real speed.
    const dt = Math.min(120, t - lastT);
    lastT = t;
    const dx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const dy = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    if (!dx && !dy) {
      stopLoop();
      return;
    }
    if (dx) facing = dx > 0 ? 'right' : 'left';
    const norm = Math.hypot(dx, dy) || 1;
    const step = (SPEED * dt) / 1000;
    move((dx / norm) * step, (dy / norm) * step);
    layout();
    checkProximity();
    if (!open) raf = requestAnimationFrame(tick);
  }

  /** Per-axis move with solid collision, so the character slides along a
   * building instead of sticking to it. All in world pixels: dx/dy are px,
   * the world border is the map edge, not the stage edge. */
  function move(dx, dy) {
    if (!worldEl) return;
    const solids = solidRects();
    const tryAxis = (x, y) => {
      const rect = { left: x - CHAR_W / 2, top: y - CHAR_H, right: x + CHAR_W / 2, bottom: y };
      return !solids.some((s) => intersects(rect, s));
    };
    const nextX = Math.min(WORLD_W - CHAR_W / 2, Math.max(CHAR_W / 2, pos.x + dx));
    if (tryAxis(nextX, pos.y)) pos.x = nextX;
    const nextY = Math.min(WORLD_H, Math.max(CHAR_H, pos.y + dy));
    if (tryAxis(pos.x, nextY)) pos.y = nextY;
  }

  /** Walking up to an object's door opens it. After closing, the same
   * object stays quiet until the character actually walks away, so a close
   * does not bounce straight back open. */
  function checkProximity() {
    if (open || !worldEl) return;
    const worldBox = worldEl.getBoundingClientRect();
    const rect = charRect();
    let nearId = null;
    for (const object of objects) {
      if (object.unlocked === false) continue;
      const entry = objectEls.get(object.id);
      if (!entry) continue;
      const s = entry.sprite.getBoundingClientRect();
      const door = inflate({
        left: s.left - worldBox.left,
        top: s.top - worldBox.top,
        right: s.right - worldBox.left,
        bottom: s.bottom - worldBox.top,
      }, DOOR_PAD);
      if (intersects(rect, door)) {
        nearId = object.id;
        if (suppressId !== object.id) {
          suppressId = object.id;
          void openObject(object);
        }
        break;
      }
    }
    if (!nearId) suppressId = null;
  }

  // ---------- the in-world overlay ----------

  async function openObject(object) {
    if (open) return;
    keys.clear();
    stopLoop();
    open = { object, node: null, panelEl: null, panelPlaceholder: null };
    if (overlayTitle) overlayTitle.textContent = object.title || object.label;
    if (overlayFull) {
      overlayFull.hidden = object.kind !== 'embed';
      if (object.kind === 'embed') overlayFull.href = object.fullHref || object.href;
    }
    if (overlayDoc) {
      overlayDoc.hidden = true;
      overlayDoc.replaceChildren();
    }
    overlayMount.replaceChildren();
    overlay.hidden = false;
    root.classList.add('is-overlay-open');

    if (object.kind === 'sim') {
      const node = bridge.getOrCreateNode(object.templateId);
      if (!node) {
        bridge.onToast?.('That sim is not available right now.');
        closeOverlay();
        return;
      }
      open.node = node;
      bridge.adoptNode(node, overlayMount);
      if (overlayDoc) bridge.renderDocs(overlayDoc, node);
    } else if (object.kind === 'panel') {
      const spec = PANELS[object.panel];
      const el = spec && document.getElementById(spec.elementId);
      if (!el) {
        bridge.onToast?.(`${object.label} is not available right now.`);
        closeOverlay();
        return;
      }
      open.panelEl = el;
      open.panelKind = object.panel;
      open.panelPlaceholder = document.createComment(`world-panel-${object.panel}`);
      el.parentNode?.insertBefore(open.panelPlaceholder, el);
      overlayMount.appendChild(el);
      const panelBridge = panelBridges[object.panel];
      if (panelBridge?.open) panelBridge.open();
      else el.hidden = false;
    } else if (object.kind === 'embed') {
      const iframe = document.createElement('iframe');
      iframe.className = 'sim-world-embed';
      iframe.src = object.href;
      iframe.title = object.title || object.label;
      overlayMount.appendChild(iframe);
    }
    overlayClose?.focus?.({ preventScroll: true });
  }

  function closeOverlay() {
    if (!open) return;
    const closing = open;
    open = null;
    if (closing.node) bridge.restoreNode(closing.node);
    if (closing.panelEl) {
      const panelBridge = panelBridges[closing.panelKind];
      if (panelBridge?.close) panelBridge.close();
      else closing.panelEl.hidden = true;
      if (closing.panelPlaceholder?.parentNode) {
        closing.panelPlaceholder.parentNode.replaceChild(closing.panelEl, closing.panelPlaceholder);
      }
    }
    if (overlayDoc) {
      overlayDoc.hidden = true;
      overlayDoc.replaceChildren();
    }
    overlayMount.replaceChildren();
    overlay.hidden = true;
    root.classList.remove('is-overlay-open');
    stage.focus?.({ preventScroll: true });
  }

  overlayClose?.addEventListener('click', closeOverlay);
  overlay.addEventListener('pointerdown', (event) => {
    if (!panel?.contains(event.target)) closeOverlay();
  });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const resizeObserver = new ResizeObserver(() => layout());
  resizeObserver.observe(stage);

  renderWorld();

  return {
    closeOverlay,
    layout,
    destroy() {
      closeOverlay();
      stopLoop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      resizeObserver.disconnect();
      stage.replaceChildren();
    },
  };
}
