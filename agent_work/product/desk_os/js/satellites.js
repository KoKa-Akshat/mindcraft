/** Connected tools · small 3D orbs orbit the owl like satellites */

const ORB = {
  moodle: { src: 'img/orbs/binder.png', label: 'Moodle' },
  gmail: { src: 'img/orbs/mail.png', label: 'Mail' },
  gcal: { src: 'img/orbs/calendar.png', label: 'Calendar' },
};

/**
 * @param {{
 *   plane: HTMLElement,
 *   owl: HTMLElement,
 *   onOpen?: (id: string) => void,
 * }} opts
 */
export function createSatellites({ plane, owl, onOpen }) {
  /** @type {HTMLElement | null} */
  let ring = null;

  function ensureRing() {
    if (ring && plane.contains(ring)) return ring;
    ring = document.createElement('div');
    ring.className = 'sat-ring';
    ring.setAttribute('aria-hidden', 'false');
    plane.appendChild(ring);
    return ring;
  }

  function placeRing() {
    if (!owl || !ring) return;
    const pr = plane.getBoundingClientRect();
    const r = owl.getBoundingClientRect();
    const cx = r.left - pr.left + r.width / 2 + plane.scrollLeft;
    const cy = r.top - pr.top + r.height / 2 + plane.scrollTop;
    ring.style.left = `${cx}px`;
    ring.style.top = `${cy}px`;
  }

  /**
   * @param {string[]} ids connected connector ids
   */
  function sync(ids) {
    const root = ensureRing();
    const want = (ids || []).filter((id) => ORB[id]);
    root.innerHTML = '';
    if (!want.length) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const n = want.length;
    want.forEach((id, i) => {
      const meta = ORB[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sat-orb';
      btn.dataset.sat = id;
      btn.title = meta.label;
      btn.setAttribute('aria-label', meta.label);
      btn.style.setProperty('--sat-i', String(i));
      btn.style.setProperty('--sat-n', String(n));
      btn.style.setProperty('--sat-angle', `${(i / n) * 360}deg`);
      btn.innerHTML = `<img src="${meta.src}" alt="" draggable="false" />`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onOpen?.(id);
      });
      root.appendChild(btn);
    });
    placeRing();
  }

  plane.addEventListener('sheet:moved', placeRing);
  window.addEventListener('resize', placeRing);
  owl?.addEventListener('pointerup', () => requestAnimationFrame(placeRing));
  owl?.addEventListener('pointermove', () => {
    if (owl.dataset.dragBound === '1') placeRing();
  });

  return {
    sync,
    place: placeRing,
    redraw: placeRing,
  };
}
