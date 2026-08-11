/** Pan + space-zoom the desk plane · landing at 0,0 · plane is 3× room */

const SPACE_MIN = 0.55;
const SPACE_MAX = 2.25;
/** Field desk world size vs one viewport */
const HOME_SPACE = 3;

export function createDeskPan({ viewport, plane, onPan }) {
  if (!viewport || !plane) {
    return {
      reset() {},
      expandRoom() {},
      focusEl() {},
      fitHome() {},
      relayout() {},
      setSpaceZoom() {},
      zoomSpaceAt() {},
      getSpaceZoom: () => 1,
    };
  }

  let x = 0;
  let y = 0;
  let scale = 1;
  let dragging = false;
  let sx = 0;
  let sy = 0;
  let ox = 0;
  let oy = 0;
  let room = HOME_SPACE;
  let homeFit = true;

  const apply = () => {
    plane.style.transformOrigin = '0 0';
    plane.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    onPan?.();
  };

  function sizePlane() {
    // 3× world · home composition lives in the top-left third (see HOME_ART)
    const mult = homeFit ? HOME_SPACE : Math.max(HOME_SPACE, 1.15 + room * 0.4);
    const w = Math.round(100 * mult);
    const h = Math.round(100 * Math.max(mult * 0.92, HOME_SPACE));
    plane.style.width = `${w}%`;
    plane.style.height = `${h}%`;
    plane.style.minWidth = `${w}%`;
    plane.style.minHeight = `${h}%`;
  }

  const clamp = () => {
    const vw = viewport.clientWidth || 1;
    const vh = viewport.clientHeight || 1;
    const pw = (plane.offsetWidth || vw) * scale;
    const ph = (plane.offsetHeight || vh) * scale;
    const maxX = Math.max(pw - vw, vw * 0.2);
    const maxY = Math.max(ph - vh, vh * 0.2);
    x = Math.max(-maxX, Math.min(0.15 * vw, x));
    y = Math.max(-maxY, Math.min(0.15 * vh, y));
  };

  const canPanFrom = (t) => {
    if (!t) return true;
    if (document.body.classList.contains('is-resizing') || document.body.classList.contains('is-dragging')) {
      return false;
    }
    if (t.closest(
      'input, textarea, select, button, a, .float-card, .paper-sheet, .owl-logo, .owl-prompt, .act-bleed, .sheet-win, .note-pad, .orb, .mascot, .upload-btn, .upload-text, .brand-home, .desk-index, .desk-rail',
    )) {
      return false;
    }
    return true;
  };

  function zoomSpaceAt(factor, clientX, clientY) {
    const next = Math.max(SPACE_MIN, Math.min(SPACE_MAX, scale * factor));
    if (Math.abs(next - scale) < 0.004) return;
    const rect = viewport.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const wx = (cx - x) / scale;
    const wy = (cy - y) / scale;
    scale = next;
    x = cx - wx * scale;
    y = cy - wy * scale;
    clamp();
    apply();
  }

  viewport.addEventListener('wheel', (e) => {
    if (e.target.closest('.float-card, .owl-prompt, .act-bleed')) return;
    if (document.body.classList.contains('is-pinching')) return;

    // Space zoom unless a page is focused (then zoomPack owns ctrl/⌘ zoom)
    const spaceZoom = e.ctrlKey || e.metaKey || e.altKey;
    const pageFocused = Boolean(plane.querySelector('.paper-sheet.is-zoom-focus'));
    if (spaceZoom && !pageFocused) {
      e.preventDefault();
      zoomSpaceAt(e.deltaY > 0 ? 0.92 : 1.08, e.clientX, e.clientY);
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    x -= e.deltaX;
    y -= e.deltaY;
    clamp();
    apply();
  }, { passive: false });

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (!canPanFrom(e.target)) return;
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    ox = x;
    oy = y;
    viewport.classList.add('panning');
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    x = ox + (e.clientX - sx);
    y = oy + (e.clientY - sy);
    clamp();
    apply();
  });

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('panning');
    try { viewport.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', end);

  sizePlane();
  apply();

  return {
    reset() {
      x = 0;
      y = 0;
      scale = 1;
      apply();
    },
    /** Landing composition at 0,0 inside the 3× world */
    fitHome() {
      homeFit = true;
      room = HOME_SPACE;
      x = 0;
      y = 0;
      scale = 1;
      sizePlane();
      apply();
    },
    /** Grow beyond the 3× home world when tools need more room */
    expandRoom(n = 1) {
      homeFit = false;
      room = Math.min(6, Math.max(HOME_SPACE, n * HOME_SPACE));
      sizePlane();
      clamp();
      apply();
    },
    relayout() {
      sizePlane();
      clamp();
      apply();
    },
    zoomSpaceAt,
    setSpaceZoom(next) {
      scale = Math.max(SPACE_MIN, Math.min(SPACE_MAX, Number(next) || 1));
      clamp();
      apply();
    },
    getSpaceZoom() {
      return scale;
    },
    focusEl(el, { soft = false } = {}) {
      if (!el || !viewport) return;
      const vr = viewport.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (vr.left + vr.width / 2) - cx;
      const dy = (vr.top + vr.height / 2) - cy;
      x += dx * (soft ? 0.7 : 0.85);
      y += dy * (soft ? 0.7 : 0.85);
      if (!soft) expandRoom(Math.max(room / HOME_SPACE, 1.2));
      clamp();
      apply();
    },
  };
}
