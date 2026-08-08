/** Kitchen cook · drop owl + typewriter note → ACT FieldBook (local, Jesse-energy) */

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{
 *   stage: HTMLElement,
 *   navBtn: HTMLElement | null,
 *   onCooked?: (note: string) => void,
 *   onDone?: () => void,
 * }} opts
 */
export function createFieldBookCook({ stage, navBtn, onCooked, onDone }) {
  let note = '';
  let cooked = false;

  try {
    cooked = localStorage.getItem('deskOs.fieldbookCooked') === '1';
    note = localStorage.getItem('deskOs.fieldbookNote') || '';
  } catch { /* ignore */ }

  function syncNav() {
    // Binder lives in the top nav · always available after cook path
    if (!navBtn) return;
    navBtn.hidden = false;
  }

  function show() {
    if (!stage) return;
    stage.hidden = false;
    stage.classList.remove('is-cooking', 'is-done');
    const input = stage.querySelector('#fieldNote');
    if (input && note) input.value = note;
    syncNav();
  }

  function hide() {
    if (stage) stage.hidden = true;
  }

  function typewriter(el, text, ms = 28) {
    return new Promise((resolve) => {
      el.textContent = '';
      let i = 0;
      const tick = () => {
        if (i >= text.length) {
          resolve();
          return;
        }
        el.textContent += text[i];
        i += 1;
        setTimeout(tick, ms);
      };
      tick();
    });
  }

  async function cook() {
    const input = stage.querySelector('#fieldNote');
    const raw = (input?.value || '').trim() || 'ACT prep · start with what feels shaky.';
    note = raw.slice(0, 160);
    stage.classList.add('is-cooking');

    const typeEl = stage.querySelector('[data-typewriter]');
    const status = stage.querySelector('[data-cook-status]');
    if (status) status.textContent = 'Owl is lining the stove…';
    if (typeEl) await typewriter(typeEl, note, 22);

    if (status) status.textContent = 'Cooking your ACT FieldBook…';
    await new Promise((r) => setTimeout(r, 900));

    cooked = true;
    try {
      localStorage.setItem('deskOs.fieldbookCooked', '1');
      localStorage.setItem('deskOs.fieldbookNote', note);
    } catch { /* ignore */ }

    stage.classList.add('is-done');
    if (status) status.textContent = 'ACT FieldBook is ready.';
    syncNav();
    onCooked?.(note);

    await new Promise((r) => setTimeout(r, 700));
    hide();
    onDone?.(note);
  }

  function wire() {
    if (!stage || stage.dataset.wired === '1') return;
    stage.dataset.wired = '1';

    const drop = stage.querySelector('[data-cook-drop]');
    const owl = stage.querySelector('[data-cook-owl]');
    const go = stage.querySelector('[data-cook-go]');

    const tryCook = () => {
      if (stage.classList.contains('is-cooking')) return;
      cook();
    };

    go?.addEventListener('click', tryCook);

    // Drop owl onto the note plate
    owl?.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', 'owl');
      owl.classList.add('is-dragging');
    });
    owl?.addEventListener('dragend', () => owl.classList.remove('is-dragging'));

    drop?.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('is-hot');
    });
    drop?.addEventListener('dragleave', () => drop.classList.remove('is-hot'));
    drop?.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-hot');
      drop.classList.add('has-owl');
      tryCook();
    });

    // Click owl also seats it (mobile / simple)
    owl?.addEventListener('click', () => {
      drop?.classList.add('has-owl');
      tryCook();
    });

    syncNav();
  }

  function openBook() {
    return {
      note: note || 'ACT prep',
      cooked,
    };
  }

  return {
    wire,
    show,
    hide,
    syncNav,
    isCooked: () => cooked,
    openBook,
    getNote: () => note,
  };
}

/** Ivory prep note under the owl · quiet, no CTA spam */
export function openFieldBookSheet({ plane, attachSheet, note }) {
  if (!plane) return null;
  let el = plane.querySelector('[data-sheet="fieldbook"]');
  if (!el) {
    el = document.createElement('aside');
    el.className = 'paper-sheet home-sheet fieldbook-sheet';
    el.dataset.sheet = 'fieldbook';
    el.style.left = '8%';
    el.style.top = '42%';
    el.style.width = '260px';
    el.style.height = '168px';
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule slim" aria-hidden="true"></div>
      <p class="page-kicker sheet-chrome">prep</p>
      <div data-fb-body></div>
    `;
    plane.appendChild(el);
    attachSheet?.(el);
  }
  el.hidden = false;
  el.classList.remove('is-min');
  const body = el.querySelector('[data-fb-body]');
  if (body) {
    body.innerHTML = `
      <p class="fieldbook-note">${escapeHtml(note || 'ACT prep')}</p>
    `;
  }
  void attachSheet;
  return el;
}
