/** Add tray (paper sheet like connect) + addable desk pages */

import { enableResizeHandles, enableSheetDrag, ensureSheetChrome } from './float.js';

let seq = 0;

const CRUISE_TAGS = [
  { id: 'key', label: 'Key' },
  { id: 'repository', label: 'Repo' },
  { id: 'act-fieldbook', label: 'ACT' },
  { id: 'intel', label: 'Intel' },
  { id: 'memo', label: 'Memo' },
];

/** Demo lecture that cruises into Class Notes */
const CRUISE_PASSAGE = [
  { who: 'Teacher', text: 'Phones away. Warm-up is stoichiometry.' },
  { who: 'Teacher', text: 'If you burn 2.5 moles of propane, how many moles of CO₂ come out?' },
  { who: 'Maya', text: 'Mole ratio from the balanced equation?' },
  { who: 'Teacher', text: 'Yes. C₃H₈ + 5 O₂ → 3 CO₂ + 4 H₂O.' },
  { who: 'Maya', text: 'So 1 propane to 3 CO₂… that is 7.5 moles.' },
  { who: 'Teacher', text: 'Exactly. Tag that ratio. Homework: limiting reactant set, due Friday.' },
  { who: 'Teacher', text: 'Next: where this shows up on ACT science passages.' },
];

function slotFor(index) {
  const cols = [
    { left: '38%', top: '40%', width: '30%', height: '42%' },
    { left: '56%', top: '16%', width: '28%', height: '44%' },
    { left: '26%', top: '48%', width: '28%', height: '40%' },
  ];
  return cols[index % cols.length];
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mount(plane, attachSheet, el, slot) {
  plane.appendChild(el);
  el.style.left = slot.left;
  el.style.top = slot.top;
  el.style.width = slot.width;
  if (slot.height) el.style.height = slot.height;
  el.style.transform = 'none';
  el.style.zIndex = String(30 + seq);
  ensureSheetChrome(el);
  enableResizeHandles(el);
  enableSheetDrag(el, '.sheet-chrome, .page-kicker, .doc-title, .doc-head, .widget-head');
  attachSheet?.(el);
  return el;
}

export function createWidgetFactory({ plane, attachSheet, showToast, onFocus, onCruiseTag }) {
  /** @type {HTMLElement | null} */
  let addTray = null;

  function wireCruise(el) {
    const cruiseBtn = el.querySelector('[data-doc-cruise]');
    const status = el.querySelector('[data-cruise-status]');
    const lane = el.querySelector('[data-cruise-lane]');
    const stream = el.querySelector('[data-cruise-stream]');
    if (!cruiseBtn || !lane || !stream) return;

    let timer = null;
    let idx = 0;
    let cruising = false;
    /** @type {Map<string, string>} */
    const tags = new Map();

    function setCruising(on) {
      cruising = on;
      el.classList.toggle('is-cruising', on);
      cruiseBtn.classList.toggle('is-live', on);
      cruiseBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      cruiseBtn.innerHTML = on
        ? '<span class="doc-cruise-pulse" aria-hidden="true"></span> Stop'
        : 'Transcribe';
      if (status) {
        status.hidden = !on;
        status.textContent = on ? 'Cruising…' : '';
      }
      lane.hidden = false;
      if (on) {
        // Give the page room to breathe while the passage rolls
        const h = parseFloat(el.style.height) || 0;
        if (h && h < 48) el.style.height = '52%';
        else if (!el.style.height) el.style.height = '52%';
      }
    }

    function stopCruise() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      setCruising(false);
      if (status) {
        status.hidden = false;
        status.textContent = tags.size ? `${tags.size} tagged` : 'Cruise paused';
      }
    }

    function paintChips(card, lineId) {
      const bar = card.querySelector('[data-tag-bar]');
      if (!bar) return;
      const current = tags.get(lineId) || '';
      bar.innerHTML = CRUISE_TAGS.map((t) => `
        <button type="button" class="cruise-chip ${current === t.id ? 'is-on' : ''}" data-tag="${t.id}" data-line="${lineId}">
          ${escapeHtml(t.label)}
        </button>
      `).join('');
      bar.querySelectorAll('[data-tag]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tag = btn.getAttribute('data-tag') || '';
          const id = btn.getAttribute('data-line') || '';
          const prev = tags.get(id);
          if (prev === tag) tags.delete(id);
          else tags.set(id, tag);
          card.dataset.tag = tags.get(id) || '';
          card.classList.toggle('is-tagged', Boolean(tags.get(id)));
          paintChips(card, id);
          const text = card.querySelector('.cruise-text')?.textContent || '';
          const who = card.querySelector('.cruise-who')?.textContent || '';
          onCruiseTag?.({
            tag: tags.get(id) || null,
            text,
            who,
            sheetId: el.dataset.sheet,
          });
          if (tags.get(id)) {
            showToast?.(`Tagged · ${CRUISE_TAGS.find((x) => x.id === tags.get(id))?.label || tag}`);
          }
        });
      });
    }

    function pushLine(row) {
      const lineId = `L${idx}_${Date.now().toString(36)}`;
      const card = document.createElement('article');
      card.className = 'cruise-card is-enter';
      card.dataset.lineId = lineId;
      card.innerHTML = `
        <div class="cruise-card-main">
          <span class="cruise-who">${escapeHtml(row.who)}</span>
          <p class="cruise-text">${escapeHtml(row.text)}</p>
        </div>
        <div class="cruise-tag-bar" data-tag-bar></div>
      `;
      stream.appendChild(card);
      paintChips(card, lineId);
      requestAnimationFrame(() => card.classList.add('is-in'));
      stream.scrollTop = stream.scrollHeight;

      // Soft-append into the editable notes too
      const body = el.querySelector('.doc-body');
      if (body) {
        const bit = document.createElement('p');
        bit.className = 'doc-cruise-echo';
        bit.textContent = `${row.who}: ${row.text}`;
        body.appendChild(bit);
        body.scrollTop = body.scrollHeight;
      }
    }

    function startCruise() {
      if (cruising) {
        stopCruise();
        return;
      }
      idx = 0;
      stream.innerHTML = '';
      tags.clear();
      setCruising(true);
      showToast?.('Transcribe · cruising on this page');
      onFocus?.(el);

      // First line immediately, then cruise
      pushLine(CRUISE_PASSAGE[0]);
      idx = 1;
      timer = window.setInterval(() => {
        if (idx >= CRUISE_PASSAGE.length) {
          stopCruise();
          if (status) {
            status.hidden = false;
            status.textContent = 'Passage complete · tag what matters';
          }
          showToast?.('Cruise done · tag lines you want to keep');
          return;
        }
        pushLine(CRUISE_PASSAGE[idx]);
        idx += 1;
      }, 1600);
    }

    cruiseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startCruise();
    });
  }

  function addTextBox() {
    if (!plane) return null;
    seq += 1;
    const id = `doc_${seq}`;
    const el = document.createElement('aside');
    el.className = 'paper-sheet desk-widget doc-sheet';
    el.dataset.sheet = id;
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule slim" aria-hidden="true"></div>
      <p class="page-kicker sheet-chrome">notes</p>
      <div class="doc-head sheet-chrome">
        <input class="doc-title" type="text" value="Class notes" maxlength="64" autocomplete="off" />
        <div class="doc-tools">
          <button type="button" class="doc-cruise-btn" data-doc-cruise aria-pressed="false">Transcribe</button>
          <span class="doc-cruise-status" data-cruise-status hidden></span>
        </div>
      </div>
      <div class="doc-body" contenteditable="true" role="textbox" aria-label="Class notes" data-placeholder="Start typing… or hit Transcribe to cruise"></div>
      <div class="doc-cruise-lane" data-cruise-lane hidden>
        <p class="doc-cruise-kicker">live passage · tag as it rolls</p>
        <div class="doc-cruise-stream" data-cruise-stream></div>
      </div>
    `;
    mount(plane, attachSheet, el, slotFor(seq));
    wireCruise(el);
    const body = el.querySelector('.doc-body');
    requestAnimationFrame(() => body?.focus());
    showToast?.('Class notes · Transcribe to cruise');
    onFocus?.(el);
    return el;
  }

  const APP_PANELS = {
    spotify: {
      title: 'spotify',
      url: 'https://open.spotify.com/',
      openLabel: 'Open Spotify',
      // Landscape player panel
      slot: { left: '28%', top: '12%', width: '44%', height: '58%' },
      frameClass: 'app-frame is-wide',
    },
    instagram: {
      title: 'instagram',
      url: 'https://www.instagram.com/',
      openLabel: 'Open Instagram',
      // Phone-ish feed panel
      slot: { left: '34%', top: '6%', width: '32%', height: '78%' },
      frameClass: 'app-frame is-phone',
    },
  };

  function openAppPanel(kind) {
    if (!plane) return null;
    const meta = APP_PANELS[kind];
    if (!meta) return null;
    // Reuse an existing panel for this app if still on the desk
    const existing = plane.querySelector(`[data-sheet="app-${kind}"]`);
    if (existing) {
      existing.hidden = false;
      existing.classList.remove('is-min', 'page-away');
      existing.style.zIndex = '44';
      onFocus?.(existing);
      showToast?.(`${meta.openLabel} · panel ready`);
      return existing;
    }

    seq += 1;
    const el = document.createElement('aside');
    el.className = `paper-sheet desk-widget app-panel-sheet app-${kind}`;
    el.dataset.sheet = `app-${kind}`;
    el.dataset.surface = kind;
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule slim" aria-hidden="true"></div>
      <p class="page-kicker sheet-chrome">${meta.title}</p>
      <div class="app-panel-chrome">
        <span class="app-panel-url">${meta.url.replace(/^https?:\/\//, '')}</span>
        <a class="app-panel-ext" href="${meta.url}" target="_blank" rel="noopener noreferrer">Open in browser</a>
      </div>
      <div class="${meta.frameClass}">
        <iframe
          class="app-panel-iframe"
          title="${meta.openLabel}"
          src="${meta.url}"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        ></iframe>
        <div class="app-panel-fallback">
          <p>If the app is blocked inside the desk, open it in your browser.</p>
          <a class="btn lime" href="${meta.url}" target="_blank" rel="noopener noreferrer">${meta.openLabel}</a>
        </div>
      </div>
    `;
    mount(plane, attachSheet, el, meta.slot);
    el.style.zIndex = '44';
    const frame = el.querySelector('.app-frame');
    // IG/Spotify often block iframes · show in-panel open after a beat
    window.setTimeout(() => frame?.classList.add('is-blocked'), 1800);
    showToast?.(`${meta.openLabel} · desk panel`);
    onFocus?.(el);
    return el;
  }

  function addSpotify() {
    return openAppPanel('spotify');
  }

  function addInstagram() {
    return openAppPanel('instagram');
  }

  /** Paper “add” tray · same language as connect (not a dark dropdown) */
  function openAddTray() {
    if (!plane) return null;
    if (addTray && plane.contains(addTray)) {
      addTray.hidden = false;
      addTray.classList.remove('is-min', 'page-away');
      addTray.dataset.minimized = 'false';
      const minBtn = addTray.querySelector('[data-sheet-act="min"]');
      if (minBtn) {
        minBtn.textContent = '−';
        minBtn.title = 'Minimize';
      }
      addTray.style.zIndex = '42';
      onFocus?.(addTray);
      return addTray;
    }

    const el = document.createElement('aside');
    el.className = 'paper-sheet home-sheet connect-sheet add-tray-sheet';
    el.dataset.sheet = 'add';
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule slim" aria-hidden="true"></div>
      <p class="page-kicker sheet-chrome">add</p>
      <ol class="connect-nest" data-add-list>
        <li>
          <button type="button" class="connect-nest-row" data-add="textbox">Text box</button>
        </li>
        <li>
          <button type="button" class="connect-nest-row" data-add="scan">Scan files</button>
        </li>
        <li>
          <button type="button" class="connect-nest-row" data-add="tutors">Find a tutor</button>
        </li>
        <li>
          <button type="button" class="connect-nest-row" data-add="spotify">Spotify</button>
        </li>
      </ol>
    `;
    el.style.left = '10%';
    el.style.top = '18%';
    el.style.width = '200px';
    el.style.height = 'auto';
    el.style.minHeight = '0';
    el.style.zIndex = '42';
    el.style.transform = 'none';
    plane.appendChild(el);
    ensureSheetChrome(el);
    enableResizeHandles(el);
    enableSheetDrag(el, '.sheet-chrome, .page-kicker');
    attachSheet?.(el);

    el.querySelectorAll('[data-add]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const kind = btn.getAttribute('data-add');
        if (kind === 'textbox') addTextBox();
        else if (kind === 'scan') document.getElementById('toolGoogle')?.click();
        else if (kind === 'tutors') {
          document.getElementById('brandHome')?.click();
          window.setTimeout(() => {
            document.getElementById('hubTutorMap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 120);
        }
        else if (kind === 'spotify') addSpotify();
      });
    });

    addTray = el;
    onFocus?.(el);
    return el;
  }

  function toggleAddTray() {
    if (addTray && plane?.contains(addTray) && !addTray.hidden && !addTray.classList.contains('is-min')) {
      addTray.hidden = true;
      return null;
    }
    return openAddTray();
  }

  return {
    addTextBox,
    addSpotify,
    addInstagram,
    openAddTray,
    toggleAddTray,
  };
}
