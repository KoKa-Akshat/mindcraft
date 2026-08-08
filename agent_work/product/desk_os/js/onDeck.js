/** On deck · Gen Z checklist (not “to-dos”) · move only, never close */

const KEY = 'deskOs.onDeck';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function load(seed) {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(raw) && raw.length) return raw.slice(0, 8);
  } catch { /* ignore */ }
  const line = String(seed || '').trim() || 'Quadratics before April';
  return [{ id: 'd1', text: line, done: false }];
}

function save(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 8)));
  } catch { /* ignore */ }
}

/**
 * Locked sheet · can’t close · only drag around
 * @param {{
 *   plane: HTMLElement,
 *   attachSheet?: (el: HTMLElement) => void,
 *   note?: string,
 * }} opts
 */
export function openOnDeckSheet({ plane, attachSheet, note }) {
  if (!plane) return null;
  let el = plane.querySelector('[data-sheet="ondeck"]');
  let items = load(note);

  if (!el) {
    el = document.createElement('aside');
    el.className = 'paper-sheet home-sheet ondeck-sheet';
    el.dataset.sheet = 'ondeck';
    el.dataset.noClose = '1';
    // Under the owl · left column
    el.style.left = '8%';
    el.style.top = '42%';
    el.style.width = '280px';
    el.style.height = '260px';
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule slim" aria-hidden="true"></div>
      <p class="page-kicker sheet-chrome">on deck</p>
      <h2 class="home-title">Still up</h2>
      <p class="home-soft">The stuff that actually matters this week.</p>
      <ul class="ondeck-list" data-ondeck-list></ul>
      <input class="note-input" data-ondeck-add type="text" maxlength="72" placeholder="add something…" autocomplete="off" />
    `;
    plane.appendChild(el);
    attachSheet?.(el);
    // Strip × if chrome already added
    el.querySelector('[data-sheet-act="close"]')?.remove();
  }

  el.hidden = false;
  el.classList.remove('is-min');
  el.dataset.noClose = '1';
  el.querySelector('[data-sheet-act="close"]')?.remove();

  const list = el.querySelector('[data-ondeck-list]');
  const input = el.querySelector('[data-ondeck-add]');

  function paint() {
    if (!list) return;
    list.innerHTML = items.map((it) => `
      <li class="${it.done ? 'is-done' : ''}" data-id="${escapeHtml(it.id)}">
        <button type="button" class="ondeck-check" data-toggle aria-label="Toggle">${it.done ? '✓' : ''}</button>
        <span class="ondeck-text">${escapeHtml(it.text)}</span>
      </li>
    `).join('');
    list.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('li')?.dataset.id;
        items = items.map((it) => (it.id === id ? { ...it, done: !it.done } : it));
        save(items);
        paint();
      });
    });
  }

  if (input && input.dataset.bound !== '1') {
    input.dataset.bound = '1';
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const t = input.value.trim();
      if (!t || items.length >= 8) return;
      items = [...items, { id: `d${Date.now()}`, text: t, done: false }];
      save(items);
      input.value = '';
      paint();
    });
  }

  // Hide legacy prep sheet if still around
  plane.querySelector('[data-sheet="fieldbook"]')?.remove();

  paint();
  return el;
}
