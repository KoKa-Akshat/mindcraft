/** Field Desk home · Intel · Connect · Binder cover · ACT Book */

import { buildConnectQueue, isConnected, loadConnectState } from './connectLinks.js';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function binderToc(items) {
  const byCourse = new Map();
  for (const item of items || []) {
    const course = item.courseName || 'Unsorted';
    if (!byCourse.has(course)) byCourse.set(course, []);
    byCourse.get(course).push(item);
  }
  for (const list of byCourse.values()) {
    list.sort((a, b) => String(b.filedAt || b.date || '').localeCompare(String(a.filedAt || a.date || '')));
  }
  return [...byCourse.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function loadIntelExtras() {
  try {
    const raw = localStorage.getItem('deskOs.intelLines');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveIntelExtra(text) {
  const list = loadIntelExtras();
  list.unshift({ id: `note_${Date.now()}`, source: 'you', text });
  try {
    localStorage.setItem('deskOs.intelLines', JSON.stringify(list.slice(0, 12)));
  } catch { /* ignore */ }
}

/** Intel lines from connected platforms + local notes */
function buildIntel(state) {
  const lines = [];
  const connect = loadConnectState();
  if (isConnected('gmail', connect)) {
    for (const m of (state.mail || []).filter((x) => x.kind !== 'draft').slice(0, 3)) {
      lines.push({
        id: `mail_${m.id || m.subject}`,
        source: 'gmail',
        text: m.subject || 'Mail',
      });
    }
  }
  if (isConnected('gcal', connect)) {
    for (const e of (state.events || []).slice(0, 3)) {
      lines.push({
        id: `cal_${e.id || e.title}`,
        source: 'cal',
        text: e.title || 'Event',
      });
    }
  }
  if (isConnected('moodle', connect)) {
    for (const f of (state.items || []).slice(0, 2)) {
      lines.push({
        id: `file_${f.id || f.title}`,
        source: 'moodle',
        text: f.title || f.originalName || 'Course file',
      });
    }
  }
  for (const extra of loadIntelExtras()) {
    lines.push(extra);
  }
  if (!lines.length) {
    const note = (() => {
      try { return localStorage.getItem('deskOs.fieldbookNote') || ''; } catch { return ''; }
    })();
    if (note) lines.push({ id: 'seed', source: 'prep', text: note });
  }
  return lines.slice(0, 8);
}

/**
 * @param {{
 *   plane: HTMLElement,
 *   attachSheet?: (el: HTMLElement) => void,
 *   onAction?: (action: string, row?: object) => void,
 *   onConnectSync?: (info: { connected: string[], allLinked: boolean }) => void,
 *   getState: () => { events: any[], mail: any[], items: any[] },
 *   journal?: { enter: (el: HTMLElement, opts?: object) => void, wireSheet: (el: HTMLElement, opts?: object) => void },
 * }} opts
 */
/**
 * Six home pages in the landing viewport of a 3× pannable world.
 * Plane is 300% · one screen = 100/3 % of the plane (top-left).
 */
const VIEW = 100 / 3;
/** @param {number} n viewport % → plane % */
function hv(n) {
  return `${((Number(n) / 100) * VIEW).toFixed(3)}%`;
}

export const HOME_ART = {
  owl: { left: hv(2), top: hv(3) },
  connect: { left: hv(2), top: hv(16), width: hv(16), height: 'auto', z: '15' },
  intel: { left: hv(20), top: hv(8), width: hv(28), height: hv(42), z: '14' },
  binder: { left: hv(50), top: hv(8), width: hv(23), height: hv(30), z: '16' },
  actbook: { left: hv(75), top: hv(8), width: hv(23), height: hv(30), z: '17' },
  memo: { left: hv(50), top: hv(42), width: hv(23), height: hv(24), z: '15' },
  calendar: { left: hv(75), top: hv(42), width: hv(23), height: hv(42), z: '18' },
  inbox: { left: hv(2), top: hv(58), width: hv(16), height: hv(26), z: '14' },
  search: { left: hv(20), top: hv(54), width: hv(28), height: hv(34), z: '19' },
  mail: { left: hv(20), top: hv(54), width: hv(28), height: hv(34), z: '19' },
};

const ART = HOME_ART;

function place(el, slot, { show = true, force = false } = {}) {
  if (!el || !slot) return;
  if (!force && el.dataset.userMoved === '1') {
    if (show) el.hidden = false;
    return;
  }
  el.style.left = slot.left;
  el.style.top = slot.top;
  if (slot.width) el.style.width = slot.width;
  if (slot.height != null) el.style.height = slot.height === 'auto' ? 'auto' : slot.height;
  if (slot.z) el.style.zIndex = slot.z;
  el.style.transform = 'none';
  el.classList.remove('is-min', 'desk-tilt-a', 'desk-tilt-b', 'desk-tilt-c', 'desk-tilt-d');
  if (show) el.hidden = false;
}

export function createHomeHub({ plane, attachSheet, onAction, onConnectSync, getState, journal }) {
  /** @type {HTMLElement | null} */
  let connectEl = null;
  /** @type {HTMLElement | null} */
  let intelEl = null;
  /** @type {HTMLElement | null} */
  let binderEl = null;
  /** @type {HTMLElement | null} */
  let actBookEl = null;
  /** @type {HTMLElement | null} */
  let inboxEl = null;

  function mountSheet(el) {
    plane.appendChild(el);
    attachSheet?.(el);
    return el;
  }

  function ensureConnect() {
    if (connectEl && plane.contains(connectEl)) return connectEl;
    const el = document.createElement('aside');
    el.className = 'paper-sheet home-sheet connect-sheet';
    el.dataset.sheet = 'tonight';
    place(el, ART.connect);
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule slim" aria-hidden="true"></div>
      <p class="page-kicker sheet-chrome">connect</p>
      <ol class="connect-nest" data-connect-list></ol>
      <p class="connect-done-soft" data-connect-done hidden>Linked</p>
    `;
    connectEl = mountSheet(el);
    return el;
  }

  function ensureIntel() {
    if (intelEl && plane.contains(intelEl)) return intelEl;
    const el = document.createElement('aside');
    el.className = 'paper-sheet home-sheet intel-sheet';
    el.dataset.sheet = 'intel';
    el.dataset.noClose = '1';
    place(el, ART.intel);
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule slim" aria-hidden="true"></div>
      <p class="page-kicker sheet-chrome">intel</p>
      <ol class="intel-lines" data-intel-list></ol>
      <input class="note-input intel-ph" data-intel-add type="text" maxlength="72" placeholder="…" autocomplete="off" />
    `;
    intelEl = mountSheet(el);
    el.querySelector('[data-intel-add]')?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const input = /** @type {HTMLInputElement} */ (e.target);
      const t = input.value.trim();
      if (!t) return;
      saveIntelExtra(t);
      input.value = '';
      onAction?.('intel:add', { text: t });
      refresh();
    });
    return el;
  }

  function ensureActBook() {
    if (actBookEl && plane.contains(actBookEl)) return actBookEl;
    const el = document.createElement('aside');
    el.className = 'paper-sheet home-sheet act-sheet book-cover-sheet sheet-stack-top';
    el.dataset.sheet = 'actbook';
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', 'Open ACT Fieldbook');
    place(el, ART.actbook);
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="book-spine-strip is-act sheet-chrome" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
      </div>
      <span class="book-tab is-act" aria-hidden="true">ACT</span>
      <div class="book-face">
        <p class="book-eyebrow">ACT · FIELDBOOK</p>
        <h2 class="sheet-paper-title">Fieldbook</h2>
        <svg class="book-doodle" viewBox="0 0 160 90" aria-hidden="true">
          <!-- Nepal scene · sun + Himalaya ridges -->
          <circle class="doodle-line" cx="118" cy="20" r="10" fill="none"/>
          <path class="doodle-line soft" d="M118 5 v4 M118 31 v4 M103 20 h4 M129 20 h4 M107 9 l3 3 M126 28 l3 3 M107 31 l3 -3 M126 9 l3 -3" fill="none"/>
          <!-- distant snow peaks -->
          <path class="doodle-line soft" d="M8 58 L 28 34 L 42 52 L 58 28 L 74 50 L 92 22 L 110 48 L 128 30 L 146 54 L 156 46" fill="none"/>
          <!-- mid ridge -->
          <path class="doodle-line" d="M0 66 L 18 50 L 34 62 L 52 42 L 70 60 L 88 38 L 108 58 L 124 44 L 142 62 L 160 54" fill="none"/>
          <!-- near foothills -->
          <path class="doodle-line" d="M0 78 C 22 70, 40 82, 58 74 C 78 66, 96 80, 118 72 C 136 66, 148 76, 160 70" fill="none"/>
          <path class="doodle-line soft" d="M0 84 C 36 78, 72 88, 110 80 C 132 76, 148 84, 160 80" fill="none"/>
          <!-- prayer-flag whisper + tiny stupa mark -->
          <path class="doodle-line soft" d="M22 48 L 22 62 M18 50 L 26 52 M18 54 L 26 56 M18 58 L 26 60" fill="none"/>
          <path class="doodle-line soft" d="M148 58 L 148 70 M145 70 h6 M148 58 l-3 4 h6 z" fill="none"/>
          <text class="doodle-math" x="6" y="16">himal</text>
        </svg>
      </div>
    `;
    const open = (e) => {
      if (e.target.closest('.sheet-win, .sheet-win-btn')) return;
      e.stopPropagation();
      onAction?.('act-book');
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onAction?.('act-book');
      }
    });
    actBookEl = mountSheet(el);
    return el;
  }

  function openBinderCover() {
    const el = ensureBinder();
    journal?.enter(el, { mode: 'book' });
    el.classList.add('is-open-book');
    el.querySelector('[data-binder-face]')?.classList.add('hidden');
    el.querySelector('[data-binder-toc]')?.classList.remove('hidden');
  }

  function closeBinderCover() {
    if (!binderEl) return;
    binderEl.classList.remove('is-open-book');
    binderEl.querySelector('[data-binder-face]')?.classList.remove('hidden');
    binderEl.querySelector('[data-binder-toc]')?.classList.add('hidden');
  }

  function ensureBinder() {
    if (binderEl && plane.contains(binderEl)) return binderEl;
    const el = document.createElement('aside');
    el.className = 'paper-sheet home-sheet binder-sheet book-cover-sheet sheet-stack-mid';
    el.dataset.sheet = 'binder';
    place(el, ART.binder);
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="book-spine-strip is-repo sheet-chrome" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
      </div>
      <span class="book-tab is-repo" aria-hidden="true">REPO</span>
      <div data-binder-face class="book-face">
        <p class="book-eyebrow">FIELD ARCHIVE</p>
        <h2 class="sheet-paper-title">Repository</h2>
        <p class="book-edition">reference edition</p>
      </div>
      <div class="binder-toc hidden" data-binder-toc></div>
    `;
    el.addEventListener('click', (e) => {
      if (el.classList.contains('is-open-book') || el.classList.contains('is-journal-open')) return;
      if (e.target.closest('.sheet-win, .sheet-win-btn')) return;
      e.stopPropagation();
      openBinderCover();
    });
    binderEl = mountSheet(el);
    journal?.wireSheet(el, {
      clickOpen: false,
      mode: 'book',
      except: 'input, textarea, button, a, .sheet-win',
      onExit: () => closeBinderCover(),
    });
    return el;
  }

  function ensureInbox() {
    if (inboxEl && plane.contains(inboxEl)) return inboxEl;
    const el = document.createElement('aside');
    el.className = 'paper-sheet home-sheet inbox-sheet';
    el.dataset.sheet = 'inbox';
    place(el, ART.inbox, { show: false });
    el.hidden = true;
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule slim" aria-hidden="true"></div>
      <p class="page-kicker sheet-chrome">inbox</p>
      <ul class="inbox-list" data-inbox-list></ul>
    `;
    inboxEl = mountSheet(el);
    return el;
  }

  /** Still-life zones · reseat on open; keep user drags after that */
  function composeArt({ reseat = false } = {}) {
    ensureConnect();
    ensureIntel();
    ensureBinder();
    ensureActBook();
    ensureInbox();
    if (reseat) {
      [connectEl, intelEl, binderEl, actBookEl, inboxEl].forEach((el) => {
        if (el) el.dataset.userMoved = '';
      });
      const memoReset = plane.querySelector('[data-sheet="notes"]');
      if (memoReset) memoReset.dataset.userMoved = '';
    }
    const force = reseat;
    place(connectEl, ART.connect, { force });
    place(intelEl, ART.intel, { force });
    place(binderEl, ART.binder, { force });
    place(actBookEl, ART.actbook, { force });
    [connectEl, intelEl, binderEl, actBookEl, inboxEl].forEach((el) => {
      el?.classList.remove(
        'sheet-stack-under', 'sheet-stack-base', 'sheet-stack-mid', 'sheet-stack-top',
        'desk-tilt-a', 'desk-tilt-b', 'desk-tilt-c', 'desk-tilt-d',
      );
      if (el) el.style.transform = 'none';
    });
    if (inboxEl) {
      if (!inboxEl.hidden) place(inboxEl, ART.inbox, { force });
      else place(inboxEl, ART.inbox, { show: false, force });
    }
    const memo = plane.querySelector('[data-sheet="notes"]');
    if (memo) {
      place(memo, ART.memo, { force });
      memo.classList.add('desk-art-memo');
      memo.classList.remove(
        'sheet-stack-mid', 'sheet-stack-under', 'sheet-stack-base', 'sheet-stack-top',
        'desk-tilt-a', 'desk-tilt-b', 'desk-tilt-c', 'desk-tilt-d',
      );
      memo.style.opacity = '';
      memo.style.transform = 'none';
    }
    const owl = plane.querySelector('.owl-logo');
    if (owl && (reseat || !owl.dataset.userMoved)) {
      owl.style.left = ART.owl.left;
      owl.style.top = ART.owl.top;
    }
    plane.querySelectorAll('.paper-sheet .sheet-win-btn[data-sheet-act="min"]').forEach((btn) => {
      btn.textContent = '−';
      btn.title = 'Minimize';
    });
  }

  function refresh() {
    const state = getState() || { events: [], mail: [], items: [] };
    ensureConnect();
    ensureIntel();
    ensureActBook();
    ensureBinder();
    ensureInbox();

    const queue = buildConnectQueue();
    const pending = queue.filter((row) => !row.connected);
    const allLinked = pending.length === 0 && queue.length > 0;
    const list = connectEl?.querySelector('[data-connect-list]');
    const done = connectEl?.querySelector('[data-connect-done]');
    if (list) {
      list.hidden = allLinked;
        list.innerHTML = pending.map((row) => `
        <li>
          <button type="button" class="connect-nest-row" data-action="${escapeHtml(row.action)}" data-id="${escapeHtml(row.id)}">
            ${escapeHtml(row.title.replace(/^Connect /, '').replace(/ · linked$/, ''))}
          </button>
        </li>
      `).join('');
      list.querySelectorAll('.connect-nest-row').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onAction?.(btn.dataset.action, { id: btn.dataset.id });
        });
      });
    }
    if (done) done.hidden = !allLinked;

    const intel = buildIntel(state);
    const intelList = intelEl?.querySelector('[data-intel-list]');
    if (intelList) {
      if (!intel.length) {
        intelList.innerHTML = `<li class="intel-empty">Connect tools. Intel lands here.</li>`;
      } else {
        intelList.innerHTML = intel.map((row, i) => `
          <li>
            <span class="intel-n">${i + 1}</span>
            <span class="intel-t">${escapeHtml(row.text)}</span>
            <span class="intel-src">${escapeHtml(row.source)}</span>
          </li>
        `).join('');
      }
    }

    const toc = binderToc(state.items);
    const binderFaceTitle = binderEl?.querySelector('[data-binder-face] .sheet-paper-title');
    if (binderFaceTitle) binderFaceTitle.textContent = 'Repository';
    const actTitle = actBookEl?.querySelector('.sheet-paper-title');
    if (actTitle) actTitle.textContent = 'Fieldbook';
    binderEl?.querySelector('[data-binder-count]')?.remove();
    actBookEl?.querySelector('.sheet-paper-soft')?.remove();
    const binderTocEl = binderEl?.querySelector('[data-binder-toc]');
    if (binderTocEl) {
      if (!toc.length) {
        binderTocEl.innerHTML = `<p class="binder-empty">Empty.</p>`;
      } else {
        let chapter = 0;
        binderTocEl.innerHTML = toc.map(([course, files]) => {
          chapter += 1;
          return `
            <section class="toc-chapter">
              <h3 class="toc-course"><span class="toc-ch">${chapter}</span> ${escapeHtml(course)}</h3>
              <ol class="toc-entries">
                ${files.map((f, i) => `
                  <li>
                    <span class="toc-num">${chapter}.${i + 1}</span>
                    <span class="toc-title">${escapeHtml(f.title || f.originalName || 'File')}</span>
                  </li>
                `).join('')}
              </ol>
            </section>
          `;
        }).join('');
      }
    }

    // Inbox only after Gmail
    const gmailOn = isConnected('gmail');
    if (inboxEl) {
      inboxEl.hidden = !gmailOn;
      const inboxList = inboxEl.querySelector('[data-inbox-list]');
      if (gmailOn && inboxList) {
        const mail = (state.mail || []).filter((m) => m.kind !== 'draft').slice(0, 5);
        inboxList.innerHTML = mail.length
          ? mail.map((m) => `
              <li>
                <span class="inbox-subj">${escapeHtml(m.subject || 'Mail')}</span>
                <span class="inbox-from">${escapeHtml(m.from || '')}</span>
              </li>
            `).join('')
          : `<li class="intel-empty">No mail yet</li>`;
      }
    }

    onConnectSync?.({
      connected: queue.filter((r) => r.connected).map((r) => r.id),
      allLinked,
    });
  }

  function focus(sheet) {
    const map = { tonight: connectEl, binder: binderEl, intel: intelEl };
    const el = map[sheet];
    if (!el) return;
    if (sheet === 'binder') {
      openBinderCover();
      return;
    }
    el.hidden = false;
    el.classList.remove('is-min');
    const minBtn = el.querySelector('[data-sheet-act="min"]');
    if (minBtn) {
      minBtn.textContent = '−';
      minBtn.title = 'Minimize';
    }
    el.style.zIndex = '28';
  }

  return {
    refresh,
    focus,
    composeArt,
    startFullPractice() { onAction?.('act-book'); },
    openActBook() { onAction?.('act-book'); },
    ensure() {
      composeArt();
      refresh();
    },
    getSheets() {
      return [connectEl, intelEl, binderEl, inboxEl].filter(Boolean);
    },
  };
}
