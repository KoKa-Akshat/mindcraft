/** Workflow market · one row of three · buy / trade */

const WORKFLOWS = [
  {
    id: 'gap_scan_pack',
    title: 'Gap scan → practice pack',
    blurb: 'Seed weaknesses, then open a matching mission.',
    price: 4,
    trade: true,
    apps: ['Scan', 'Practice', 'Map'],
    author: 'AK',
  },
  {
    id: 'mail_to_binder',
    title: 'School mail → Repository file',
    blurb: 'Tag syllabus mail and drop it into the binder.',
    price: 3,
    trade: true,
    apps: ['Mail', 'Repository'],
    author: 'BK',
  },
  {
    id: 'act_nightly',
    title: 'ACT nightly drill loop',
    blurb: 'One ACT FieldBook set each evening.',
    price: 6,
    trade: true,
    apps: ['ACT', 'Practice'],
    author: 'AK',
  },
];

/**
 * @param {{
 *   root: HTMLElement,
 *   onToast?: (msg: string) => void,
 * }} opts
 */
export function createWorkflowMarket({ root, onToast }) {
  if (!root) return { destroy() {} };

  const grid = root.querySelector('[data-wf-grid]');
  const countEl = root.querySelector('[data-wf-count]');
  const search = root.querySelector('[data-wf-search]');
  let query = '';
  /** @type {Set<string>} */
  const owned = new Set();

  try {
    const raw = JSON.parse(localStorage.getItem('deskOs.workflows') || '[]');
    if (Array.isArray(raw)) raw.forEach((id) => owned.add(id));
  } catch { /* ignore */ }

  function saveOwned() {
    try {
      localStorage.setItem('deskOs.workflows', JSON.stringify([...owned]));
    } catch { /* ignore */ }
  }

  function matches(w) {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      w.title.toLowerCase().includes(q) ||
      w.blurb.toLowerCase().includes(q) ||
      w.apps.some((a) => a.toLowerCase().includes(q))
    );
  }

  function paint() {
    const rows = WORKFLOWS.filter(matches).slice(0, 3);
    if (countEl) countEl.textContent = `${rows.length} workflow${rows.length === 1 ? '' : 's'}`;
    if (!grid) return;
    grid.innerHTML = rows.length
      ? rows
          .map((w) => {
            const mine = owned.has(w.id);
            return `
        <article class="wf-card" data-wf-id="${w.id}">
          <p class="wf-card-title">${w.title}</p>
          <p class="wf-card-blurb">${w.blurb}</p>
          <div class="wf-card-apps">
            ${w.apps.map((a) => `<span>${a}</span>`).join('')}
          </div>
          <div class="wf-card-foot">
            <span class="wf-author" aria-hidden="true">${w.author}</span>
            <div class="wf-actions">
              ${
                mine
                  ? `<button type="button" class="wf-btn is-owned" data-wf-act="open" data-id="${w.id}">In library</button>`
                  : `<button type="button" class="wf-btn" data-wf-act="buy" data-id="${w.id}">Buy · ${w.price}</button>`
              }
              ${
                w.trade
                  ? `<button type="button" class="wf-btn ghost" data-wf-act="trade" data-id="${w.id}">Trade</button>`
                  : ''
              }
            </div>
          </div>
        </article>`;
          })
          .join('')
      : `<p class="wf-empty">No workflows match.</p>`;
  }

  search?.addEventListener('input', () => {
    query = search.value.trim();
    paint();
  });
  root.querySelector('[data-wf-search-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    query = search?.value.trim() || '';
    paint();
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-wf-act]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const w = WORKFLOWS.find((x) => x.id === id);
    if (!w) return;
    const act = btn.getAttribute('data-wf-act');
    if (act === 'buy') {
      owned.add(w.id);
      saveOwned();
      paint();
      onToast?.(`Bought · ${w.title}`);
    } else if (act === 'trade') {
      onToast?.(owned.has(w.id) ? `Trade listed · ${w.title}` : `Offer trade · ${w.title}`);
    } else if (act === 'open') {
      onToast?.(`Open · ${w.title}`);
    }
  });

  paint();
  return { destroy() {} };
}
