/** Hub Call · mastery check-in (student) or session note (tutor) */

import { getRole } from './onboarding.js';

/**
 * @param {{
 *   hub: HTMLElement,
 *   getFocusInstance: () => object | null,
 *   onComplete: (inst: object, pct: number) => void,
 *   onToast?: (msg: string) => void,
 * }} opts
 */
export function createHubCall({ hub, getFocusInstance, onComplete, onToast }) {
  if (!hub) return { open() {}, close() {}, destroy() {} };

  let panel = hub.querySelector('[data-hub-call-panel]');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'hub-call-panel';
    panel.dataset.hubCallPanel = '';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="hub-call-panel-card" role="dialog" aria-label="Call">
        <div class="hub-call-panel-head">
          <p class="hub-call-panel-kicker" data-call-kicker>Mastery check-in</p>
          <button type="button" class="hub-call-panel-x" data-call-close aria-label="Close">−</button>
        </div>
        <p class="hub-call-panel-soft" data-call-soft>How solid does this goal feel right now?</p>
        <textarea
          class="hub-call-panel-input"
          data-call-note
          rows="3"
          maxlength="220"
          placeholder="A few sentences · what feels shaky, what clicked…"
        ></textarea>
        <div class="hub-call-panel-pct" data-call-pct-wrap>
          <label for="hubCallPct">Honest estimate</label>
          <div class="hub-call-panel-pct-row">
            <input id="hubCallPct" data-call-pct type="range" min="0" max="100" value="40" />
            <span data-call-pct-label>40%</span>
          </div>
        </div>
        <div class="hub-call-panel-actions">
          <button type="button" class="hub-call-panel-end" data-call-skip>Not now</button>
          <button type="button" class="hub-call-panel-go" data-call-save>Save check-in</button>
        </div>
      </div>
    `;
    hub.appendChild(panel);
  }

  const noteEl = /** @type {HTMLTextAreaElement | null} */ (panel.querySelector('[data-call-note]'));
  const pctEl = /** @type {HTMLInputElement | null} */ (panel.querySelector('[data-call-pct]'));
  const pctLabel = panel.querySelector('[data-call-pct-label]');
  const soft = panel.querySelector('[data-call-soft]');
  const kicker = panel.querySelector('[data-call-kicker]');
  const pctWrap = panel.querySelector('[data-call-pct-wrap]');
  const saveBtn = panel.querySelector('[data-call-save]');
  const bubble = hub.querySelector('.hub-call-bubble');

  function syncLabel() {
    if (pctLabel && pctEl) pctLabel.textContent = `${pctEl.value}%`;
  }

  function paintRoleChrome() {
    const role = getRole() || 'student';
    const tutor = role === 'tutor';
    if (kicker) kicker.textContent = tutor ? 'Tutor call' : 'Mastery check-in';
    if (saveBtn) saveBtn.textContent = tutor ? 'Save session note' : 'Save check-in';
    if (pctWrap) pctWrap.hidden = tutor;
    if (noteEl) {
      noteEl.placeholder = tutor
        ? 'What did you coach? What should the student practice next…'
        : 'A few sentences · what feels shaky, what clicked…';
    }
    if (bubble) {
      bubble.textContent = tutor ? 'Start a tutor call note' : 'Start your mastery check-in';
    }
  }

  function open() {
    paintRoleChrome();
    const inst = getFocusInstance?.();
    const role = getRole() || 'student';
    if (soft) {
      if (role === 'tutor') {
        soft.textContent = inst?.name
          ? `Tutor note for ${inst.name} · what happened on the call?`
          : 'Tutor note · pick an instance in Set goal first.';
      } else {
        soft.textContent = inst?.name
          ? `How solid is ${inst.name} toward your goal?`
          : 'How solid does this goal feel right now?';
      }
    }
    panel.hidden = false;
    panel.classList.add('is-open');
    syncLabel();
    window.setTimeout(() => noteEl?.focus(), 60);
  }

  function close() {
    panel.hidden = true;
    panel.classList.remove('is-open');
  }

  function save() {
    const inst = getFocusInstance?.();
    if (!inst) {
      onToast?.('Pick an instance in Set goal first');
      return;
    }
    const role = getRole() || 'student';
    const note = noteEl?.value?.trim() || '';
    const pct = role === 'tutor'
      ? (Number.isFinite(Number(inst.masteryPct)) ? Number(inst.masteryPct) : 0)
      : Math.max(0, Math.min(100, Number(pctEl?.value || 0)));

    if (role !== 'tutor') inst.masteryPct = pct;

    try {
      const list = JSON.parse(localStorage.getItem('deskOs.instances') || '[]');
      if (Array.isArray(list)) {
        const row = list.find((x) => x.id === inst.id);
        if (row) {
          if (role !== 'tutor') row.masteryPct = pct;
          row.masteryNote = note;
          row.masteryAt = new Date().toISOString();
          row.lastCallRole = role;
          localStorage.setItem('deskOs.instances', JSON.stringify(list));
        }
      }
      const callLog = JSON.parse(localStorage.getItem('deskOs.callLog') || '[]');
      if (Array.isArray(callLog)) {
        callLog.unshift({
          instanceId: inst.id,
          role,
          pct: role === 'tutor' ? null : pct,
          note,
          at: new Date().toISOString(),
        });
        localStorage.setItem('deskOs.callLog', JSON.stringify(callLog.slice(0, 40)));
      }
      if (role !== 'tutor') {
        localStorage.setItem('deskOs.mastery', JSON.stringify({
          instanceId: inst.id,
          pct,
          sure: true,
          note,
        }));
      }
    } catch { /* ignore */ }

    onComplete?.(inst, pct);
    onToast?.(
      role === 'tutor'
        ? `Tutor note saved on ${inst.name}`
        : `Check-in saved · ${pct}% on ${inst.name}`,
    );
    close();
  }

  paintRoleChrome();
  pctEl?.addEventListener('input', syncLabel);
  panel.querySelector('[data-call-close]')?.addEventListener('click', close);
  panel.querySelector('[data-call-skip]')?.addEventListener('click', close);
  panel.querySelector('[data-call-save]')?.addEventListener('click', save);

  hub.querySelector('[data-hub-call]')?.addEventListener('click', (e) => {
    e.preventDefault();
    open();
  });

  return { open, close, paintRoleChrome, destroy() { close(); } };
}
