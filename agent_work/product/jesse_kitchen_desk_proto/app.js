/* Field Desk proto · pan canvas + Connect + live 3D Jesse Kitchen (worlds/world2) */

(() => {
  const viewport = document.getElementById('deskViewport');
  const plane = document.getElementById('deskPlane');
  const connectModal = document.getElementById('connectModal');
  const learnModal = document.getElementById('learnModal');
  const brandHit = document.getElementById('brandHit');
  const kitchenZone = document.getElementById('kitchenZone');
  const learnZone = document.getElementById('learnZone');
  const deskLayer = document.getElementById('deskLayer');
  const worldLayer = document.getElementById('worldLayer');
  const worldBack = document.getElementById('worldBack');
  const kitchenFrame = document.getElementById('kitchenFrame');
  const worldLoading = document.getElementById('worldLoading');

  if (!viewport || !plane) return;

  /**
   * Resolve the 3D world URL.
   * Prefer local worlds/world2 when this page is served from the MindCraft repo root.
   * Fall back to the deployed Firebase world host so the proto still demos from a shallow server.
   */
  function kitchenWorldUrl() {
    const { protocol, hostname, port, pathname } = window.location;
    const localish = hostname === 'localhost' || hostname === '127.0.0.1';
    // Served from repo root: /agent_work/product/jesse_kitchen_desk_proto/
    if (localish && pathname.includes('/agent_work/product/jesse_kitchen_desk_proto')) {
      return `${protocol}//${hostname}${port ? `:${port}` : ''}/worlds/world2/index.html`;
    }
    // Relative climb when proto folder is opened under a parent static server
    if (localish) {
      return new URL('../../../worlds/world2/index.html', window.location.href).href;
    }
    return 'https://mindcraft-world1.web.app/';
  }

  const state = {
    x: 0,
    y: 0,
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    worldLoaded: false,
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
      (learnModal && !learnModal.hidden);
    if (!open) document.body.style.overflow = '';
  }

  function openKitchenWorld() {
    if (!worldLayer || !deskLayer || !kitchenFrame) return;
    deskLayer.classList.remove('is-on');
    deskLayer.hidden = true;
    worldLayer.hidden = false;
    worldLayer.classList.add('is-on');
    if (worldLoading) worldLoading.hidden = false;

    const url = kitchenWorldUrl();
    if (!state.worldLoaded || kitchenFrame.src !== url) {
      kitchenFrame.src = url;
      state.worldLoaded = true;
    }
  }

  function closeKitchenWorld() {
    if (!worldLayer || !deskLayer) return;
    worldLayer.classList.remove('is-on');
    worldLayer.hidden = true;
    deskLayer.hidden = false;
    deskLayer.classList.add('is-on');
    // Keep iframe warm so re-entry is instant; unload only if you need GPU back:
    // kitchenFrame.removeAttribute('src'); state.worldLoaded = false;
  }

  kitchenFrame?.addEventListener('load', () => {
    if (worldLoading) worldLoading.hidden = true;
  });

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
    openKitchenWorld();
  });

  worldBack?.addEventListener('click', () => closeKitchenWorld());

  learnZone?.addEventListener('click', (e) => {
    if (state.moved) return;
    e.stopPropagation();
    openModal(learnModal);
  });

  document.querySelectorAll('[data-close-learn]').forEach((el) => {
    el.addEventListener('click', () => closeModal(learnModal));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (worldLayer && !worldLayer.hidden) {
      closeKitchenWorld();
      return;
    }
    closeModal(connectModal);
    closeModal(learnModal);
  });

  window.addEventListener('resize', () => {
    apply();
  });

  requestAnimationFrame(bootPan);
})();
