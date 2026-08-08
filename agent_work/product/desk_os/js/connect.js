/** Owl node · simple n8n-style links to desk sheets */

function enableOwlDrag(owl, onMoved) {
  if (!owl || owl.dataset.dragBound === '1') return;
  owl.dataset.dragBound = '1';
  let moved = false;

  owl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    moved = false;
    // Drag in plane-local px · divide screen delta by current space scale
    const parent = owl.offsetParent || owl.parentElement;
    const baseLeft = owl.offsetLeft;
    const baseTop = owl.offsetTop;
    owl.style.left = `${baseLeft}px`;
    owl.style.top = `${baseTop}px`;
    const sx = e.clientX;
    const sy = e.clientY;
    const planeScale = () => {
      const t = getComputedStyle(parent).transform;
      if (!t || t === 'none') return 1;
      const m = t.match(/matrix\(([^)]+)\)/);
      if (!m) return 1;
      const p = m[1].split(',').map(Number);
      return Math.hypot(p[0], p[1]) || 1;
    };

    const onMove = (ev) => {
      const s = planeScale() || 1;
      const dx = (ev.clientX - sx) / s;
      const dy = (ev.clientY - sy) / s;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      owl.style.left = `${baseLeft + dx}px`;
      owl.style.top = `${baseTop + dy}px`;
      onMoved?.();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      owl.dataset.justDragged = moved ? '1' : '0';
      onMoved?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

/**
 * @param {{
 *   plane: HTMLElement,
 *   owl: HTMLElement,
 *   svg: SVGSVGElement,
 *   hint?: HTMLElement | null,
 *   prompt?: HTMLElement | null,
 *   onLink?: (sheetId: string, el: HTMLElement) => void,
 * }} opts
 */
export function createOwlLinks({ plane, owl, svg, hint, prompt, onLink }) {
  /** @type {Map<string, HTMLElement>} */
  const links = new Map();
  let armed = false;

  /** Plane-local coords · survive space scale (getBoundingClientRect does not) */
  function sheetCenter(el) {
    return {
      x: el.offsetLeft + el.offsetWidth / 2,
      y: el.offsetTop + el.offsetHeight / 2,
    };
  }

  function owlPort() {
    return {
      x: owl.offsetLeft + owl.offsetWidth - 4,
      y: owl.offsetTop + owl.offsetHeight / 2,
    };
  }

  function redraw() {
    if (!svg) return;
    // Keep SVG viewport = plane layout box so paths track zoom/pan with the world
    svg.setAttribute('width', String(plane.clientWidth || 0));
    svg.setAttribute('height', String(plane.clientHeight || 0));
    svg.setAttribute('viewBox', `0 0 ${plane.clientWidth || 0} ${plane.clientHeight || 0}`);
    const parts = [];
    const from = owlPort();
    links.forEach((el) => {
      if (el.hidden) return;
      const to = sheetCenter(el);
      const mx = (from.x + to.x) / 2;
      parts.push(
        `<path d="M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}" />`,
      );
    });
    svg.innerHTML = parts.join('');
  }

  function placeHint() {
    if (!hint || hint.hidden) return;
    hint.style.left = `${owl.offsetLeft + owl.offsetWidth + 12}px`;
    hint.style.top = `${owl.offsetTop + owl.offsetHeight / 2 - 8}px`;
  }

  function placePrompt() {
    if (!prompt || prompt.hidden) return;
    prompt.style.left = `${Math.max(8, owl.offsetLeft)}px`;
    prompt.style.top = `${owl.offsetTop + owl.offsetHeight + 10}px`;
  }

  function setPromptOpen(on) {
    if (!prompt) return;
    prompt.hidden = !on;
    if (on) placePrompt();
  }

  function setArmed(on) {
    armed = on;
    owl.classList.toggle('is-linking', on);
    plane.classList.toggle('owl-linking', on);
    if (hint) {
      hint.hidden = !on;
      placeHint();
    }
  }

  function linkSheet(el) {
    if (!el?.dataset?.sheet) return;
    const id = el.dataset.sheet;
    if (links.has(id)) {
      links.delete(id);
    } else {
      links.set(id, el);
      onLink?.(id, el);
    }
    setArmed(false);
    redraw();
  }

  /** Link without toggle-off (desk boot wiring) */
  function ensureLink(el) {
    if (!el?.dataset?.sheet || el.hidden) return;
    links.set(el.dataset.sheet, el);
    redraw();
  }

  enableOwlDrag(owl, () => {
    redraw();
    placeHint();
    placePrompt();
  });

  owl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (owl.dataset.justDragged === '1') {
      owl.dataset.justDragged = '0';
      return;
    }
    // Keep connect arming · also open the instance prompt under the owl
    setArmed(!armed);
    setPromptOpen(true);
  });

  prompt?.querySelector('[data-owl-prompt-close]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setPromptOpen(false);
  });

  plane.addEventListener('click', (e) => {
    if (!armed) return;
    const sheet = e.target.closest('.paper-sheet[data-sheet]');
    if (!sheet || sheet === owl) return;
    e.stopPropagation();
    linkSheet(sheet);
  });

  plane.addEventListener('sheet:moved', redraw);
  plane.addEventListener('sheet:resized', redraw);
  plane.addEventListener('sheet:closed', (e) => {
    const el = e.target;
    if (el?.dataset?.sheet) links.delete(el.dataset.sheet);
    redraw();
  });

  window.addEventListener('resize', redraw);
  const ro = new ResizeObserver(redraw);
  ro.observe(plane);

  return {
    redraw,
    linkSheet,
    ensureLink,
    placePrompt,
    openPrompt() {
      setPromptOpen(true);
    },
    closePrompt() {
      setPromptOpen(false);
    },
    getLinked() {
      return [...links.values()];
    },
    isArmed() {
      return armed;
    },
    clearArm() {
      setArmed(false);
    },
  };
}
