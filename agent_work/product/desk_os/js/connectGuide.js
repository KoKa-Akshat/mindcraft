/** Connect instruction paper · sharp bullets · Mark connected */

import { getConnector, markConnected, isConnected } from './connectLinks.js';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{
 *   plane: HTMLElement,
 *   attachSheet?: (el: HTMLElement) => void,
 *   journal?: { enter: (el: HTMLElement, opts?: object) => void },
 *   onMarked?: (id: string) => void,
 * }} opts
 */
export function openConnectGuide({ plane, attachSheet, journal, onMarked, id }) {
  const spec = getConnector(id);
  if (!plane || !spec) return null;

  let el = plane.querySelector(`[data-sheet="guide_${id}"]`);
  if (!el) {
    el = document.createElement('aside');
    el.className = 'paper-sheet home-sheet guide-sheet';
    el.dataset.sheet = `guide_${id}`;
    el.style.left = '30%';
    el.style.top = '16%';
    el.style.width = '420px';
    el.style.height = '400px';
    plane.appendChild(el);
    attachSheet?.(el);
  }

  const linked = isConnected(id);
  el.hidden = false;
  el.classList.remove('is-min');
  if (!el.querySelector('[data-guide-body]')) {
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule" aria-hidden="true"></div>
      <p class="page-kicker sheet-chrome">connect</p>
      <div data-guide-body></div>
    `;
    attachSheet?.(el);
    journal?.wireSheet?.(el, { mode: 'sheet' });
  }
  const kicker = el.querySelector('.page-kicker');
  if (kicker) kicker.textContent = `connect · ${spec.kind}`;

  const body = el.querySelector('[data-guide-body]');
  if (body) {
    body.innerHTML = `
      <h2 class="home-title">${escapeHtml(spec.title)}</h2>
      <p class="home-soft">${escapeHtml(spec.meta)}</p>
      <ul class="guide-bullets">
        ${spec.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
      </ul>
      <button type="button" class="boop-primary" data-mark ${linked ? 'disabled' : ''}>
        <span class="hl">${linked ? 'Already linked' : 'Mark as connected'}</span>
      </button>
    `;
    body.querySelector('[data-mark]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isConnected(id)) return;
      markConnected(id);
      onMarked?.(id);
      const btn = body.querySelector('[data-mark]');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="hl">Already linked</span>';
      }
    });
  }

  journal?.enter(el, { mode: 'sheet' });
  return el;
}
