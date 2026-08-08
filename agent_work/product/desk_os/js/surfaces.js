/** Desk tool sheets · mail / calendar / device search live ON the plane */

import { wireFloatChrome, enableResizeHandles, enableSheetDrag, ensureSheetChrome } from './float.js';

import { HOME_ART } from './home.js';

/** On-canvas slots · landing viewport of the 3× world */
const OFFSETS = {
  google: HOME_ART.search,
  mail: HOME_ART.mail,
  calendar: HOME_ART.calendar,
};

function flashFocus(el) {
  if (!el) return;
  document.querySelectorAll('.paper-sheet.is-tool-focus').forEach((n) => {
    n.classList.remove('is-tool-focus');
  });
  el.classList.add('is-tool-focus');
  window.setTimeout(() => el.classList.remove('is-tool-focus'), 1600);
}

const TAGS = [
  { id: 'repository', label: 'Repository' },
  { id: 'act-fieldbook', label: 'act-fieldbook' },
  { id: 'intel', label: 'Intel' },
  { id: 'memo', label: 'Memo' },
];

const DEMO_DOCS = [
  { name: 'Quadratics_before_April.pdf', size: 482113, kind: 'pdf' },
  { name: 'ACT_math_practice_set.docx', size: 210444, kind: 'doc' },
  { name: 'Unit_5_notes.md', size: 18420, kind: 'note' },
  { name: 'Gmail_export_syllabus.pdf', size: 90122, kind: 'pdf' },
  { name: 'calc_hw_scan.png', size: 1200440, kind: 'image' },
];

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function scoreDoc(name, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return 0.55;
  const n = String(name || '').toLowerCase();
  if (n.includes(q)) return 0.95;
  const parts = q.split(/\s+/).filter(Boolean);
  const hits = parts.filter((p) => n.includes(p)).length;
  if (!hits) return 0.2;
  return Math.min(0.9, 0.35 + hits / parts.length * 0.55);
}

export function createSurfaces({
  appShell,
  brandLogo,
  showToast,
  onDropFile,
  onTagScanFile,
  getEvents,
  daysUntil,
  formatDisplayDate,
  plane,
  attachSheet,
  onOpenSheet,
}) {
  void brandLogo;
  const panes = {
    google: document.getElementById('surfaceGoogle'),
    mail: document.getElementById('surfaceMail'),
    calendar: document.getElementById('surfaceCalendar'),
  };

  let z = 28;
  const desk = plane || document.getElementById('deskPlane');
  /** @type {{ id: string, name: string, size: number, file?: File, score: number, tag: string }[]} */
  let scanRows = [];

  function setBrand(_key) {
    // Wordmark lives in chrome now
  }

  function syncBrand() {
    if (!panes.google?.hidden) setBrand('google');
    else setBrand('mindcraft');
  }

  /** Move fixed float into the desk plane as a new page. Never replaces existing sheets. */
  function mountOnDesk(pane, name) {
    if (!pane || !desk) return;
    if (pane.parentElement !== desk) {
      desk.appendChild(pane);
    }
    pane.classList.add('desk-tool-sheet', 'paper-sheet');
    pane.classList.remove('float-card');
    pane.dataset.sheet = name;
    if (!pane.querySelector('.page-grain')) {
      const g = document.createElement('div');
      g.className = 'page-grain';
      g.setAttribute('aria-hidden', 'true');
      pane.prepend(g);
    }
    if (!pane.querySelector('.margin-rule')) {
      const m = document.createElement('div');
      m.className = 'margin-rule slim';
      m.setAttribute('aria-hidden', 'true');
      pane.prepend(m);
    }
    const title = pane.querySelector('.float-title');
    if (title && !pane.querySelector('.page-kicker')) {
      const k = document.createElement('p');
      k.className = 'page-kicker sheet-chrome';
      k.textContent = title.textContent?.trim().toLowerCase() || name;
      pane.querySelector('.float-chrome')?.before(k);
    }
    const chrome = pane.querySelector('.float-chrome');
    if (chrome) chrome.classList.add('desk-tool-chrome');
    ensureSheetChrome(pane);
    enableResizeHandles(pane);
    enableSheetDrag(pane, '.sheet-chrome, .page-kicker, .float-chrome, .desk-tool-chrome');
    attachSheet?.(pane);
  }

  function place(el, name, { force = false } = {}) {
    if (!force && el.dataset.userMoved === '1' && el.style.left) return;
    const o = OFFSETS[name] || OFFSETS.mail;
    el.style.left = o.left;
    el.style.top = o.top;
    el.style.width = o.width;
    if (o.height) el.style.height = o.height;
    el.style.transform = 'none';
  }

  /** Seat a tool as a home page (calendar) without treating it as a popup */
  function seat(name, slot, { force = false } = {}) {
    const pane = panes[name];
    if (!pane) return null;
    mountOnDesk(pane, name);
    pane.dataset.homeSheet = '1';
    pane.hidden = false;
    pane.classList.remove('is-min', 'page-away');
    pane.dataset.minimized = 'false';
    if (slot) {
      if (force || pane.dataset.userMoved !== '1') {
        pane.style.left = slot.left;
        pane.style.top = slot.top;
        if (slot.width) pane.style.width = slot.width;
        if (slot.height) pane.style.height = slot.height;
        pane.style.transform = 'none';
        if (slot.z) pane.style.zIndex = String(slot.z);
      }
    } else {
      place(pane, name, { force });
    }
    if (name === 'calendar') renderCalendar();
    return pane;
  }

  function open(name) {
    if (name === 'spotify' || name === 'drop') return null;
    const pane = panes[name];
    if (!pane) return null;
    mountOnDesk(pane, name);
    pane.hidden = false;
    pane.classList.remove('is-min', 'page-away');
    pane.dataset.minimized = 'false';
    // Re-open home tools at their on-page slot · don't dump them below the fold
    place(pane, name, { force: pane.dataset.userMoved !== '1' });
    z += 1;
    pane.style.zIndex = String(z);
    appShell.dataset.mode = 'desk';
    appShell.dataset.surface = 'desk';

    if (name === 'calendar') renderCalendar();
    if (name === 'google') {
      const hint = document.getElementById('googleHint');
      if (hint) {
        hint.textContent = 'Scan this device for docs relevant to this instance, then tag what to keep.';
      }
      if (!scanRows.length) renderScanSeed();
    }
    syncBrand();
    flashFocus(pane);
    onOpenSheet?.(pane, name);
    return pane;
  }

  function closeAll() {
    Object.values(panes).forEach((p) => {
      if (!p) return;
      // Keep home-seated calendar on the desk grid
      if (p.dataset.homeSheet === '1' && p.dataset.sheet === 'calendar') return;
      p.hidden = true;
      p.classList.remove('is-min');
      p.dataset.minimized = 'false';
    });
    appShell.dataset.surface = 'desk';
    appShell.dataset.mode = 'desk';
    setBrand('mindcraft');
  }

  function closeToDesk() {
    closeAll();
  }

  function hideAll() {
    closeAll();
  }

  function renderCalendar() {
    const root = document.getElementById('calWeek');
    if (!root) return;
    const events = (getEvents?.() || [])
      .filter((e) => daysUntil(e.date) >= -1 && daysUntil(e.date) <= 7)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!events.length) {
      root.innerHTML = `<p class="soft-line">No dues this week. Load a sample week.</p>`;
      return;
    }
    root.innerHTML = events.map((e) => `
      <div class="cal-day">
        <div class="d">${formatDisplayDate(e.date)}</div>
        <div class="ev"><b>${e.title}</b><br/>${e.courseName || ''}</div>
      </div>
    `).join('');
  }

  function tagOptions(selected) {
    return TAGS.map((t) => `
      <option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${t.label}</option>
    `).join('');
  }

  function guessTag(name, query) {
    const s = `${name} ${query}`.toLowerCase();
    if (/act|field.?book|quadratic|prep/.test(s)) return 'act-fieldbook';
    if (/memo|note|scratch/.test(s)) return 'memo';
    if (/intel|due|syllabus|gmail/.test(s)) return 'intel';
    return 'repository';
  }

  function renderScanResults() {
    const box = document.getElementById('googleResults');
    const hint = document.getElementById('googleHint');
    if (!box) return;
    if (!scanRows.length) {
      box.hidden = false;
      box.innerHTML = `<p class="scan-empty">No files yet. Scan this device to find docs for this instance.</p>`;
      return;
    }
    box.hidden = false;
    if (hint) {
      hint.textContent = `${scanRows.length} file${scanRows.length === 1 ? '' : 's'} · tag and add to this instance`;
    }
    box.innerHTML = scanRows.map((row) => `
      <div class="scan-row" data-scan-id="${row.id}">
        <div class="scan-meta">
          <span class="scan-name">${escapeHtml(row.name)}</span>
          <span class="scan-sub">${fmtSize(row.size)} · ${Math.round(row.score * 100)}% match</span>
        </div>
        <label class="scan-tag">
          <span class="sr-only">Tag</span>
          <select data-scan-tag="${row.id}">${tagOptions(row.tag)}</select>
        </label>
        <button type="button" class="btn lime scan-add" data-scan-add="${row.id}">Add</button>
      </div>
    `).join('');
  }

  function renderScanSeed() {
    const q = document.getElementById('googleQuery')?.value || '';
    scanRows = DEMO_DOCS.map((d, i) => ({
      id: `demo_${i}`,
      name: d.name,
      size: d.size,
      score: scoreDoc(d.name, q),
      tag: guessTag(d.name, q),
      demo: true,
    })).filter((r) => r.score >= 0.3)
      .sort((a, b) => b.score - a.score);
    renderScanResults();
  }

  function ingestPickedFiles(fileList, query) {
    const files = [...(fileList || [])];
    if (!files.length) {
      renderScanSeed();
      showToast?.('Showing likely matches · pick files to scan this device');
      return;
    }
    scanRows = files.map((f, i) => ({
      id: `file_${Date.now()}_${i}`,
      name: f.name,
      size: f.size || 0,
      file: f,
      score: scoreDoc(f.name, query),
      tag: guessTag(f.name, query),
    })).sort((a, b) => b.score - a.score);
    renderScanResults();
    showToast?.(`Scanned ${files.length} file${files.length === 1 ? '' : 's'} from this device`);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function wire() {
    Object.entries(panes).forEach(([, pane]) => {
      if (!pane) return;
      wireFloatChrome(pane, { onClose: syncBrand });
      pane.addEventListener('pointerdown', () => {
        z += 1;
        pane.style.zIndex = String(z);
      });
    });

    const scanInput = document.getElementById('deviceScanInput');
    const form = document.getElementById('googleSearchForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('googleQuery')?.value || '';
      // Open the real device picker · keywords rank results
      if (scanInput) {
        scanInput.value = '';
        scanInput.dataset.query = q;
        scanInput.click();
      } else {
        renderScanSeed();
      }
    });

    document.getElementById('deviceScanBrowse')?.addEventListener('click', () => {
      const q = document.getElementById('googleQuery')?.value || '';
      if (!scanInput) return;
      scanInput.value = '';
      scanInput.dataset.query = q;
      scanInput.click();
    });

    scanInput?.addEventListener('change', () => {
      const q = scanInput.dataset.query || document.getElementById('googleQuery')?.value || '';
      ingestPickedFiles(scanInput.files, q);
    });

    document.getElementById('googleResults')?.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-scan-tag]');
      if (!sel) return;
      const id = sel.getAttribute('data-scan-tag');
      const row = scanRows.find((r) => r.id === id);
      if (row) row.tag = sel.value;
    });

    document.getElementById('googleResults')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-scan-add]');
      if (!btn) return;
      const id = btn.getAttribute('data-scan-add');
      const row = scanRows.find((r) => r.id === id);
      if (!row) return;
      const tagSel = document.querySelector(`[data-scan-tag="${id}"]`);
      const tag = tagSel?.value || row.tag;
      onTagScanFile?.({
        name: row.name,
        file: row.file || null,
        tag,
        demo: Boolean(row.demo || !row.file),
      });
      btn.textContent = 'Added';
      btn.disabled = true;
    });

    const shell = appShell || document.body;
    ['dragenter', 'dragover'].forEach((ev) => {
      shell.addEventListener(ev, (e) => {
        if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
      });
    });
    shell.addEventListener('drop', (e) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) onDropFile?.(f);
    });
  }

  return {
    open,
    seat,
    closeToDesk,
    setBrand,
    hideAll,
    renderCalendar,
    flashFocus,
    getPane: (name) => panes[name],
    wire,
  };
}
