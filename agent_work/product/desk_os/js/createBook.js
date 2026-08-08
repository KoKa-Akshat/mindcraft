/**
 * Create Instance studio · hawk + uploads + per-file prompts → Field Book
 *
 * Pipeline (modular · see js/pipeline/):
 *   1) extract  2) tag  3) generate interactive pages  4) bind instance
 */

import { runBookPipeline } from './pipeline/run.js';
import { buildStaticHtml } from './pipeline/generate.js';

const BOOKS_KEY = 'deskOs.books';

const SUBJECTS = [
  { id: 'act_math', label: 'ACT Math' },
  { id: 'piano', label: 'Piano' },
  { id: 'biology', label: 'Biology' },
  { id: 'chemistry', label: 'Chemistry' },
  { id: 'history', label: 'History' },
  { id: 'custom', label: 'Custom subject' },
];

function loadBooks() {
  try {
    const raw = JSON.parse(localStorage.getItem(BOOKS_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveBook(book) {
  const all = loadBooks();
  all[book.id] = book;
  try {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function getBook(id) {
  return loadBooks()[id] || null;
}

/** Persist a seed book into deskOs.books once */
export function ensureSeedBook(seed) {
  if (!seed?.id) return null;
  const all = loadBooks();
  if (all[seed.id]?.pages?.length) return all[seed.id];
  const book = {
    ...seed,
    html: seed.html || buildStaticHtml(seed),
    cookedAt: seed.cookedAt || new Date().toISOString(),
  };
  saveBook(book);
  return book;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{
 *   root: HTMLElement,
 *   onBack: () => void,
 *   onCooked: (inst: object, book: object) => void,
 * }} opts
 */
export function createBookStudio({ root, onBack, onCooked }) {
  if (!root) return { show() {}, hide() {} };

  /** @type {{ id: string, name: string, prompt: string, kind: string, text?: string }[]} */
  let files = [];
  let cooking = false;

  root.innerHTML = `
    <header class="studio-nav">
      <button type="button" class="studio-back" data-studio-back>← Dashboard</button>
      <p class="studio-brand">Mind<span>Craft</span></p>
      <span class="studio-nav-spacer"></span>
    </header>
    <div class="studio-body">
      <aside class="studio-hawk">
        <button type="button" class="studio-hawk-orb" aria-label="Hawk">
          <img src="img/orbs/mascot-ivory.png" alt="" draggable="false" />
        </button>
        <h1 class="studio-title">Cook a Field Book</h1>
        <p class="studio-soft">Drop files and notes. Tag each with a prompt. Same extract → tag → generate path for Piano and ACT.</p>
        <ol class="studio-steps">
          <li>Extract sources</li>
          <li>Tag concepts</li>
          <li>Generate interactive pages</li>
          <li>Bind to your desk</li>
        </ol>
      </aside>
      <section class="studio-panel">
        <label class="studio-field">
          <span>Book title</span>
          <input type="text" data-studio-title maxlength="64" placeholder="e.g. Piano week 1 · ACT warm-up" />
        </label>
        <label class="studio-field">
          <span>Subject</span>
          <select data-studio-subject>
            ${SUBJECTS.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}
          </select>
        </label>
        <div class="studio-upload">
          <input type="file" data-studio-file multiple hidden />
          <button type="button" class="studio-upload-btn" data-studio-pick>Upload files</button>
          <button type="button" class="studio-upload-btn ghost" data-studio-note>+ Add note</button>
        </div>
        <ul class="studio-files" data-studio-list></ul>
        <p class="studio-status" data-studio-status>Tag each source. Then cook.</p>
        <button type="button" class="studio-cook" data-studio-cook disabled>Cook Field Book</button>
      </section>
    </div>
  `;

  const listEl = root.querySelector('[data-studio-list]');
  const statusEl = root.querySelector('[data-studio-status]');
  const cookBtn = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-studio-cook]'));
  const fileInput = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-studio-file]'));
  const titleInput = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-studio-title]'));
  const subjectSel = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-studio-subject]'));

  function renderList() {
    if (!listEl) return;
    if (!files.length) {
      listEl.innerHTML = `<li class="studio-empty">No sources yet</li>`;
    } else {
      listEl.innerHTML = files.map((f, i) => `
        <li class="studio-file" data-i="${i}">
          <div class="studio-file-head">
            <span class="studio-file-kind">${escapeHtml(f.kind)}</span>
            <strong>${escapeHtml(f.name)}</strong>
            <button type="button" class="studio-file-x" data-rm="${i}" aria-label="Remove">×</button>
          </div>
          <input type="text" class="studio-prompt" data-prompt="${i}" maxlength="160"
            placeholder="Prompt for this source…" value="${escapeHtml(f.prompt)}" />
        </li>
      `).join('');
      listEl.querySelectorAll('[data-rm]').forEach((btn) => {
        btn.addEventListener('click', () => {
          files.splice(Number(btn.getAttribute('data-rm')), 1);
          renderList();
          syncCook();
        });
      });
      listEl.querySelectorAll('[data-prompt]').forEach((input) => {
        input.addEventListener('input', () => {
          const i = Number(input.getAttribute('data-prompt'));
          if (files[i]) files[i].prompt = /** @type {HTMLInputElement} */ (input).value;
        });
      });
    }
    syncCook();
  }

  function syncCook() {
    if (cookBtn) cookBtn.disabled = cooking || files.length === 0;
  }

  function addFiles(fileList) {
    for (const file of fileList || []) {
      files.push({
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        kind: 'file',
        prompt: '',
        text: '',
      });
    }
    renderList();
  }

  function addNote() {
    const n = files.filter((f) => f.kind === 'note').length + 1;
    files.push({
      id: `n_${Date.now()}`,
      name: `Note ${n}`,
      kind: 'note',
      prompt: '',
      text: '',
    });
    renderList();
  }

  async function cook() {
    if (cooking || !files.length) return;
    cooking = true;
    syncCook();
    const subject = SUBJECTS.find((s) => s.id === subjectSel?.value) || SUBJECTS[0];
    const title = (titleInput?.value || '').trim() || `${subject.label} Field Book`;

    try {
      const { book, inst } = await runBookPipeline({
        sources: files.map((f) => ({
          ...f,
          text: f.prompt || f.text || `Source: ${f.name}`,
        })),
        subject,
        title,
        onStage: (line) => {
          if (statusEl) statusEl.textContent = line;
        },
      });
      saveBook(book);
      cooking = false;
      if (statusEl) statusEl.textContent = 'Book ready · appended to Dashboard';
      syncCook();
      onCooked?.(inst, book);
    } catch (err) {
      cooking = false;
      syncCook();
      if (statusEl) statusEl.textContent = `Cook failed · ${err?.message || 'unknown'}`;
    }
  }

  root.querySelector('[data-studio-back]')?.addEventListener('click', () => onBack?.());
  root.querySelector('[data-studio-pick]')?.addEventListener('click', () => fileInput?.click());
  root.querySelector('[data-studio-note]')?.addEventListener('click', () => addNote());
  fileInput?.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });
  cookBtn?.addEventListener('click', () => { void cook(); });

  renderList();

  return {
    show() {
      root.hidden = false;
      root.classList.remove('hidden');
      files = [];
      if (titleInput) titleInput.value = '';
      if (statusEl) statusEl.textContent = 'Tag each source. Then cook.';
      cooking = false;
      renderList();
    },
    hide() {
      root.hidden = true;
      root.classList.add('hidden');
    },
  };
}
