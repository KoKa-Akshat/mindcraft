/** Space zoom by default · click a page first to zoom that page instead */

const MIN_SCALE = 0.85;
const MAX_SCALE = 1.85;
const GAP = 28;
const PAD = 16;

/** Plane-local box · survives desk space scale */
function readBox(el) {
  return {
    left: el.offsetLeft,
    top: el.offsetTop,
    w: el.offsetWidth,
    h: el.offsetHeight,
  };
}

function writeBox(el, box) {
  el.style.left = `${box.left}px`;
  el.style.top = `${box.top}px`;
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
  el.style.maxHeight = 'none';
  el.dataset.userMoved = '1';
}

function overlaps(a, b, gap = GAP) {
  return !(
    a.left + a.w + gap <= b.left
    || b.left + b.w + gap <= a.left
    || a.top + a.h + gap <= b.top
    || b.top + b.h + gap <= a.top
  );
}

function sheetAt(plane, clientX, clientY) {
  const sheets = [...plane.querySelectorAll('.paper-sheet')]
    .filter((el) => !el.hidden && !el.classList.contains('is-journal-open') && !el.classList.contains('is-min'));
  let hit = null;
  for (const sheet of sheets) {
    const r = sheet.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      hit = sheet;
    }
  }
  return hit;
}

function packAway(plane, focus, focusOverride = null) {
  const nodes = [...plane.querySelectorAll('.paper-sheet, .owl-logo')]
    .filter((el) => !el.hidden && !el.classList.contains('page-away') && !el.classList.contains('is-journal-open'));

  /** @type {Map<HTMLElement, { left: number, top: number, w: number, h: number }>} */
  const boxes = new Map();
  for (const el of nodes) {
    boxes.set(el, el === focus && focusOverride ? { ...focusOverride } : readBox(el));
  }

  const focusBox = boxes.get(focus);
  if (!focusBox) return;

  const bounds = {
    w: Math.max(plane.clientWidth, 800),
    h: Math.max(plane.clientHeight, 600),
  };

  for (let iter = 0; iter < 10; iter += 1) {
    for (const el of nodes) {
      if (el === focus) continue;
      const b = boxes.get(el);
      if (!b) continue;

      if (overlaps(focusBox, b, GAP + 8)) {
        const fcx = focusBox.left + focusBox.w / 2;
        const fcy = focusBox.top + focusBox.h / 2;
        const cx = b.left + b.w / 2;
        const cy = b.top + b.h / 2;
        let dx = cx - fcx;
        let dy = cy - fcy;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const push = 18 + iter * 2;
        b.left += dx * push;
        b.top += dy * push * 0.65;
      }

      for (const other of nodes) {
        if (other === el || other === focus) continue;
        const o = boxes.get(other);
        if (!o || !overlaps(b, o, GAP)) continue;
        const cx = b.left + b.w / 2;
        const cy = b.top + b.h / 2;
        const ox = o.left + o.w / 2;
        const oy = o.top + o.h / 2;
        let dx = cx - ox;
        let dy = cy - oy;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        b.left += dx * 8;
        b.top += dy * 6;
      }

      b.left = Math.max(PAD, Math.min(bounds.w - b.w - PAD, b.left));
      b.top = Math.max(PAD, Math.min(bounds.h - b.h - PAD, b.top));
    }
  }

  for (const [el, b] of boxes) {
    if (el === focus) {
      writeBox(el, focusBox);
      continue;
    }
    el.style.transition = 'left 0.28s ease, top 0.28s ease';
    writeBox(el, b);
    window.setTimeout(() => {
      el.style.transition = '';
    }, 320);
  }

  plane.dispatchEvent(new CustomEvent('sheet:moved', { bubbles: true }));
}

function applyZoom(el, factor, plane) {
  if (!el || el.classList.contains('is-min') || el.classList.contains('is-journal-open')) return;
  const cur = Number(el.dataset.zoom || '1');
  const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cur * factor));
  if (Math.abs(next - cur) < 0.008) return;

  const box = readBox(el);
  const cx = box.left + box.w / 2;
  const cy = box.top + box.h / 2;
  const ratio = next / cur;
  const maxW = Math.max(280, plane.clientWidth * 0.42);
  const maxH = Math.max(220, plane.clientHeight * 0.42);
  const w = Math.max(180, Math.min(maxW, box.w * ratio));
  const h = Math.max(140, Math.min(maxH, box.h * ratio));
  const nextBox = {
    w,
    h,
    left: Math.max(PAD, cx - w / 2),
    top: Math.max(PAD, cy - h / 2),
  };
  el.dataset.zoom = next.toFixed(3);
  el.classList.toggle('is-zoomed', next > 1.06);
  writeBox(el, nextBox);
  packAway(plane, el, nextBox);
  el.dispatchEvent(new CustomEvent('sheet:resized', { bubbles: true }));
}

/**
 * @param {{
 *   plane: HTMLElement,
 *   viewport: HTMLElement,
 *   onSpaceZoom?: (factor: number, clientX: number, clientY: number) => void,
 * }} opts
 */
export function createZoomPack({ plane, viewport, onSpaceZoom }) {
  if (!plane || !viewport) return { destroy() {}, focusSheet() {}, clearFocus() {}, getFocus: () => null };

  /** @type {HTMLElement | null} */
  let focused = null;
  /** @type {Map<number, { x: number, y: number }>} */
  const tips = new Map();
  /** @type {HTMLElement | null} */
  let pinchSheet = null;
  let lastDist = 0;
  let spacePinching = false;

  function touchDist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function focusSheet(el) {
    if (!el || el.classList.contains('owl-logo')) return;
    plane.querySelectorAll('.paper-sheet.is-zoom-focus').forEach((n) => {
      n.classList.remove('is-zoom-focus');
    });
    focused = el;
    el.classList.add('is-zoom-focus');
    el.style.zIndex = String(Math.max(36, Number(el.style.zIndex) || 20));
  }

  function clearFocus() {
    plane.querySelectorAll('.paper-sheet.is-zoom-focus').forEach((n) => {
      n.classList.remove('is-zoom-focus');
    });
    focused = null;
  }

  function onTouchStart(e) {
    for (const t of e.changedTouches) {
      tips.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (tips.size === 2) {
      const pts = [...tips.values()];
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      lastDist = touchDist(pts[0], pts[1]);
      // Page zoom only if a page is focused · else space zoom
      if (focused && !focused.hidden) {
        pinchSheet = focused;
        spacePinching = false;
        document.body.classList.add('is-pinching');
      } else {
        pinchSheet = null;
        spacePinching = true;
        document.body.classList.add('is-pinching');
      }
      void midX;
      void midY;
    }
  }

  function onTouchMove(e) {
    for (const t of e.changedTouches) {
      tips.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (tips.size !== 2) return;
    e.preventDefault();
    const pts = [...tips.values()];
    const dist = touchDist(pts[0], pts[1]);
    if (!lastDist) {
      lastDist = dist;
      return;
    }
    const factor = dist / lastDist;
    lastDist = dist;
    const softened = 1 + (factor - 1) * 0.85;
    if (pinchSheet) {
      applyZoom(pinchSheet, softened, plane);
    } else if (spacePinching) {
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      onSpaceZoom?.(softened, midX, midY);
    }
  }

  function onTouchEnd(e) {
    for (const t of e.changedTouches) tips.delete(t.identifier);
    if (tips.size < 2) {
      pinchSheet = null;
      spacePinching = false;
      lastDist = 0;
      document.body.classList.remove('is-pinching');
    }
  }

  function onWheel(e) {
    const pinch = e.ctrlKey || e.metaKey || e.altKey;
    if (!pinch) return;

    // Focused page → zoom that page · otherwise let pan do space zoom
    if (focused && plane.contains(focused) && !focused.hidden) {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY > 0 ? 0.92 : 1.1;
      applyZoom(focused, factor, plane);
    }
  }

  // Click a page to make zoom target it · click empty desk to zoom the space again
  plane.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.sheet-win, input, textarea, select, button, a, .owl-prompt')) return;
    const sheet = e.target.closest('.paper-sheet');
    if (sheet && plane.contains(sheet) && !sheet.classList.contains('is-min')) {
      focusSheet(sheet);
      return;
    }
    if (!e.target.closest('.owl-logo, .owl-prompt')) {
      clearFocus();
    }
  });

  viewport.addEventListener('touchstart', onTouchStart, { passive: true });
  viewport.addEventListener('touchmove', onTouchMove, { passive: false });
  viewport.addEventListener('touchend', onTouchEnd, { passive: true });
  viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });
  viewport.addEventListener('wheel', onWheel, { passive: false, capture: true });

  return {
    pack(focus) {
      if (focus) packAway(plane, focus);
    },
    zoomSheet(el, factor = 1.12) {
      if (el) applyZoom(el, factor, plane);
    },
    focusSheet,
    clearFocus,
    getFocus: () => focused,
    destroy() {
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', onTouchEnd);
      viewport.removeEventListener('wheel', onWheel, true);
    },
  };
}
