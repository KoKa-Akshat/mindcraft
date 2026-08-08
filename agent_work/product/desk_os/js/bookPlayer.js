/**
 * Interactive Field Book player · full-bleed pages for Piano + ACT (+ cooked books)
 */

const PROGRESS_KEY = 'deskOs.bookProgress';

const NOTE_FREQ = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25,
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadProgress(bookId) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return all?.[bookId] || { page: 0, answers: 0, answers: {} };
  } catch {
    return { page: 0, answers: 0, answers: {} };
  }
}

function saveProgress(bookId, prog) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    all[bookId] = prog;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/**
 * @param {{
 *   shell: HTMLElement,
 *   onClose?: () => void,
 *   onAction?: (action: string, page: object) => void,
 *   onToast?: (msg: string) => void,
 * }} opts
 */
export function createBookPlayer({ shell, onClose, onAction, onToast }) {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {object | null} */
  let book = null;
  let pageIndex = 0;
  let prog = { page: 0, answers: 0, answers: {} };
  /** @type {AudioContext | null} */
  let audioCtx = null;
  let openFlag = false;

  function canvasHost() {
    return shell?.querySelector('.desk-canvas') || shell;
  }

  function ensureRoot() {
    if (root && root.isConnected) return root;
    const host = canvasHost();
    root = document.createElement('div');
    root.className = 'book-player act-bleed';
    root.dataset.sheet = 'book-player';
    root.hidden = true;
    root.innerHTML = `
      <div class="book-player-frame">
        <header class="book-player-chrome">
          <p class="book-player-kicker" data-bp-kicker>Field Book</p>
          <p class="book-player-progress" data-bp-progress></p>
          <button type="button" class="act-bleed-min" data-bp-close title="Back" aria-label="Close book">−</button>
        </header>
        <div class="book-player-page" data-bp-page></div>
        <footer class="book-player-nav">
          <button type="button" class="book-player-btn ghost" data-bp-prev>Back</button>
          <button type="button" class="book-player-btn" data-bp-next>Next</button>
        </footer>
      </div>
    `;
    host.appendChild(root);
    root.querySelector('[data-bp-close]')?.addEventListener('click', () => close());
    root.querySelector('[data-bp-prev]')?.addEventListener('click', () => go(-1));
    root.querySelector('[data-bp-next]')?.addEventListener('click', () => go(1));
    return root;
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx?.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  }

  function playNote(name, when = 0, dur = 0.28) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const freq = NOTE_FREQ[name] || 261.63;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function playPhrase(notes) {
    (notes || []).forEach((n, i) => playNote(n, i * 0.32, 0.26));
  }

  function pages() {
    return book?.pages || [];
  }

  function render() {
    const el = ensureRoot();
    const list = pages();
    const page = list[pageIndex] || { type: 'done', title: 'Empty book', body: 'No pages.' };
    const kicker = el.querySelector('[data-bp-kicker]');
    const progress = el.querySelector('[data-bp-progress]');
    const stage = el.querySelector('[data-bp-page]');
    const prev = /** @type {HTMLButtonElement | null} */ (el.querySelector('[data-bp-prev]'));
    const next = /** @type {HTMLButtonElement | null} */ (el.querySelector('[data-bp-next]'));

    if (kicker) kicker.textContent = `${book?.badge || book?.subjectLabel || 'Book'} · ${book?.title || 'Field Book'}`;
    if (progress) progress.textContent = `${pageIndex + 1} / ${Math.max(1, list.length)}`;
    if (prev) prev.disabled = pageIndex <= 0;
    if (next) {
      next.textContent = pageIndex >= list.length - 1 ? 'Close' : 'Next';
    }

    if (!stage) return;
    stage.dataset.type = page.type || 'read';
    stage.innerHTML = renderPage(page);
    wirePage(stage, page);

    prog.page = pageIndex;
    if (book?.id) saveProgress(book.id, prog);
  }

  function renderPage(page) {
    if (page.type === 'cover') {
      return `
        <div class="bp-cover">
          <p class="bp-eyebrow">MindCraft · interactive book</p>
          <h1>${escapeHtml(page.title)}</h1>
          <p class="bp-sub">${escapeHtml(page.subtitle || '')}</p>
          <p class="bp-license">${escapeHtml(page.license || '')}</p>
        </div>`;
    }
    if (page.type === 'piano') {
      const keys = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
      return `
        <div class="bp-piano">
          <h2>${escapeHtml(page.title)}</h2>
          <p class="bp-prompt">${escapeHtml(page.prompt || '')}</p>
          <p class="bp-phrase">Phrase · ${escapeHtml((page.notes || []).join(' '))}</p>
          <div class="bp-keys" data-bp-keys>
            ${keys.map((k) => `<button type="button" class="bp-key" data-note="${k}">${k.replace('4', '').replace('5', '′')}</button>`).join('')}
          </div>
          <div class="bp-piano-actions">
            <button type="button" class="book-player-btn" data-bp-play>Play phrase</button>
            <button type="button" class="book-player-btn ghost" data-bp-mark>Mark practiced</button>
          </div>
          <p class="bp-feedback" data-bp-feedback hidden></p>
        </div>`;
    }
    if (page.type === 'mcq') {
      return `
        <div class="bp-mcq">
          <h2>${escapeHtml(page.title)}</h2>
          <p class="bp-stem">${escapeHtml(page.stem)}</p>
          <div class="bp-choices" data-bp-choices>
            ${(page.choices || []).map((c, i) => `
              <button type="button" class="bp-choice" data-choice="${i}">${escapeHtml(c)}</button>
            `).join('')}
          </div>
          <p class="bp-feedback" data-bp-feedback hidden></p>
        </div>`;
    }
    if (page.type === 'quiz') {
      return `
        <div class="bp-quiz">
          <h2>${escapeHtml(page.title)}</h2>
          <p class="bp-stem">${escapeHtml(page.q)}</p>
          <textarea class="bp-quiz-input" data-bp-quiz rows="3" maxlength="200" placeholder="${escapeHtml(page.placeholder || '')}"></textarea>
          <button type="button" class="book-player-btn" data-bp-quiz-save>Save reflection</button>
          <p class="bp-feedback" data-bp-feedback hidden></p>
        </div>`;
    }
    if (page.type === 'action') {
      return `
        <div class="bp-action">
          <h2>${escapeHtml(page.title)}</h2>
          <p class="bp-stem">${escapeHtml(page.body || '')}</p>
          <button type="button" class="book-player-btn" data-bp-action="${escapeHtml(page.action || '')}">${escapeHtml(page.label || 'Continue')}</button>
        </div>`;
    }
    if (page.type === 'done') {
      return `
        <div class="bp-done">
          <h2>${escapeHtml(page.title)}</h2>
          <p class="bp-stem">${escapeHtml(page.body || '')}</p>
          <p class="bp-score">Answers marked · ${prog.marks || 0}</p>
        </div>`;
    }
    return `
      <div class="bp-read">
        <h2>${escapeHtml(page.title || 'Chapter')}</h2>
        <p class="bp-stem">${escapeHtml(page.body || '')}</p>
      </div>`;
  }

  function wirePage(stage, page) {
    stage.querySelectorAll('[data-note]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const note = btn.getAttribute('data-note') || 'C4';
        playNote(note);
        btn.classList.add('is-lit');
        window.setTimeout(() => btn.classList.remove('is-lit'), 180);
      });
    });
    stage.querySelector('[data-bp-play]')?.addEventListener('click', () => {
      playPhrase(page.notes || []);
    });
    stage.querySelector('[data-bp-mark]')?.addEventListener('click', () => {
      prog.marks = (prog.marks || 0) + 1;
      prog.answers = prog.answers || {};
      prog.answers[`p${pageIndex}`] = { practiced: true };
      const fb = stage.querySelector('[data-bp-feedback]');
      if (fb) {
        fb.hidden = false;
        fb.textContent = 'Practiced · saved locally';
        fb.dataset.ok = '1';
      }
      if (book?.id) saveProgress(book.id, prog);
      onToast?.('Piano drill marked');
    });
    stage.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-choice'));
        const ok = i === Number(page.answer);
        stage.querySelectorAll('.bp-choice').forEach((b) => {
          b.disabled = true;
          const bi = Number(b.getAttribute('data-choice'));
          if (bi === Number(page.answer)) b.classList.add('is-correct');
          if (bi === i && !ok) b.classList.add('is-wrong');
        });
        const fb = stage.querySelector('[data-bp-feedback]');
        if (fb) {
          fb.hidden = false;
          fb.dataset.ok = ok ? '1' : '0';
          fb.textContent = ok
            ? `Correct · ${page.explain || ''}`
            : `Not quite · ${page.explain || 'Try the next page.'}`;
        }
        prog.marks = (prog.marks || 0) + 1;
        prog.answers = prog.answers || {};
        prog.answers[`p${pageIndex}`] = { choice: i, ok };
        if (book?.id) saveProgress(book.id, prog);
      });
    });
    stage.querySelector('[data-bp-quiz-save]')?.addEventListener('click', () => {
      const input = /** @type {HTMLTextAreaElement | null} */ (stage.querySelector('[data-bp-quiz]'));
      const text = (input?.value || '').trim();
      const fb = stage.querySelector('[data-bp-feedback]');
      if (!text) {
        if (fb) {
          fb.hidden = false;
          fb.dataset.ok = '0';
          fb.textContent = 'Write a short line first.';
        }
        return;
      }
      prog.marks = (prog.marks || 0) + 1;
      prog.answers = prog.answers || {};
      prog.answers[`p${pageIndex}`] = { text };
      if (book?.id) saveProgress(book.id, prog);
      if (fb) {
        fb.hidden = false;
        fb.dataset.ok = '1';
        fb.textContent = 'Saved · local only';
      }
    });
    stage.querySelector('[data-bp-action]')?.addEventListener('click', () => {
      const action = stage.querySelector('[data-bp-action]')?.getAttribute('data-bp-action') || '';
      onAction?.(action, page);
    });
  }

  function go(delta) {
    const list = pages();
    if (delta > 0 && pageIndex >= list.length - 1) {
      close();
      return;
    }
    pageIndex = Math.max(0, Math.min(list.length - 1, pageIndex + delta));
    render();
  }

  /**
   * @param {object} nextBook
   * @param {{ startPage?: number }} [opts]
   */
  function open(nextBook, opts = {}) {
    book = nextBook;
    if (!book?.pages?.length) {
      onToast?.('Book has no pages');
      return;
    }
    prog = loadProgress(book.id);
    pageIndex = Number.isFinite(opts.startPage) ? opts.startPage : (prog.page || 0);
    pageIndex = Math.max(0, Math.min(book.pages.length - 1, pageIndex));
    const el = ensureRoot();
    el.hidden = false;
    openFlag = true;
    shell?.classList.add('is-act-bleed', 'is-book-player');
    render();
  }

  function close() {
    const wasOpen = openFlag;
    openFlag = false;
    if (root) root.hidden = true;
    shell?.classList.remove('is-act-bleed', 'is-book-player');
    if (wasOpen) onClose?.();
  }

  function isOpen() {
    return openFlag;
  }

  return { open, close, isOpen, playPhrase, playNote };
}

/**
 * Fetch a seed book JSON from the prototype data folder.
 * @param {'piano' | 'act' | string} kind
 */
export async function loadSeedBook(kind) {
  const file = kind === 'piano' ? 'pianoSeed.json' : 'actSeed.json';
  const url = new URL(`../data/${file}`, import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`seed ${file} ${res.status}`);
  return res.json();
}
