/** ACT Field Book · full-bleed MindCraft dash in the canvas (right of shared rail) */

function isLocalHost() {
  return typeof location !== 'undefined' && /localhost|127\.0\.0\.1/.test(location.hostname);
}

/** Prefer local Vite app Claude is building · fall back to live try-dashboard */
export function actAppUrl() {
  if (isLocalHost()) {
    return 'http://localhost:5173/try/dashboard';
  }
  return 'https://mindcraft-93858.web.app/try/dashboard';
}

/**
 * @param {{
 *   shell: HTMLElement,
 *   plane?: HTMLElement | null,
 *   attachSheet?: (el: HTMLElement) => void,
 *   onClose?: () => void,
 * }} opts
 */
export function createActBookOverlay({ shell, onClose }) {
  /** @type {HTMLElement | null} */
  let bleed = null;

  function canvasHost() {
    return shell?.querySelector('.desk-canvas') || shell;
  }

  function ensureBleed() {
    if (bleed && bleed.isConnected) return bleed;
    const host = canvasHost();
    bleed = document.createElement('div');
    bleed.className = 'act-bleed';
    bleed.dataset.sheet = 'act-instance';
    bleed.hidden = true;
    bleed.innerHTML = `
      <iframe
        class="act-bleed-frame"
        title="MindCraft ACT dashboard"
        src="about:blank"
        allow="clipboard-read; clipboard-write"
      ></iframe>
      <button type="button" class="act-bleed-min" data-act-bleed-min title="Back" aria-label="Close ACT">−</button>
    `;
    host.appendChild(bleed);
    bleed.querySelector('[data-act-bleed-min]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });
    return bleed;
  }

  function loadFrame(src) {
    const el = ensureBleed();
    const frame = /** @type {HTMLIFrameElement | null} */ (el.querySelector('.act-bleed-frame'));
    if (!frame) return;
    const next = src || actAppUrl();
    if (frame.dataset.srcKey === next && frame.dataset.loaded === '1') return;
    frame.src = next;
    frame.dataset.srcKey = next;
    frame.dataset.loaded = '1';
  }

  /** Full-bleed dash · no paper box, no padding · fills canvas beside the rail */
  function open(src) {
    const el = ensureBleed();
    el.hidden = false;
    shell.classList.add('is-act-bleed');
    shell.classList.remove('is-act-locked');
    loadFrame(src);
    return el;
  }

  /** Same full-bleed surface · kept for callers that used the old plane panel */
  function openOnPlane(opts = {}) {
    return open(opts.src);
  }

  function closePlane() {
    if (!bleed) return;
    bleed.hidden = true;
    shell.classList.remove('is-act-bleed');
  }

  function closeOverlay() {
    closePlane();
  }

  function close() {
    closePlane();
    onClose?.();
  }

  return {
    open,
    openOnPlane,
    close,
    closeOverlay,
    closePlane,
    isOpen: () => Boolean(bleed && !bleed.hidden),
    appUrl: actAppUrl,
  };
}
