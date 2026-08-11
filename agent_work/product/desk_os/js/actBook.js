/** ACT Field Book · full-bleed MindCraft · starts at diagnosis */

export const LIVE_DIAGNOSTIC = 'https://mindcraft-93858.web.app/try/diagnostic';
export const LIVE_COVER = 'https://mindcraft-93858.web.app/try/dashboard';

/** Boot timing · diagram fade then pause before hub (ms) */
export const BOOT_DIAGRAM_DELAY_MS = 500;
export const BOOT_HUB_DELAY_MS = 1600;

/**
 * @param {{ hostname?: string } | string | null | undefined} host
 */
export function isLocalHost(host) {
  const h = typeof host === 'string'
    ? host
    : (host?.hostname ?? (typeof location !== 'undefined' ? location.hostname : ''));
  return /localhost|127\.0\.0\.1/.test(String(h || ''));
}

/** ACT package entry · diagnosis (not Contents dash) */
export function actDiagnosticUrl(host) {
  if (isLocalHost(host ?? (typeof location !== 'undefined' ? location : null))) {
    return 'http://localhost:5173/try/diagnostic';
  }
  return LIVE_DIAGNOSTIC;
}

/** Post-diagnosis cover / demo dashboard */
export function actCoverUrl(host) {
  if (isLocalHost(host ?? (typeof location !== 'undefined' ? location : null))) {
    return 'http://localhost:5173/try/dashboard';
  }
  return LIVE_COVER;
}

/** Default ACT open URL · diagnosis first */
export function actAppUrl(host) {
  return actDiagnosticUrl(host);
}

/**
 * Probe whether a URL is reachable (local Vite may be down).
 * @param {string} url
 * @param {number} [timeoutMs]
 */
export async function probeUrl(url, timeoutMs = 1200) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = globalThis.setTimeout(() => ctrl?.abort(), timeoutMs);
  try {
    if (typeof fetch !== 'function') return false;
    const res = await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl?.signal,
    });
    // no-cors → opaque 0; reaching the host still means Vite is up
    return res.type === 'opaque' || res.ok || res.status === 0;
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(t);
  }
}

/**
 * Pick iframe src · prefer local diagnostic, fall back to live.
 * @param {{ preferLocal?: boolean, customSrc?: string | null }} [opts]
 */
export async function resolveActSrc(opts = {}) {
  if (opts.customSrc) return { src: opts.customSrc, fallback: false };
  const local = actDiagnosticUrl();
  const live = LIVE_DIAGNOSTIC;
  if (!isLocalHost()) return { src: live, fallback: false };
  const ok = await probeUrl(local);
  if (ok) return { src: local, fallback: false };
  return { src: live, fallback: true };
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

  function setStatus(el, msg, kind = 'loading') {
    const status = el.querySelector('[data-act-status]');
    if (!status) return;
    status.hidden = !msg;
    status.dataset.kind = kind;
    status.textContent = msg || '';
  }

  function ensureBleed() {
    if (bleed && bleed.isConnected) return bleed;
    const host = canvasHost();
    bleed = document.createElement('div');
    bleed.className = 'act-bleed';
    bleed.dataset.sheet = 'act-instance';
    bleed.hidden = true;
    bleed.innerHTML = `
      <div class="act-bleed-status" data-act-status hidden></div>
      <iframe
        class="act-bleed-frame"
        title="MindCraft ACT · diagnosis"
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

  function loadFrame(src, meta = {}) {
    const el = ensureBleed();
    const frame = /** @type {HTMLIFrameElement | null} */ (el.querySelector('.act-bleed-frame'));
    if (!frame) return;
    const next = src || actAppUrl();
    if (frame.dataset.srcKey === next && frame.dataset.loaded === '1') {
      setStatus(el, '');
      return;
    }
    setStatus(
      el,
      meta.fallback
        ? 'Local Vite not running · opening live diagnostic…'
        : 'Opening ACT diagnosis…',
      meta.fallback ? 'fallback' : 'loading',
    );
    frame.onload = () => setStatus(el, '');
    frame.onerror = () => setStatus(
      el,
      'Could not load ACT. Start Vite on :5173 or check the network.',
      'error',
    );
    frame.src = next;
    frame.dataset.srcKey = next;
    frame.dataset.loaded = '1';
    // Cross-origin load often won't fire error · clear spinner after a beat
    window.setTimeout(() => {
      if (el.querySelector('[data-act-status]')?.dataset.kind === 'loading') {
        setStatus(el, '');
      }
    }, 4000);
  }

  /** Full-bleed · diagnosis first · fills canvas beside the shared rail */
  function open(src) {
    const el = ensureBleed();
    el.hidden = false;
    shell.classList.add('is-act-bleed');
    shell.classList.remove('is-act-locked');
    if (src) {
      loadFrame(src);
      return el;
    }
    setStatus(el, 'Opening ACT diagnosis…', 'loading');
    void resolveActSrc().then(({ src: resolved, fallback }) => {
      loadFrame(resolved, { fallback });
    });
    return el;
  }

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
    diagnosticUrl: actDiagnosticUrl,
    coverUrl: actCoverUrl,
  };
}
