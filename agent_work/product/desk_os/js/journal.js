/** Binder / ACT / guide focus · fills desk; − or × restores (no stuck veil) */

/**
 * @param {{ plane: HTMLElement }} opts
 */
export function createJournalFocus({ plane }) {
  /** @type {HTMLElement | null} */
  let focused = null;
  /** @type {Map<HTMLElement, { left: string, top: string, width: string, height: string, z: string, transform: string }>} */
  const stash = new Map();
  /** @type {WeakMap<HTMLElement, () => void>} */
  const onExitMap = new WeakMap();

  function others() {
    return [...plane.querySelectorAll('.paper-sheet, .owl-logo')].filter((el) => el !== focused);
  }

  function clearVeil() {
    plane.classList.remove('is-journal-focus');
    delete plane.dataset.focusMode;
    plane.querySelectorAll('.page-away').forEach((el) => {
      el.classList.remove('page-away');
      el.style.removeProperty('--away-i');
    });
  }

  /**
   * @param {HTMLElement} el
   * @param {{ mode?: 'book' | 'act' | 'sheet' }} [opts]
   */
  function enter(el, opts = {}) {
    if (!plane || !el) return;
    if (focused === el) return;
    if (focused) exit();

    const mode = opts.mode || (el.dataset.sheet === 'binder' ? 'book'
      : el.dataset.sheet === 'act' || el.dataset.sheet === 'fieldbook' ? 'act'
        : 'sheet');

    focused = el;
    stash.clear();
    stash.set(el, {
      left: el.style.left,
      top: el.style.top,
      width: el.style.width,
      height: el.style.height,
      z: el.style.zIndex,
      transform: el.style.transform || '',
    });

    others().forEach((o, i) => {
      stash.set(o, {
        left: o.style.left,
        top: o.style.top,
        width: o.style.width,
        height: o.style.height,
        z: o.style.zIndex,
        transform: o.style.transform || '',
      });
      o.classList.add('page-away');
      o.style.setProperty('--away-i', String(i));
    });

    plane.classList.add('is-journal-focus');
    plane.dataset.focusMode = mode;
    el.classList.add('is-journal-open');
    el.classList.remove('is-min', 'page-away');
    el.hidden = false;
    el.style.left = '50%';
    el.style.top = '50%';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.zIndex = '40';

    if (mode === 'book') {
      el.style.width = 'min(1040px, 96vw)';
      el.style.height = 'min(90vh, 820px)';
    } else if (mode === 'act') {
      // Full-desk mission · almost the whole viewport
      el.style.width = 'min(1320px, calc(100vw - 28px))';
      el.style.height = 'min(960px, calc(100vh - 52px))';
    } else {
      el.style.width = 'min(560px, 90vw)';
      el.style.height = 'min(72vh, 560px)';
    }
  }

  /**
   * @param {{ hideFocus?: boolean }} [opts]
   */
  function exit(opts = {}) {
    const el = focused;
    if (!el) {
      clearVeil();
      return;
    }

    clearVeil();
    el.classList.remove('is-journal-open');

    stash.forEach((s, node) => {
      node.classList.remove('page-away');
      node.style.left = s.left;
      node.style.top = s.top;
      node.style.width = s.width;
      node.style.height = s.height;
      node.style.zIndex = s.z;
      node.style.transform = s.transform;
      node.style.removeProperty('--away-i');
    });
    stash.clear();
    focused = null;

    if (opts.hideFocus || el.dataset.sheet?.startsWith('guide_')) {
      el.hidden = true;
    } else {
      el.hidden = false;
    }

    onExitMap.get(el)?.();
    plane.dispatchEvent(new CustomEvent('sheet:moved', { bubbles: true }));
  }

  /**
   * @param {HTMLElement} el
   * @param {{ clickOpen?: boolean, mode?: 'book' | 'act' | 'sheet', except?: string, onExit?: () => void }} [opts]
   */
  function wireSheet(el, opts = {}) {
    if (!el) return;
    if (opts.mode) el.dataset.focusMode = opts.mode;
    if (typeof opts.onExit === 'function') onExitMap.set(el, opts.onExit);

    // Allow a later call to upgrade clickOpen (attachSheet wires chrome first)
    if (opts.clickOpen && el.dataset.focusClick !== '1') {
      el.dataset.focusClick = '1';
      const except = opts.except
        || 'input, textarea, button, a, .sheet-win, .warm-choices, .note-input';
      el.addEventListener('click', (e) => {
        if (focused === el) return;
        if (e.target.closest(except)) return;
        e.stopPropagation();
        enter(el, { mode: opts.mode || el.dataset.focusMode || 'sheet' });
      });
    }

    if (el.dataset.focusBound === '1') return;
    el.dataset.focusBound = '1';

    // − restore desk · × restore + dismiss focus sheet (guides)
    el.addEventListener('click', (e) => {
      if (focused !== el) return;
      const min = e.target.closest('[data-sheet-act="min"]');
      const close = e.target.closest('[data-sheet-act="close"]');
      if (!min && !close) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      exit({ hideFocus: Boolean(close) });
      if (close) {
        el.dispatchEvent(new CustomEvent('sheet:closed', { bubbles: true }));
      }
    }, true);
  }

  // Safety: any close that slips through still clears the blackout
  plane.addEventListener('sheet:closed', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (focused === t || plane.classList.contains('is-journal-focus') && t.classList.contains('is-journal-open')) {
      exit({ hideFocus: true });
    }
  });

  return {
    enter,
    exit,
    wireSheet,
    clearVeil,
    isOpen: () => Boolean(focused),
    getFocused: () => focused,
  };
}
