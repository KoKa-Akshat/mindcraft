/** Paper sheets · edge-hover resize (no ‹ ›) · drag · minimize · close */

const EDGE = 10;
const MIN = { w: 200, h: 120 };

/** Keep left/top/size as % of the plane so window expand does not strand sheets */
export function sheetToPercent(el) {
  if (!el?.classList?.contains('paper-sheet')) return;
  const parent = el.offsetParent || el.parentElement;
  if (!parent) return;
  const pw = parent.clientWidth || 1;
  const ph = parent.clientHeight || 1;
  const left = el.style.left;
  const top = el.style.top;
  if (left && left.endsWith('px')) {
    el.style.left = `${((parseFloat(left) || 0) / pw) * 100}%`;
  }
  if (top && top.endsWith('px')) {
    el.style.top = `${((parseFloat(top) || 0) / ph) * 100}%`;
  }
  const w = el.style.width;
  if (w && w.endsWith('px')) {
    el.style.width = `${Math.max(8, ((parseFloat(w) || 0) / pw) * 100)}%`;
  }
  const h = el.style.height;
  if (h && h !== 'auto' && h.endsWith('px') && !el.classList.contains('is-min')) {
    el.style.height = `${Math.max(8, ((parseFloat(h) || 0) / ph) * 100)}%`;
  }
}

function clampSize(w, h) {
  return {
    w: Math.max(MIN.w, Math.min(window.innerWidth - 16, w)),
    h: Math.max(MIN.h, Math.min(window.innerHeight - 16, h)),
  };
}

function edgeAt(el, clientX, clientY) {
  if (el.classList.contains('is-min')) return '';
  const r = el.getBoundingClientRect();
  const nearL = clientX - r.left <= EDGE;
  const nearR = r.right - clientX <= EDGE;
  const nearT = clientY - r.top <= EDGE;
  const nearB = r.bottom - clientY <= EDGE;
  if (nearT && nearL) return 'nw';
  if (nearT && nearR) return 'ne';
  if (nearB && nearL) return 'sw';
  if (nearB && nearR) return 'se';
  if (nearL) return 'w';
  if (nearR) return 'e';
  if (nearT) return 'n';
  if (nearB) return 's';
  return '';
}

function cursorFor(edge) {
  return ({
    n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
    nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
  })[edge] || '';
}

function runResize(el, start) {
  el.dataset.resizing = '1';
  el.classList.add('resizing');
  document.body.classList.add('is-resizing');
  document.body.style.cursor = cursorFor(start.edge);

  const r = el.getBoundingClientRect();
  const origin = {
    edge: start.edge,
    x: start.clientX,
    y: start.clientY,
    left: r.left,
    top: r.top,
    w: r.width,
    h: r.height,
  };

  if (el.classList.contains('paper-sheet')) {
    const parent = el.offsetParent || el.parentElement;
    const pr = parent.getBoundingClientRect();
    origin.left = r.left - pr.left;
    origin.top = r.top - pr.top;
    el.style.left = `${origin.left}px`;
    el.style.top = `${origin.top}px`;
  } else {
    el.style.left = `${r.left}px`;
    el.style.top = `${r.top}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.transform = 'none';
  }
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
  el.style.maxHeight = 'none';

  const onMove = (ev) => {
    const dx = ev.clientX - origin.x;
    const dy = ev.clientY - origin.y;
    let left = origin.left;
    let top = origin.top;
    let w = origin.w;
    let h = origin.h;
    const ed = origin.edge;
    if (ed.includes('e')) w = origin.w + dx;
    if (ed.includes('s')) h = origin.h + dy;
    if (ed.includes('w')) {
      w = origin.w - dx;
      left = origin.left + dx;
    }
    if (ed.includes('n')) {
      h = origin.h - dy;
      top = origin.top + dy;
    }
    const size = clampSize(w, h);
    if (ed.includes('w') && size.w !== w) left = origin.left + (origin.w - size.w);
    if (ed.includes('n') && size.h !== h) top = origin.top + (origin.h - size.h);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${size.w}px`;
    el.style.height = `${size.h}px`;
  };

  const onUp = () => {
    el.dataset.resizing = '0';
    el.classList.remove('resizing');
    document.body.classList.remove('is-resizing');
    document.body.style.cursor = '';
    el.style.cursor = '';
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    sheetToPercent(el);
    el.dispatchEvent(new CustomEvent('sheet:resized', { bubbles: true }));
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function runDrag(el, e) {
  el.dataset.dragging = '1';
  el.classList.add('dragging');
  document.body.classList.add('is-dragging');

  const r = el.getBoundingClientRect();
  const isSheet = el.classList.contains('paper-sheet');
  let baseLeft;
  let baseTop;

  if (isSheet) {
    const parent = el.offsetParent || el.parentElement;
    const pr = parent.getBoundingClientRect();
    baseLeft = r.left - pr.left;
    baseTop = r.top - pr.top;
    el.style.left = `${baseLeft}px`;
    el.style.top = `${baseTop}px`;
    el.style.transform = 'none';
  } else {
    baseLeft = r.left;
    baseTop = r.top;
    el.style.left = `${baseLeft}px`;
    el.style.top = `${baseTop}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.transform = 'none';
  }

  const sx = e.clientX;
  const sy = e.clientY;

  const onMove = (ev) => {
    el.style.left = `${baseLeft + (ev.clientX - sx)}px`;
    el.style.top = `${baseTop + (ev.clientY - sy)}px`;
    el.dispatchEvent(new CustomEvent('sheet:moved', { bubbles: true }));
  };

  const onUp = () => {
    el.dataset.dragging = '0';
    el.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    sheetToPercent(el);
    el.dispatchEvent(new CustomEvent('sheet:moved', { bubbles: true }));
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

export function ensureSheetChrome(el) {
  if (el.querySelector('.sheet-win')) return;
  const title = el.querySelector('.page-kicker, .float-title')?.textContent?.trim() || 'page';
  const noClose = el.dataset.noClose === '1';
  const bar = document.createElement('div');
  bar.className = 'sheet-win';
  bar.innerHTML = `
    <button type="button" class="sheet-win-btn" data-sheet-act="min" title="Minimize" aria-label="Minimize">−</button>
    ${noClose ? '' : '<button type="button" class="sheet-win-btn" data-sheet-act="close" title="Close" aria-label="Close">×</button>'}
  `;
  el.appendChild(bar);
  // Transcript (or others) may inject .live-dot before − via placeLiveDot
  if (!el.dataset.title) el.dataset.title = title;

  const minBtn = bar.querySelector('[data-sheet-act="min"]');
  minBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const min = el.classList.toggle('is-min');
    if (minBtn) {
      minBtn.textContent = min ? '+' : '−';
      minBtn.title = min ? 'Expand' : 'Minimize';
      minBtn.setAttribute('aria-label', min ? 'Expand' : 'Minimize');
    }
    if (min) {
      el.dataset.prevH = el.style.height || '';
      el.dataset.prevW = el.style.width || '';
      el.style.height = '36px';
    } else {
      el.style.height = el.dataset.prevH || '';
      el.style.width = el.dataset.prevW || el.style.width;
    }
  });
  bar.querySelector('[data-sheet-act="close"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (el.dataset.noClose === '1') return;
    el.hidden = true;
    el.dispatchEvent(new CustomEvent('sheet:closed', { bubbles: true }));
  });
}

/** Edge-hover resize · no visible ‹ › glyphs */
export function enableResizeHandles(el) {
  if (!el || el.dataset.resizeBound === '1') return;
  el.dataset.resizeBound = '1';

  // Remove legacy word-arrow grips if present
  el.querySelectorAll('.sheet-grip, .float-grip').forEach((g) => g.remove());
  el.querySelectorAll('.sheet-edge').forEach((g) => g.remove());

  el.addEventListener('pointermove', (e) => {
    if (el.dataset.resizing === '1' || el.hidden) return;
    if (e.target.closest('input, textarea, select, button, a, .sheet-win')) {
      el.style.cursor = '';
      el.dataset.edge = '';
      return;
    }
    const edge = edgeAt(el, e.clientX, e.clientY);
    el.dataset.edge = edge;
    el.style.cursor = edge ? cursorFor(edge) : '';
    el.classList.toggle('near-edge', Boolean(edge));
  });

  el.addEventListener('pointerleave', () => {
    if (el.dataset.resizing === '1') return;
    el.style.cursor = '';
    el.dataset.edge = '';
    el.classList.remove('near-edge');
  });

  el.addEventListener('pointerdown', (e) => {
    if (el.hidden || el.classList.contains('is-min')) return;
    if (e.target.closest('input, textarea, select, button, a, .sheet-win')) return;
    const edge = edgeAt(el, e.clientX, e.clientY);
    if (!edge) return;
    e.preventDefault();
    e.stopPropagation();
    runResize(el, { edge, clientX: e.clientX, clientY: e.clientY });
  });
}

export function enableSheetDrag(el, handleSelector = '.sheet-chrome, .page-kicker, .sheet-paper-title') {
  if (!el || el.dataset.dragBound === '1') return;
  el.dataset.dragBound = '1';

  el.addEventListener('pointerdown', (e) => {
    if (el.dataset.resizing === '1') return;
    if (e.target.closest('input, textarea, select, a, button, .sheet-win, .connect-nest-row, .mail-tab')) return;
    if (edgeAt(el, e.clientX, e.clientY)) return;
    const onHandle = e.target.closest(handleSelector);
    const onPaperPad = e.target === el
      || e.target.classList.contains('page-grain')
      || e.target.classList.contains('margin-rule');
    const cover = el.classList.contains('act-sheet')
      || el.classList.contains('binder-sheet')
      || el.classList.contains('desk-tool-sheet');
    if (!onHandle && !onPaperPad && !cover && !el.classList.contains('is-min')) return;
    if (!cover && !onHandle && !onPaperPad && e.target.closest('.intel-lines, .connect-nest, .note-lines, .binder-toc, .float-body')) return;
    e.preventDefault();
    e.stopPropagation();
    el.dataset.userMoved = '1';
    runDrag(el, e);
  });
}

export function wireFloatChrome(el, { onClose } = {}) {
  if (!el) return;
  // One chrome only: − / × · never also a wordy "close"
  el.querySelectorAll('[data-float="close"], .float-close').forEach((n) => n.remove());
  enableResizeHandles(el);
  ensureSheetChrome(el);

  el.addEventListener('pointerdown', (e) => {
    if (el.dataset.resizing === '1') return;
    if (e.target.closest('button, input, select, textarea, a, .float-body, .sheet-win')) return;
    if (edgeAt(el, e.clientX, e.clientY)) return;
    if (!e.target.closest('.float-chrome')) return;
    e.stopPropagation();
    runDrag(el, e);
  });

  el.addEventListener('sheet:closed', () => onClose?.());
}

export function createPaperDesk({ root, persistKey = 'deskOs.sheets' }) {
  if (!root) return { wire() {}, attach() {}, save() {} };

  // Bump when default sheet sizes/positions change so old drag-saves don't stick
  const LAYOUT_VER = 'r6o';
  const VER_KEY = `${persistKey}.ver`;

  function load() {
    try {
      if (localStorage.getItem(VER_KEY) !== LAYOUT_VER) {
        localStorage.removeItem(persistKey);
        localStorage.setItem(VER_KEY, LAYOUT_VER);
      }
      return JSON.parse(localStorage.getItem(persistKey) || '{}');
    } catch {
      return {};
    }
  }

  function save() {
    const map = {};
    root.querySelectorAll('.paper-sheet[data-sheet]').forEach((el) => {
      if (el.hidden) return;
      map[el.dataset.sheet] = {
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        min: el.classList.contains('is-min'),
      };
    });
    try {
      localStorage.setItem(persistKey, JSON.stringify(map));
    } catch { /* ignore */ }
  }

  function attach(el) {
    if (!el) return;
    enableResizeHandles(el);
    enableSheetDrag(el, '.sheet-chrome, .page-kicker, .sheet-paper-title, .book-face, .book-spine-strip, .transcript-head, .upload-head');
    ensureSheetChrome(el);
    el.addEventListener('sheet:resized', save);
    el.addEventListener('sheet:moved', () => {
      el.dataset.userMoved = '1';
      save();
    });
    el.addEventListener('sheet:closed', save);
  }

  function wire() {
    const saved = load();
    root.querySelectorAll('.paper-sheet[data-sheet]').forEach((el) => {
      const s = saved[el.dataset.sheet];
      if (s?.left) {
        el.style.left = s.left;
        el.style.top = s.top;
        if (s.width) el.style.width = s.width;
        if (s.height && !s.min) el.style.height = s.height;
        if (s.min) el.classList.add('is-min');
      }
      attach(el);
    });
  }

  return { wire, save, attach };
}

export function enableDrag(el) { void el; }
export function enableResize(el) { enableResizeHandles(el); }
