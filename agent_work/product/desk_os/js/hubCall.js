/** Hub Call · mastery check-in from the phone button */

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
      <div class="hub-call-panel-card" role="dialog" aria-label="Mastery check-in">
        <div class="hub-call-panel-head">
          <p class="hub-call-panel-kicker">Mastery check-in</p>
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
        <div class="hub-call-panel-pct">
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

  function syncLabel() {
    if (pctLabel && pctEl) pctLabel.textContent = `${pctEl.value}%`;
  }

  function open() {
    const inst = getFocusInstance?.();
    if (soft) {
      soft.textContent = inst?.name
        ? `How solid is ${inst.name} toward your goal?`
        : 'How solid does this goal feel right now?';
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
    const pct = Math.max(0, Math.min(100, Number(pctEl?.value || 0)));
    const note = noteEl?.value?.trim() || '';
    inst.masteryPct = pct;
    try {
      const list = JSON.parse(localStorage.getItem('deskOs.instances') || '[]');
      if (Array.isArray(list)) {
        const row = list.find((x) => x.id === inst.id);
        if (row) {
          row.masteryPct = pct;
          row.masteryNote = note;
          row.masteryAt = new Date().toISOString();
          localStorage.setItem('deskOs.instances', JSON.stringify(list));
        }
      }
      localStorage.setItem('deskOs.mastery', JSON.stringify({
        instanceId: inst.id,
        pct,
        sure: true,
        note,
      }));
    } catch { /* ignore */ }
    onComplete?.(inst, pct);
    onToast?.(`Check-in saved · ${pct}% on ${inst.name}`);
    close();
  }

  pctEl?.addEventListener('input', syncLabel);
  panel.querySelector('[data-call-close]')?.addEventListener('click', close);
  panel.querySelector('[data-call-skip]')?.addEventListener('click', close);
  panel.querySelector('[data-call-save]')?.addEventListener('click', save);

  hub.querySelector('[data-hub-call]')?.addEventListener('click', (e) => {
    e.preventDefault();
    open();
  });

  return { open, close, destroy() { close(); } };
}
