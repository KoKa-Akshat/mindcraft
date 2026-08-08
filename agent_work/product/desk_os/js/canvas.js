/** Canvas cards: expansive, scrollable, iPad-friendly. */

const CARD_W = 280;
const CARD_H = 168;
const GAP = 28;
const PAD = 48;

export function createCardEl(card, { onSelect, onDragEnd, onMove }) {
  const el = document.createElement('article');
  el.className = `canvas-card type-${card.type}${card.selected ? ' selected' : ''}`;
  el.dataset.id = card.id;
  el.style.left = `${card.x}px`;
  el.style.top = `${card.y}px`;
  el.innerHTML = cardHtml(card);

  let dragging = false;
  let ox = 0;
  let oy = 0;
  let startX = 0;
  let startY = 0;

  const onPointerDown = (e) => {
    if (e.target.closest('button, select, a, input, textarea')) return;
    dragging = true;
    el.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    ox = card.x;
    oy = card.y;
    el.classList.add('dragging');
    onSelect?.(card.id);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    card.x = Math.max(PAD / 2, ox + dx);
    card.y = Math.max(PAD / 2, oy + dy);
    el.style.left = `${card.x}px`;
    el.style.top = `${card.y}px`;
    onMove?.(card);
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    onDragEnd?.(card);
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('click', (e) => {
    if (e.target.closest('button, select')) return;
    onSelect?.(card.id);
  });

  return el;
}

function whisperFor(card) {
  if (card.type === 'due') return card.whenLabel || card.dateLabel || '';
  if (card.type === 'mail' || card.type === 'draft') {
    return [card.courseName, card.from].filter(Boolean).join(' · ');
  }
  if (card.type === 'transcript') return card.courseName || 'Class';
  if (card.type === 'file') {
    return [card.courseName, card.unit].filter(Boolean).join(' · ');
  }
  if (card.type === 'processing') return card.subtitle || 'Filing…';
  return card.courseName || '';
}

function cardHtml(card) {
  const whisper = whisperFor(card);
  const whenClass = card.type === 'due' ? ' when' : '';
  return `
    <span class="dot" aria-hidden="true"></span>
    <h3>${escape(card.title || 'Untitled')}</h3>
    ${whisper ? `<p class="whisper${whenClass}">${escape(whisper)}</p>` : ''}
  `;
}

function escape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Grow canvas so cards always have room to roam + scroll. */
export function sizeCanvas(canvasEl, cards, viewport = { w: 1200, h: 800 }) {
  let maxX = viewport.w * 2.2;
  let maxY = viewport.h * 2.2;
  for (const c of cards) {
    maxX = Math.max(maxX, (c.x || 0) + CARD_W + 480);
    maxY = Math.max(maxY, (c.y || 0) + CARD_H + 480);
  }
  canvasEl.style.width = `${Math.ceil(maxX)}px`;
  canvasEl.style.height = `${Math.ceil(maxY)}px`;
  return { w: maxX, h: maxY };
}

/** Place in first free grid cell, spreading across a wide field. */
export function nextSlot(cards, base = { x: PAD, y: PAD }) {
  const cols = 6;
  const occupied = new Set(
    cards
      .filter((c) => c.type !== 'processing')
      .map((c) => {
        const col = Math.round(((c.x || 0) - base.x) / (CARD_W + GAP));
        const row = Math.round(((c.y || 0) - base.y) / (CARD_H + GAP));
        return `${col},${row}`;
      }),
  );
  for (let i = 0; i < 200; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const key = `${col},${row}`;
    if (occupied.has(key)) continue;
    return {
      x: base.x + col * (CARD_W + GAP),
      y: base.y + row * (CARD_H + GAP),
    };
  }
  const n = cards.length;
  return {
    x: base.x + (n % cols) * (CARD_W + GAP),
    y: base.y + Math.floor(n / cols) * (CARD_H + GAP),
  };
}

export { CARD_W, CARD_H, GAP, PAD };
