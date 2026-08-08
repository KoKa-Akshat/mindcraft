/** Boot → instance hub → open desk / ACT · n8n-shaped flow */

import { BOOT_DIAGRAM_DELAY_MS, BOOT_HUB_DELAY_MS } from './actBook.js';

const INST_KEY = 'deskOs.instances';
const USER_KEY = 'deskOs.user';

export { BOOT_DIAGRAM_DELAY_MS, BOOT_HUB_DELAY_MS };

const DEFAULTS = [
  {
    id: 'desk_main',
    kind: 'desk',
    name: 'field-desk',
    label: 'Field Desk',
    badge: 'Desk',
    status: 'running',
    execUsed: 12,
    execCap: 1000,
  },
  {
    id: 'act_main',
    kind: 'act',
    name: 'act-fieldbook',
    label: 'ACT Field Book',
    badge: 'ACT',
    status: 'running',
    execUsed: 0,
    execCap: 1000,
  },
];

function fmtCount(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function loadInstances() {
  try {
    const raw = JSON.parse(localStorage.getItem(INST_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveInstances(list) {
  try {
    localStorage.setItem(INST_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveUser(u) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  } catch { /* ignore */ }
}

function ensureCatalog() {
  const list = loadInstances();
  const byId = new Map(list.map((x) => [x.id, x]));
  let changed = false;
  for (const d of DEFAULTS) {
    if (!byId.has(d.id)) {
      list.push({ ...d, createdAt: new Date().toISOString() });
      changed = true;
    } else {
      const cur = byId.get(d.id);
      if (!cur.kind) {
        Object.assign(cur, { kind: d.kind, badge: d.badge, label: d.label });
        changed = true;
      }
      // Catalog rename · act-prep → act-fieldbook
      if (cur.name !== d.name || cur.label !== d.label) {
        cur.name = d.name;
        cur.label = d.label;
        cur.badge = d.badge;
        changed = true;
      }
      if (cur.execCap == null) {
        cur.execUsed = d.execUsed;
        cur.execCap = d.execCap;
        changed = true;
      }
      if (cur.blurb) {
        delete cur.blurb;
        changed = true;
      }
    }
  }
  if (changed) saveInstances(list);
  return list;
}

/**
 * @param {{
 *   boot: HTMLElement,
 *   hub: HTMLElement,
 *   onOpenInstance: (inst: object) => void,
 *   onCreateInstance?: () => void,
 *   onSignOut: () => void,
 * }} opts
 */
const GOALS_KEY = 'deskOs.instanceGoals';
const GOAL_FOCUS_KEY = 'deskOs.goalFocus';

const GOALS_BY_KIND = {
  desk: [
    { id: 'tasks_today', label: 'Tasks for today' },
    { id: 'connect_tools', label: 'Connect school tools' },
    { id: 'mastery_topic', label: 'Mastery on a topic' },
    { id: 'file_notes', label: 'File class notes' },
  ],
  act: [
    { id: 'mastery_lesson', label: 'Mastery to a lesson' },
    { id: 'practice_set', label: 'Finish a practice set' },
    { id: 'score_target', label: 'Hit a score target' },
    { id: 'review_mistakes', label: 'Review mistakes' },
  ],
};

function greetWord() {
  const h = new Date().getHours();
  if (h < 12) return 'good morning';
  if (h < 18) return 'good afternoon';
  return 'good evening';
}

function loadGoals() {
  try {
    const raw = JSON.parse(localStorage.getItem(GOALS_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveGoals(map) {
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

/**
 * Honest mastery estimate for the focused instance.
 * Only a number when we have recorded evidence (check-in / practice).
 * Otherwise null → UI shows a dash.
 */
function masteryForInstance(inst) {
  if (!inst) return { pct: null, sure: false };
  const direct = Number(inst.masteryPct);
  if (Number.isFinite(direct) && direct >= 0) {
    const pct = Math.max(0, Math.min(100, Math.round(direct)));
    return { pct, sure: true };
  }
  try {
    const raw = JSON.parse(localStorage.getItem('deskOs.mastery') || 'null');
    if (
      raw &&
      raw.instanceId === inst.id &&
      raw.sure === true &&
      Number.isFinite(Number(raw.pct))
    ) {
      return { pct: Math.max(0, Math.min(100, Math.round(Number(raw.pct)))), sure: true };
    }
  } catch { /* ignore */ }
  return { pct: null, sure: false };
}

function goalOptionsFor(inst) {
  const kind = inst?.kind === 'act' ? 'act' : 'desk';
  return GOALS_BY_KIND[kind] || GOALS_BY_KIND.desk;
}

export function createBootHub({ boot, hub, onOpenInstance, onCreateInstance, onSignOut }) {
  const bootTitle = boot?.querySelector('[data-boot-title]');
  const bootDots = boot?.querySelector('[data-boot-dots]');
  const hubList = hub?.querySelector('[data-hub-list]');
  const hubName = hub?.querySelector('[data-hub-name]');
  const hubEmail = hub?.querySelector('[data-hub-email]');
  const hubFirst = hub?.querySelector('[data-hub-first]');
  const hubGreetWord = hub?.querySelector('[data-hub-greet-word]');
  const goalInstance = hub?.querySelector('[data-hub-goal-instance]');
  const goalType = hub?.querySelector('[data-hub-goal-type]');
  const goalEcho = hub?.querySelector('[data-hub-goal-echo]');
  const hubMasteryPct = hub?.querySelector('[data-hub-mastery-pct]');
  const tabBtns = [...(hub?.querySelectorAll('[data-hub-tab]') || [])];
  const panels = [...(hub?.querySelectorAll('[data-hub-panel]') || [])];

  function setUser(profile = {}) {
    const user = {
      name: profile.name || 'Akshat Koirala',
      email: profile.email || 'akoirala@macalester.edu',
      ...loadUser(),
      ...profile,
    };
    saveUser(user);
    if (hubName) hubName.textContent = user.name;
    if (hubEmail) hubEmail.textContent = user.email;
    if (hubFirst) hubFirst.textContent = String(user.name || 'there').split(/\s+/)[0];
    if (hubGreetWord) hubGreetWord.textContent = greetWord();
    return user;
  }

  function selectedInstance(list) {
    const id = goalInstance?.value || localStorage.getItem(GOAL_FOCUS_KEY) || list[0]?.id;
    return list.find((x) => x.id === id) || list[0] || null;
  }

  function paintGoalControls(list) {
    if (!goalInstance || !goalType) return;
    const goals = loadGoals();
    const focusId = localStorage.getItem(GOAL_FOCUS_KEY) || list[0]?.id || '';
    goalInstance.innerHTML = list.map((inst) => `
      <option value="${inst.id}" ${inst.id === focusId ? 'selected' : ''}>${inst.name}</option>
    `).join('');
    const inst = selectedInstance(list);
    const opts = goalOptionsFor(inst);
    const saved = inst ? goals[inst.id]?.type : '';
    const pick = opts.some((o) => o.id === saved) ? saved : opts[0]?.id;
    goalType.innerHTML = opts.map((o) => `
      <option value="${o.id}" ${o.id === pick ? 'selected' : ''}>${o.label}</option>
    `).join('');
    paintGoalEcho(inst, opts.find((o) => o.id === pick));
  }

  function paintGoalEcho(inst, goal) {
    if (!goalEcho) return;
    if (!inst || !goal) {
      goalEcho.textContent = 'Pick an instance, then a target for today.';
      return;
    }
    goalEcho.textContent = `${inst.name} → ${goal.label}`;
  }

  function persistGoal() {
    const list = ensureCatalog();
    const inst = selectedInstance(list);
    if (!inst || !goalType) return;
    const opts = goalOptionsFor(inst);
    const goal = opts.find((o) => o.id === goalType.value) || opts[0];
    const map = loadGoals();
    map[inst.id] = { type: goal.id, label: goal.label, at: new Date().toISOString() };
    saveGoals(map);
    try { localStorage.setItem(GOAL_FOCUS_KEY, inst.id); } catch { /* ignore */ }
    paintGoalEcho(inst, goal);
    paintMastery(list);
  }

  /** Honest estimate beside the cube · dash when we do not know */
  function paintMastery(list) {
    const inst = selectedInstance(list);
    const { pct, sure } = masteryForInstance(inst);
    if (hubMasteryPct) {
      if (sure && pct != null) {
        hubMasteryPct.textContent = `${pct}%`;
        hubMasteryPct.classList.remove('is-unknown');
      } else {
        hubMasteryPct.textContent = '—';
        hubMasteryPct.classList.add('is-unknown');
      }
    }
    try {
      localStorage.setItem('deskOs.mastery', JSON.stringify({
        instanceId: inst?.id || null,
        pct: sure ? pct : null,
        sure,
      }));
    } catch { /* ignore */ }
  }

  function renderHub() {
    const list = ensureCatalog();
    const user = setUser();
    if (hubName) hubName.textContent = user.name;
    if (hubEmail) hubEmail.textContent = user.email;
    paintGoalControls(list);
    paintMastery(list);
    if (!hubList) return;

    hubList.innerHTML = list.map((inst) => {
      const isAct = inst.kind === 'act';
      const used = Number(inst.execUsed ?? 0);
      const cap = Math.max(1, Number(inst.execCap ?? 1000));
      const pct = Math.min(100, Math.round((used / cap) * 100));
      const running = (inst.status || 'running') !== 'off';
      return `
      <article class="hub-card ${isAct ? 'is-act' : 'is-desk'}" data-inst="${inst.id}">
        <div class="hub-card-top">
          <span class="hub-card-gear" aria-hidden="true" title="Settings">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.5.42l-.36 2.54c-.6.24-1.15.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.48.39 1.03.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.8c.24 0 .45-.18.5-.42l.36-2.54c.6-.24 1.15-.55 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/></svg>
          </span>
          <span class="hub-card-badge ${isAct ? 'is-act' : ''}">${inst.badge || (isAct ? 'ACT' : 'Desk')}</span>
        </div>
        <div class="hub-card-main">
          <h2 class="hub-card-name">${inst.name}</h2>
          <button type="button" class="hub-open" data-open="${inst.id}">Open instance</button>
          <p class="hub-card-status">
            <span>${running ? 'Running' : 'Stopped'}</span>
            <span class="hub-dot ${running ? 'is-ready' : ''}" aria-hidden="true"></span>
          </p>
        </div>
        <div class="hub-card-exec">
          <p class="hub-exec-count"><strong>${fmtCount(used)}</strong> / ${fmtCount(cap)}</p>
          <div class="hub-exec-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
          <p class="hub-exec-label">Execution steps</p>
        </div>
      </article>`;
    }).join('') + `
      <button type="button" class="hub-card hub-card-new" data-create>
        <span class="hub-plus">+</span>
        <span>Create an instance</span>
      </button>
    `;

    hubList.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-open');
        const inst = list.find((x) => x.id === id) || list[0];
        onOpenInstance?.(inst);
      });
    });
    hubList.querySelector('[data-create]')?.addEventListener('click', () => {
      onCreateInstance?.();
    });
  }

  /** Append a cooked Field Book instance (like ACT) */
  function appendInstance(inst) {
    const list = ensureCatalog();
    if (list.some((x) => x.id === inst.id)) {
      renderHub();
      return list;
    }
    list.push(inst);
    saveInstances(list);
    renderHub();
    return list;
  }

  function showBoot() {
    if (!boot) return Promise.resolve();
    boot.hidden = false;
    boot.classList.remove('hidden');
    hub?.classList.add('hidden');
    if (hub) hub.hidden = true;
    if (bootTitle) bootTitle.textContent = 'Your workspace is starting up…';
    bootDots?.classList.add('is-pulse');
    const diagram = boot.querySelector('[data-boot-diagram]');
    diagram?.classList.remove('is-in');
    return new Promise((resolve) => {
      // Icons/arrows fade in after title
      window.setTimeout(() => {
        diagram?.classList.add('is-in');
      }, BOOT_DIAGRAM_DELAY_MS);
      // Short pause after diagram, then hub
      window.setTimeout(() => {
        bootDots?.classList.remove('is-pulse');
        resolve();
      }, BOOT_HUB_DELAY_MS);
    });
  }

  function showHub() {
    boot?.classList.add('hidden');
    if (boot) boot.hidden = true;
    if (!hub) return;
    hub.hidden = false;
    hub.classList.remove('hidden');
    renderHub();
  }

  function hideAll() {
    boot?.classList.add('hidden');
    hub?.classList.add('hidden');
    if (boot) boot.hidden = true;
    if (hub) hub.hidden = true;
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.hubTab;
      tabBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      panels.forEach((p) => {
        p.hidden = p.dataset.hubPanel !== tab;
      });
    });
  });

  hub?.querySelector('[data-hub-signout]')?.addEventListener('click', () => {
    onSignOut?.();
  });

  goalInstance?.addEventListener('change', () => {
    const list = ensureCatalog();
    try { localStorage.setItem(GOAL_FOCUS_KEY, goalInstance.value); } catch { /* ignore */ }
    paintGoalControls(list);
    paintMastery(list);
  });
  goalType?.addEventListener('change', () => persistGoal());

  async function runAfterAuth(profile) {
    setUser(profile || {});
    await showBoot();
    showHub();
  }

  return {
    runAfterAuth,
    showHub,
    showBoot,
    hideAll,
    renderHub,
    appendInstance,
    setUser,
  };
}
