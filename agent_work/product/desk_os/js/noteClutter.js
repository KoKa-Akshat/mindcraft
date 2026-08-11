/** Front-of-desk note clutter · visible scraps, no motion */

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SCRAPS = [
  {
    id: 'scrap_a',
    kicker: 'scratch',
    left: '18%',
    top: '22%',
    w: '200px',
    h: '150px',
    rot: '-3.5deg',
    lines: ['Chem lab writeup', 'Ask about moles'],
  },
  {
    id: 'scrap_b',
    kicker: 'later',
    left: '44%',
    top: '18%',
    w: '188px',
    h: '140px',
    rot: '2.8deg',
    lines: ['Email Ms. R', 'Bring calc'],
  },
  {
    id: 'scrap_c',
    kicker: 'inbox',
    left: '52%',
    top: '38%',
    w: '210px',
    h: '156px',
    rot: '-1.6deg',
    lines: ['History outline', 'Fri quiz?'],
  },
];

/**
 * @param {{
 *   plane: HTMLElement,
 *   attachSheet?: (el: HTMLElement) => void,
 * }} opts
 */
export function placeNoteClutter({ plane, attachSheet }) {
  if (!plane) return [];
  const out = [];

  for (const scrap of SCRAPS) {
    let el = plane.querySelector(`[data-sheet="${scrap.id}"]`);
    if (!el) {
      el = document.createElement('aside');
      el.className = 'paper-sheet note-sheet note-scrap';
      el.dataset.sheet = scrap.id;
      el.style.left = scrap.left;
      el.style.top = scrap.top;
      el.style.width = scrap.w;
      el.style.height = scrap.h;
      el.style.transform = `rotate(${scrap.rot})`;
      el.style.zIndex = '18';
      el.innerHTML = `
        <p class="page-kicker sheet-chrome">${escapeHtml(scrap.kicker)}</p>
        <ol class="note-lines">
          ${scrap.lines.map((t, i) => `
            <li><span class="n">${i + 1} |</span><span class="t">${escapeHtml(t)}</span></li>
          `).join('')}
        </ol>
      `;
      plane.appendChild(el);
      attachSheet?.(el);
    }
    el.hidden = false;
    el.classList.remove('is-min');
    out.push(el);
  }

  // Main memo up front
  const memo = plane.querySelector('[data-sheet="notes"]');
  if (memo) {
    memo.style.left = '38%';
    memo.style.top = '28%';
    memo.style.width = '240px';
    memo.style.height = '200px';
    memo.style.zIndex = '20';
    memo.style.transform = 'rotate(1.1deg)';
    memo.hidden = false;
    memo.classList.remove('is-min');
  }

  return out;
}
