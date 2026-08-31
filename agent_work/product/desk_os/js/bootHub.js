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
    seed: 'act',
    status: 'running',
    execUsed: 0,
    execCap: 1000,
  },
  {
    id: 'piano_main',
    kind: 'piano',
    name: 'piano-book',
    label: 'Piano Field Book',
    badge: 'Piano',
    seed: 'piano',
    status: 'running',
    execUsed: 0,
    execCap: 1000,
  },
];

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
      // Catalog rename · act-prep → act-fieldbook · keep seed pointers fresh
      if (cur.name !== d.name || cur.label !== d.label || cur.badge !== d.badge || cur.kind !== d.kind) {
        cur.name = d.name;
        cur.label = d.label;
        cur.badge = d.badge;
        cur.kind = d.kind;
        changed = true;
      }
      if (d.seed && cur.seed !== d.seed) {
        cur.seed = d.seed;
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
  piano: [
    { id: 'hand_position', label: 'Steady hand position' },
    { id: 'five_finger', label: 'Clean five-finger run' },
    { id: 'learn_motif', label: 'Learn a short motif' },
    { id: 'daily_reps', label: 'Daily practice reps' },
  ],
  book: [
    { id: 'finish_chapter', label: 'Finish a chapter' },
    { id: 'mastery_topic', label: 'Mastery on a topic' },
    { id: 'review_notes', label: 'Review notes' },
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
  const kind = inst?.kind || 'desk';
  return GOALS_BY_KIND[kind] || GOALS_BY_KIND.desk;
}

export function createBootHub({ boot, hub, onOpenInstance, onCreateInstance, onSignOut }) {
  const bootTitle = boot?.querySelector('[data-boot-title]');
  const bootDots = boot?.querySelector('[data-boot-dots]');
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
        hubMasteryPct.textContent = '--';
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

  // Instance-card rendering (the old "Your instances" grid, `[data-hub-list]`)
  // was removed 2026-08-31 -- the instances concept is dropped from the hub,
  // not just hidden, and "Tutors nearby" now sits where it used to. The
  // catalog itself (ensureCatalog/list) stays: it still backs the Mastery
  // goal-instance picker (paintGoalControls) and mastery readout
  // (paintMastery) just above where the grid used to be. onOpenInstance and
  // onCreateInstance are unused now that their only trigger buttons
  // (`[data-open]` / `[data-create]`) are gone with the grid -- kept as
  // no-op-safe params rather than changing createBootHub's call signature
  // in app.js, which is outside this audit's scope.
  function renderHub() {
    const list = ensureCatalog();
    const user = setUser();
    if (hubName) hubName.textContent = user.name;
    if (hubEmail) hubEmail.textContent = user.email;
    paintGoalControls(list);
    paintMastery(list);
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
