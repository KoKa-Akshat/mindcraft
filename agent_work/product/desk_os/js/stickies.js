/** Memo pad · Enter saves as 1 | … · max 5 */

const MAX = 5;
const KEY = 'deskOs.noteLines';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function save(lines) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines.slice(0, MAX)));
  } catch { /* ignore */ }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createStickies({ linesEl, inputEl }) {
  const listEl = linesEl || document.getElementById('noteLines');
  const input = inputEl || document.getElementById('noteInput');
  let lines = load();

  function render() {
    if (!listEl) return;
    listEl.innerHTML = lines.map((t, i) => `
      <li data-i="${i}" title="Click to remove">
        <span class="n">${i + 1} |</span>
        <span class="t">${escapeHtml(t)}</span>
      </li>
    `).join('');
    listEl.querySelectorAll('li').forEach((li) => {
      li.addEventListener('click', () => {
        const i = Number(li.dataset.i);
        lines = lines.filter((_, idx) => idx !== i);
        save(lines);
        render();
      });
    });
    if (input) {
      input.disabled = lines.length >= MAX;
      input.placeholder = lines.length >= MAX ? '5 memos max' : '1 | memo…';
    }
  }

  function add(text) {
    const t = String(text || '').trim();
    if (!t || lines.length >= MAX) return;
    lines = [...lines, t].slice(0, MAX);
    save(lines);
    render();
  }

  input?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    add(input.value);
    input.value = '';
  });

  render();
  return { render, add };
}
