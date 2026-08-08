/** Gate scroll choreography · wheel near Continue inks the page */

export function createGate({
  gate,
  page,
  authBlock,
  hint,
  onEnter,
}) {
  if (!gate || !page) return { destroy() {} };

  let focus = 0; // 0..1 how "ready" the primary action feels
  let ticking = false;

  const primary = authBlock?.querySelector('[data-enter]') || authBlock?.querySelector('.auth-primary');
  const quiets = [...(authBlock?.querySelectorAll('.auth-quiet') || [])];

  function paint() {
    page.style.setProperty('--gate-focus', focus.toFixed(3));
    page.classList.toggle('is-ready', focus > 0.55);
    if (primary) {
      primary.style.setProperty('--press', Math.min(1, focus).toFixed(3));
    }
    quiets.forEach((btn, i) => {
      const t = Math.max(0, focus - 0.15 - i * 0.08);
      btn.style.opacity = String(0.45 + t * 0.55);
      btn.style.transform = `translateY(${(1 - Math.min(1, t)) * 6}px)`;
    });
    if (hint) {
      hint.style.opacity = String(Math.max(0, 0.7 - focus));
    }
  }

  function nearAuth(clientY) {
    if (!authBlock) return false;
    const r = authBlock.getBoundingClientRect();
    const pad = 120;
    return clientY >= r.top - pad && clientY <= r.bottom + pad;
  }

  const onWheel = (e) => {
    if (!nearAuth(e.clientY) && !page.matches(':hover')) return;
    e.preventDefault();
    const delta = Math.max(-28, Math.min(28, e.deltaY));
    // scroll down = commitment; scroll up = ease off
    focus = Math.max(0, Math.min(1, focus + delta * 0.012));
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        paint();
        ticking = false;
      });
    }
    // overscroll commit
    if (focus >= 0.98 && delta > 0) {
      focus = 1;
      paint();
      onEnter?.('scroll');
    }
  };

  const enter = (method) => {
    page.classList.add('is-opening');
    window.setTimeout(() => onEnter?.(method), 420);
  };

  authBlock?.querySelectorAll('[data-enter]').forEach((btn) => {
    btn.addEventListener('click', () => enter(btn.dataset.enter));
  });

  gate.addEventListener('wheel', onWheel, { passive: false });

  // gentle idle breathe on highlighter
  let idle = 0;
  const idleTimer = window.setInterval(() => {
    if (focus > 0.2) return;
    idle = (idle + 1) % 120;
    const pulse = 0.5 + Math.sin(idle / 18) * 0.08;
    page.style.setProperty('--hl-breathe', pulse.toFixed(3));
  }, 40);

  paint();

  return {
    enter,
    destroy() {
      gate.removeEventListener('wheel', onWheel);
      clearInterval(idleTimer);
    },
  };
}
