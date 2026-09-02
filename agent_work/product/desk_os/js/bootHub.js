/** Boot → instance hub → open desk / ACT · n8n-shaped flow */

import { BOOT_DIAGRAM_DELAY_MS, BOOT_HUB_DELAY_MS } from './actBook.js';
import { getRole } from './onboarding.js';

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

export function createBootHub({ boot, hub, onOpenInstance, onCreateInstance, onSignOut, onResumeOpen, onMapOpen }) {
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
  const masteryNav = hub?.querySelector('[data-hub-mastery-nav]');
  const masteryCube = hub?.querySelector('.hub-cube');
  const jesseNav = hub?.querySelector('[data-hub-jesse-nav]');
  const tutorTiles = hub?.querySelector('[data-hub-tutor-tiles]');
  const jesseBox = hub?.querySelector('[data-jesse-scene]');
  const jesseOwl = hub?.querySelector('.jesse-owl');
  const jesseStageName = hub?.querySelector('[data-jesse-stage-name]');
  const jesseCountEl = hub?.querySelector('[data-jesse-count]');
  const tabBtns = [...(hub?.querySelectorAll('[data-hub-tab]') || [])];
  const panels = [...(hub?.querySelectorAll('[data-hub-panel]') || [])];

  // No hardcoded fallback identity here (this used to default to the
  // founder's own name/email, meaning every real student saw
  // "Akshat Koirala" / his email on their own hub whenever setUser() ran
  // with no profile, e.g. renderHub()'s bare setUser() call, or the local
  // demo onboarding path before a real profile was ever known). Falls back
  // to whatever was last persisted (loadUser()), and only to a neutral
  // placeholder if nothing has ever been saved.
  function setUser(profile = {}) {
    const user = {
      name: 'Student',
      email: '',
      ...loadUser(),
      ...profile,
    };
    saveUser(user);
    if (hubName) hubName.textContent = user.name;
    if (hubEmail) hubEmail.textContent = user.email;
    if (hubFirst) hubFirst.textContent = String(user.name || 'there').split(/\s+/)[0];
    if (hubGreetWord) hubGreetWord.textContent = greetWord();
    paintJesse(user);
    paintRoleSurfaces();
    return user;
  }

  /**
   * Tutors have no hatchling (2026-08-31 ask): a tutor's hub swaps Jesse
   * for the three tutor-tool tiles (Calendly, Meet, Location), which
   * deep-link to the real /tutor dashboard where those boxes already live.
   * Students keep Jesse exactly as before.
   */
  function paintRoleSurfaces() {
    const tutor = (getRole() || 'student') === 'tutor';
    if (jesseNav) jesseNav.hidden = tutor;
    if (tutorTiles) tutorTiles.hidden = !tutor;
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

  /**
   * Jesse's growth curve, driven only by the real handed off learn count
   * (users/{uid}.learnActivityCount, which the /learn page bumps at three
   * genuine moments: a search resolving to a real concept, a real chapter
   * landing on screen, a check question actually answered). Nothing on this
   * side ever invents activity: with no handed off count Jesse shows an
   * unknown state, and a count of 0 is honestly stage 0.
   *
   * Threshold reasoning: one sincere /learn session produces roughly 4 to 8
   * of those events (a search or two, a few chapters, a check answer), so:
   *   stage 0, Hatchling, 0+: brand new, nothing proven yet, still in the
   *     egg.
   *   stage 1, Fledgling, 3+: reachable inside the very first real session;
   *     an early honest win that teaches the mechanic (learning grows him).
   *   stage 2, Student, 10+: a couple of real sessions; earns his glasses.
   *   stage 3, Scholar, 25+: several sessions across days; earns his book.
   *   stage 4, Sage, 60+: a sustained habit over weeks; earns the cap.
   *     Deliberately far out so the top stage means something.
   */
  const JESSE_STAGES = [
    { min: 60, idx: 4, name: 'Sage' },
    { min: 25, idx: 3, name: 'Scholar' },
    { min: 10, idx: 2, name: 'Student' },
    { min: 3, idx: 1, name: 'Fledgling' },
    { min: 0, idx: 0, name: 'Hatchling' },
  ];

  function jesseStageFor(count) {
    return JESSE_STAGES.find((s) => count >= s.min) || JESSE_STAGES[JESSE_STAGES.length - 1];
  }

  /** Honest pet: stage comes only from the real learn count, dash when unknown. */
  function paintJesse(user) {
    if (!jesseBox) return;
    const raw = Number(user?.learnCount);
    const known = Number.isFinite(raw) && raw >= 0;
    const count = known ? Math.floor(raw) : 0;
    const stage = jesseStageFor(count);
    jesseBox.dataset.jesseStage = String(stage.idx);
    if (jesseStageName) jesseStageName.textContent = stage.name;
    if (jesseCountEl) {
      if (known) {
        jesseCountEl.textContent = count === 1 ? '1 learn action' : `${count} learn actions`;
        jesseCountEl.classList.remove('is-unknown');
      } else {
        jesseCountEl.textContent = 'no activity recorded';
        jesseCountEl.classList.add('is-unknown');
      }
    }
    if (jesseNav) {
      jesseNav.setAttribute(
        'aria-label',
        `Tutors and events near you. Real learning on Learn grows Jesse. Jesse is a ${stage.name.toLowerCase()}`
          + (known ? `, from ${count} real learn actions.` : '.'),
      );
    }
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
  // was removed 2026-08-31. The instances concept is dropped from the hub,
  // not just hidden, and "Tutors nearby" now sits where it used to. The
  // catalog itself (ensureCatalog/list) stays: it still backs the Mastery
  // goal-instance picker (paintGoalControls) and mastery readout
  // (paintMastery) just above where the grid used to be. onOpenInstance and
  // onCreateInstance are unused now that their only trigger buttons
  // (`[data-open]` / `[data-create]`) are gone with the grid, kept as
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

  // No-animation path for a real signed-in student handed off from the
  // React app (2026-09-01 ask): the "workspace is starting up..." beat with
  // its icon-diagram fade exists to sell the local demo prototype some
  // theater, a real student who already clicked through two real preference
  // screens does not need another ~2s of manufactured boot time before
  // reaching content that is already loaded.
  function skipBoot() {
    if (!boot) return;
    boot.classList.add('hidden');
    boot.hidden = true;
    if (hub) { hub.hidden = true; hub.classList.add('hidden'); }
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

  // Clicking the Mastery cube goes to Learn, same destination as the
  // Dashboard tab (2026-09-01 ask, replacing the Set Goal picker and
  // "Start your mastery check-in" call button that used to sit around it).
  // The cube already has a slow ambient spin (cubeTurn); this layers one
  // quick full turn on top as click feedback, then navigates once it's
  // played, matching CLICK_SPIN_MS to the CSS animation's own duration.
  // 2026-08-31: a TUTOR's cube goes to their own dashboard (/tutor, the
  // existing React tutor page with Calendly, Meet, Location, and now
  // Events), not to the student Learn experience.
  const CLICK_SPIN_MS = 500;
  masteryNav?.addEventListener('click', () => {
    masteryCube?.classList.add('is-click-spin');
    const dest = (getRole() || 'student') === 'tutor' ? '/tutor' : '/learn';
    window.setTimeout(() => {
      window.location.href = dest;
    }, CLICK_SPIN_MS);
  });

  // Jesse (second pass, 2026-09-02): opens Tutors and events, folded back
  // onto him after one round as a separate "Map" box, one fewer box per the
  // founder. Still hops on click first, purely for delight, same feedback
  // he always had; the class is removed after it plays so every click hops
  // again.
  const JESSE_HOP_MS = 520;
  jesseNav?.addEventListener('click', () => {
    jesseOwl?.classList.add('is-hop');
    window.setTimeout(() => jesseOwl?.classList.remove('is-hop'), JESSE_HOP_MS);
    onMapOpen?.();
  });

  // Raccoon: opens the Resume Helper. Its own dedicated box (was Jesse's
  // click behavior originally, then a separate "Unlock" box for one round),
  // a direct "show mine, hide the other" against Jesse's Map above rather
  // than a shared toggle, since they are two independently reachable
  // destinations, not two faces of one control.
  const resumeNav = hub?.querySelector('[data-hub-resume-nav]');
  resumeNav?.addEventListener('click', () => onResumeOpen?.());

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.hubTab;
      // "Dashboard" is real cross-app navigation to Learn (React app's
      // /learn, the "ask anything -> resolve -> read -> check" experience:
      // real search, real chapters, real sims), not an in-page panel this
      // static shell can render. Desk OS is a separate static page from
      // the React app, so this has to be a full navigation, not a
      // client-side route change. (2026-09-01: was /knowledge-graph, the
      // concept-graph visualization; corrected to /learn, which is the
      // lessons-and-sims screen actually meant here.)
      if (tab === 'dashboard') {
        window.location.href = '/learn';
        return;
      }
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

  async function runAfterAuth(profile, opts) {
    setUser(profile || {});
    if (opts?.skipBoot) {
      skipBoot();
    } else {
      await showBoot();
    }
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
