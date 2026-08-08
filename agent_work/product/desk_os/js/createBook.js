/**
 * Create Instance studio · hawk + uploads + per-file prompts → Field Book
 *
 * Pipeline shape (local demo now · wire to ml later):
 *   1) Ingest tagged sources
 *   2) Learning-graph spine (McCreary-style concept graph; MindCraft ontology for math)
 *   3) Chapters + MicroSim / practice stubs (subject-agnostic)
 *   4) Bind as an ACT-like instance on the hub
 *
 * External pattern: https://dmccreary.github.io/intelligent-textbooks/case-studies/
 * MindCraft seam: ml/scripts/pipeline/ + ml/generation/
 */

const BOOKS_KEY = 'deskOs.books';

const SUBJECTS = [
  { id: 'act_math', label: 'ACT Math' },
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

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(s) {
  return String(s || 'book')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'book';
}

/** Build a local HTML Field Book from cooked sources */
function buildBookHtml(book) {
  const chapters = book.chapters || [];
  const sources = book.sources || [];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${escapeHtml(book.title)}</title>
<style>
  body{margin:0;font-family:Georgia,serif;background:#f7f3ee;color:#1c1a17}
  header{padding:28px 32px;background:#121820;color:#f5f5f5}
  header p{margin:0 0 6px;font:500 11px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
  h1{margin:0;font:italic 400 32px/1.15 Georgia,serif}
  main{padding:28px 32px 48px;max-width:720px}
  .stage{font:500 12px/1.4 system-ui;color:#6f7888;margin:0 0 18px}
  h2{font:600 20px/1.25 system-ui;margin:28px 0 10px}
  .src{border-bottom:1px solid #e6ddd0;padding:12px 0}
  .src b{display:block;font:600 14px/1.3 system-ui}
  .src span{font:italic 400 14px/1.4 Georgia,serif;color:#5c564c}
  .ch{margin:0 0 8px;font:400 15px/1.5 Georgia,serif;color:#3a3530}
  .sims{margin:8px 0 0;padding:0;list-style:none}
  .sims li{font:500 13px/1.4 system-ui;color:#1d3a8a;padding:4px 0}
</style></head><body>
<header>
  <p>MindCraft · Field Book</p>
  <h1>${escapeHtml(book.title)}</h1>
</header>
<main>
  <p class="stage">Subject: ${escapeHtml(book.subjectLabel)} · ${sources.length} sources · learning graph spine</p>
  <h2>Sources</h2>
  ${sources.map((s) => `
    <div class="src">
      <b>${escapeHtml(s.name)}</b>
      <span>${escapeHtml(s.prompt || 'No prompt tagged')}</span>
    </div>`).join('')}
  <h2>Chapters</h2>
  ${chapters.map((c, i) => `
    <p class="ch"><strong>${i + 1}.</strong> ${escapeHtml(c.title)}</p>
    <ul class="sims">${(c.sims || []).map((m) => `<li>MicroSim · ${escapeHtml(m)}</li>`).join('')}</ul>
  `).join('')}
  <h2>Next</h2>
  <p class="ch">Wire this cook to MindCraft <code>ml/scripts/pipeline/</code> + McCreary intelligent-textbook skills for full generation across subjects.</p>
</main>
</body></html>`;
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

  /** @type {{ id: string, name: string, prompt: string, kind: string }[]} */
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
        <p class="studio-soft">Drop files and notes. Tag each with a prompt. The hawk builds a book like ACT Prep, for any subject.</p>
        <ol class="studio-steps">
          <li>Ingest sources</li>
          <li>Learning graph spine</li>
          <li>Chapters + MicroSims</li>
          <li>Append to your desk</li>
        </ol>
      </aside>
      <section class="studio-panel">
        <label class="studio-field">
          <span>Book title</span>
          <input type="text" data-studio-title maxlength="64" placeholder="e.g. Biology midterm" />
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
    });
    renderList();
  }

  async function cook() {
    if (cooking || !files.length) return;
    cooking = true;
    syncCook();
    const subject = SUBJECTS.find((s) => s.id === subjectSel?.value) || SUBJECTS[0];
    const title = (titleInput?.value || '').trim() || `${subject.label} Field Book`;
    const stages = [
      'Ingesting tagged sources…',
      'Building learning graph spine…',
      'Drafting chapters + MicroSim stubs…',
      'Binding Field Book instance…',
    ];
    for (const line of stages) {
      if (statusEl) statusEl.textContent = line;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 520));
    }

    const chapters = files.slice(0, 5).map((f, i) => ({
      title: f.prompt?.trim() || `From ${f.name}`,
      sims: [
        `${subject.label} explore ${i + 1}`,
        `Check understanding · ${f.name.replace(/\.[^.]+$/, '')}`,
      ],
    }));

    const book = {
      id: `book_${Date.now()}`,
      title,
      subject: subject.id,
      subjectLabel: subject.label,
      sources: files.map((f) => ({ name: f.name, kind: f.kind, prompt: f.prompt })),
      chapters,
      cookedAt: new Date().toISOString(),
      pipeline: ['ingest', 'learning_graph', 'chapters_microsims', 'bind_instance'],
      refs: {
        mccreary: 'https://dmccreary.github.io/intelligent-textbooks/case-studies/',
        mindcraft: 'ml/scripts/pipeline/',
      },
    };
    book.html = buildBookHtml(book);
    saveBook(book);

    const inst = {
      id: book.id,
      kind: 'act',
      bookId: book.id,
      name: slugify(title),
      label: title,
      blurb: `${subject.label} · ${files.length} sources · Field Book`,
      badge: subject.id === 'act_math' ? 'ACT' : 'Book',
      createdAt: book.cookedAt,
      status: 'ready',
    };

    cooking = false;
    if (statusEl) statusEl.textContent = 'Book ready · appended to Dashboard';
    syncCook();
    onCooked?.(inst, book);
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
