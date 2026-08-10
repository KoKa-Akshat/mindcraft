/* Field Desk proto · pan canvas + Connect + Kitchen overlay */

(() => {
  const viewport = document.getElementById('deskViewport');
  const plane = document.getElementById('deskPlane');
  const connectModal = document.getElementById('connectModal');
  const kitchenModal = document.getElementById('kitchenModal');
  const learnModal = document.getElementById('learnModal');
  const brandHit = document.getElementById('brandHit');
  const kitchenZone = document.getElementById('kitchenZone');
  const learnZone = document.getElementById('learnZone');

  if (!viewport || !plane) return;

  const state = {
    x: 0,
    y: 0,
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  };

  function clampPan() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const pw = plane.offsetWidth;
    const ph = plane.offsetHeight;
    const minX = Math.min(0, vw - pw);
    const minY = Math.min(0, vh - ph);
    state.x = Math.max(minX, Math.min(0, state.x));
    state.y = Math.max(minY, Math.min(0, state.y));
  }

  function apply() {
    clampPan();
    plane.style.transform = `translate(${state.x}px, ${state.y}px)`;
  }

  // Start slightly centered on the kitchen zone
  function bootPan() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    state.x = Math.round((vw - plane.offsetWidth) * 0.18);
    state.y = Math.round((vh - plane.offsetHeight) * 0.12);
    apply();
  }

  function pointerDown(e) {
    if (e.target.closest('button, a, input, .ghost-link')) return;
    state.dragging = true;
    state.moved = false;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.originX = state.x;
    state.originY = state.y;
    viewport.classList.add('is-panning');
    viewport.setPointerCapture?.(e.pointerId);
  }

  function pointerMove(e) {
    if (!state.dragging) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) state.moved = true;
    state.x = state.originX + dx;
    state.y = state.originY + dy;
    apply();
  }

  function pointerUp(e) {
    if (!state.dragging) return;
    state.dragging = false;
    viewport.classList.remove('is-panning');
    try {
      viewport.releasePointerCapture?.(e.pointerId);
    } catch { /* ignore */ }
  }

  viewport.addEventListener('pointerdown', pointerDown);
  viewport.addEventListener('pointermove', pointerMove);
  viewport.addEventListener('pointerup', pointerUp);
  viewport.addEventListener('pointercancel', pointerUp);

  // Wheel / trackpad pan
  viewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      state.x -= e.deltaX;
      state.y -= e.deltaY;
      apply();
    },
    { passive: false },
  );

  function openModal(el) {
    if (!el) return;
    el.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(el) {
    if (!el) return;
    el.hidden = true;
    const open =
      (connectModal && !connectModal.hidden) ||
      (kitchenModal && !kitchenModal.hidden) ||
      (learnModal && !learnModal.hidden);
    if (!open) document.body.style.overflow = '';
  }

  brandHit?.addEventListener('click', () => openModal(connectModal));

  document.querySelectorAll('[data-open-connect]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(connectModal);
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => closeModal(connectModal));
  });

  kitchenZone?.addEventListener('click', (e) => {
    if (state.moved) return;
    e.stopPropagation();
    openModal(kitchenModal);
  });

  learnZone?.addEventListener('click', (e) => {
    if (state.moved) return;
    e.stopPropagation();
    openModal(learnModal);
  });

  document.querySelectorAll('[data-close-kitchen]').forEach((el) => {
    el.addEventListener('click', () => closeModal(kitchenModal));
  });

  document.querySelectorAll('[data-close-learn]').forEach((el) => {
    el.addEventListener('click', () => closeModal(learnModal));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeModal(connectModal);
    closeModal(kitchenModal);
    closeModal(learnModal);
  });

  window.addEventListener('resize', () => {
    apply();
  });

  requestAnimationFrame(bootPan);
})();
