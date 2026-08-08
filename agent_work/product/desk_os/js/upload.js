/** Upload preview sheet · convert with owl into writable dash notes */

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
 *   onConvert?: (ctx: { title: string, body: string, file: File, el: HTMLElement }) => void,
 * }} opts
 */
export function createUploadSurface({ plane, attachSheet, onConvert }) {
  /** @type {HTMLElement | null} */
  let active = null;

  function open(file, meta = {}) {
    if (!plane || !file) return null;
    if (active) {
      active.remove();
      active = null;
    }

    const title = meta.title || file.name.replace(/\.[^.]+$/, '') || 'Upload';
    const course = meta.courseName || 'Unsorted';
    const isImage = /^image\//.test(file.type);
    const url = isImage ? URL.createObjectURL(file) : '';

    const el = document.createElement('aside');
    el.className = 'paper-sheet upload-sheet';
    el.dataset.sheet = `up_${Date.now().toString(36)}`;
    el.style.left = '22%';
    el.style.top = '16%';
    el.style.width = '520px';
    el.style.height = '420px';
    el.innerHTML = `
      <div class="page-grain" aria-hidden="true"></div>
      <div class="margin-rule" aria-hidden="true"></div>
      <header class="upload-head sheet-chrome">
        <p class="page-kicker">upload</p>
        <span class="upload-meta">${escapeHtml(course)}</span>
      </header>
      <h2 class="upload-title">${escapeHtml(title)}</h2>
      <div class="upload-preview" data-preview>
        ${isImage
    ? `<img src="${url}" alt="" />`
    : `<p class="upload-file-name">${escapeHtml(file.name)}</p><p class="upload-file-kind">${escapeHtml(file.type || 'file')} · ${Math.round(file.size / 1024)} KB</p>`}
      </div>
      <footer class="upload-foot">
        <button type="button" class="boop-primary" data-convert>
          <span class="hl">Owl converts to notes</span>
        </button>
      </footer>
    `;

    plane.appendChild(el);
    attachSheet?.(el);
    active = el;

    el.querySelector('[data-convert]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onConvert?.({
        title,
        body: meta.snippet || title,
        file,
        el,
        meta,
      });
    });

    el.addEventListener('sheet:closed', () => {
      if (url) URL.revokeObjectURL(url);
      if (active === el) active = null;
    });

    return el;
  }

  return { open };
}

/** Dash-format writable notes from an upload / owl convert */
export function spawnDashNotes({ plane, attachSheet, title, lines }) {
  if (!plane) return null;
  const el = document.createElement('aside');
  el.className = 'paper-sheet note-sheet dash-notes';
  el.dataset.sheet = `dash_${Date.now().toString(36)}`;
  el.style.left = '55%';
  el.style.top = '22%';
  el.style.width = '300px';
  el.style.height = '280px';
  const starter = (lines || []).slice(0, 5);
  el.innerHTML = `
    <div class="page-grain" aria-hidden="true"></div>
    <div class="margin-rule slim" aria-hidden="true"></div>
    <p class="page-kicker sheet-chrome">${escapeHtml(title || 'notes')}</p>
    <ol class="note-lines">
      ${starter.map((t, i) => `<li><span class="n">${i + 1} |</span><span class="t">${escapeHtml(t)}</span></li>`).join('')}
    </ol>
    <input class="note-input" type="text" maxlength="72" placeholder="1 | memo…" autocomplete="off" />
  `;
  plane.appendChild(el);
  attachSheet?.(el);

  const list = el.querySelector('.note-lines');
  const input = el.querySelector('.note-input');
  let rows = [...starter];
  const render = () => {
    if (!list) return;
    list.innerHTML = rows.map((t, i) => (
      `<li data-i="${i}"><span class="n">${i + 1} |</span><span class="t">${escapeHtml(t)}</span></li>`
    )).join('');
    list.querySelectorAll('li').forEach((li) => {
      li.addEventListener('click', () => {
        const i = Number(li.dataset.i);
        rows = rows.filter((_, idx) => idx !== i);
        render();
      });
    });
  };
  input?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const t = input.value.trim();
    if (!t || rows.length >= 8) return;
    rows.push(t);
    input.value = '';
    render();
  });
  render();
  return el;
}
